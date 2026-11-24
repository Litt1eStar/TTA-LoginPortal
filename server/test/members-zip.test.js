import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { addStoredFile, readZip } from './zip-helpers.js';
import { makeTestApp, loginAs } from './helpers.js';
import { allEntryKeys, listEntries, saveDraft } from '../src/entries.js';

let ctx;
afterEach(async () => { await ctx?.app.close(); });

const stamp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
const nn = (key) => String(allEntryKeys().indexOf(key) + 1).padStart(2, '0');
const base = (m) => ({ title: '', fullName: '', dept: '', university: '', email: '', phone: '', source: 'manual', ...m });
const photo = (fileId) => ({ fileId, name: 'p', size: 1, ext: 'jpg', mime: 'image/jpeg' });

async function download(app) {
  const cookie = await loginAs(app, 'admin1', 'pass-admin-1');
  return app.inject({ method: 'GET', url: '/api/admin/members.zip', headers: { cookie } });
}

describe('admin members.zip', () => {
  it('builds university / entry folders with a CSV and named photos', async () => {
    ctx = await makeTestApp();
    const { db, config, app } = ctx;
    listEntries(db, 1);
    const p1 = addStoredFile(db, config, { universityId: 1, key: 'theory.g0', kind: 0, bytes: Buffer.from('advisor'), mime: 'image/jpeg', name: 'a.jpg' });
    const p2 = addStoredFile(db, config, { universityId: 1, key: 'theory.g0', kind: 0, bytes: Buffer.from('student'), mime: 'image/webp', name: 's.webp' });
    const p3 = addStoredFile(db, config, { universityId: 1, key: 'theory.g0', kind: 0, bytes: Buffer.from('nostudentid'), mime: 'image/png', name: 'x.png' });
    saveDraft(db, 1, 'theory.g0', {
      members: [
        base({ id: 'a1', type: 'advisor', fullName: 'สมชาย ใจดี', email: 'somchai.j@kmutt.ac.th', photo: photo(p1) }),
        base({ id: 's1', type: 'student', role: 'ผู้สอนหลัก', fullName: 'นักศึกษา หนึ่ง', studentId: '67080500203', year: '2', photo: { ...photo(p2), mime: 'image/webp' } }),
        base({ id: 's2', type: 'student', role: 'ผู้ช่วยสอน', fullName: 'นักศึกษา สอง', studentId: '', year: '1', photo: { ...photo(p3), mime: 'image/png' } })
      ]
    }, 1);

    const res = await download(app);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="tta-members-${stamp()}.zip"`);

    const files = await readZip(res.rawPayload);
    const dir = `TTA-members-${stamp()}/Kmutt/${nn('theory.g0')} สอนทฤษฎี - กลุ่มสาขาวิชาไฟฟ้า`;
    expect([...files.keys()].sort()).toEqual([
      `${dir}/ProfileImage_Kmutt_67080500203.webp`,
      `${dir}/ProfileImage_Kmutt_Student02.png`,
      `${dir}/ProfileImage_Kmutt_somchai.j.jpg`,
      `${dir}/รายชื่อสมาชิก.csv`
    ].sort());
    expect(files.get(`${dir}/ProfileImage_Kmutt_somchai.j.jpg`).toString()).toBe('advisor');

    const csv = files.get(`${dir}/รายชื่อสมาชิก.csv`).toString('utf8');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0].endsWith(',ไฟล์รูปถ่าย')).toBe(true);
    expect(lines[1]).toContain('สมชาย ใจดี');
    expect(lines[1]).toContain(',อาจารย์,');
    expect(lines[1].endsWith(',ProfileImage_Kmutt_somchai.j.jpg')).toBe(true);
    expect(lines[2]).toContain(',ผู้สอนหลัก,');
    expect(lines[2].endsWith(',ProfileImage_Kmutt_67080500203.webp')).toBe(true);
    expect(lines[3]).toContain(',ผู้ช่วยสอน,');
  });

  it('exports dance roles, standalone clip folder, and participants folder (P-8)', async () => {
    ctx = await makeTestApp();
    const { db, config, app } = ctx;
    listEntries(db, 1);
    const pDance = addStoredFile(db, config, { universityId: 1, key: 'dance', kind: 0, bytes: Buffer.from('d'), mime: 'image/jpeg', name: 'd.jpg' });
    const pClip = addStoredFile(db, config, { universityId: 1, key: 'clip', kind: 0, bytes: Buffer.from('c'), mime: 'image/jpeg', name: 'c.jpg' });
    const pPart = addStoredFile(db, config, { universityId: 1, key: 'participants', kind: 0, bytes: Buffer.from('p'), mime: 'image/jpeg', name: 'p.jpg' });

    saveDraft(db, 1, 'dance', {
      members: [
        base({ id: 'd1', type: 'student', role: 'นักแสดง', fullName: 'ก', studentId: '101', photo: photo(pDance) }),
        base({ id: 'b1', type: 'student', role: 'Backstage', fullName: 'ข', studentId: '102', photo: photo(pDance) })
      ]
    }, 1);
    saveDraft(db, 1, 'clip', {
      members: [base({ id: 'c1', type: 'student', role: 'ผู้แข่งขัน', isLeader: true, fullName: 'ค', studentId: '201', photo: photo(pClip) })]
    }, 1);
    saveDraft(db, 1, 'participants', {
      members: [base({ id: 'p1', type: 'student', fullName: 'ง', photo: photo(pPart) })]
    }, 1);

    const files = await readZip((await download(app)).rawPayload);
    const root = `TTA-members-${stamp()}/Kmutt`;

    const danceDir = `${root}/${nn('dance')} แดนเซอร์จินตลีลา`;
    const danceCsv = files.get(`${danceDir}/รายชื่อสมาชิก.csv`).toString('utf8');
    expect(danceCsv).toContain(',นักแสดง,');
    expect(danceCsv).toContain(',Backstage,');

    const clipDir = `${root}/${nn('clip')} สื่อสร้างสรรค์`;
    const clipCsv = files.get(`${clipDir}/รายชื่อสมาชิก.csv`).toString('utf8');
    expect(clipCsv).toContain(',การแข่งขันประเภทสื่อสร้างสรรค์,,ฉบับร่าง,ผู้แข่งขัน,ใช่,');

    const partDir = `${root}/${nn('participants')} ผู้เข้าร่วม`;
    expect(files.has(`${partDir}/ProfileImage_Kmutt_Student01.jpg`)).toBe(true);
    const partCsv = files.get(`${partDir}/รายชื่อสมาชิก.csv`).toString('utf8');
    expect(partCsv).toContain(',ผู้เข้าร่วม,,ฉบับร่าง,ผู้เข้าร่วม,,');
  });

  it('uses Advisor01 fallback, skips empty entries and lists missing photos', async () => {
    ctx = await makeTestApp();
    const { db, config, app } = ctx;
    listEntries(db, 2);
    const p = addStoredFile(db, config, { universityId: 2, key: 'robot', kind: 0, bytes: Buffer.from('gone'), mime: 'image/jpeg', name: 'g.jpg' });
    const ok = addStoredFile(db, config, { universityId: 2, key: 'robot', kind: 0, bytes: Buffer.from('here'), mime: 'image/jpeg', name: 'h.jpg' });
    saveDraft(db, 2, 'robot', {
      members: [
        base({ id: 'a1', type: 'advisor', fullName: 'ไม่มีอีเมล', photo: photo(ok) }),
        base({ id: 's1', type: 'student', fullName: 'รูปหาย', studentId: '111', photo: photo(p) }),
        base({ id: 's2', type: 'student', fullName: 'ไม่มีรูป', studentId: '222' })
      ]
    }, 1);
    saveDraft(db, 2, 'pitching', { members: [] }, 1);
    fs.rmSync(path.join(config.uploadDir, db.prepare('SELECT sha256 FROM files WHERE id = ?').get(p).sha256));

    const files = await readZip((await download(app)).rawPayload);
    const root = `TTA-members-${stamp()}`;
    const dir = `${root}/Rmutt/${nn('robot')} Robot`;
    expect([...files.keys()].sort()).toEqual([
      `${dir}/ProfileImage_Rmutt_Advisor01.jpg`,
      `${dir}/รายชื่อสมาชิก.csv`,
      `${root}/_missing.txt`
    ].sort());
    const missing = files.get(`${root}/_missing.txt`).toString('utf8');
    expect(missing).toContain('รูปหาย');
    expect(missing).toContain('ไม่มีรูป');
    const lines = files.get(`${dir}/รายชื่อสมาชิก.csv`).toString('utf8').trim().split('\r\n');
    expect(lines[2].endsWith(',')).toBe(true);
  });

  it('is admin-only', async () => {
    ctx = await makeTestApp();
    const cookie = await loginAs(ctx.app, 'kmutt', 'pass-kmutt-1');
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/members.zip', headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});
