import { describe, it, expect, vi } from 'vitest';
import { runBrowserUploadTest, runServerUploadTest, makeSampleFile, BROWSER_STEPS } from './driveTest.js';

const file = { name: 'x.txt', size: 1234, type: 'text/plain' };

function fakes({ session, upload, confirm } = {}) {
  const api = {
    post: vi.fn(async (url, body) => {
      if (url === '/admin/drive-test/session') {
        if (session) throw session;
        return { uploadUrl: 'https://upload.test/s1', folderUrl: 'https://drive.test/f' };
      }
      if (url === '/admin/drive-test/confirm') {
        if (confirm) throw confirm;
        return { file: { id: body.driveFileId, name: 'x.txt', size: body.size, url: 'https://drive.test/x' }, folderUrl: 'https://drive.test/f' };
      }
      if (url === '/admin/drive-test/server') {
        return { file: { id: 'srv-file-0001', name: 'server-test.txt', size: 70 }, folderUrl: 'https://drive.test/f' };
      }
      throw new Error(`unexpected ${url}`);
    })
  };
  const uploadImpl = vi.fn(async ({ onProgress }) => {
    onProgress(50);
    if (upload) throw upload;
    return { driveFileId: 'drive-file-0001' };
  });
  return { api, uploadImpl };
}

const collect = () => {
  const events = [];
  return { events, onStep: (index, patch) => events.push([index, patch.status, patch.message ?? patch.progress]) };
};

describe('runBrowserUploadTest', () => {
  it('runs session, upload and confirm, and reports every step', async () => {
    const { api, uploadImpl } = fakes();
    const { events, onStep } = collect();
    const result = await runBrowserUploadTest({ file, api, uploadImpl, onStep });

    expect(result.ok).toBe(true);
    expect(result.file.id).toBe('drive-file-0001');
    expect(result.folderUrl).toBe('https://drive.test/f');
    expect(api.post).toHaveBeenCalledWith('/admin/drive-test/session', { name: 'x.txt', size: 1234, mime: 'text/plain' });
    expect(uploadImpl.mock.calls[0][0]).toMatchObject({ uploadUrl: 'https://upload.test/s1', file });
    expect(api.post).toHaveBeenCalledWith('/admin/drive-test/confirm', { driveFileId: 'drive-file-0001', size: 1234 });
    expect(events.filter(e => e[1] === 'ok').map(e => e[0])).toEqual([0, 1, 2]);
    expect(events).toContainEqual([1, 'running', 50]);
  });

  it('stops at the failing step with its message and a hint', async () => {
    for (const [at, opts] of [[0, { session: new Error('ยังไม่ได้เชื่อมต่อ Google Drive') }],
                              [1, { upload: new Error('network down') }],
                              [2, { confirm: new Error('size mismatch') }]]) {
      const { api, uploadImpl } = fakes(opts);
      const { events, onStep } = collect();
      const result = await runBrowserUploadTest({ file, api, uploadImpl, onStep });
      expect(result.ok).toBe(false);
      const fail = events.find(e => e[1] === 'fail');
      expect(fail[0]).toBe(at);
      expect(fail[2]).toBeTruthy();
      expect(result.hint).toBe(BROWSER_STEPS[at].hint);
      expect(events.some(e => e[0] > at)).toBe(false);   // later steps never start
    }
  });

  it('sends application/octet-stream for a file without a type', async () => {
    const { api, uploadImpl } = fakes();
    await runBrowserUploadTest({ file: { name: 'a.bin', size: 3, type: '' }, api, uploadImpl, onStep: () => {} });
    expect(api.post.mock.calls[0][1].mime).toBe('application/octet-stream');
  });
});

describe('runServerUploadTest', () => {
  it('reports the uploaded file', async () => {
    const { api } = fakes();
    const { events, onStep } = collect();
    const result = await runServerUploadTest({ api, onStep });
    expect(result.ok).toBe(true);
    expect(result.file.id).toBe('srv-file-0001');
    expect(events.at(-1)[1]).toBe('ok');
  });
});

describe('makeSampleFile', () => {
  it('makes a small named text file', () => {
    const f = makeSampleFile(new Date('2026-11-26T10:00:00Z'));
    expect(f.name).toBe('tta-upload-test-2026-11-26T10-00-00-000Z.txt');
    expect(f.type).toBe('text/plain');
    expect(f.size).toBeGreaterThan(100 * 1024);
  });
});
