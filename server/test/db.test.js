import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, migrate, tx } from '../src/db.js';

const MIGRATION_COUNT = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter(f => /^\d{3}_.*\.sql$/.test(f)).length;
const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);

describe('openDb', () => {
  it('creates the schema in memory', () => {
    const db = openDb(':memory:');
    expect(tables(db)).toEqual(expect.arrayContaining(['files', 'submissions', 'universities', 'users']));
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATION_COUNT);
    expect(db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1);
  });

  it('is idempotent on a file database', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-db-'));
    const file = path.join(dir, 'portal.db');
    const db1 = openDb(file);
    db1.prepare("INSERT INTO universities (code, name) VALUES ('kmutt', 'x')").run();
    expect(db1.prepare('PRAGMA journal_mode').get().journal_mode).toBe('wal');
    db1.close();
    const db2 = openDb(file);
    migrate(db2);
    expect(db2.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(1);
    expect(db2.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATION_COUNT);
    db2.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tx rolls back on error', () => {
    const db = openDb(':memory:');
    expect(() => tx(db, () => {
      db.prepare("INSERT INTO universities (code, name) VALUES ('a', 'a')").run();
      throw new Error('boom');
    })).toThrow('boom');
    expect(db.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(0);
    expect(tx(db, () => 42)).toBe(42);
  });

  it('tx rethrows the original error when ROLLBACK fails', () => {
    const db = openDb(':memory:');
    expect(() => tx(db, () => {
      db.exec('COMMIT');
      throw new Error('original');
    })).toThrow('original');
  });

  it('migrate rejects duplicate migration numbers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-mig-'));
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (x);');
    fs.writeFileSync(path.join(dir, '001_b.sql'), 'CREATE TABLE b (x);');
    const db = openDb(':memory:');
    db.exec('PRAGMA user_version = 0');
    expect(() => migrate(db, dir)).toThrow(/Duplicate migration number 001/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
