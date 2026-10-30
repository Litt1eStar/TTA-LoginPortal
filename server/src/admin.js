import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { getTrack, parseEntryKey } from '../../src/data/tracks.js';
import { httpError } from './errors.js';
import { allEntryKeys, isValidEntryKey, listEntries, unlockEntry } from './entries.js';
import { buildMembersCsv } from './csv.js';

const STATUS_TH = { submitted: 'ส่งแล้ว', draft: 'ฉบับร่าง', not_started: 'ยังไม่เริ่ม' };

const MIME_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

// Uploads are content-addressed: <uploadDir>/<sha256> (plan B)
export const storedFilePath = (config, sha256) => path.resolve(config.uploadDir, sha256);

// Epoch/ISO → "YYYY-MM-DD HH:mm:ss" in Thai time, which Excel reads as a date
const bangkokTime = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }) : '');

const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 100) || 'file';

function uniqueName(used, wanted) {
  if (!used.has(wanted)) { used.add(wanted); return wanted; }
  const dot = wanted.lastIndexOf('.');
  const [base, ext] = dot > wanted.lastIndexOf('/') ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const name = `${base}-${n}${ext}`;
  used.add(name);
  return name;
}

function listUniversities(db) {
  return db.prepare('SELECT id, code, name FROM universities ORDER BY id').all().map(u => ({ id: u.id, code: u.code, name: u.name }));
}

function findUniversity(db, rawId) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) throw httpError(400, 'bad_request');
  const u = db.prepare('SELECT id, code, name FROM universities WHERE id = ?').get(id);
  if (!u) throw httpError(404, 'not_found');
  return { id: u.id, code: u.code, name: u.name };
}

function checkKey(key) {
  if (!isValidEntryKey(key)) throw httpError(400, 'bad_request');
  return key;
}

// One flat row per member, in university → TRACKS order → member order
export function collectMemberRows(db, config) {
  const rows = [];
  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    for (const key of allEntryKeys()) {
      const entry = entries[key];
      const track = getTrack(key);
      const { groupIdx } = parseEntryKey(key);
      const type = track.category || track.full;
      const subType = groupIdx != null ? track.subjectGroups[groupIdx] : (track.category ? track.th : '');
      for (const m of entry.members || []) {
        rows.push({
          university: uni.name,
          type,
          subType,
          status: STATUS_TH[entry.status] || entry.status,
          role: m.type === 'advisor' ? 'อาจารย์' : 'ผู้แข่งขัน',
          leader: m.isLeader ? 'ใช่' : '',
          title: m.title,
          fullName: m.fullName,
          dept: m.dept,
          studentId: m.type === 'student' ? m.studentId : '',
          year: m.type === 'student' ? m.year : '',
          email: m.email,
          phone: m.phone,
          photoUrl: m.photo?.fileId ? `${config.appOrigin}/api/files/${m.photo.fileId}` : '',
          submittedAt: bangkokTime(entry.submittedAt),
          hash: entry.hash || ''
        });
      }
    }
  }
  return rows;
}

// Items for the zip of one track: { name, file } (path on disk) or { name, text }
export function buildZipPlan(db, config, trackId) {
  const keys = allEntryKeys().filter(k => parseEntryKey(k).trackId === trackId);
  if (!keys.length) throw httpError(400, 'bad_request');
  const fileRow = db.prepare('SELECT id, sha256, mime, original_name FROM files WHERE id = ? AND university_id = ? AND entry_key = ?');
  const items = [];
  const missing = [];

  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    for (const key of keys) {
      const entry = entries[key];
      const base = `${uni.code}/${key}`;
      const used = new Set();

      const add = (fileId, folder, makeName) => {
        const row = fileRow.get(Number(fileId), uni.id, key);
        if (!row) { missing.push(`${base}: fileId ${fileId} (ไม่พบในฐานข้อมูล)`); return; }
        const abs = storedFilePath(config, row.sha256);
        if (!fs.existsSync(abs)) { missing.push(`${base}: ${row.original_name} (ไม่พบไฟล์บนดิสก์)`); return; }
        const ext = MIME_EXT[row.mime] || path.extname(row.original_name).slice(1) || 'bin';
        items.push({ name: uniqueName(used, `${base}/${folder}/${makeName(row, ext)}`), file: abs });
      };

      (entry.members || []).forEach((m, i) => {
        if (m.photo?.fileId) add(m.photo.fileId, 'photos', (_row, ext) => `${String(i + 1).padStart(2, '0')}-${safeName(m.fullName || m.id)}.${ext}`);
      });
      (entry.files || []).forEach(f => add(f.fileId, 'files', (row) => safeName(row.original_name)));

      if (getTrack(key).id === 'clip') {
        const lines = [];
        if (entry.video?.driveFileId) lines.push(`Google Drive: https://drive.google.com/file/d/${entry.video.driveFileId}/view  (${entry.video.name})`);
        if (entry.links?.video) lines.push(`YouTube: ${entry.links.video}`);
        if (lines.length) items.push({ name: `${base}/links.txt`, text: lines.join('\r\n') + '\r\n' });
      }
    }
  }
  if (missing.length) items.push({ name: '_missing.txt', text: missing.join('\r\n') + '\r\n' });
  return items;
}

export default async function adminPlugin(app, { db, config }) {
  const pre = { preHandler: app.requireAdmin };

  app.get('/api/admin/overview', pre, async () => {
    const universities = listUniversities(db);
    const entries = {};
    for (const uni of universities) {
      const list = listEntries(db, uni.id);
      entries[uni.id] = Object.fromEntries(
        Object.entries(list).map(([key, e]) => [key, { status: e.status, submittedAt: e.submittedAt }])
      );
    }
    return { universities, entries };
  });

  app.get('/api/admin/submissions/:universityId/:key', pre, async (request) => {
    const uni = findUniversity(db, request.params.universityId);
    const key = checkKey(request.params.key);
    return { entry: listEntries(db, uni.id)[key] };
  });

  app.post('/api/admin/submissions/:universityId/:key/unlock', pre, async (request) => {
    const uni = findUniversity(db, request.params.universityId);
    const key = checkKey(request.params.key);
    const entry = unlockEntry(db, uni.id, key);
    request.log.info({ admin: request.user.username, universityId: uni.id, key }, 'entry unlocked');
    return { entry };
  });

  app.get('/api/admin/export.csv', pre, async (request, reply) => {
    const csv = buildMembersCsv(collectMemberRows(db, config));
    const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-members-${stamp}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });

  app.get('/api/admin/files.zip', pre, async (request, reply) => {
    const trackId = String(request.query.key || '');
    const items = buildZipPlan(db, config, trackId);
    // Photos, PDFs and zips are already compressed: level 1 keeps CPU low
    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.on('warning', err => request.log.warn(err));
    archive.on('error', err => request.log.error(err));
    for (const item of items) {
      if (item.file) archive.file(item.file, { name: item.name });
      else archive.append(item.text, { name: item.name });
    }
    Promise.resolve(archive.finalize()).catch(err => request.log.error(err));
    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="tta-${trackId}.zip"`)
      .header('Cache-Control', 'no-store');
    return reply.send(archive);
  });
}
