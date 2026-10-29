import { TRACKS, getTrack, entryKey, parseEntryKey, isGrouped } from '../../src/data/tracks.js';
import { emptySubmission } from '../../src/data/seedData.js';
import { tx } from './db.js';

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

function sanitizeMember(m) {
  if (!m || (m.type !== 'advisor' && m.type !== 'student')) return null;
  const out = {
    id: str(m.id, LIMITS.id),
    type: m.type,
    title: str(m.title, LIMITS.short),
    fullName: str(m.fullName, LIMITS.name),
    dept: str(m.dept, LIMITS.name),
    university: str(m.university, LIMITS.name),
    email: str(m.email, LIMITS.name),
    phone: str(m.phone, LIMITS.short),
    source: str(m.source, LIMITS.short),
    photo: sanitizePhoto(m.photo)
  };
  if (m.type === 'student') {
    out.studentId = str(m.studentId, LIMITS.short);
    out.year = str(m.year, 10);
    out.isLeader = m.isLeader === true;
  }
  return out;
}

function sanitizeVideo(v) {
  if (!v || typeof v.driveFileId !== 'string' || !v.driveFileId) return null;
  return { driveFileId: str(v.driveFileId, 200), name: str(v.name, LIMITS.name), size: num(v.size), mime: str(v.mime, 100) };
}

// Keeps only known keys; never trusts status/hash/version/times from the client.
export function sanitizeData(key, data = {}) {
  const track = getTrack(key);
  const maxMembers = track.maxCompetitors + (track.advisorCount || 1);
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    projectName: str(data.projectName, LIMITS.name),
    summary: str(data.summary, LIMITS.text),
    notes: str(data.notes, LIMITS.text),
    members: list(data.members).map(sanitizeMember).filter(Boolean).slice(0, maxMembers),
    files: list(data.files).map(sanitizeFile).filter(Boolean).slice(0, MAX_FILES),
    links: { video: str(data.links?.video, LIMITS.url) },
    video: track.id === 'clip' ? sanitizeVideo(data.video) : null,
    subjectGroup: subjectGroupFor(key)
  };
}

export function rowToEntry(row) {
  return {
    ...JSON.parse(row.data),
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
