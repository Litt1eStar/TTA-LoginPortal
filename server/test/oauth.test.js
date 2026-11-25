import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { fakeGoogle, connectDrive, GOOGLE_ENV, GOOD_CODE, REFRESH_TOKEN } from './fakeGoogle.js';
import { getSetting, setSetting } from '../src/settings.js';
import { decrypt } from '../src/crypto.js';
import { ROOT_FOLDER_NAME } from '../src/drive.js';

let t, google, admin;
beforeEach(async () => {
  google = fakeGoogle();
  t = await makeTestApp(GOOGLE_ENV, { googleFetch: google.fetch });
  admin = await loginAs(t.app, 'admin1', 'pass-admin-1');
});
afterEach(() => t.app.close());

async function connect() {
  const res = await t.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: admin } });
  const state = new URL(res.headers.location).searchParams.get('state');
  const stateCookie = res.cookies.find(c => c.name === 'tta_gstate');
  return { res, state, cookie: `${admin}; tta_gstate=${stateCookie.value}` };
}
const callback = (qs, cookie) =>
  t.app.inject({ method: 'GET', url: `/api/admin/google/callback?${new URLSearchParams(qs)}`, headers: { cookie } });

describe('Google OAuth', () => {
  it('connect redirects to Google with drive.file, offline access, consent and a state', async () => {
    const { res, state } = await connect();
    expect(res.statusCode).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('client_id')).toBe(GOOGLE_ENV.GOOGLE_CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(t.config.google.redirectUri);
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is admin only', async () => {
    const kmutt = await loginAs(t.app, 'kmutt', 'pass-kmutt-1');
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: kmutt } });
    expect(res.statusCode).toBe(403);
  });

  it('answers 503 when Google env is not set', async () => {
    const bare = await makeTestApp({}, { googleFetch: google.fetch });
    const c = await loginAs(bare.app, 'admin1', 'pass-admin-1');
    const res = await bare.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: c } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('drive_unavailable');
    await bare.app.close();
  });

  it('rejects a state mismatch with 400 and stores nothing', async () => {
    const { cookie } = await connect();
    const res = await callback({ code: GOOD_CODE, state: 'f'.repeat(32) }, cookie);
    expect(res.statusCode).toBe(400);
    expect(getSetting(t.db, 'google.refresh_token')).toBeNull();
    const noCookie = await callback({ code: GOOD_CODE, state: 'f'.repeat(32) }, admin);
    expect(noCookie.statusCode).toBe(400);
  });

  it('callback stores the token encrypted, the email and the root folder, then redirects', async () => {
    const { state, cookie } = await connect();
    const res = await callback({ code: GOOD_CODE, state }, cookie);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${t.config.appOrigin}/admin?google=connected`);

    const stored = getSetting(t.db, 'google.refresh_token');
    expect(stored).not.toBe(REFRESH_TOKEN);
    expect(stored).not.toContain(REFRESH_TOKEN);
    expect(decrypt(stored, t.config.tokenKey)).toBe(REFRESH_TOKEN);
    expect(getSetting(t.db, 'google.email')).toBe('lead@gmail.com');
    expect(google.foldersNamed(ROOT_FOLDER_NAME)).toHaveLength(1);
    expect(getSetting(t.db, 'drive.root_folder')).toBe(google.foldersNamed(ROOT_FOLDER_NAME)[0].id);
  });

  it('a denied consent redirects with google=denied', async () => {
    const { state, cookie } = await connect();
    const res = await callback({ error: 'access_denied', state }, cookie);
    expect(res.headers.location).toBe(`${t.config.appOrigin}/admin?google=denied`);
  });

  it('status reports disconnected, then connected with quota', async () => {
    const get = () => t.app.inject({ method: 'GET', url: '/api/admin/google/status', headers: { cookie: admin } });
    expect((await get()).json()).toEqual({ connected: false, email: null, quota: null, folderUrl: null });
    connectDrive(t.db, t.config);
    expect((await get()).json()).toEqual({
      connected: true, email: 'lead@gmail.com', quota: { limit: 16106127360, usage: 1048576 }, folderUrl: null
    });
  });

  it('status links to the root Drive folder once it exists', async () => {
    connectDrive(t.db, t.config);
    setSetting(t.db, 'drive.root_folder', 'abc_123-XYZ');
    const res = await t.app.inject({ method: 'GET', url: '/api/admin/google/status', headers: { cookie: admin } });
    expect(res.json().folderUrl).toBe('https://drive.google.com/drive/folders/abc_123-XYZ');
  });
});
