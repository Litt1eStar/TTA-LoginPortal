import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestApp, loginAs } from './helpers.js';
import { loadConfig } from '../src/config.js';
import { fakeGoogle, GOOGLE_ENV, GOOD_CODE } from './fakeGoogle.js';

// KMUTT: the Landing Page owns https://tta2027.kmutt.ac.th/ and nginx forwards /portal/... (unchanged)
// and /api/... to this server. BASE_PATH=/portal lets the server answer under that prefix.

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function fakeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbCd1234.js'), 'console.log(1)');
  return dir;
}

describe('BASE_PATH config', () => {
  it('defaults to no prefix', () => {
    expect(loadConfig({}).basePath).toBe('');
  });
  it('is normalised to a leading slash and no trailing slash', () => {
    expect(loadConfig({ BASE_PATH: '/portal' }).basePath).toBe('/portal');
    expect(loadConfig({ BASE_PATH: 'portal/' }).basePath).toBe('/portal');
    expect(loadConfig({ BASE_PATH: '/' }).basePath).toBe('');
  });
});

describe('serving under BASE_PATH=/portal', () => {
  const env = () => ({ BASE_PATH: '/portal', SERVE_STATIC: 'true', STATIC_DIR: fakeDist() });

  it('answers the API with and without the prefix', async () => {
    ctx = await makeTestApp(env());
    for (const url of ['/portal/api/health', '/api/health']) {
      const res = await ctx.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.json().ok).toBe(true);
    }
  });

  it('serves the app pages and assets under the prefix', async () => {
    ctx = await makeTestApp(env());
    for (const url of ['/portal', '/portal/', '/portal/dashboard', '/portal/admin?google=connected']) {
      const res = await ctx.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain('id="root"');
    }
    const js = await ctx.app.inject({ method: 'GET', url: '/portal/assets/index-AbCd1234.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('logs in through the prefixed API', async () => {
    ctx = await makeTestApp(env());
    const res = await ctx.app.inject({ method: 'POST', url: '/portal/api/login', payload: { username: 'kmutt', password: 'pass-kmutt-1' } });
    expect(res.statusCode).toBe(200);
  });

  it('keeps JSON 404s under the prefixed API', async () => {
    ctx = await makeTestApp(env());
    const res = await ctx.app.inject({ method: 'GET', url: '/portal/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('does not strip look-alike paths', async () => {
    ctx = await makeTestApp({ BASE_PATH: '/portal' });
    const res = await ctx.app.inject({ method: 'GET', url: '/portalx/api/health' });
    expect(res.statusCode).toBe(404);
  });

  it('sends the Google Drive callback back to /portal/admin', async () => {
    const google = fakeGoogle();
    ctx = await makeTestApp({ ...GOOGLE_ENV, BASE_PATH: '/portal' }, { googleFetch: google.fetch });
    const admin = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const start = await ctx.app.inject({ method: 'GET', url: '/api/admin/google/connect', headers: { cookie: admin } });
    const state = new URL(start.headers.location).searchParams.get('state');
    const gstate = start.cookies.find(c => c.name === 'tta_gstate').value;
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/google/callback?${new URLSearchParams({ code: GOOD_CODE, state })}`,
      headers: { cookie: `${admin}; tta_gstate=${gstate}` }
    });
    expect(res.headers.location).toBe(`${ctx.config.appOrigin}/portal/admin?google=connected`);
  });
});

describe('without BASE_PATH (default)', () => {
  it('does not answer under /portal', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/portal/api/health' });
    expect(res.statusCode).toBe(404);
  });
});
