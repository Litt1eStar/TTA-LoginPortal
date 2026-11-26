import { describe, it, expect } from 'vitest';
import { publicUrl } from './publicUrl.js';

describe('publicUrl', () => {
  it('prefixes root-relative public files with the base path', () => {
    expect(publicUrl('/assets/ttaa13-logo.png', '/portal/')).toBe('/portal/assets/ttaa13-logo.png');
    expect(publicUrl('/assets/mascots/theory.webp', '/portal')).toBe('/portal/assets/mascots/theory.webp');
  });

  it('leaves paths unchanged at the root base', () => {
    expect(publicUrl('/assets/ttaa13-logo.png', '/')).toBe('/assets/ttaa13-logo.png');
  });

  it('leaves absolute, protocol-relative, data and empty values alone', () => {
    expect(publicUrl('https://x.test/a.png', '/portal/')).toBe('https://x.test/a.png');
    expect(publicUrl('//cdn.test/a.png', '/portal/')).toBe('//cdn.test/a.png');
    expect(publicUrl('data:image/png;base64,AA', '/portal/')).toBe('data:image/png;base64,AA');
    expect(publicUrl(null, '/portal/')).toBe(null);
  });
});
