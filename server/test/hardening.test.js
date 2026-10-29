import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, GOOD_CODE, FOLDER_MIME } from './fakeGoogle.js';
import { getSetting } from '../src/settings.js';
import { decrypt } from '../src/crypto.js';
import { ROOT_FOLDER_NAME } from '../src/drive.js';

const MB = 1024 * 1024;
const DOWN = 'Google Drive ขัดข้อง กรุณาลองใหม่';
const NOT_CONNECTED = 'ยังไม่ได้เชื่อมต่อ Google Drive';
let t, google, kmutt;
afterEach(() => t?.app.close());

// hook(url, init) returns a Response to override, or undefined to fall through to the fake.
async function setup({ hook, env = GOOGLE_ENV, connect = true } = {}) {
  google = fakeGoogle();
  const fetch = async (input, init = {}) => (hook && (await hook(new URL(String(input)), init))) || google.fetch(input, init);
  t = await makeTestApp(env, { googleFetch: fetch });
  kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
  if (connect) connectDrive(t.db, t.config);
}
const post = (url, body) =>
  t.app.inject({ method: 'POST', url: `/api/submissions/clip/video${url}`, payload: body, headers: { cookie: kmutt } });
const session = () => post('', { name: 'clip.mp4', size: MB, mime: 'video/mp4' });
const del = (id) => t.app.inject({ method: 'DELETE', url: `/api/submissions/clip/video/${id}`, headers: { cookie: kmutt } });
const res = (status, body) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'content-type': 'application/json' } });

describe('error messages', () => {
  it('not connected keeps its own text', async () => {
    await setup({ connect: false });
    const r = await session();
    expect(r.statusCode).toBe(503);
    expect(r.json().message).toBe(NOT_CONNECTED);
  });
  it('Drive 5xx gives 503 with the contract text', async () => {
    await setup({ hook: (u) => u.pathname === '/upload/drive/v3/files' ? res(500) : undefined });
    const r = await session();
    expect(r.statusCode).toBe(503);
    expect(r.json().message).toBe(DOWN);
  });
  it('a throwing fetch gives 503 with the contract text', async () => {
    await setup({ hook: () => { throw new TypeError('fetch failed'); } });
    const r = await session();
    expect(r.statusCode).toBe(503);
    expect(r.json().message).toBe(DOWN);
  });
  it('a non-JSON token response gives 503', async () => {
    await setup({ hook: (u) => u.pathname === '/token' ? new Response('<html>', { status: 200 }) : undefined });
    const r = await session();
    expect(r.statusCode).toBe(503);
    expect(r.json().message).toBe(DOWN);
  });
  it('passes an abort signal to every fetch', async () => {
    const signals = [];
    await setup({ hook: (u, init) => { signals.push(init.signal); } });
    await session();
    expect(signals.length).toBeGreaterThan(1);
    expect(signals.every(s => s instanceof AbortSignal)).toBe(true);
  });
});

describe('confirm never deletes a folder', () => {
  it('university folder id and root id give 422 without a delete call', async () => {
    await setup();
    await session();
    for (const id of [getSetting(t.db, 'drive.folder.kmutt'), getSetting(t.db, 'drive.root_folder')]) {
      const r = await post('/confirm', { driveFileId: id });
      expect(r.statusCode).toBe(422);
      expect(google.files.has(id)).toBe(true);
      expect(google.calls.some(c => c.method === 'DELETE')).toBe(false);
    }
  });
  it('a folder-mime item is never deleted, nor a file under the root', async () => {
    await setup();
    await session();
    const root = getSetting(t.db, 'drive.root_folder');
    google.addFile({ id: 'stray-folder-1', name: 'x', mimeType: FOLDER_MIME, parents: ['elsewhere-000'] });
    google.addFile({ id: 'under-root-001', name: 'x.mp4', size: '1', mimeType: 'video/mp4', parents: [root] });
    expect((await post('/confirm', { driveFileId: 'stray-folder-1' })).statusCode).toBe(422);
    expect((await post('/confirm', { driveFileId: 'under-root-001' })).statusCode).toBe(422);
    expect(google.files.has('stray-folder-1')).toBe(true);
    expect(google.files.has('under-root-001')).toBe(true);
  });
  it('DELETE refuses folders', async () => {
    await setup();
    await session();
    const id = getSetting(t.db, 'drive.folder.kmutt');
    expect((await del(id)).statusCode).toBe(403);
    expect((await del(getSetting(t.db, 'drive.root_folder'))).statusCode).toBe(403);
    expect(google.files.has(id)).toBe(true);
  });
});

