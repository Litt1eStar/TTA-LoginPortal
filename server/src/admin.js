import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { getTrack, parseEntryKey } from '../../src/data/tracks.js';
import { getRequirements } from '../../src/utils/requirements.js';
import { httpError } from './errors.js';
import { allEntryKeys, isValidEntryKey, listEntries, unlockEntry } from './entries.js';
import { buildMembersCsv, buildCertificatesCsv } from './csv.js';

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

const entryLabels = (key) => {
  const track = getTrack(key);
  const { groupIdx } = parseEntryKey(key);
  return {
    type: track.category || track.full,
    subType: groupIdx != null ? track.subjectGroups[groupIdx] : (track.category ? track.th : '')
  };
};

export const formatCertName = (title, fullName) =>
  `${String(title || '').trim()}${String(fullName || '').trim()}`;

export const formatCertCompetition = (key) => {
  const track = getTrack(key);
  const { groupIdx } = parseEntryKey(key);
  return groupIdx != null ? `${track.full} (${track.subjectGroups[groupIdx]})` : track.full;
};

// One member → one flat row (includes fields for both admin UI inspection and CSV exports)
function memberRow(uni, entry, key, m, config) {
  const track = getTrack(key);
  const { type, subType } = entryLabels(key);
  const recipientGroup = track.participantsOnly
    ? 'ผู้เข้าร่วม'
    : (m.type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : 'ผู้แข่งขัน');
  return {
    universityId: uni.id,
    universityCode: uni.code,
    university: uni.name,
    entryKey: key,
    trackId: track.id,
    entryStatus: entry.status,
    type,
    subType,
    status: STATUS_TH[entry.status] || entry.status,
    recipientGroup,
    role: m.type === 'advisor' ? 'อาจารย์' : (m.role || 'ผู้แข่งขัน'),
    leader: m.isLeader ? 'ใช่' : '',
    memberId: m.id,
    memberType: m.type,
    title: m.title,
    fullName: m.fullName,
    certName: formatCertName(m.title, m.fullName),
    certCompetition: formatCertCompetition(key),
    dept: m.dept,
    studentId: m.type === 'student' ? m.studentId : '',
    year: m.type === 'student' ? m.year : '',
    email: m.email,
    phone: m.phone,
    hasPhoto: Boolean(m.photo?.fileId || m.photo?.dataUrl),
    photoDataUrl: m.photo?.dataUrl || (m.photo?.fileId ? `/api/files/${m.photo.fileId}` : ''),
    photoUrl: m.photo?.fileId ? `${config.appOrigin}/api/files/${m.photo.fileId}` : '',
    submittedAt: bangkokTime(entry.submittedAt),
    hash: entry.hash || ''
  };
}

const memberSearchText = (r) =>
  [r.certName, r.fullName, r.studentId, r.email, r.phone, r.role, r.certCompetition, r.university, r.dept]
    .map(v => v || '').join(' ').toLowerCase();

export function filterMemberRows(rows, query = {}) {
  const status = String(query.status || '').trim();
  const group = String(query.group || '').trim();
  const universityId = String(query.universityId || '').trim();
  const trackId = String(query.trackId || '').trim();
  const q = String(query.q || '').trim().toLowerCase().slice(0, 200);
  const missingPhoto = query.missingPhoto === '1' || query.missingPhoto === 'true';
  const groupLabel = group === 'competitor'
    ? 'ผู้แข่งขัน'
    : group === 'advisor'
      ? 'อาจารย์ที่ปรึกษา'
      : group === 'participant'
        ? 'ผู้เข้าร่วม'
        : '';

  return rows.filter((r) => {
    if (status && status !== 'all' && r.entryStatus !== status) return false;
    if (groupLabel && r.recipientGroup !== groupLabel) return false;
    if (universityId && universityId !== 'all' && Number(r.universityId) !== Number(universityId)) return false;
    if (trackId && trackId !== 'all' && r.trackId !== trackId && r.entryKey !== trackId) return false;
    if (missingPhoto && r.hasPhoto) return false;
    // Same fields as the admin directory search (src/components/admin/AdminView.jsx, memberSearchText)
    if (q && !memberSearchText(r).includes(q)) return false;
    return true;
  });
}

// One flat row per member, in university → TRACKS order → member order
export function collectMemberRows(db, config) {
  const rows = [];
  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    for (const key of allEntryKeys()) {
      const entry = entries[key];
      for (const m of entry.members || []) rows.push(memberRow(uni, entry, key, m, config));
    }
  }
  return rows;
}

const bangkokStamp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
const uniLabel = (code) => { const c = String(code || ''); return c ? c[0].toUpperCase() + c.slice(1) : 'Uni'; };

