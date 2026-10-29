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
