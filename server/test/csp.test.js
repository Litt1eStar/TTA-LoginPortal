import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp } from './helpers.js';

let t;
afterEach(() => t?.app.close());

const csp = async () => {
  t = await makeTestApp();
  const res = await t.app.inject({ method: 'GET', url: '/api/health' });
  return Object.fromEntries(res.headers['content-security-policy'].split(';').map(d => {
    const [name, ...values] = d.trim().split(/\s+/);
    return [name, values];
  }));
};

describe('content security policy', () => {
  it('lets the browser PUT video chunks to the Drive resumable upload URL', async () => {
    expect((await csp())['connect-src']).toEqual(["'self'", 'https://www.googleapis.com']);
  });
  it('keeps scripts same-origin only', async () => {
    expect((await csp())['script-src']).toEqual(["'self'"]);
  });
});
