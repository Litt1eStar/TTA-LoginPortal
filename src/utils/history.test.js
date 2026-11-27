import { describe, it, expect } from 'vitest';
import { historyRows } from './history';
import { TRACKS, entryKey } from '../data/tracks';

describe('historyRows', () => {
  it('has one row per entry: every กลุ่มสาขา of a grouped track gets its own row', () => {
    const rows = historyRows({});
    const expected = TRACKS.reduce((n, t) => n + (t.subjectGroups?.length || 1), 0);
    expect(rows).toHaveLength(expected);
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length);
  });

  it('shows an empty entry as not started', () => {
    const row = historyRows({})[0];
    expect(row.isSubmitted).toBe(false);
    expect(row.timestamp).toBe('-');
    expect(row.action).toBe('เริ่มส่ง');
    expect(row.hash).toBeNull();
  });

  it('carries the receipt hash and counts only finished files for a submitted entry', () => {
    const track = TRACKS.find(t => !t.subjectGroups?.length);
    const rows = historyRows({
      [track.id]: {
        status: 'submitted',
        submittedAt: '2026-12-01T10:00:00+07:00',
        hash: 'abc123',
        members: [],
        files: [{ status: 'done' }, { status: 'uploading' }],
        links: { video: 'https://example.com/v' }
      }
    });
    const row = rows.find(r => r.key === track.id);
    expect(row.isSubmitted).toBe(true);
    expect(row.hash).toBe('abc123');
    expect(row.filesCount).toBe(1);
    expect(row.linksCount).toBe(1);
    expect(row.action).toBe('ดูรายละเอียด');
  });

  it('labels a draft of a grouped track with its group and "(ร่าง)"', () => {
    const track = TRACKS.find(t => t.subjectGroups?.length);
    const key = entryKey(track.id, 1);
    const row = historyRows({ [key]: { status: 'draft', draftAt: '2026-12-02T09:00:00+07:00', members: [], files: [] } })
      .find(r => r.key === key);
    expect(row.subtitle).toBe(track.subjectGroups[1]);
    expect(row.timestamp).toMatch(/\(ร่าง\)$/);
    expect(row.action).toBe('แก้ไขต่อ');
  });
});