// Committee export: TTA-members-YYYYMMDD/<Uni>/<NN entry>/รายชื่อสมาชิก.csv + ProfileImage_<Uni>_<id>.<ext>
export function buildMembersZipPlan(db, config) {
  const root = `TTA-members-${bangkokStamp()}`;
  const fileRow = db.prepare('SELECT id, sha256, mime, original_name FROM files WHERE id = ? AND university_id = ? AND entry_key = ?');
  const keys = allEntryKeys();
  const items = [];
  const missing = [];

  for (const uni of listUniversities(db)) {
    const entries = listEntries(db, uni.id);
    const uniName = uniLabel(uni.code);
    keys.forEach((key, idx) => {
      const entry = entries[key];
      const members = entry.members || [];
      if (!members.length) return;
      const track = getTrack(key);
      const { groupIdx } = parseEntryKey(key);
      const label = `${String(idx + 1).padStart(2, '0')} ${track.th}${groupIdx != null ? ` - ${track.subjectGroups[groupIdx]}` : ''}`;
      const dir = `${root}/${safeName(uniName)}/${safeName(label)}`;
      const used = new Set();
      const counts = { advisor: 0, student: 0 };
      const rows = members.map((m) => {
        const role = m.type === 'advisor' ? 'advisor' : 'student';
        counts[role] += 1;
        const row = { ...memberRow(uni, entry, key, m, config), photoFile: '' };
        const who = `${uni.code}/${key}: ${m.fullName || m.id}`;
        if (!m.photo?.fileId) { missing.push(`${who} (ไม่มีรูปถ่าย)`); return row; }
        const file = fileRow.get(Number(m.photo.fileId), uni.id, key);
        if (!file) { missing.push(`${who} (ไม่พบรูปในฐานข้อมูล)`); return row; }
        const abs = storedFilePath(config, file.sha256);
        if (!fs.existsSync(abs)) { missing.push(`${who} (ไม่พบไฟล์รูปบนดิสก์)`); return row; }
        const fallback = `${role === 'advisor' ? 'Advisor' : 'Student'}${String(counts[role]).padStart(2, '0')}`;
        const raw = role === 'advisor' ? String(m.email || '').split('@')[0] : m.studentId;
        const id = String(raw || '').trim() || fallback;
        const ext = MIME_EXT[file.mime] || path.extname(file.original_name).slice(1) || 'bin';
        const name = uniqueName(used, safeName(`ProfileImage_${uniName}_${id}.${ext}`));
        items.push({ name: `${dir}/${name}`, file: abs });
        row.photoFile = name;
        return row;
      });
      items.push({ name: `${dir}/รายชื่อสมาชิก.csv`, text: buildMembersCsv(rows, [{ header: 'ไฟล์รูปถ่าย', field: 'photoFile' }]) });
    });
  }
  if (missing.length) items.push({ name: `${root}/_missing.txt`, text: missing.join('\r\n') + '\r\n' });
  return items;
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
    const summaries = {};
    const members = [];
    for (const uni of universities) {
      const list = listEntries(db, uni.id);
      entries[uni.id] = {};
      summaries[uni.id] = {};
      for (const key of allEntryKeys()) {
        const e = list[key];
        const listMembers = e.members || [];
        const reqs = getRequirements(getTrack(key), e);
        const failed = reqs.find(r => !r.ok);
        entries[uni.id][key] = { status: e.status, submittedAt: e.submittedAt };
        summaries[uni.id][key] = {
          memberCount: listMembers.length,
          studentCount: listMembers.filter(m => m.type === 'student').length,
          advisorCount: listMembers.filter(m => m.type === 'advisor').length,
          missingPhotoCount: listMembers.filter(m => !m.photo?.fileId && !m.photo?.dataUrl).length,
          ready: !failed,
          firstError: failed?.error || ''
        };
        for (const m of listMembers) members.push(memberRow(uni, e, key, m, config));
      }
    }
    return { universities, entries, summaries, members };
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
    const rows = filterMemberRows(collectMemberRows(db, config), request.query);
    const csv = buildMembersCsv(rows);
    const stamp = bangkokStamp();
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-members-${stamp}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });

  app.get('/api/admin/certificates.csv', pre, async (request, reply) => {
    const rows = filterMemberRows(collectMemberRows(db, config), request.query);
    const csv = buildCertificatesCsv(rows);
    const stamp = bangkokStamp();
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-certificates-${stamp}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });

  const sendZip = (request, reply, items, filename) => {
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
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Cache-Control', 'no-store');
    return reply.send(archive);
  };

  app.get('/api/admin/files.zip', pre, async (request, reply) => {
    const trackId = String(request.query.key || '');
    return sendZip(request, reply, buildZipPlan(db, config, trackId), `tta-${trackId}.zip`);
  });

  app.get('/api/admin/members.zip', pre, async (request, reply) =>
    sendZip(request, reply, buildMembersZipPlan(db, config), `tta-members-${bangkokStamp()}.zip`));
}
