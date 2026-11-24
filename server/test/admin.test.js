import { describe, it, expect, afterEach } from 'vitest';
import { makeTestApp, loginAs } from './helpers.js';
import { listEntries, saveDraft } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

const advisor = { id: 'a1', type: 'advisor', title: 'ดร.', fullName: 'สมชาย ใจดี', dept: 'วิศวกรรมไฟฟ้า', university: 'มจธ.', email: 'somchai@kmutt.ac.th', phone: '0812345678', source: 'manual', photo: null };
const student = { id: 's1', type: 'student', title: 'นาย', fullName: '=1+2', dept: 'ครุศาสตร์, ไฟฟ้า', university: 'มจธ.', studentId: '6401234567', year: '3', email: 's@kmutt.ac.th', phone: '0899999999', isLeader: true, source: 'manual', photo: null };

function seedEntries(db) {
  listEntries(db, 1);
  listEntries(db, 2);
  saveDraft(db, 1, 'theory.g0', { projectName: 'โครงการ', members: [advisor, student] }, 1);
  saveDraft(db, 2, 'singing', { members: [{ ...advisor, id: 'a2', fullName: 'สมหญิง ร้องดี' }] }, 1);
  db.prepare("UPDATE submissions SET status = 2, submitted_at = ?, hash = 'abcdefabcdef', version = version + 1 WHERE university_id = 1 AND entry_key = 'theory.g0'")
    .run(Math.floor(Date.parse('2026-11-04T03:15:00Z') / 1000));
}

const ADMIN_ROUTES = [
  ['GET', '/api/admin/overview'],
  ['GET', '/api/admin/submissions/1/theory.g0'],
  ['POST', '/api/admin/submissions/1/theory.g0/unlock'],
  ['GET', '/api/admin/export.csv'],
  ['GET', '/api/admin/files.zip?key=theory']
];

describe('admin access', () => {
  it('gives 403 forbidden to coordinators on every admin route', async () => {
    ctx = await makeTestApp();
    const cookie = await loginAs(ctx.app, 'kmutt', 'pass-kmutt-1');
    for (const [method, url] of ADMIN_ROUTES) {
      const res = await ctx.app.inject({ method, url, headers: { cookie }, payload: method === 'POST' ? {} : undefined });
      expect(res.statusCode, url).toBe(403);
      expect(res.json().error).toBe('forbidden');
    }
  });
  it('gives 401 without a session', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/overview' });
    expect(res.statusCode).toBe(401);
  });
});

describe('admin overview and detail', () => {
  it('lists every university with all 17 keys', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/overview', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.universities.map(u => u.code)).toEqual(['kmutt', 'rmutt']);
    expect(Object.keys(body.entries['1'])).toHaveLength(17);
    expect(body.entries['1']['theory.g0']).toEqual({ status: 'submitted', submittedAt: '2026-11-04T03:15:00.000Z' });
    expect(body.entries['2'].singing.status).toBe('draft');
    expect(body.entries['2'].clip).toEqual({ status: 'not_started', submittedAt: null });
  });

  it('returns one entry, 404 for an unknown university, 400 for a bad key', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const ok = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/1/theory.g0', headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().entry.members).toHaveLength(2);
    const missing = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/99/theory.g0', headers: { cookie } });
    expect(missing.statusCode).toBe(404);
    const bad = await ctx.app.inject({ method: 'GET', url: '/api/admin/submissions/1/theory', headers: { cookie } });
    expect(bad.statusCode).toBe(400);
  });
});

describe('admin unlock', () => {
  it('returns a draft and lets the coordinator save again', async () => {
    ctx = await makeTestApp();
    seedEntries(ctx.db);
    const coord = await loginAs(ctx.app, 'kmutt', 'pass-kmutt-1');
    const admin = await loginAs(ctx.app, 'admin1', 'pass-admin-1');

    const locked = await ctx.app.inject({ method: 'PUT', url: '/api/submissions/theory.g0', headers: { cookie: coord }, payload: { data: { projectName: 'x' }, version: 3 } });
    expect(locked.statusCode).toBe(423);

    const res = await ctx.app.inject({ method: 'POST', url: '/api/admin/submissions/1/theory.g0/unlock', headers: { cookie: admin }, payload: {} });
    expect(res.statusCode).toBe(200);
    const { entry } = res.json();
    expect(entry.status).toBe('draft');
    expect(entry.hash).toBeNull();

    const saved = await ctx.app.inject({ method: 'PUT', url: '/api/submissions/theory.g0', headers: { cookie: coord }, payload: { data: { projectName: 'แก้หลังปลดล็อก', members: [advisor, student] }, version: entry.version } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().entry.projectName).toBe('แก้หลังปลดล็อก');
  });
});

describe('admin export.csv', () => {
  it('has BOM, Thai text, escaped formulas and one row per member', async () => {
    ctx = await makeTestApp({ APP_ORIGIN: 'https://portal.example.ac.th' });
    seedEntries(ctx.db);
    const cookie = await loginAs(ctx.app, 'admin1', 'pass-admin-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/export.csv', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="tta-members-\d{8}\.csv"/);
    expect([...res.rawPayload.subarray(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);

    const text = res.rawPayload.toString('utf8').slice(1);
    const lines = text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1 + 3); // header + 3 members
    expect(lines[1].startsWith('มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี,สอนทฤษฎี,กลุ่มสาขาวิชาไฟฟ้า,ส่งแล้ว,อาจารย์,')).toBe(true);
    expect(lines[1]).toContain(',2026-11-04 10:15:00,abcdefabcdef');
    expect(lines[2]).toContain(",ผู้สอนหลัก,,นาย,'=1+2,คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี,6401234567,3,");
    expect(lines[3]).toContain('มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี,การแข่งขันศิลปวัฒนธรรม,ร้องเพลงลูกทุ่ง,ฉบับร่าง,อาจารย์');
  });
});
