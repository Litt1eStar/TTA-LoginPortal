import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { clearUserCache } from '../src/users.js';

const login = (app, username, password) => app.inject({ method: 'POST', url: '/api/login', payload: { username, password } });

describe('POST /api/login', () => {
  it('logs in a coordinator and returns user + 17 submissions', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toEqual({ username: 'kmutt', name: 'ผู้ประสานงาน มจธ.', university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', universityCode: 'kmutt', role: 'coordinator' });
    expect(Object.keys(body.submissions)).toHaveLength(17);
    const cookie = res.cookies.find(c => c.name === 'tta_session');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBe(7 * 24 * 3600);
  });

  it('admin login returns empty submissions', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'admin1', 'pass-admin-1');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { role: 'admin', university: null }, submissions: {} });
  });

  it('wrong password -> 401 bad_credentials', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'wrong');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('bad_credentials');
    expect((await login(app, 'nobody', 'x')).json().error).toBe('bad_credentials');
  });

  it('disabled user -> 401 bad_credentials', async () => {
    const { app, db } = await makeTestApp();
    db.prepare("UPDATE users SET disabled = 1 WHERE username = 'kmutt'").run();
    clearUserCache();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('bad_credentials');
  });

  it('missing fields -> 400 bad_request', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { username: 'kmutt' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('bad_request');
  });

  it('rate limits after 10 attempts per minute', async () => {
    const { app } = await makeTestApp();
    for (let i = 0; i < 10; i++) expect((await login(app, 'kmutt', 'wrong')).statusCode).toBe(401);
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited', message: 'ลองใหม่อีกครั้งในภายหลัง' });
  });
});

describe('login hardening', () => {
  it('rate limit is per IP and username', async () => {
    const { app } = await makeTestApp();
    for (let i = 0; i < 10; i++) await login(app, 'kmutt', 'wrong');
    expect((await login(app, 'kmutt', 'pass-kmutt-1')).statusCode).toBe(429);
    expect((await login(app, 'rmutt', 'pass-rmutt-1')).statusCode).toBe(200);
  });

  it('trims and lowercases the username', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, ' KMUTT ', 'pass-kmutt-1');
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('kmutt');
  });

  it('sets Secure when cookieSecure is true', async () => {
    const { app } = await makeTestApp({ COOKIE_SECURE: 'true' });
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.cookies.find(c => c.name === 'tta_session').secure).toBe(true);
  });

  it('401 for tampered signed cookies', async () => {
    const { app } = await makeTestApp();
    const a = (await loginAs(app, 'kmutt', 'pass-kmutt-1')).split('=')[1];
    const b = (await loginAs(app, 'rmutt', 'pass-rmutt-1')).split('=')[1];
    const sigA = a.slice(a.lastIndexOf('.') + 1);
    const sigB = b.slice(b.lastIndexOf('.') + 1);
    const valueA = a.slice(0, a.lastIndexOf('.'));
    const valueB = b.slice(0, b.lastIndexOf('.'));
    const tampered = [`${valueB}.${sigA}`, `${valueA}.${sigB}`, `3.1.${sigA}`];
    for (const v of tampered) {
      const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: `tta_session=${v}` } });
      expect(res.statusCode).toBe(401);
    }
  });

  it('logout clears the cookie with matching attributes', async () => {
    const { app } = await makeTestApp({ COOKIE_SECURE: 'true' });
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const out = await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } });
    const c = out.cookies.find(x => x.name === 'tta_session');
    expect(c).toMatchObject({ path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  });
});

describe('request guards', () => {
  it('415 for text/plain POST', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const res = await app.inject({ method: 'POST', url: '/api/submissions/clip/submit', headers: { cookie, 'content-type': 'text/plain' }, payload: 'x' });
    expect(res.statusCode).toBe(415);
    expect(res.json().error).toBe('bad_type');
  });

  it('415 for form-urlencoded and multipart outside the files route', async () => {
    const { app } = await makeTestApp();
    for (const ct of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const res = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': ct }, payload: 'a=b' });
      expect(res.statusCode).toBe(415);
    }
  });

  it('bodyless POST to submit and logout still works', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const submit = await app.inject({ method: 'POST', url: '/api/submissions/clip/submit', headers: { cookie } });
    expect(submit.statusCode).not.toBe(415);
    const out = await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);
  });

  it('413 for a body over 1 MB', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ username: 'a', password: 'x'.repeat(1024 * 1024 + 10) }) });
    expect(res.statusCode).toBe(413);
  });
});

