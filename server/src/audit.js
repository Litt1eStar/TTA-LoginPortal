import { nowSec } from './entries.js';
import { csvCell } from './csv.js';

const FIELD_LABELS = {
  projectName: 'ชื่อผลงาน',
  summary: 'บทคัดย่อ/แนวคิด',
  notes: 'หมายเหตุ',
  'links.video': 'ลิงก์วิดีโอ'
};

const MEMBER_FIELDS = ['type', 'title', 'fullName', 'studentId', 'year', 'role', 'email', 'phone', 'dept', 'isLeader', 'photoFileId'];

function memberFieldValue(m, field) {
  if (!m) return null;
  if (field === 'photoFileId') return m.photo?.fileId ?? null;
  if (field === 'isLeader') return Boolean(m.isLeader);
  return m[field] ?? '';
}

function summarizeMember(m) {
  return {
    id: m.id || '',
    type: m.type || 'student',
    title: m.title || '',
    fullName: m.fullName || '',
    studentId: m.studentId || '',
    role: m.role || '',
    isLeader: Boolean(m.isLeader)
  };
}

export function diffEntryData(beforeEntry = {}, afterEntry = {}) {
  const before = beforeEntry || {};
  const after = afterEntry || {};

  const scalarPairs = [
    ['projectName', String(before.projectName ?? ''), String(after.projectName ?? '')],
    ['summary', String(before.summary ?? ''), String(after.summary ?? '')],
    ['notes', String(before.notes ?? ''), String(after.notes ?? '')],
    ['links.video', String(before.links?.video ?? ''), String(after.links?.video ?? '')]
  ];

  const fields = [];
  for (const [field, bVal, aVal] of scalarPairs) {
    if (bVal !== aVal) fields.push({ field, before: bVal, after: aVal });
  }

  const beforeMembers = Array.isArray(before.members) ? before.members : [];
  const afterMembers = Array.isArray(after.members) ? after.members : [];
  const keyForMember = (m, idx) => (m?.id ? String(m.id) : `${m?.type || 'm'}:${m?.fullName || ''}:${idx}`);
  const beforeById = new Map(beforeMembers.filter(Boolean).map((m, i) => [keyForMember(m, i), m]));
  const afterById = new Map(afterMembers.filter(Boolean).map((m, i) => [keyForMember(m, i), m]));

  const membersAdded = [];
  const membersRemoved = [];
  const membersUpdated = [];

  for (const [id, am] of afterById.entries()) {
    const bm = beforeById.get(id);
    if (!bm) {
      membersAdded.push(summarizeMember(am));
    } else {
      const changes = [];
      for (const field of MEMBER_FIELDS) {
        const bVal = memberFieldValue(bm, field);
        const aVal = memberFieldValue(am, field);
        if (bVal !== aVal) changes.push({ field, before: bVal, after: aVal });
      }
      if (changes.length > 0) {
        membersUpdated.push({
          id,
          fullName: am.fullName || bm.fullName || '',
          changes
        });
      }
    }
  }

  for (const [id, bm] of beforeById.entries()) {
    if (!afterById.has(id)) {
      membersRemoved.push(summarizeMember(bm));
    }
  }

  const beforeFiles = Array.isArray(before.files) ? before.files : [];
  const afterFiles = Array.isArray(after.files) ? after.files : [];
  const beforeFileById = new Map(beforeFiles.filter(f => f?.fileId).map(f => [f.fileId, f]));
  const afterFileById = new Map(afterFiles.filter(f => f?.fileId).map(f => [f.fileId, f]));

  const filesAdded = [];
  const filesRemoved = [];
  for (const [fid, af] of afterFileById.entries()) {
    if (!beforeFileById.has(fid)) {
      filesAdded.push({ fileId: fid, name: af.name || '', size: af.size || 0 });
    }
  }
  for (const [fid, bf] of beforeFileById.entries()) {
    if (!afterFileById.has(fid)) {
      filesRemoved.push({ fileId: fid, name: bf.name || '', size: bf.size || 0 });
    }
  }

  const bVid = before.video?.driveFileId
    ? { driveFileId: before.video.driveFileId, name: before.video.name || '', size: before.video.size || 0, mime: before.video.mime || '' }
    : null;
  const aVid = after.video?.driveFileId
    ? { driveFileId: after.video.driveFileId, name: after.video.name || '', size: after.video.size || 0, mime: after.video.mime || '' }
    : null;
  const videoChanged = (bVid?.driveFileId ?? null) !== (aVid?.driveFileId ?? null)
    ? { before: bVid, after: aVid }
    : null;

  const hasChanges = Boolean(
    fields.length ||
    membersAdded.length ||
    membersRemoved.length ||
    membersUpdated.length ||
    filesAdded.length ||
    filesRemoved.length ||
    videoChanged
  );

  return {
    hasChanges,
    fields,
    membersAdded,
    membersRemoved,
    membersUpdated,
    filesAdded,
    filesRemoved,
    videoChanged
  };
}

