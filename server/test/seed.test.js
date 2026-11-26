import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { openDb } from '../src/db.js';
import { UNIVERSITY_CODES, parseAccounts, seed } from '../scripts/seed.js';

const MD = `# accounts

## Coordinators

| Username | Password | University |
|---|---|---|
| kmitl | test-pass-a | สจล. สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง |
| kmutt | test-pass-b | มจธ. มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี |

## Admins (committee)

Some text.

| Username | Password | Name |
|---|---|---|
| admin1 | test-pass-c | (to fill in) |
| admin2 | test-pass-d | สมศรี |
`;

describe('seed', () => {
  it('lists 10 universities in UNIVERSITIES order', () => {
    expect(UNIVERSITY_CODES.map(u => u.code)).toEqual(['kmitl', 'kmutt', 'kmutnb', 'rmutk', 'rmutsb', 'rmutp', 'rmutt', 'rmutl', 'rmutsv', 'rmuti']);
    expect(UNIVERSITY_CODES[1].name).toBe('มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี');
  });

  it('parses both tables', () => {
    const a = parseAccounts(MD);
    expect(a.coordinators).toEqual([{ username: 'kmitl', password: 'test-pass-a' }, { username: 'kmutt', password: 'test-pass-b' }]);
    expect(a.admins).toEqual([{ username: 'admin1', password: 'test-pass-c', name: 'admin1' }, { username: 'admin2', password: 'test-pass-d', name: 'สมศรี' }]);
  });

  it('seeds universities and users, idempotently', () => {
    const db = openDb(':memory:');
    seed(db, parseAccounts(MD), 4);
    seed(db, parseAccounts(MD), 4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM universities').get().n).toBe(10);
    const k = db.prepare("SELECT u.*, un.code FROM users u JOIN universities un ON un.id = u.university_id WHERE username = 'kmutt'").get();
    expect(k.code).toBe('kmutt');
    expect(k.role).toBe(0);
    expect(bcrypt.compareSync('test-pass-b', k.password_hash)).toBe(true);
    const admin = db.prepare("SELECT * FROM users WHERE username = 'admin2'").get();
    expect(admin).toMatchObject({ role: 1, university_id: null, name: 'สมศรี' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(4);
  });

  it('rejects an unknown coordinator username', () => {
    const db = openDb(':memory:');
    expect(() => seed(db, { coordinators: [{ username: 'xyz', password: 'p' }], admins: [] }, 4)).toThrow(/xyz/);
  });

  it('bumps session_version when re-seeding an existing user so old sessions are revoked', () => {
    const db = openDb(':memory:');
    seed(db, parseAccounts(MD), 4);
    const v1 = db.prepare("SELECT session_version FROM users WHERE username = 'kmutt'").get().session_version;
    seed(db, parseAccounts(MD), 4);
    const v2 = db.prepare("SELECT session_version FROM users WHERE username = 'kmutt'").get().session_version;
    expect(v2).toBe(v1 + 1);
  });
});

import { validateAccounts } from '../scripts/seed.js';

describe('seed parsing strictness', () => {
  it('ignores a leading BOM and CRLF line endings', () => {
    const a = parseAccounts('\uFEFF' + MD.replace(/\n/g, '\r\n'));
    expect(a.coordinators).toHaveLength(2);
    expect(a.admins).toHaveLength(2);
  });

  it('validateAccounts rejects zero coordinators', () => {
    expect(() => validateAccounts({ coordinators: [], admins: [] })).toThrow(/no coordinators/i);
  });

  it('validateAccounts rejects unknown coordinator usernames', () => {
    expect(() => validateAccounts({ coordinators: [{ username: 'nope', password: 'p' }], admins: [] })).toThrow(/nope/);
  });

  it('validateAccounts accepts valid accounts', () => {
    expect(() => validateAccounts(parseAccounts(MD))).not.toThrow();
  });
});
