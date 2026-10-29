import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

// Runs fn inside BEGIN/COMMIT; rolls back and rethrows on error. Not re-entrant.
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Applies every migrations/NNN_*.sql whose number is above PRAGMA user_version.
export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const n = Number(file.slice(0, 3));
    if (n <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    tx(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${n}`);
    });
  }
}

export function openDb(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}