export function summarizeDraftDiff(key, diff, previousStatus = 1) {
  const parts = [];
  if (previousStatus === 0 && !diff?.hasChanges) {
    return `เริ่มสร้างฉบับร่าง ${key}`;
  }
  if (diff?.fields?.length) {
    const names = diff.fields.map(f => FIELD_LABELS[f.field] || f.field).join(', ');
    parts.push(`แก้ไขข้อมูล (${names})`);
  }
  if (diff?.membersAdded?.length) parts.push(`เพิ่มสมาชิก ${diff.membersAdded.length} คน`);
  if (diff?.membersUpdated?.length) parts.push(`แก้ไขสมาชิก ${diff.membersUpdated.length} คน`);
  if (diff?.membersRemoved?.length) parts.push(`ลบสมาชิก ${diff.membersRemoved.length} คน`);
  if (diff?.filesAdded?.length) parts.push(`แนบไฟล์เพิ่ม ${diff.filesAdded.length} ไฟล์`);
  if (diff?.filesRemoved?.length) parts.push(`ลบไฟล์แนบ ${diff.filesRemoved.length} ไฟล์`);
  if (diff?.videoChanged) parts.push(diff.videoChanged.after ? 'เปลี่ยนไฟล์วิดีโอ' : 'ลบไฟล์วิดีโอ');

  const detail = parts.length ? `: ${parts.join(', ')}` : '';
  return `บันทึกฉบับร่าง ${key}${detail}`;
}

