import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { clearUserCache } from '../src/users.js';

export async function makeTestApp(overrides = {}, appOptions = {}) {
  clearUserCache();
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-up-'));
  const config = loadConfig({ NODE_ENV: 'test', UPLOAD_DIR: uploadDir, ...overrides });
  const db = openDb(':memory:');
  db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)').run(1, 'kmutt', 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี');
  db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)').run(2, 'rmutt', 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี');
  const addUser = db.prepare('INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, ?)');
  addUser.run('kmutt', bcrypt.hashSync('pass-kmutt-1', 4), 'ผู้ประสานงาน มจธ.', 1, 0);
  addUser.run('rmutt', bcrypt.hashSync('pass-rmutt-1', 4), 'ผู้ประสานงาน มทร.ธัญบุรี', 2, 0);
  addUser.run('admin1', bcrypt.hashSync('pass-admin-1', 4), 'Admin', null, 1);
  const app = buildApp({ db, config, ...appOptions });
  await app.ready();
  return { app, db, config };
}

export async function loginAs(app, username, password) {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find(c => c.name === 'tta_session');
  return `tta_session=${cookie.value}`;
}
