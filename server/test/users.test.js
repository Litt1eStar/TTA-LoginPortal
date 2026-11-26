import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { getUserById, getUserByUsername, getUserAuth, bumpSessionVersion, clearUserCache, toClientUser } from '../src/users.js';

let db;
beforeEach(() => {
  clearUserCache();
  db = openDb(':memory:');
  db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (1, 'kmutt', 'h', 'ผู้ประสานงาน', 1, 0)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (2, 'admin1', 'h', 'Admin', NULL, 1)").run();
});

describe('users', () => {
  it('getUserById returns a PublicUser', () => {
    expect(getUserById(db, 1)).toEqual({ id: 1, username: 'kmutt', name: 'ผู้ประสานงาน', role: 'coordinator', universityId: 1, university: 'มจธ', universityCode: 'kmutt' });
    expect(getUserById(db, 2)).toEqual({ id: 2, username: 'admin1', name: 'Admin', role: 'admin', universityId: null, university: null, universityCode: null });
    expect(getUserById(db, 99)).toBeNull();
  });

  it('getUserByUsername includes password_hash', () => {
    expect(getUserByUsername(db, 'kmutt').password_hash).toBe('h');
    expect(getUserByUsername(db, 'nobody')).toBeUndefined();
  });

  it('bumpSessionVersion updates the row and the cache', () => {
    expect(getUserAuth(db, 1).sessionVersion).toBe(0);
    bumpSessionVersion(db, 1);
    expect(getUserAuth(db, 1).sessionVersion).toBe(1);
  });

  it('getUserAuth reflects out-of-band DB changes (e.g. seed script or disabling user) immediately', () => {
    expect(getUserAuth(db, 1).sessionVersion).toBe(0);
    db.prepare('UPDATE users SET session_version = 5, disabled = 1 WHERE id = 1').run();
    expect(getUserAuth(db, 1)).toMatchObject({ sessionVersion: 5, disabled: true });
  });

  it('toClientUser keeps only username, name, university, universityCode, role', () => {
    expect(toClientUser(getUserById(db, 1))).toEqual({ username: 'kmutt', name: 'ผู้ประสานงาน', university: 'มจธ', universityCode: 'kmutt', role: 'coordinator' });
  });
});
