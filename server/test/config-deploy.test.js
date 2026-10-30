import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('deploy config', () => {
  it('serves no static files by default', () => {
    const c = loadConfig({});
    expect(c.serveStatic).toBe(false);
    expect(c.staticDir).toBe('../dist');
  });
  it('reads SERVE_STATIC and STATIC_DIR', () => {
    const c = loadConfig({ SERVE_STATIC: 'true', STATIC_DIR: '/app/dist' });
    expect(c.serveStatic).toBe(true);
    expect(c.staticDir).toBe('/app/dist');
  });
});
