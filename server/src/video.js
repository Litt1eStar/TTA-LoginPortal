import { httpError } from './errors.js';
import { writableEntry, extOf, cleanName } from './files.js';
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
    const parent = await drive.ensureUniversityFolder(request.user.universityCode);
    const uploadUrl = await drive.createResumableSession({ name: cleanName(name), size, mime, parent });
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

    const parents = meta.parents || [];
    if (!parents.includes(folder)) {
      // Never delete a file that sits in another university's folder: the id may be theirs.
      const inOtherUniversity = listSettings(db, 'drive.folder.').some(id => parents.includes(id));
      if (!inOtherUniversity) await drive.deleteFile(driveFileId);
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
    if (!meta) return { ok: true }; // already gone
    if (!folder || !(meta.parents || []).includes(folder)) {
      throw httpError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึง');
    }
    await drive.deleteFile(driveFileId);
    return { ok: true };
  });
}
