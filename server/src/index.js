import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolveServerPath, SERVER_DIR } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { googleSetupProblems } from './drive.js';

// Node ≥ 22.13 reads .env itself when present (process.loadEnvFile)
const envFile = path.join(SERVER_DIR, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig(process.env);
config.dbPath = resolveServerPath(config.dbPath);
config.uploadDir = resolveServerPath(config.uploadDir);
fs.mkdirSync(config.uploadDir, { recursive: true });
const db = openDb(config.dbPath);
const app = buildApp({ db, config, logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' } });
for (const problem of googleSetupProblems(config)) app.log.warn(`[google] ${problem}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await app.close();
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('Shutdown failed:', err);
    process.exit(1);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: process.env.HOST || '127.0.0.1' });
