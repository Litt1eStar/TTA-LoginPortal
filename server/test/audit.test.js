import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/db.js';
import { diffEntryData, summarizeDraftDiff, writeAuditLog, queryAuditLogs, getAuditLogById, buildAuditLogsCsv } from '../src/audit.js';
import { blankData } from '../src/entries.js';
import { makeTestApp, loginAs } from './helpers.js';

describe('diffEntryData', () => {
  it('detects no changes on identical entries', () => {
    const a = blankData('theory.g0');
    const b = blankData('theory.g0');
    const diff = diffEntryData(a, b);
    expect(diff.hasChanges).toBe(false);
  });

  it('detects project field changes, member additions/updates/removals, file changes, and video changes', () => {
    const before = {
      ...blankData('clip'),
      projectName: 'เดิม',
      members: [
        { id: 'm1', type: 'student', title: 'นาย', fullName: 'ก', studentId: '111', role: 'ผู้แข่งขัน', isLeader: true, photo: null },
        { id: 'm2', type: 'student', title: 'นางสาว', fullName: 'ข', studentId: '222', role: 'ผู้แข่งขัน', isLeader: false, photo: null }
      ],
      files: [{ fileId: 10, name: 'old.pdf', size: 100 }]
    };
    const after = {
      ...blankData('clip'),
      projectName: 'ใหม่',
      links: { video: 'https://youtu.be/123' },
      members: [
        { id: 'm1', type: 'student', title: 'นาย', fullName: 'ก แก้ชื่อ', studentId: '111', role: 'ผู้แข่งขัน', isLeader: true, photo: { fileId: 55, name: 'p.webp' } },
        { id: 'm3', type: 'advisor', title: 'ดร.', fullName: 'ค', studentId: '', role: 'อาจารย์', isLeader: false, photo: null }
      ],
      files: [{ fileId: 11, name: 'new.pdf', size: 200 }],
      video: { driveFileId: 'drv1', name: 'v.mp4', size: 999, mime: 'video/mp4' }
    };
    const diff = diffEntryData(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.fields).toEqual([
      { field: 'projectName', before: 'เดิม', after: 'ใหม่' },
      { field: 'links.video', before: '', after: 'https://youtu.be/123' }
    ]);
    expect(diff.membersAdded).toMatchObject([{ id: 'm3', fullName: 'ค' }]);
    expect(diff.membersRemoved).toMatchObject([{ id: 'm2', fullName: 'ข' }]);
    expect(diff.membersUpdated).toHaveLength(1);
    expect(diff.membersUpdated[0].id).toBe('m1');
    expect(diff.membersUpdated[0].changes).toEqual([
      { field: 'fullName', before: 'ก', after: 'ก แก้ชื่อ' },
      { field: 'photoFileId', before: null, after: 55 }
    ]);
    expect(diff.filesAdded).toEqual([{ fileId: 11, name: 'new.pdf', size: 200 }]);
    expect(diff.filesRemoved).toEqual([{ fileId: 10, name: 'old.pdf', size: 100 }]);
    expect(diff.videoChanged).toEqual({
      before: null,
      after: { driveFileId: 'drv1', name: 'v.mp4', size: 999, mime: 'video/mp4' }
    });
    expect(summarizeDraftDiff('clip', diff, 1)).toContain('clip');
  });
});

describe('writeAuditLog and queryAuditLogs', () => {
  let db;
  beforeEach(() => {
    db = openDb(':memory:');
    db.prepare("INSERT INTO universities (id, code, name) VALUES (1, 'kmutt', 'มจธ.')").run();
    db.prepare("INSERT INTO users (id, username, password_hash, name, university_id, role) VALUES (1, 'kmutt', 'h', 'ผู้ประสานงาน มจธ.', 1, 0)").run();
  });

  it('inserts and filters audit logs and exports formula-safe CSV', () => {
    const id1 = writeAuditLog(db, {
      user: { id: 1, username: 'kmutt', role: 'coordinator', universityId: 1, universityCode: 'kmutt' },
      action: 'submission.submit',
      entryKey: 'theory.g0',
      status: 'ok',
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      summary: 'ส่งผลงาน theory.g0 (รหัสอ้างอิง abc123def456)',
      details: { hash: 'abc123def456' }
    });
    writeAuditLog(db, {
      user: { id: null, username: '=cmd()', role: 'anonymous' },
      action: 'auth.login_failed',
      status: 'error',
      errorCode: 'bad_credentials',
      ip: '10.0.0.2',
      summary: 'เข้าสู่ระบบไม่สำเร็จ',
      details: { attemptedUsername: '=cmd()' }
    });

    const all = queryAuditLogs(db, {});
    expect(all.total).toBe(2);
    expect(all.stats).toEqual({ total: 2, errors: 1, submits: 1, saves: 0 });

    const onlyUni1 = queryAuditLogs(db, { universityId: '1' });
    expect(onlyUni1.total).toBe(1);
    expect(onlyUni1.logs[0].id).toBe(id1);

    const detail = getAuditLogById(db, id1);
    expect(detail.details).toEqual({ hash: 'abc123def456' });

    const csv = buildAuditLogsCsv(all.logs);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain("'=cmd()");
  });
});

