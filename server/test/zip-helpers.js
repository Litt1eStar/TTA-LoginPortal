import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yauzl from 'yauzl';

export function addStoredFile(db, config, { universityId, key, kind, bytes, mime, name }) {
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, sha), bytes);
  const userId = db.prepare("SELECT id FROM users WHERE username = 'kmutt'").get().id;
  const r = db.prepare('INSERT INTO files (university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(universityId, key, kind, sha, bytes.length, mime, name, userId, Math.floor(Date.now() / 1000));
  return Number(r.lastInsertRowid);
}

export function readZip(buffer) {
  return new Promise((resolve, reject) => {
    const out = new Map();
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', () => resolve(out));
      zip.on('entry', (entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e) return reject(e);
          const chunks = [];
          stream.on('data', c => chunks.push(c));
          stream.on('end', () => { out.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}