describe('GET /api/me', () => {
  it('is not rate limited', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    for (let i = 0; i < 11; i++) expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(200);
  });

  it('401 without a cookie', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('unauthenticated');
  });

  it('401 with a forged (unsigned) cookie', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: 'tta_session=1.0' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns user and submissions with a cookie', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('kmutt');
    expect(Object.keys(res.json().submissions)).toHaveLength(17);
  });

  it('401 once the user is disabled', async () => {
    const { app, db } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    db.prepare("UPDATE users SET disabled = 1 WHERE username = 'kmutt'").run();
    clearUserCache();
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('POST /api/logout', () => {
  it('clears the cookie and invalidates the old one', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const out = await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);
    expect(out.json()).toEqual({ ok: true });
    expect(out.cookies.find(c => c.name === 'tta_session').value).toBe('');
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});

describe('empty JSON body', () => {
  it('json content-type with no body behaves like the body-less case', async () => {
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const headers = { 'content-type': 'application/json', cookie };
    const submit = await app.inject({ method: 'POST', url: '/api/submissions/clip/submit', headers });
    const submitBare = await app.inject({ method: 'POST', url: '/api/submissions/clip/submit', headers: { cookie } });
    expect(submit.statusCode).toBe(submitBare.statusCode);
    expect(submit.statusCode).toBe(422);
    const out = await app.inject({ method: 'POST', url: '/api/logout', headers });
    expect(out.statusCode).toBe(200);
  });

  it('malformed non-empty JSON is still 400', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: '{bad' });
    expect(res.statusCode).toBe(400);
  });
});

describe('login per-IP cap', () => {
  it('30 attempts per minute per IP across different usernames, 429 at the 31st', async () => {
    const { app } = await makeTestApp();
    for (let i = 0; i < 30; i++) expect((await login(app, `user${i}`, 'wrong')).statusCode).toBe(401);
    const res = await login(app, 'user30', 'wrong');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
  }, 60000);
});

describe('server-side session expiry', () => {
  afterEach(() => vi.useRealTimers());
  const sign = (app, v) => `tta_session=${app.signCookie(v)}`;

  it('fresh cookie 200; 3-part value format', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    const c = res.cookies.find(x => x.name === 'tta_session');
    expect(app.unsignCookie(c.value).value).toMatch(/^\d+\.\d+\.\d+$/);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: `tta_session=${c.value}` } });
    expect(me.statusCode).toBe(200);
  });

  it('cookie older than 7 days -> 401, just under -> 200', async () => {
    const { app } = await makeTestApp();
    const now = Math.floor(Date.now() / 1000);
    const get = (v) => app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sign(app, v) } });
    expect((await get(`1.0.${now - 7 * 86400 - 5}`)).statusCode).toBe(401);
    expect((await get(`1.0.${now - 7 * 86400 + 60}`)).statusCode).toBe(200);
  });

  it('expires with the clock moving forward', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { app } = await makeTestApp();
    const cookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    vi.setSystemTime(Date.now() + 8 * 86400 * 1000);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('cookie issued more than 60s in the future -> 401', async () => {
    const { app } = await makeTestApp();
    const now = Math.floor(Date.now() / 1000);
    const get = (v) => app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sign(app, v) } });
    expect((await get(`1.0.${now + 120}`)).statusCode).toBe(401);
    expect((await get(`1.0.${now + 30}`)).statusCode).toBe(200);
  });

  it('old 2-part format is rejected', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sign(app, '1.0') } });
    expect(res.statusCode).toBe(401);
  });
});
