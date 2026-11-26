import { httpError } from './errors.js';
import { cleanName } from './files.js';
import { FOLDER_MIME_TYPE, TEST_FOLDER_KEY } from './drive.js';
import { getSetting } from './settings.js';

// Admin page "test Google Drive upload". Everything happens in one test folder (TTA2027/_ทดสอบอัปโหลด):
//  - browser -> Drive: POST /session, the browser PUTs the file to Drive, POST /confirm (as the clip video)
//  - server  -> Drive: POST /server (as the member photo sync)
//  - DELETE /:id removes a test file, and nothing outside the test folder.

const DRIVE_ID = '^[A-Za-z0-9_-]{10,200}$';

const folderUrl = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
const fileUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const fileView = (meta) => ({
  id: meta.id, name: meta.name, size: Number(meta.size) || 0, mimeType: meta.mimeType, url: fileUrl(meta.id)
});

export default async function driveTestRoutes(app, { db, config, drive }) {
  const testFolder = () => getSetting(db, TEST_FOLDER_KEY);
  const inTestFolder = (meta) =>
    meta.mimeType !== FOLDER_MIME_TYPE && Boolean(testFolder()) && (meta.parents || []).includes(testFolder());

  app.post('/admin/drive-test/session', {
    preHandler: app.requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'size'],
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
    if (size > config.maxVideoMB * 1024 * 1024) throw httpError(413, 'too_large');
    const uploadUrl = await drive.createTestSession({
      name: cleanName(name), size, mime: mime || 'application/octet-stream'
    });
    return { uploadUrl, folderUrl: folderUrl(testFolder()) };
  });

  app.post('/admin/drive-test/confirm', {
    preHandler: app.requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['driveFileId', 'size'],
        additionalProperties: false,
        properties: {
          driveFileId: { type: 'string', pattern: DRIVE_ID },
          size: { type: 'integer', minimum: 1 }
        }
      }
    }
  }, async (request) => {
    const { driveFileId, size } = request.body;
    const meta = await drive.getFileMeta(driveFileId);
    if (!meta || meta.trashed) throw httpError(404, 'not_found', 'ไม่พบไฟล์ทดสอบใน Google Drive');
    if (!inTestFolder(meta)) throw httpError(403, 'forbidden', 'ไฟล์นี้ไม่ได้อยู่ในโฟลเดอร์ทดสอบ');
    if (Number(meta.size) !== size) {
      throw httpError(422, 'incomplete',
        `ขนาดไฟล์ใน Google Drive (${Number(meta.size) || 0} ไบต์) ไม่ตรงกับไฟล์ที่ส่ง (${size} ไบต์)`);
    }
    return { file: fileView(meta), folderUrl: folderUrl(testFolder()) };
  });

  app.post('/admin/drive-test/server', { preHandler: app.requireAdmin }, async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bytes = Buffer.from(`TTA 2027 portal: server -> Google Drive upload test, ${new Date().toISOString()}\n`, 'utf8');
    const uploaded = await drive.uploadTestFile({ name: `server-test-${stamp}.txt`, mime: 'text/plain', bytes });
    return { file: fileView({ ...uploaded, size: uploaded.size ?? bytes.length }), folderUrl: folderUrl(testFolder()) };
  });

  app.delete('/admin/drive-test/:driveFileId', {
    preHandler: app.requireAdmin,
    schema: {
      params: {
        type: 'object',
        required: ['driveFileId'],
        properties: { driveFileId: { type: 'string', pattern: DRIVE_ID } }
      }
    }
  }, async (request) => {
    const meta = await drive.getFileMeta(request.params.driveFileId);
    if (meta) {
      if (!inTestFolder(meta)) throw httpError(403, 'forbidden', 'ลบได้เฉพาะไฟล์ในโฟลเดอร์ทดสอบ');
      await drive.deleteFile(meta.id);
    }
    return { ok: true };
  });
}