export function writeAuditLog(db, opts = {}) {
  try {
    const actor = opts.user || opts.request?.user || {};
    const userId = actor.id ?? null;
    const username = String(actor.username || 'anonymous').slice(0, 100);
    const userRole = String(actor.role || 'anonymous').slice(0, 30);
    const universityId = opts.universityId !== undefined ? opts.universityId : (actor.universityId ?? null);
    let universityCode = opts.universityCode !== undefined ? opts.universityCode : (actor.universityCode ?? null);
    if (!universityCode && universityId) {
      const uni = db.prepare('SELECT code FROM universities WHERE id = ?').get(universityId);
      universityCode = uni?.code ?? null;
    }
    const action = String(opts.action || 'unknown');
    const entryKey = opts.entryKey ?? null;
    const targetId = opts.targetId != null ? String(opts.targetId) : null;
    const status = opts.status === 'error' ? 'error' : 'ok';
    const errorCode = opts.errorCode ?? null;
    const ip = opts.ip ?? opts.request?.ip ?? null;
    const rawUa = opts.userAgent ?? opts.request?.headers?.['user-agent'] ?? '';
    const userAgent = rawUa ? String(rawUa).slice(0, 300) : null;
    const summary = String(opts.summary || action).slice(0, 500);
    const detailsJson = JSON.stringify(opts.details ?? {});

    const res = db.prepare(`
      INSERT INTO audit_logs (
        created_at, user_id, username, user_role, university_id, university_code,
        action, entry_key, target_id, status, error_code, ip, user_agent, summary, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nowSec(), userId, username, userRole, universityId, universityCode,
      action, entryKey, targetId, status, errorCode, ip, userAgent, summary, detailsJson
    );
    return Number(res.lastInsertRowid);
  } catch {
    return null;
  }
}

function rowToAuditLog(row) {
  let details = {};
  try {
    details = row.details ? JSON.parse(row.details) : {};
  } catch {
    details = {};
  }
  return {
    id: row.id,
    createdAt: new Date(row.created_at * 1000).toISOString(),
    userId: row.user_id ?? null,
    username: row.username,
    userRole: row.user_role,
    universityId: row.university_id ?? null,
    universityCode: row.university_code ?? null,
    universityName: row.university_name ?? null,
    action: row.action,
    entryKey: row.entry_key ?? null,
    targetId: row.target_id ?? null,
    status: row.status,
    errorCode: row.error_code ?? null,
    ip: row.ip ?? null,
    userAgent: row.user_agent ?? null,
    summary: row.summary,
    details
  };
}

export function getAuditLogById(db, id) {
  const row = db.prepare(`
    SELECT a.*, un.name AS university_name
    FROM audit_logs a
    LEFT JOIN universities un ON un.id = a.university_id
    WHERE a.id = ?
  `).get(id);
  return row ? rowToAuditLog(row) : null;
}

export function queryAuditLogs(db, filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.universityId !== undefined && filters.universityId !== '') {
    const uid = Number(filters.universityId);
    if (Number.isSafeInteger(uid)) {
      clauses.push('a.university_id = ?');
      params.push(uid);
    }
  }
  if (filters.action) {
    const act = String(filters.action).trim();
    if (act.endsWith('.')) {
      clauses.push('a.action LIKE ?');
      params.push(`${act}%`);
    } else {
      clauses.push('a.action = ?');
      params.push(act);
    }
  }
  if (filters.status === 'ok' || filters.status === 'error') {
    clauses.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.role) {
    clauses.push('a.user_role = ?');
    params.push(String(filters.role).trim());
  }
  if (filters.entryKey) {
    clauses.push('a.entry_key = ?');
    params.push(String(filters.entryKey).trim());
  }
  if (filters.beforeId) {
    const bid = Number(filters.beforeId);
    if (Number.isSafeInteger(bid) && bid > 0) {
      clauses.push('a.id < ?');
      params.push(bid);
    }
  }
  if (filters.from) {
    const ts = Date.parse(filters.from);
    if (!Number.isNaN(ts)) {
      clauses.push('a.created_at >= ?');
      params.push(Math.floor(ts / 1000));
    }
  }
  if (filters.to) {
    const ts = Date.parse(filters.to);
    if (!Number.isNaN(ts)) {
      clauses.push('a.created_at <= ?');
      params.push(Math.floor(ts / 1000));
    }
  }
  if (filters.q && String(filters.q).trim()) {
    const pattern = `%${String(filters.q).trim().toLowerCase()}%`;
    clauses.push(`(
      LOWER(a.username) LIKE ? OR
      LOWER(a.summary) LIKE ? OR
      LOWER(COALESCE(a.entry_key, '')) LIKE ? OR
      LOWER(COALESCE(a.university_code, '')) LIKE ? OR
      LOWER(COALESCE(a.ip, '')) LIKE ? OR
      LOWER(COALESCE(a.error_code, '')) LIKE ? OR
      LOWER(COALESCE(a.target_id, '')) LIKE ?
    )`);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rawLimit = Number(filters.limit);
  const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 100;
  const rawOffset = Number(filters.offset);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs a ${whereSql}`).get(...params);
  const statsRow = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
      SUM(CASE WHEN action = 'submission.submit' AND status = 'ok' THEN 1 ELSE 0 END) AS submits,
      SUM(CASE WHEN action = 'submission.save_draft' AND status = 'ok' THEN 1 ELSE 0 END) AS saves
    FROM audit_logs
  `).get();

  const rows = db.prepare(`
    SELECT a.*, un.name AS university_name
    FROM audit_logs a
    LEFT JOIN universities un ON un.id = a.university_id
    ${whereSql}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    logs: rows.map(rowToAuditLog),
    total: totalRow?.n ?? 0,
    stats: {
      total: statsRow?.total ?? 0,
      errors: statsRow?.errors ?? 0,
      submits: statsRow?.submits ?? 0,
      saves: statsRow?.saves ?? 0
    }
  };
}

export const AUDIT_CSV_HEADERS = [
  'ID', 'วันเวลา (เวลาไทย)', 'ผู้ใช้งาน', 'บทบาท', 'มหาวิทยาลัย',
  'การกระทำ', 'รายการแข่งขัน', 'สถานะ', 'รหัสข้อผิดพลาด', 'IP Address', 'รายละเอียดสรุป'
];

const formatThaiTime = (isoStr) => {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' });
  } catch {
    return String(isoStr);
  }
};

export function buildAuditLogsCsv(rows = []) {
  const lines = [AUDIT_CSV_HEADERS.map(csvCell).join(',')];
  for (const r of rows) {
    const uniLabel = r.universityCode ? `${r.universityCode.toUpperCase()}${r.universityName ? ` (${r.universityName})` : ''}` : '';
    const cells = [
      r.id,
      formatThaiTime(r.createdAt),
      r.username,
      r.userRole,
      uniLabel,
      r.action,
      r.entryKey || '',
      r.status,
      r.errorCode || '',
      r.ip || '',
      r.summary
    ];
    lines.push(cells.map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