describe('route audit logging', () => {
  it('logs login failure, login success, draft save with diff, no-op save suppression, submit failure, submit success, admin unlock, and logout', async () => {
    const { app, db } = await makeTestApp();

    // 1. Failed login
    const badLogin = await app.inject({ method: 'POST', url: '/api/login', payload: { username: 'kmutt', password: 'wrong' } });
    expect(badLogin.statusCode).toBe(401);

    // 2. Successful login
    const coordCookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');

    // 3. First draft save (creates diff)
    const member = {
      id: 'm1', type: 'student', title: 'นาย', fullName: 'สมชาย ใจดี',
      studentId: '6500001', year: '2', email: 's@kmutt.ac.th', phone: '0811111111',
      isLeader: true
    };
    const save1 = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'เพลงลูกทุ่ง', members: [member] }, version: 1 }
    });
    expect(save1.statusCode).toBe(200);

    // 4. Identical no-op save (should NOT create a second submission.save_draft row)
    const save2 = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'เพลงลูกทุ่ง', members: [member] }, version: 2 }
    });
    expect(save2.statusCode).toBe(200);

    // 5. Version conflict save failure (should log submission.save_failed)
    const saveConflict = await app.inject({
      method: 'PUT',
      url: '/api/submissions/singing',
      headers: { cookie: coordCookie },
      payload: { data: { projectName: 'แก้ซ้ำ' }, version: 1 }
    });
    expect(saveConflict.statusCode).toBe(409);

    // 6. Incomplete submit failure (missing photo/advisor -> 422, should log submission.submit_failed)
    const subFail = await app.inject({
      method: 'POST',
      url: '/api/submissions/singing/submit',
      headers: { cookie: coordCookie }
    });
    expect(subFail.statusCode).toBe(422);

    // 7. Logout
    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: coordCookie } });

    const { logs } = queryAuditLogs(db, {});
    const actions = logs.map(l => `${l.action}:${l.status}`).reverse();
    expect(actions).toEqual([
      'auth.login_failed:error',
      'auth.login:ok',
      'submission.save_draft:ok',
      'submission.save_failed:error',
      'submission.submit_failed:error',
      'auth.logout:ok'
    ]);

    const draftLog = logs.find(l => l.action === 'submission.save_draft');
    expect(draftLog.details.diff.fields).toEqual([{ field: 'projectName', before: '', after: 'เพลงลูกทุ่ง' }]);
    expect(draftLog.details.diff.membersAdded).toHaveLength(1);
    expect(draftLog.details.diff.membersAdded[0].fullName).toBe('สมชาย ใจดี');
  });
});

describe('dev audit API (/api/dev/*)', () => {
  it('blocks anonymous (401), coordinator (403), and admin (403) from /api/dev/*, and allows dev (200)', async () => {
    const { app } = await makeTestApp();
    const coordCookie = await loginAs(app, 'kmutt', 'pass-kmutt-1');
    const adminCookie = await loginAs(app, 'admin1', 'pass-admin-1');
    const devCookie = await loginAs(app, 'dev1', 'pass-dev-1');

    for (const url of ['/api/dev/logs', '/api/dev/logs/1', '/api/dev/logs.csv']) {
      const anon = await app.inject({ method: 'GET', url });
      expect(anon.statusCode, `anon ${url}`).toBe(401);

      const coord = await app.inject({ method: 'GET', url, headers: { cookie: coordCookie } });
      expect(coord.statusCode, `coord ${url}`).toBe(403);

      const adm = await app.inject({ method: 'GET', url, headers: { cookie: adminCookie } });
      expect(adm.statusCode, `admin ${url}`).toBe(403);
    }

    // Also verify dev cannot access admin or coordinator routes
    const devToAdmin = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: { cookie: devCookie } });
    expect(devToAdmin.statusCode).toBe(403);
    const devToCoord = await app.inject({ method: 'GET', url: '/api/submissions', headers: { cookie: devCookie } });
    expect(devToCoord.statusCode).toBe(403);

    const listRes = await app.inject({ method: 'GET', url: '/api/dev/logs', headers: { cookie: devCookie } });
    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.universities).toHaveLength(2);
    expect(body.logs.length).toBeGreaterThanOrEqual(3); // 3 logins above

    const firstId = body.logs[0].id;
    const detailRes = await app.inject({ method: 'GET', url: `/api/dev/logs/${firstId}`, headers: { cookie: devCookie } });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().log.id).toBe(firstId);

    const csvRes = await app.inject({ method: 'GET', url: '/api/dev/logs.csv', headers: { cookie: devCookie } });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
  });
});
