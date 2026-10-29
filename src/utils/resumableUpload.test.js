import { describe, it, expect, vi } from 'vitest';
import { uploadResumable, validateVideoFile } from './resumableUpload.js';

const file20 = new Blob(['x'.repeat(20)]);
const r308 = (range) => new Response(null, { status: 308, headers: range ? { Range: range } : {} });
const r200 = (body) => new Response(JSON.stringify(body), { status: 200 });
const noSleep = () => Promise.resolve();
const headerOf = (call) => call[1].headers['Content-Range'];

describe('validateVideoFile', () => {
  it('accepts mp4 and mov, with their mime types', () => {
    expect(validateVideoFile({ name: 'a.MP4', size: 10 })).toEqual({ ok: true, mime: 'video/mp4' });
    expect(validateVideoFile({ name: 'b.mov', size: 10 })).toEqual({ ok: true, mime: 'video/quicktime' });
  });
  it('rejects other types, empty files and files over the limit', () => {
    expect(validateVideoFile({ name: 'a.avi', size: 10 }).ok).toBe(false);
    expect(validateVideoFile({ name: 'a.mp4', size: 0 }).ok).toBe(false);
    const big = validateVideoFile({ name: 'a.mp4', size: 500 * 1024 * 1024 + 1 });
    expect(big).toEqual({ ok: false, error: 'ไฟล์วิดีโอต้องไม่เกิน 500 MB' });
  });
});

describe('uploadResumable', () => {
  it('sends the file in chunks and returns the Drive file id', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(r308('bytes=0-7'))
      .mockResolvedValueOnce(r308('bytes=0-15'))
      .mockResolvedValueOnce(r200({ id: 'drive-1' }));
    const onProgress = vi.fn();
    const out = await uploadResumable({ uploadUrl: 'https://up', file: file20, chunkSize: 8, fetchImpl, onProgress, sleep: noSleep });
    expect(out).toEqual({ driveFileId: 'drive-1' });
    expect(fetchImpl.mock.calls.map(headerOf)).toEqual(['bytes 0-7/20', 'bytes 8-15/20', 'bytes 16-19/20']);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://up');
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT');
    expect(fetchImpl.mock.calls[2][1].body.size).toBe(4);
    expect(onProgress.mock.calls.map(c => c[0])).toEqual([0, 40, 80, 100]);
  });

  it('after a network error asks for the status and resumes from there', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(r308('bytes=0-7'))
      .mockResolvedValueOnce(r308('bytes=0-15'))
      .mockResolvedValueOnce(r200({ id: 'd' }));
    const sleep = vi.fn(noSleep);
    await uploadResumable({ uploadUrl: 'u', file: file20, chunkSize: 8, fetchImpl, sleep });
    expect(fetchImpl.mock.calls.map(headerOf)).toEqual(['bytes 0-7/20', 'bytes */20', 'bytes 8-15/20', 'bytes 16-19/20']);
    expect(fetchImpl.mock.calls[1][1].body).toBeUndefined();
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('restarts from 0 when a 308 has no Range header', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(r308(null))
      .mockResolvedValueOnce(r200({ id: 'd' }));
    await uploadResumable({ uploadUrl: 'u', file: file20, chunkSize: 32, fetchImpl, sleep: noSleep });
    expect(fetchImpl.mock.calls.map(headerOf)).toEqual(['bytes 0-19/20', 'bytes 0-19/20']);
  });

  it('retries 5xx answers', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(r308('bytes=0-19'))
      .mockResolvedValueOnce(r200({ id: 'd' }));
    const out = await uploadResumable({ uploadUrl: 'u', file: file20, chunkSize: 32, fetchImpl, sleep: noSleep });
    expect(out.driveFileId).toBe('d');
    expect(headerOf(fetchImpl.mock.calls[1])).toBe('bytes */20');
  });

  it('gives up after maxRetries network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(uploadResumable({ uploadUrl: 'u', file: file20, fetchImpl, sleep: noSleep, maxRetries: 2 }))
      .rejects.toThrow('การเชื่อมต่อขัดข้อง');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reports an expired session (404)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(uploadResumable({ uploadUrl: 'u', file: file20, fetchImpl, sleep: noSleep }))
      .rejects.toThrow('หมดอายุ');
  });

  it('stops when aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fetchImpl = vi.fn();
    const err = await uploadResumable({ uploadUrl: 'u', file: file20, fetchImpl, signal: ctrl.signal }).catch(e => e);
    expect(err.name).toBe('AbortError');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
