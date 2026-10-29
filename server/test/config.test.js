import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { FINAL_DEADLINE } from '../../src/data/tracks.js';

describe('loadConfig', () => {
  it('has dev defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3001);
    expect(c.dbPath).toBe('data/portal.db');
    expect(c.uploadDir).toBe('data/uploads');
    expect(c.deadline).toBe(FINAL_DEADLINE);
    expect(c.cookieSecure).toBe(false);
    expect(c.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(c.google.redirectUri).toBe('http://localhost:3000/api/admin/google/callback');
    expect(c.appOrigin).toBe('http://localhost:3000');
  });

  it('reads env values', () => {
    const c = loadConfig({ PORT: '4000', COOKIE_SECURE: 'true', DEADLINE: '2030-01-01T00:00:00Z', MAX_WORK_MB: '10' });
    expect(c.port).toBe(4000);
    expect(c.cookieSecure).toBe(true);
    expect(c.deadline).toBe('2030-01-01T00:00:00Z');
    expect(c.maxWorkMB).toBe(10);
  });

  it('parses TRUST_PROXY', () => {
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ TRUST_PROXY: '10.0.0.1' }).trustProxy).toBe('10.0.0.1');
  });

  it('rejects a short secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('accepts a 32-char secret in production', () => {
    const c = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) });
    expect(c.sessionSecret).toBe('x'.repeat(32));
  });
});
