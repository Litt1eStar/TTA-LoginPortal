// Usage (from server/): npm run seed [-- path/to/TTA-portal-accounts.md]
// Stores bcrypt hashes only. Never prints passwords.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { openDb, tx } from '../src/db.js';
import { loadConfig, resolveServerPath, SERVER_DIR } from '../src/config.js';

// Same order as UNIVERSITIES in src/data/referenceData.js (not imported: it uses extensionless imports)
export const UNIVERSITY_CODES = [
  { code: 'kmitl', name: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' },
  { code: 'kmutt', name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' },
  { code: 'kmutnb', name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' },
  { code: 'rmutk', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ' },
  { code: 'rmutsb', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลสุวรรณภูมิ' },
  { code: 'rmutp', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร' },
  { code: 'rmutt', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี' },
  { code: 'rmutl', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา' },
  { code: 'rmutsv', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย' },
  { code: 'rmuti', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน' }
];

const PLACEHOLDER_NAME = '(to fill in)';

// Returns the data rows (array of cell arrays) of the first table after the heading line that starts with `heading`.
function tableAfter(lines, heading) {
  const start = lines.findIndex(l => l.startsWith(heading));
  if (start < 0) return [];
  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) { if (inTable) break; continue; }
    inTable = true;
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
    if (cells.every(c => /^:?-+:?$/.test(c))) continue; // separator row
    rows.push(cells);
  }
  return rows.slice(1); // drop the header row
}

export function parseAccounts(md) {
  const lines = md.split(/\r?\n/);
  const coordinators = tableAfter(lines, '## Coordinators')
    .map(([username, password]) => ({ username, password }));
  const admins = tableAfter(lines, '## Admins')
    .map(([username, password, name]) => ({ username, password, name: !name || name === PLACEHOLDER_NAME ? username : name }));
  return { coordinators, admins };
}

export function validateAccounts({ coordinators }) {
  if (!coordinators.length) throw new Error('No coordinators found in the accounts file (expected a "## Coordinators" table).');
  const codes = new Set(UNIVERSITY_CODES.map(u => u.code));
  const bad = coordinators.filter(c => !codes.has(c.username)).map(c => c.username);
  if (bad.length) throw new Error(`Unknown coordinator username(s) (must be a university code): ${bad.join(', ')}`);
}

export function seed(db, { coordinators, admins }, cost = 12) {
  const upsertUni = db.prepare('INSERT INTO universities (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name');
  const uniId = db.prepare('SELECT id FROM universities WHERE code = ?');
  const upsertUser = db.prepare(`
    INSERT INTO users (username, password_hash, name, university_id, role) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name,
      university_id = excluded.university_id, role = excluded.role,
      session_version = users.session_version + 1`);
  const hashed = [
    ...coordinators.map(c => ({ ...c, role: 0 })),
    ...admins.map(a => ({ ...a, role: 1 }))
  ].map(u => ({ ...u, hash: bcrypt.hashSync(u.password, cost) }));

  tx(db, () => {
    for (const u of UNIVERSITY_CODES) upsertUni.run(u.code, u.name);
    for (const u of hashed) {
      if (u.role === 0) {
        const uni = UNIVERSITY_CODES.find(x => x.code === u.username);
        if (!uni) throw new Error(`Unknown coordinator username (must be a university code): ${u.username}`);
        upsertUser.run(u.username, u.hash, `ผู้ประสานงาน ${uni.name}`, uniId.get(u.username).id, 0);
      } else {
        upsertUser.run(u.username, u.hash, u.name, null, 1);
      }
    }
  });
  return { coordinators: coordinators.length, admins: admins.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const serverDir = SERVER_DIR;
  const file = process.argv[2] || path.resolve(serverDir, '../../data/TTA-portal-accounts.md');
  if (fs.existsSync(path.join(serverDir, '.env'))) process.loadEnvFile(path.join(serverDir, '.env'));
  const config = loadConfig(process.env);
  let accounts;
  try {
    accounts = parseAccounts(fs.readFileSync(file, 'utf8'));
    validateAccounts(accounts);
  } catch (err) {
    console.error(`Seed failed: ${err.message}`);
    process.exit(1);
  }
  const db = openDb(resolveServerPath(config.dbPath));
  const counts = seed(db, accounts);
  db.close();
  console.log(`Seeded 10 universities, ${counts.coordinators} coordinators, ${counts.admins} admins (passwords not shown).`);
}
