import { describe, it, expect } from 'vitest';
import { computeDirection, prefersReducedMotion } from './useSwapTransition';

describe('useSwapTransition helpers', () => {
  it('computes +1 when moving forward and -1 when moving backward', () => {
    expect(computeDirection(0, 1)).toBe(1);
    expect(computeDirection(1, 3)).toBe(1);
    expect(computeDirection(3, 1)).toBe(-1);
    expect(computeDirection(2, 0)).toBe(-1);
  });

  it('defaults to +1 when indices are equal or non-numeric', () => {
    expect(computeDirection(2, 2)).toBe(1);
    expect(computeDirection(undefined, 1)).toBe(1);
    expect(computeDirection(1, null)).toBe(1);
  });

  it('returns false in a Node test environment without matchMedia', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
