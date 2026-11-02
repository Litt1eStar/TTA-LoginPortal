import { describe, it, expect } from 'vitest';
import { deadlineState } from './formatters';

const DAY = 86400000;
const now = Date.parse('2026-11-02T00:00:00Z');
const at = (ms) => new Date(now + ms).toISOString();

describe('deadlineState', () => {
  it('is closed once the deadline has passed', () => {
    expect(deadlineState(at(-3 * DAY), now)).toEqual({ closed: true, soon: false, label: 'ปิดรับแล้ว' });
    expect(deadlineState(at(0), now).closed).toBe(true);
  });

  it('warns in the last 3 days', () => {
    expect(deadlineState(at(2 * DAY + 1000), now)).toEqual({ closed: false, soon: true, label: 'อีก 2 วัน' });
    expect(deadlineState(at(3600 * 1000), now).label).toBe('ปิดรับวันนี้');
  });

  it('is calm further out', () => {
    expect(deadlineState(at(10 * DAY + 1000), now)).toEqual({ closed: false, soon: false, label: 'อีก 10 วัน' });
  });

  it('handles a missing deadline', () => {
    expect(deadlineState(null, now).closed).toBe(false);
  });
});
