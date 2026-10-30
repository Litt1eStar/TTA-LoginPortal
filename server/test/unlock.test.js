import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp } from './helpers.js';
import { listEntries, saveDraft, unlockEntry } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

function forceSubmitted(db, universityId, key) {
  db.prepare("UPDATE submissions SET status = 2, submitted_at = ?, hash = 'abcdefabcdef', version = version + 1 WHERE university_id = ? AND entry_key = ?")
    .run(Math.floor(Date.now() / 1000), universityId, key);
}

describe('unlockEntry', () => {
  it('turns a submitted entry back into a draft and bumps version', async () => {
    ctx = await makeTestApp();
    const { db } = ctx;
    listEntries(db, 1);
    saveDraft(db, 1, 'singing', { projectName: 'เพลง' }, 1);
    forceSubmitted(db, 1, 'singing');
    const before = listEntries(db, 1).singing;
    expect(before.status).toBe('submitted');

    const entry = unlockEntry(db, 1, 'singing');
    expect(entry.status).toBe('draft');
    expect(entry.hash).toBeNull();
    expect(entry.submittedAt).toBeNull();
    expect(entry.version).toBe(before.version + 1);
    expect(entry.projectName).toBe('เพลง');

    const again = saveDraft(db, 1, 'singing', { projectName: 'แก้แล้ว' }, entry.version);
    expect(again.projectName).toBe('แก้แล้ว');
  });

  it('leaves a draft unchanged', async () => {
    ctx = await makeTestApp();
    listEntries(ctx.db, 1);
    const saved = saveDraft(ctx.db, 1, 'clip', { projectName: 'x' }, 1);
    const entry = unlockEntry(ctx.db, 1, 'clip');
    expect(entry.status).toBe('draft');
    expect(entry.version).toBe(saved.version);
  });
});
