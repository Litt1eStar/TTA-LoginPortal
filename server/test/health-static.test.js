import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestApp } from './helpers.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function fakeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbCd1234.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'assets', 'ttaa13-logo.png'), 'png');
  return dir;
}

describe('GET /api/health', () => {
  it('is public and reports ok', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe('static frontend', () => {
  it('is off by default: unknown paths give JSON 404', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/dashboard' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('serves index.html for SPA routes, assets with cache headers, JSON 404 under /api', async () => {
    ctx = await makeTestApp({ SERVE_STATIC: 'true', STATIC_DIR: fakeDist() });
    const page = await ctx.app.inject({ method: 'GET', url: '/admin' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.body).toContain('id="root"');
    expect(page.headers['cache-control']).toBe('no-cache');

    const root = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(root.body).toContain('id="root"');

    const js = await ctx.app.inject({ method: 'GET', url: '/assets/index-AbCd1234.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const logo = await ctx.app.inject({ method: 'GET', url: '/assets/ttaa13-logo.png' });
    expect(logo.headers['cache-control']).toBe('public, max-age=3600');

    const api = await ctx.app.inject({ method: 'GET', url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error).toBe('not_found');

    const post = await ctx.app.inject({ method: 'POST', url: '/somewhere', payload: {} });
    expect(post.statusCode).toBe(404);
    expect(post.json().error).toBe('not_found');
  });
});
