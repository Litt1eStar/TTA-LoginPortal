// Usage (from server/): npm run loadtest      Pass: p99 < 20 ms, 0 non-2xx, 0 errors
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import autocannon from 'autocannon';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { allEntryKeys } from '../src/entries.js';

const CONNECTIONS = 50;
const DURATION = Number(process.env.LOADTEST_SECONDS || 20);
const UNIS = 5;
const KEYS_PER_UNI = CONNECTIONS / UNIS; // 10

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-load-'));
const db = openDb(path.join(dir, 'portal.db'));
const addUni = db.prepare('INSERT INTO universities (id, code, name) VALUES (?, ?, ?)');
const addUser = db.prepare('INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, 0)');
for (let i = 1; i <= UNIS; i++) {
  addUni.run(i, `load${i}`, `มหาวิทยาลัยทดสอบ ${i}`);
  addUser.run(`load${i}`, bcrypt.hashSync(`load-pass-${i}`, 4), `ผู้ทดสอบ ${i}`, i);
}

const config = loadConfig({ NODE_ENV: 'test', DB_PATH: path.join(dir, 'portal.db'), UPLOAD_DIR: path.join(dir, 'uploads') });
const app = buildApp({ db, config });
await app.listen({ port: 0, host: '127.0.0.1' });
const base = `http://127.0.0.1:${app.server.address().port}`;

// Log in each university and read its starting versions
const slots = [];
const keys = allEntryKeys().slice(0, KEYS_PER_UNI);
for (let i = 1; i <= UNIS; i++) {
  const res = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: `load${i}`, password: `load-pass-${i}` }) });
  if (!res.ok) throw new Error(`login load${i}: ${res.status}`);
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('tta_session=')).split(';')[0];
  const { submissions } = await res.json();
  for (const key of keys) slots.push({ cookie, key, version: submissions[key].version });
}

let nextSlot = 0;
const result = await autocannon({
  url: base,
  connections: CONNECTIONS,
  duration: DURATION,
  requests: [{
    method: 'PUT',
    setupRequest(req, context) {
      if (context.slot == null) context.slot = slots[nextSlot++ % slots.length];
      const s = context.slot;
      return {
        ...req,
        path: `/api/submissions/${s.key}`,
        headers: { 'content-type': 'application/json', cookie: s.cookie },
        body: JSON.stringify({ data: { projectName: `load ${s.version}`, summary: 'ทดสอบโหลด '.repeat(20) }, version: s.version })
      };
    },
    onResponse(status, body, context) {
      if (status === 200) context.slot.version = JSON.parse(body).entry.version;
    }
  }]
});

await app.close();
db.close();
fs.rmSync(dir, { recursive: true, force: true });

const p99 = result.latency.p99;
console.log(autocannon.printResult(result));
console.log(`requests=${result.requests.total} p50=${result.latency.p50}ms p99=${p99}ms non2xx=${result.non2xx} errors=${result.errors} timeouts=${result.timeouts}`);
const pass = p99 < 20 && result.non2xx === 0 && result.errors === 0 && result.timeouts === 0;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
