import { describe, it, expect } from 'vitest';
import { getRequirements } from '../../src/utils/requirements.js';
import { getTrack } from '../../src/data/tracks.js';

const clip = getTrack('clip');
const deliverables = (sub) => getRequirements(clip, sub).find(r => r.key === 'deliverables');

describe('deliverables rule (clip)', () => {
  it('fails with no file, link or video', () => {
    expect(deliverables({}).ok).toBe(false);
    expect(deliverables({ files: [], links: { video: '' }, video: null }).ok).toBe(false);
  });

  it('passes with a Drive video only', () => {
    const sub = { files: [], links: { video: '' },
      video: { driveFileId: '1AbCdEfGhIjK', name: 'clip.mp4', size: 1000, mime: 'video/mp4' } };
    expect(deliverables(sub).ok).toBe(true);
  });

  it('does not pass with a video object that has no driveFileId', () => {
    expect(deliverables({ video: { name: 'clip.mp4' } }).ok).toBe(false);
  });

  it('still passes with a YouTube link or a finished file', () => {
    expect(deliverables({ links: { video: 'https://youtu.be/x' } }).ok).toBe(true);
    expect(deliverables({ files: [{ status: 'done' }] }).ok).toBe(true);
  });

  it('mentions the video in the label', () => {
    expect(deliverables({}).label).toContain('วิดีโอ');
  });
});

describe('per-track role validation', () => {
  const adv = { id: 'a1', type: 'advisor', fullName: 'อ.', dept: 'D', photo: { dataUrl: '/x' } };
  const stu = (id, role, extra = {}) => ({ id, type: 'student', fullName: id, dept: 'D', role, photo: { dataUrl: '/x' }, ...extra });
  const team = (trackId, members) => getRequirements(getTrack(trackId), { members }).find(r => r.key === 'team');

  it('theory requires both ผู้สอนหลัก and ผู้ช่วยสอน without requiring isLeader', () => {
    expect(team('theory.g0', [adv, stu('s1', 'ผู้สอนหลัก')]).ok).toBe(false);
    expect(team('theory.g0', [adv, stu('s1', 'ผู้สอนหลัก'), stu('s2', 'ผู้ช่วยสอน')]).ok).toBe(true);
  });

  it('dance allows up to 14 (10 performers + 4 backstage/light/sound) and rejects over-cap or unknown roles', () => {
    const valid = [
      adv,
      ...Array.from({ length: 10 }, (_, i) => stu(`d${i}`, 'นักแสดง')),
      stu('b1', 'Backstage'),
      stu('b2', 'Backstage'),
      stu('f1', 'ผู้ควบคุมไฟ'),
      stu('s1', 'ผู้ควบคุมเสียง')
    ];
    expect(team('dance', valid).ok).toBe(true);
    expect(team('dance', [
      adv,
      ...Array.from({ length: 4 }, (_, i) => stu(`b${i}`, 'Backstage')),
      stu('f1', 'ผู้ควบคุมไฟ')
    ]).ok).toBe(false);
    expect(team('dance', [adv, stu('f1', 'ผู้ควบคุมไฟ'), stu('f2', 'ผู้ควบคุมไฟ')]).ok).toBe(false);
    expect(team('dance', [adv, stu('x', 'ตัวปลอม')]).ok).toBe(false);
  });

  it('hardware requires 3 students and clip requires 3-5 students', () => {
    expect(team('hardware', [adv, stu('s1', 'ผู้แข่งขัน'), stu('s2', 'ผู้แข่งขัน')]).ok).toBe(false);
    expect(team('hardware', [adv, stu('s1', 'ผู้แข่งขัน'), stu('s2', 'ผู้แข่งขัน'), stu('s3', 'ผู้แข่งขัน')]).ok).toBe(true);
    expect(team('clip', [adv, stu('s1', 'ผู้แข่งขัน'), stu('s2', 'ผู้แข่งขัน')]).ok).toBe(false);
    expect(team('clip', [adv, ...Array.from({ length: 5 }, (_, i) => stu(`c${i}`, 'ผู้แข่งขัน'))]).ok).toBe(true);
    expect(team('software', [adv, ...Array.from({ length: 3 }, (_, i) => stu(`w${i}`, 'ผู้แข่งขัน'))]).ok).toBe(true);
    expect(team('robot', [adv, ...Array.from({ length: 3 }, (_, i) => stu(`r${i}`, 'ผู้แข่งขัน'))]).ok).toBe(true);
  });

  it('participants requires 1-10 members with photos and no advisors or dept', () => {
    const pTrack = getTrack('participants');
    const emptyReqs = getRequirements(pTrack, { members: [] });
    expect(emptyReqs.map(r => r.key)).toEqual(['team', 'photos']);
    expect(emptyReqs.every(r => !r.ok)).toBe(true);

    const valid = {
      members: [{ id: 'p1', type: 'student', fullName: 'สมชาย', role: 'ผู้เข้าร่วม', photo: { dataUrl: '/x' } }]
    };
    expect(getRequirements(pTrack, valid).every(r => r.ok)).toBe(true);
  });
});
