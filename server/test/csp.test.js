import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp } from './helpers.js';

let t;
afterEach(() => t?.app.close());

const headers = async (env = {}) => {
  t = await makeTestApp(env);
  return (await t.app.inject({ method: 'GET', url: '/api/health' })).headers;
};

const csp = async (env) => Object.fromEntries((await headers(env))['content-security-policy'].split(';').map(d => {
  const [name, ...values] = d.trim().split(/\s+/);
  return [name, values];
}));

describe('plain http deploy (COOKIE_SECURE unset)', () => {
  it('does not tell the browser to upgrade /assets to https', async () => {
    expect(await csp()).not.toHaveProperty('upgrade-insecure-requests');
  });
  it('sends no HSTS', async () => {
    expect(await headers()).not.toHaveProperty('strict-transport-security');
  });
});

describe('https deploy (COOKIE_SECURE=true)', () => {
  it('upgrades insecure requests', async () => {
    expect(await csp({ COOKIE_SECURE: 'true' })).toHaveProperty('upgrade-insecure-requests');
  });
  it('sends HSTS', async () => {
    expect(await headers({ COOKIE_SECURE: 'true' })).toHaveProperty('strict-transport-security');
  });
});

describe('content security policy', () => {
  it('lets the browser PUT video chunks to the Drive resumable upload URL', async () => {
    expect((await csp())['connect-src']).toEqual(["'self'", 'https://www.googleapis.com']);
  });
  it('keeps scripts same-origin only', async () => {
    expect((await csp())['script-src']).toEqual(["'self'"]);
  });
});
