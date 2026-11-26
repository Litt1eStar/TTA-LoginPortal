import { TRACKS, getTrack, entryKey, parseEntryKey, isGrouped, trackRoles, defaultRole, usesLeader } from '../../src/data/tracks.js';
import { DEPT_BY_UNIVERSITY, departmentForUniversity } from '../../src/data/referenceData.js';
import { emptySubmission } from '../../src/data/seedData.js';
import { tx } from './db.js';
import crypto from 'node:crypto';
import { getRequirements } from '../../src/utils/requirements.js';
import { httpError } from './errors.js';

const STATUS_NAMES = ['not_started', 'draft', 'submitted'];
const LIMITS = { short: 50, name: 200, text: 2000, url: 500, id: 64 };
const MAX_FILES = 20;

const nowSec = () => Math.floor(Date.now() / 1000);
const iso = (sec) => (sec == null ? null : new Date(sec * 1000).toISOString());
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fileId = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);
const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

const findTrack = (id) => TRACKS.find(t => t.id === id);

export function isValidEntryKey(key) {
  if (typeof key !== 'string') return false;
  const plain = findTrack(key);
  if (plain) return !isGrouped(plain);
  const m = /^([a-z]+)\.g(0|[1-9]\d*)$/.exec(key);
  if (!m) return false;
  const track = findTrack(m[1]);
  return !!track && isGrouped(track) && Number(m[2]) < track.subjectGroups.length;
}

export function allEntryKeys() {
  return TRACKS.flatMap(t => (isGrouped(t) ? t.subjectGroups.map((_, i) => entryKey(t.id, i)) : [t.id]));
}

const subjectGroupFor = (key) => {
  const track = getTrack(key);
  return isGrouped(track) ? track.subjectGroups[parseEntryKey(key).groupIdx] : '';
};

export function blankData(key) {
  const { status, ...rest } = emptySubmission({ subjectGroup: subjectGroupFor(key) });
  return { ...rest, links: { video: '' }, video: null };
}

function sanitizePhoto(p) {
  const id = fileId(p?.fileId);
  if (!id) return null;
  return { fileId: id, name: str(p.name, LIMITS.name), size: num(p.size), ext: str(p.ext, 10), mime: str(p.mime, 100), dataUrl: `/api/files/${id}` };
}

function sanitizeFile(f) {
  const id = fileId(f?.fileId);
  if (!id) return null;
  return { id, fileId: id, name: str(f.name, LIMITS.name), size: num(f.size), ext: str(f.ext, 10), mime: str(f.mime, 100), status: 'done', progress: 100, url: `/api/files/${id}` };
}

