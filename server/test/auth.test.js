import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { clearUserCache } from '../src/users.js';

const login = (app, username, password) => app.inject({ method: 'POST', url: '/api/login', payload: { username, password } });

describe('POST /api/login', () => {
  it('logs in a coordinator and returns user + 17 submissions', async () => {
    const { app } = await makeTestApp();
    const res = await login(app, 'kmutt', 'pass-kmutt-1');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toEqual({ username: 'kmutt', name: 'ผู้ประสานงาน มจธ.', university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี', role: 'coordinator' });
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

describe('GET /api/me', () => {
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