describe('OAuth callback failures', () => {
  async function connectFlow() {
    const admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
    const r = await t.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: admin } });
    const state = new URL(r.headers.location).searchParams.get('state');
    const c = r.cookies.find(x => x.name === 'tta_gstate');
    const cookie = `${admin}; tta_gstate=${c.value}`;
    const cb = (code = GOOD_CODE, st = state, ck = cookie) =>
      t.app.inject({ method: 'GET', url: `/api/admin/google/callback?${new URLSearchParams({ code, state: st })}`, headers: { cookie: ck } });
    return { admin, cb };
  }
  it('failed code exchange redirects to google=error', async () => {
    await setup({ connect: false });
    const { cb } = await connectFlow();
    const r = await cb('bad-code');
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe(`${t.config.appOrigin}/admin?google=error`);
    expect(getSetting(t.db, 'google.refresh_token')).toBeNull();
  });
  it('a failure after the token was stored removes the half setup', async () => {
    await setup({ connect: false, hook: (u) => u.pathname === '/drive/v3/files' ? res(500) : undefined });
    const { cb } = await connectFlow();
    const r = await cb();
    expect(r.headers.location).toBe(`${t.config.appOrigin}/admin?google=error`);
    expect(getSetting(t.db, 'google.refresh_token')).toBeNull();
    expect(getSetting(t.db, 'google.email')).toBeNull();
    expect(getSetting(t.db, 'drive.root_folder')).toBeNull();
  });
  it('missing state cookie gives 400', async () => {
    await setup({ connect: false });
    const { admin, cb } = await connectFlow();
    expect((await cb(GOOD_CODE, 'a'.repeat(32), admin)).statusCode).toBe(400);
  });
  it('replaying the state after the callback gives 400', async () => {
    await setup({ connect: false });
    const { cb } = await connectFlow();
    expect((await cb()).headers.location).toContain('google=connected');
    expect((await cb()).statusCode).toBe(400);
  });
  it('a token response without refresh_token errors on first connect, keeps the old one later', async () => {
    const noRt = (u, init) => (u.pathname === '/token' && new URLSearchParams(init.body).get('grant_type') === 'authorization_code')
      ? res(200, { access_token: 'at-code', expires_in: 3599 }) : undefined;
    await setup({ connect: false, hook: noRt });
    let f = await connectFlow();
    expect((await f.cb()).headers.location).toContain('google=error');
    expect(getSetting(t.db, 'google.refresh_token')).toBeNull();
    connectDrive(t.db, t.config);
    const before = getSetting(t.db, 'google.refresh_token');
    f = await connectFlow();
    expect((await f.cb()).headers.location).toContain('google=connected');
    expect(getSetting(t.db, 'google.refresh_token')).toBe(before);
  });
});

describe('confirmed videos only', () => {
  const put = (video, version) => t.app.inject({
    method: 'PUT', url: '/api/submissions/clip', headers: { cookie: kmutt }, payload: { data: { video }, version }
  });
  const ref = { driveFileId: 'vid-ok-0001', name: 'clip.mp4', size: 5, mime: 'video/mp4' };
  it('unconfirmed video is dropped, confirmed one kept, and kept once stored', async () => {
    await setup();
    await session();
    const folder = getSetting(t.db, 'drive.folder.kmutt');
    google.addFile({ id: 'vid-ok-0001', name: 'clip.mp4', size: '5', mimeType: 'video/mp4', parents: [folder] });
    const first = await put(ref, 1);
    expect(first.json().entry.video).toBeNull();
    expect((await post('/confirm', { driveFileId: 'vid-ok-0001' })).statusCode).toBe(200);
    const second = await put(ref, first.json().entry.version);
    expect(second.json().entry.video.driveFileId).toBe('vid-ok-0001');
    const third = await put(ref, second.json().entry.version);
    expect(third.json().entry.video.driveFileId).toBe('vid-ok-0001');
    expect((await del('vid-ok-0001')).statusCode).toBe(200);
    expect(t.db.prepare('SELECT COUNT(*) n FROM video_confirmations').get().n).toBe(0);
  });
});

describe('401 retry', () => {
  it('refreshes once and retries once', async () => {
    let n = 0;
    await setup({ hook: (u) => (u.pathname === '/upload/drive/v3/files' && ++n === 1) ? res(401) : undefined });
    const r = await session();
    expect(r.statusCode).toBe(200);
    expect(google.calls.filter(c => c.url.pathname === '/token').length).toBe(2);
  });
  it('gives up after one retry', async () => {
    await setup({ hook: (u) => u.pathname === '/upload/drive/v3/files' ? res(401) : undefined });
    expect((await session()).statusCode).toBe(503);
  });
  it('stores a rotated refresh token encrypted', async () => {
    await setup({ hook: (u) => u.pathname === '/token'
      ? res(200, { access_token: 'at-rot', expires_in: 3599, refresh_token: 'rotated-rt' }) : undefined });
    await session();
    const stored = getSetting(t.db, 'google.refresh_token');
    expect(stored).not.toContain('rotated-rt');
    expect(decrypt(stored, t.config.tokenKey)).toBe('rotated-rt');
  });
});

describe('stale folder ids', () => {
  const guard = () => (u, init) => {
    if (u.pathname === '/upload/drive/v3/files' || (u.pathname === '/drive/v3/files' && init.method === 'POST')) {
      const parent = JSON.parse(init.body).parents?.[0];
      if (parent && !google.files.has(parent)) return res(404);
    }
  };
  it('recreates a missing university folder and retries', async () => {
    await setup({ hook: guard() });
    await session();
    const old = getSetting(t.db, 'drive.folder.kmutt');
    google.files.delete(old);
    expect((await session()).statusCode).toBe(200);
    expect(getSetting(t.db, 'drive.folder.kmutt')).not.toBe(old);
  });
  it('recreates a missing root as well', async () => {
    await setup({ hook: guard() });
    await session();
    google.files.delete(getSetting(t.db, 'drive.root_folder'));
    google.files.delete(getSetting(t.db, 'drive.folder.kmutt'));
    expect((await session()).statusCode).toBe(200);
    expect(google.foldersNamed(ROOT_FOLDER_NAME).length).toBe(1);
  });
});

describe('deadline', () => {
  it('video session and confirm answer 403 deadline_passed', async () => {
    await setup({ env: { ...GOOGLE_ENV, DEADLINE: '2000-01-01T00:00:00Z' } });
    for (const [url, body] of [['', { name: 'a.mp4', size: 1, mime: 'video/mp4' }], ['/confirm', { driveFileId: 'vid-ok-0001' }]]) {
      const r = await post(url, body);
      expect(r.statusCode).toBe(403);
      expect(r.json().error).toBe('deadline_passed');
    }
  });
});
