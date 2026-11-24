import { describe, it, expect } from 'vitest';
import { easeOutCubic, countAt } from './useMotion';

describe('useMotion helpers', () => {
  it('eases from 0 to 1 and clamps outside the range', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // ease-out runs ahead early
  });

  it('counts between two integers, up or down', () => {
    expect(countAt(0, 17, 0)).toBe(0);
    expect(countAt(0, 17, 1)).toBe(17);
    expect(countAt(10, 2, 1)).toBe(2);
    const mid = countAt(0, 100, 0.5);
    expect(Number.isInteger(mid)).toBe(true);
    expect(mid).toBeGreaterThan(50);
  });
});
