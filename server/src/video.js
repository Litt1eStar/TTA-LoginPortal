import { httpError } from './errors.js';
import { writableEntry, extOf, cleanName } from './files.js';
import { FOLDER_MIME_TYPE } from './drive.js';
import { nowSec, getEntryRow, rowToEntry } from './entries.js';
import { getSetting, listSettings } from './settings.js';

const CLIP_KEY = 'clip';
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);
const VIDEO_EXTS = new Set(['mp4', 'mov']);
const DRIVE_ID = '^[A-Za-z0-9_-]{10,200}$';

const badType = () => httpError(415, 'bad_type', 'ไม่รองรับไฟล์ประเภทนี้');
const tooLarge = () => httpError(413, 'too_large', 'ไฟล์มีขนาดใหญ่เกินกำหนด');
const wrongFolder = () => httpError(422, 'incomplete', 'ยังกรอกข้อมูลไม่ครบ', {
  failed: [{ key: 'video', label: 'วิดีโอ', error: 'ไฟล์วิดีโอไม่ได้อยู่ในโฟลเดอร์ของมหาวิทยาลัย กรุณาอัปโหลดใหม่' }]
});

export default async function videoRoutes(app, { db, config, drive }) {
  const isProtectedId = (id) =>
    id === getSetting(db, 'drive.root_folder') || listSettings(db, 'drive.folder.').includes(id);
  const maxBytes = () => config.maxVideoMB * 1024 * 1024;

  app.post('/submissions/clip/video', {
    preHandler: app.requireCoordinator,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'size', 'mime'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          size: { type: 'integer', minimum: 1 },
          mime: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (request) => {
    const { name, size, mime } = request.body;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    if (!VIDEO_MIMES.has(mime) || !VIDEO_EXTS.has(extOf(name))) throw badType();
    if (size > maxBytes()) throw tooLarge();
    const uploadUrl = await drive.createUniversitySession(request.user.universityCode,
      { name: cleanName(name), size, mime });
    return { uploadUrl };
  });

  app.post('/submissions/clip/video/confirm', {
    preHandler: app.requireCoordinator,
    schema: {
      body: {
        type: 'object',
        required: ['driveFileId'],
        additionalProperties: false,
        properties: { driveFileId: { type: 'string', pattern: DRIVE_ID } }
      }
    }
  }, async (request) => {
    const { driveFileId } = request.body;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    const folder = await drive.ensureUniversityFolder(request.user.universityCode);
    const meta = await drive.getFileMeta(driveFileId);
    if (!meta || meta.trashed) throw httpError(404, 'not_found', 'ไม่พบข้อมูล');

    // Folders are never deleted: neither ours (root, university) nor any folder-typed item.
    if (meta.mimeType === FOLDER_MIME_TYPE || isProtectedId(driveFileId)) throw wrongFolder();
    const parents = meta.parents || [];
    if (!parents.includes(folder)) {
      // Delete a stray file only when its parent is neither the root nor any university folder.
      if (!parents.some(isProtectedId)) await drive.deleteFile(driveFileId);
      throw wrongFolder();
    }
    if (!VIDEO_MIMES.has(meta.mimeType) || !VIDEO_EXTS.has(extOf(meta.name))) {
      await drive.deleteFile(driveFileId);
      throw badType();
    }
    const size = Number(meta.size);
    if (!(size > 0) || size > maxBytes()) {
      await drive.deleteFile(driveFileId);
      throw tooLarge();
    }
    const previous = db.prepare('SELECT drive_file_id FROM video_confirmations WHERE university_id = ? AND drive_file_id <> ?')
      .all(request.user.universityId, meta.id);
    for (const old of previous) {
      if (!isProtectedId(old.drive_file_id)) {
        await drive.deleteFile(old.drive_file_id).catch(() => {});
      }
      db.prepare('DELETE FROM video_confirmations WHERE university_id = ? AND drive_file_id = ?')
        .run(request.user.universityId, old.drive_file_id);
    }
    db.prepare('INSERT OR IGNORE INTO video_confirmations (university_id, drive_file_id, created_at) VALUES (?, ?, ?)')
      .run(request.user.universityId, meta.id, nowSec());
    return { video: { driveFileId: meta.id, name: meta.name, size, mime: meta.mimeType } };
  });

  app.delete('/submissions/clip/video/:driveFileId', {
    preHandler: app.requireCoordinator,
    schema: {
      params: {
        type: 'object',
        required: ['driveFileId'],
        properties: { driveFileId: { type: 'string', pattern: DRIVE_ID } }
      }
    }
  }, async (request) => {
    const { driveFileId } = request.params;
    writableEntry(db, config, request.user.universityId, CLIP_KEY);
    const folder = getSetting(db, `drive.folder.${request.user.universityCode}`);
    const meta = await drive.getFileMeta(driveFileId);
    if (meta) {
      if (meta.mimeType === FOLDER_MIME_TYPE || isProtectedId(driveFileId)
        || !folder || !(meta.parents || []).includes(folder)) {
        throw httpError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึง');
      }
      await drive.deleteFile(driveFileId);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM video_confirmations WHERE university_id = ? AND drive_file_id = ?')
        .run(request.user.universityId, driveFileId);
      db.prepare(`UPDATE submissions SET data = json_set(data, '$.video', json('null')), version = version + 1
        WHERE university_id = ? AND entry_key = ? AND status <> 2 AND json_extract(data, '$.video.driveFileId') = ?`)
        .run(request.user.universityId, CLIP_KEY, driveFileId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    const row = getEntryRow(db, request.user.universityId, CLIP_KEY);
    return { ok: true, entry: row ? rowToEntry(row) : null };
  });
}
