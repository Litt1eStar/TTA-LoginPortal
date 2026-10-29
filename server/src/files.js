import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tx } from './db.js';
import { fileTypeFromFile } from 'file-type';
import { httpError } from './errors.js';
import { isValidEntryKey, getEntryRow, ensureRows, nowSec, assertBeforeDeadline } from './entries.js';
import { ALLOWED_EXTENSIONS } from '../../src/data/tracks.js';

export const MAX_FILES_PER_ENTRY = 40;
const KIND = { photo: 0, work: 1 };
const PHOTO_MIMES = new Set(['image/webp', 'image/jpeg', 'image/png']);
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
// Stored/served mime per allowed work extension.
const WORK_MIME = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: PPTX_MIME
};
// What file-type may report for each extension. A pptx is a zip container and is
// often reported as plain application/zip; an old .ppt is a CFB (OLE) container.
const SNIFFED_AS = {
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  ppt: ['application/x-cfb'],
  pptx: [PPTX_MIME, 'application/zip']
};

const badType = () => httpError(415, 'bad_type', 'ไม่รองรับไฟล์ประเภทนี้');
const tooLarge = () => httpError(413, 'too_large', 'ไฟล์มีขนาดใหญ่เกินกำหนด');
const badRequest = (message = 'ข้อมูลไม่ถูกต้อง') => httpError(400, 'bad_request', message);

export const extOf = (name) => {
  const i = String(name).lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i + 1).toLowerCase();
};

export const cleanName = (name) =>
  path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'file';

// Shared by files.js and video.js: valid key, before the deadline, entry not submitted.
// Creates the university's entry rows first if they don't exist yet (files has an FK to them).
export function writableEntry(db, config, universityId, key) {
  if (!isValidEntryKey(key)) throw badRequest();
  assertBeforeDeadline(config);
  ensureRows(db, universityId);
  const row = getEntryRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked', 'ส่งผลงานแล้ว แก้ไขไม่ได้');
  return row;
}

// Move a temp file to its final path. If another upload won the race to the same
// sha256 (rename collision), discard ours and keep the existing blob.
export async function moveIntoPlace(tmpPath, target) {
  try {
    await rename(tmpPath, target);
  } catch (err) {
    if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(err.code)) throw err;
    try {
      await stat(target);
    } catch {
      throw err;
    }
    await rm(tmpPath, { force: true });
  }
}

// Remove uploads/<sha256> files that no files row references. Files younger than
// minAgeMs are skipped so in-flight uploads (blob stored, row not yet inserted) are safe.
export async function sweepOrphanBlobs(db, uploadDir, minAgeMs = 10 * 60 * 1000) {
  const removed = [];
  for (const name of await readdir(uploadDir)) {
    if (!/^[0-9a-f]{64}$/.test(name)) continue;
    const file = path.join(uploadDir, name);
    let st;
    try { st = await stat(file); } catch { continue; }
    if (!st.isFile() || Date.now() - st.mtimeMs < minAgeMs) continue;
    if (db.prepare('SELECT 1 FROM files WHERE sha256 = ? LIMIT 1').get(name)) continue;
    await rm(file, { force: true });
    removed.push(name);
  }
  return removed;
}

// Stream to `dest` while hashing; never holds the whole file in memory.
async function saveStream(source, dest) {
  const hash = createHash('sha256');
  let size = 0;
  const tap = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      size += chunk.length;
      cb(null, chunk);
    }
  });
  await pipeline(source, tap, createWriteStream(dest));
  return { sha256: hash.digest('hex'), size };
}

async function checkType(kind, tmpPath, nameExt) {
  const sniffed = await fileTypeFromFile(tmpPath);
  if (!sniffed) throw badType();
  if (kind === 'photo') {
    if (!PHOTO_MIMES.has(sniffed.mime)) throw badType();
    return { ext: sniffed.ext, mime: sniffed.mime };
  }
  if (!ALLOWED_EXTENSIONS.includes(nameExt)) throw badType();
  if (!SNIFFED_AS[nameExt].includes(sniffed.mime)) throw badType();
  return { ext: nameExt, mime: WORK_MIME[nameExt] };
}

function toRef(kind, fileId, { name, size, ext, mime }) {
  const url = `/api/files/${fileId}`;
  if (kind === 'photo') return { fileId, name, size, ext, mime, dataUrl: url };
  return { id: fileId, fileId, name, size, ext, mime, status: 'done', progress: 100, url };
}