function sanitizeMember(m, track, lockedDept = null) {
  if (!m || (m.type !== 'advisor' && m.type !== 'student')) return null;
  if (track.participantsOnly) {
    if (m.type !== 'student') return null;
    return {
      id: str(m.id, LIMITS.id),
      type: 'student',
      title: str(m.title, LIMITS.short),
      fullName: str(m.fullName, LIMITS.name),
      dept: '',
      university: str(m.university, LIMITS.name),
      email: '',
      phone: '',
      source: str(m.source, LIMITS.short),
      photo: sanitizePhoto(m.photo),
      studentId: '',
      year: '',
      role: defaultRole(track),
      isLeader: false
    };
  }
  const out = {
    id: str(m.id, LIMITS.id),
    type: m.type,
    title: str(m.title, LIMITS.short),
    fullName: str(m.fullName, LIMITS.name),
    dept: lockedDept !== null ? lockedDept : (departmentForUniversity(m.university) || str(m.dept, LIMITS.name)),
    university: str(m.university, LIMITS.name),
    email: str(m.email, LIMITS.name),
    phone: str(m.phone, LIMITS.short),
    source: str(m.source, LIMITS.short),
    photo: sanitizePhoto(m.photo)
  };
  if (m.type === 'student') {
    const rawRole = str(m.role, LIMITS.short);
    const roleName = rawRole || defaultRole(track);
    if (!trackRoles(track).some(r => r.name === roleName)) return null;
    out.studentId = str(m.studentId, LIMITS.short);
    out.year = str(m.year, 10);
    out.role = roleName;
    out.isLeader = usesLeader(track) ? m.isLeader === true : false;
  }
  return out;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function sanitizeVideo(v) {
  if (!isObj(v) || typeof v.driveFileId !== 'string' || !v.driveFileId) return null;
  return { driveFileId: str(v.driveFileId, 200), name: str(v.name, LIMITS.name), size: num(v.size), mime: str(v.mime, 100) };
}

function capMembers(members, track) {
  const maxAdvisors = track.advisorCount ?? 1;
  const maxCompetitors = track.maxCompetitors ?? 0;
  const roles = trackRoles(track);
  const roleLimit = new Map(roles.map(r => [r.name, r.max]));
  const backstageRoles = new Set(roles.filter(r => r.group === 'backstage').map(r => r.name));
  const roleCounts = new Map();
  let advisors = 0;
  let students = 0;
  let backstage = 0;
  return members.filter(m => {
    if (m.type === 'advisor') {
      if (advisors >= maxAdvisors) return false;
      advisors += 1;
      return true;
    }
    const cap = roleLimit.get(m.role) ?? 0;
    const cur = roleCounts.get(m.role) || 0;
    const isBackstage = backstageRoles.has(m.role);
    if (students >= maxCompetitors || cur >= cap) return false;
    if (isBackstage && track.backstageCap && backstage >= track.backstageCap) return false;
    students += 1;
    roleCounts.set(m.role, cur + 1);
    if (isBackstage) backstage += 1;
    return true;
  });
}

// Keeps only known keys; never trusts status/hash/version/times from the client.
export function sanitizeData(key, rawData, universityCode = null) {
  const data = isObj(rawData) ? rawData : {};
  const track = getTrack(key);
  const maxMembers = track.maxCompetitors + (track.advisorCount ?? 1);
  const list = (v) => (Array.isArray(v) ? v : []);
  const lockedDept = universityCode ? (DEPT_BY_UNIVERSITY[universityCode] ?? '') : null;
  return {
    projectName: str(data.projectName, LIMITS.name),
    summary: str(data.summary, LIMITS.text),
    notes: str(data.notes, LIMITS.text),
    members: capMembers(list(data.members).slice(0, maxMembers).map(m => sanitizeMember(m, track, lockedDept)).filter(Boolean), track),
    files: list(data.files).map(sanitizeFile).filter(Boolean).slice(0, MAX_FILES),
    links: { video: str(data.links?.video, LIMITS.url) },
    video: track.id === 'clip' ? sanitizeVideo(data.video) : null,
    subjectGroup: subjectGroupFor(key)
  };
}

export function rowToEntry(row) {
  const parsed = JSON.parse(row.data);
  const fallbackRole = defaultRole(getTrack(row.entry_key));
  if (Array.isArray(parsed.members)) {
    parsed.members = parsed.members.map(m => (
      m?.type === 'student' && !m.role ? { ...m, role: fallbackRole } : m
    ));
  }
  return {
    ...parsed,
    status: STATUS_NAMES[row.status],
    draftAt: iso(row.draft_at),
    submittedAt: iso(row.submitted_at),
    hash: row.hash ?? null,
    version: row.version
  };
}

export function getEntryRow(db, universityId, key) {
  return db.prepare('SELECT * FROM submissions WHERE university_id = ? AND entry_key = ?').get(universityId, key);
}

function ensureRows(db, universityId) {
  const have = new Set(db.prepare('SELECT entry_key FROM submissions WHERE university_id = ?').all(universityId).map(r => r.entry_key));
  const missing = allEntryKeys().filter(k => !have.has(k));
  if (!missing.length) return;
  const insert = db.prepare('INSERT OR IGNORE INTO submissions (university_id, entry_key, data) VALUES (?, ?, ?)');
  tx(db, () => {
    for (const key of missing) insert.run(universityId, key, JSON.stringify(blankData(key)));
  });
}

export function listEntries(db, universityId) {
  ensureRows(db, universityId);
  const rows = db.prepare('SELECT * FROM submissions WHERE university_id = ?').all(universityId);
  const byKey = Object.fromEntries(rows.map(r => [r.entry_key, r]));
  const out = {};
  for (const key of allEntryKeys()) out[key] = rowToEntry(byKey[key]);
  return out;
}

export { nowSec, ensureRows };

export function assertBeforeDeadline(config) {
  const deadline = Date.parse(config?.deadline);
  if (Number.isNaN(deadline) || Date.now() > deadline) throw httpError(403, 'deadline_passed');
}

function loadRow(db, universityId, key) {
  ensureRows(db, universityId);
  return getEntryRow(db, universityId, key);
}

export function saveDraft(db, universityId, key, data, version) {
  const row = loadRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked');
  if (row.version !== version) throw httpError(409, 'version_conflict', undefined, { entry: rowToEntry(row) });
  const uni = db.prepare('SELECT code FROM universities WHERE id = ?').get(universityId);
  const clean = sanitizeData(key, data, uni?.code ?? null);
  if (clean.video) {
    const id = clean.video.driveFileId;
    const confirmed = db.prepare('SELECT 1 FROM video_confirmations WHERE university_id = ? AND drive_file_id = ?').get(universityId, id);
    if (!confirmed) {
      const stored = rowToEntry(row).video;
      clean.video = stored?.driveFileId === id ? stored : null; // keep the stored meta, never the client's
    }
  }
  const keptPhotoIds = new Set((clean.members || []).map(m => m.photo?.fileId).filter(Boolean));
  tx(db, () => {
    const res = db.prepare(`
      UPDATE submissions SET data = ?, status = 1, draft_at = ?, version = version + 1
      WHERE university_id = ? AND entry_key = ? AND version = ? AND status <> 2`
    ).run(JSON.stringify(clean), nowSec(), universityId, key, version);
    if (res.changes !== 1) {
      const current = getEntryRow(db, universityId, key);
      if (current.status === 2) throw httpError(423, 'locked');
      throw httpError(409, 'version_conflict', undefined, { entry: rowToEntry(current) });
    }
    const existingPhotos = db.prepare('SELECT id FROM files WHERE university_id = ? AND entry_key = ? AND kind = 0').all(universityId, key);
    const delStmt = db.prepare('DELETE FROM files WHERE id = ?');
    for (const f of existingPhotos) {
      if (!keptPhotoIds.has(f.id)) delStmt.run(f.id);
    }
  });
  return rowToEntry(getEntryRow(db, universityId, key));
}

const FILES_LABEL = 'ไฟล์แนบไม่ถูกต้อง';

function missingFileRefs(db, universityId, key, entry) {
  const refs = [
    ...(entry.members || []).map(m => m.photo?.fileId).filter(Boolean).map(id => [id, 0]),
    ...(entry.files || []).map(f => [f.fileId, 1])
  ];
  if (!refs.length) return false;
  const kinds = new Map(db.prepare('SELECT id, kind FROM files WHERE university_id = ? AND entry_key = ?').all(universityId, key).map(r => [r.id, r.kind]));
  return refs.some(([id, kind]) => kinds.get(id) !== kind);
}

export function submitEntry(db, universityId, key) {
  const row = loadRow(db, universityId, key);
  if (row.status === 2) throw httpError(423, 'locked');
  const entry = rowToEntry(row);
  const failed = getRequirements(getTrack(key), entry)
    .filter(r => !r.ok)
    .map(r => ({ key: r.key, label: r.label, error: r.error }));
  if (!failed.length && missingFileRefs(db, universityId, key, entry)) {
    failed.push({ key: 'files', label: FILES_LABEL, error: FILES_LABEL });
  }
  if (failed.length) throw httpError(422, 'incomplete', undefined, { failed });
  const hash = crypto.randomBytes(6).toString('hex');
  const res = db.prepare(`
    UPDATE submissions SET status = 2, submitted_at = ?, hash = ?, version = version + 1
    WHERE university_id = ? AND entry_key = ? AND status <> 2`
  ).run(nowSec(), hash, universityId, key);
  if (res.changes !== 1) throw httpError(423, 'locked');
  return rowToEntry(getEntryRow(db, universityId, key));
}

// Admin only: a submitted entry goes back to draft. The version is bumped so a coordinator tab
// still holding the submitted copy reloads before it can save.
export function unlockEntry(db, universityId, key) {
  ensureRows(db, universityId);
  const row = getEntryRow(db, universityId, key);
  if (!row) throw httpError(404, 'not_found');
  if (row.status === 2) {
    db.prepare(`
      UPDATE submissions SET status = 1, submitted_at = NULL, hash = NULL, draft_at = ?, version = version + 1
      WHERE university_id = ? AND entry_key = ? AND status = 2`
    ).run(nowSec(), universityId, key);
  }
  return rowToEntry(getEntryRow(db, universityId, key));
}
