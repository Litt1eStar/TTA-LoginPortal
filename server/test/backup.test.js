import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.js';
import { SERVER_DIR } from '../src/config.js';
import { runBackup, resolveBackupOptions } from '../scripts/backup.js';

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-bk-'));
  const dbPath = path.join(dir, 'portal.db');
  const db = openDb(dbPath);
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ.')").run();
  db.close();
  const uploadDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadDir);
  fs.writeFileSync(path.join(uploadDir, 'aaa'), 'one');
  return { dir, dbPath, uploadDir, backupDir: path.join(dir, 'backups') };
}

describe('runBackup', () => {
  it('writes a consistent DB snapshot and copies uploads incrementally', async () => {
    const s = setup();
    const first = await runBackup({ ...s, now: new Date('2026-11-04T19:00:00Z') });
    expect(path.basename(first.dest)).toBe('portal-2026-11-04T19-00-00.db');
    const copy = new DatabaseSync(first.dest);
    expect(copy.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
    expect(copy.prepare('SELECT code FROM universities').get().code).toBe('kmutt');
    copy.close();
    expect(first.copied).toBe(1);
    expect(fs.readFileSync(path.join(s.backupDir, 'uploads', 'aaa'), 'utf8')).toBe('one');

    fs.writeFileSync(path.join(s.uploadDir, 'bbb'), 'two');
    const second = await runBackup({ ...s, now: new Date('2026-11-05T19:00:00Z') });
    expect(second.copied).toBe(1); // only the new file
  });

  it('deletes DB snapshots older than keepDays', async () => {
    const s = setup();
    fs.mkdirSync(path.join(s.backupDir, 'db'), { recursive: true });
    const old = path.join(s.backupDir, 'db', 'portal-2026-10-01T00-00-00.db');
    fs.writeFileSync(old, 'x');
    const oldTime = new Date('2026-10-01T00:00:00Z');
    fs.utimesSync(old, oldTime, oldTime);
    const res = await runBackup({ ...s, keepDays: 14, now: new Date('2026-11-04T00:00:00Z') });
    expect(res.pruned).toEqual(['portal-2026-10-01T00-00-00.db']);
    expect(fs.existsSync(old)).toBe(false);
  });

  it('resolves relative dbPath, uploadDir and backupDir against SERVER_DIR regardless of cwd', () => {
    const opts = resolveBackupOptions({
      DB_PATH: 'data/portal.db',
      UPLOAD_DIR: 'data/uploads',
      BACKUP_DIR: 'backups',
      BACKUP_KEEP_DAYS: '7'
    });
    expect(opts).toEqual({
      dbPath: path.resolve(SERVER_DIR, 'data/portal.db'),
      uploadDir: path.resolve(SERVER_DIR, 'data/uploads'),
      backupDir: path.resolve(SERVER_DIR, 'backups'),
      keepDays: 7
    });
  });
});