export default async function filesRoutes(app, { db, config }) {
  const uploadDir = path.resolve(config.uploadDir);
  const tmpDir = path.join(uploadDir, 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const blobPath = (sha256) => path.join(uploadDir, sha256);

  // Move the temp file to uploads/<sha256>, unless the same bytes are already stored.
  async function storeBlob(tmpPath, sha256) {
    try {
      await stat(blobPath(sha256));
    } catch {
      await moveIntoPlace(tmpPath, blobPath(sha256));
    }
  }

  app.post('/submissions/:key/files', {
    preHandler: app.requireCoordinator,
    schema: {
      querystring: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { type: 'string', enum: ['photo', 'work'] } }
      }
    }
  }, async (request) => {
    const { key } = request.params;
    const { kind } = request.query;
    const universityId = request.user.universityId;

    writableEntry(db, config, universityId, key);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM files WHERE university_id = ? AND entry_key = ?')
      .get(universityId, key);
    if (n >= MAX_FILES_PER_ENTRY) throw badRequest(`แนบไฟล์ได้สูงสุด ${MAX_FILES_PER_ENTRY} ไฟล์ต่อรายการ`);
    if (!request.isMultipart()) throw badRequest();

    const maxBytes = kind === 'photo' ? config.maxPhotoKB * 1024 : config.maxWorkMB * 1024 * 1024;
    const part = await request.file({ limits: { fileSize: maxBytes } });
    if (!part || part.fieldname !== 'file') throw badRequest();

    const tmpPath = path.join(tmpDir, randomBytes(16).toString('hex'));
    try {
      const { sha256, size } = await saveStream(part.file, tmpPath);
      if (part.file.truncated) throw tooLarge();
      if (size === 0) throw badRequest();
      const name = cleanName(part.filename);
      const { ext, mime } = await checkType(kind, tmpPath, extOf(name));
      await storeBlob(tmpPath, sha256);
      const lastInsertRowid = tx(db, () => {
        const cur = getEntryRow(db, universityId, key);
        if (cur.status === 2) throw httpError(423, 'locked', 'ส่งผลงานแล้ว แก้ไขไม่ได้');
        const { n: count } = db.prepare('SELECT COUNT(*) AS n FROM files WHERE university_id = ? AND entry_key = ?')
          .get(universityId, key);
        if (count >= MAX_FILES_PER_ENTRY) throw badRequest(`แนบไฟล์ได้สูงสุด ${MAX_FILES_PER_ENTRY} ไฟล์ต่อรายการ`);
        return db.prepare(
          `INSERT INTO files (university_id, entry_key, kind, sha256, size, mime, original_name, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(universityId, key, KIND[kind], sha256, size, mime, name, request.user.id, nowSec()).lastInsertRowid;
      });
      return { file: toRef(kind, Number(lastInsertRowid), { name, size, ext, mime }) };
    } finally {
      await rm(tmpPath, { force: true });
    }
  });

  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } }
  };
  const getFileRow = (id) => {
    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    if (!row) throw httpError(404, 'not_found', 'ไม่พบข้อมูล');
    return row;
  };
  const forbidden = () => httpError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึง');

  app.get('/files/:id', { preHandler: app.requireUser, schema: { params: idParams } }, async (request, reply) => {
    const row = getFileRow(request.params.id);
    if (request.user.role !== 'admin' && row.university_id !== request.user.universityId) throw forbidden();
    try {
      await stat(blobPath(row.sha256));
    } catch {
      throw httpError(404, 'not_found', 'ไม่พบข้อมูล');
    }
    const disposition = row.kind === KIND.photo ? 'inline' : 'attachment';
    const strict = (v) => encodeURIComponent(v).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const fallback = row.original_name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
    reply
      .header('content-type', row.mime)
      .header('content-length', row.size)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('content-disposition', `${disposition}; filename="${fallback}"; filename*=UTF-8''${strict(row.original_name)}`);
    return reply.send(createReadStream(blobPath(row.sha256)));
  });

  app.delete('/files/:id', { preHandler: app.requireCoordinator, schema: { params: idParams } }, async (request) => {
    const row = getFileRow(request.params.id);
    if (row.university_id !== request.user.universityId) throw forbidden();
    writableEntry(db, config, row.university_id, row.entry_key);
    db.prepare('DELETE FROM files WHERE id = ?').run(row.id);
    // Orphaned blobs are swept later, so a concurrent upload of the same bytes is never cut off.
    setImmediate(() => {
      sweepOrphanBlobs(db, uploadDir).catch(err => request.log.error({ err }, 'orphan sweep failed'));
    });
    return { ok: true };
  });
}
