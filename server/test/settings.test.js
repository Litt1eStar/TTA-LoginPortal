import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { getSetting, setSetting, deleteSetting, listSettings, deleteSettingsLike } from '../src/settings.js';
import { encrypt, decrypt } from '../src/crypto.js';

const KEY = '11'.repeat(32);

describe('settings table', () => {
  it('is created by migration 002', () => {
    const db = openDb(':memory:');
    expect(db.prepare('PRAGMA user_version').get().user_version).toBeGreaterThanOrEqual(2);
    expect(getSetting(db, 'missing')).toBeNull();
  });

  it('sets, overwrites, lists and deletes values', () => {
    const db = openDb(':memory:');
    setSetting(db, 'drive.folder.kmutt', 'a');
    setSetting(db, 'drive.folder.kmutt', 'b');
    setSetting(db, 'drive.folder.rmutt', 'c');
    setSetting(db, 'google.email', 'x@gmail.com');
    expect(getSetting(db, 'drive.folder.kmutt')).toBe('b');
    expect(listSettings(db, 'drive.folder.').sort()).toEqual(['b', 'c']);
    deleteSetting(db, 'google.email');
    expect(getSetting(db, 'google.email')).toBeNull();
    deleteSettingsLike(db, 'drive.');
    expect(listSettings(db, 'drive.')).toEqual([]);
  });
});

describe('token encryption', () => {
  it('round-trips and never contains the plain text', () => {
    const enc = encrypt('rt-secret-123', KEY);
    expect(enc).not.toContain('rt-secret-123');
    expect(encrypt('rt-secret-123', KEY)).not.toBe(enc); // random IV
    expect(decrypt(enc, KEY)).toBe('rt-secret-123');
  });

  it('fails with the wrong key or a tampered value', () => {
    const enc = encrypt('rt-secret-123', KEY);
    expect(() => decrypt(enc, '22'.repeat(32))).toThrow();
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow();
  });

  it('rejects a key that is not 64 hex characters', () => {
    expect(() => encrypt('x', '')).toThrow(/TOKEN_KEY/);
    expect(() => encrypt('x', 'abc')).toThrow(/TOKEN_KEY/);
  });
});
