// Daily backup: consistent SQLite snapshot + incremental copy of uploads/, keeps `keepDays` of DB snapshots.
// Usage (from server/): npm run backup      env: DB_PATH, UPLOAD_DIR, BACKUP_DIR (default "backups"), BACKUP_KEEP_DAYS
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sqlite from 'node:sqlite';
import { loadConfig, resolveServerPath, SERVER_DIR } from '../src/config.js';

export function resolveBackupOptions(env = process.env) {
  const config = loadConfig(env);
  return {
    dbPath: resolveServerPath(config.dbPath),
    uploadDir: resolveServerPath(config.uploadDir),
    backupDir: resolveServerPath(env.BACKUP_DIR || 'backups'),
    keepDays: Number(env.BACKUP_KEEP_DAYS || 14)
  };
}

export async function runBackup({ dbPath, uploadDir, backupDir, keepDays = 14, now = new Date() }) {
  const dbDir = path.join(backupDir, 'db');
  const upDir = path.join(backupDir, 'uploads');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(upDir, { recursive: true });

  // 1. DB snapshot (safe while the API is running: WAL + online backup)
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const dest = path.join(dbDir, `portal-${stamp}.db`);
  if (fs.existsSync(dest)) fs.rmSync(dest);
  const src = new sqlite.DatabaseSync(dbPath);
  try {
    if (typeof sqlite.backup === 'function') await sqlite.backup(src, dest);
    else src.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    src.close();
  }

  // 2. Uploads: content-addressed (name = sha256), so copy only names not yet in the backup
  let copied = 0;
  if (fs.existsSync(uploadDir)) {
    for (const rel of fs.readdirSync(uploadDir, { recursive: true })) {
      if (rel === 'tmp' || rel.startsWith(`tmp${path.sep}`)) continue; // plan B's in-progress uploads
      const from = path.join(uploadDir, rel);
      if (!fs.statSync(from).isFile()) continue;
      const to = path.join(upDir, rel);
      if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }

  // 3. Keep `keepDays` of DB snapshots
  const cutoff = now.getTime() - keepDays * 86400000;
  const pruned = [];
  for (const name of fs.readdirSync(dbDir)) {
    if (!/^portal-.*\.db$/.test(name)) continue;
    const full = path.join(dbDir, name);
    if (full !== dest && fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full);
      pruned.push(name);
    }
  }
  return { dest, copied, pruned };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const envFile = path.join(SERVER_DIR, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const res = await runBackup(resolveBackupOptions(process.env));
  console.log(`[backup] ${new Date().toISOString()} db=${res.dest} uploadsCopied=${res.copied} pruned=${res.pruned.length}`);
}
