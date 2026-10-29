import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, onUnauthenticated, uploadFile } from './api.js';

const jsonResponse = (status, body) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api JSON calls', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    onUnauthenticated(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('GET sends cookies and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: { name: 'A' } }));
    const out = await api.get('/me');
    expect(out).toEqual({ user: { name: 'A' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('PUT sends a JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { entry: { version: 2 } }));
    await api.put('/submissions/clip', { data: { a: 1 }, version: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/submissions/clip');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ data: { a: 1 }, version: 1 });
  });

  it('del uses DELETE', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.del('/files/7');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('turns an error body into ApiError with code, message and extra', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'version_conflict', message: 'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่', entry: { version: 5 } }));
    const err = await api.put('/submissions/clip', {}).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('version_conflict');
    expect(err.message).toBe('ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่');
    expect(err.extra).toEqual({ entry: { version: 5 } });
  });

  it('calls the unauthenticated handler on 401 unauthenticated', async () => {
    const handler = vi.fn();
    onUnauthenticated(handler);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'unauthenticated', message: 'กรุณาเข้าสู่ระบบ' }));
    await expect(api.get('/submissions')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call the handler on 401 bad_credentials', async () => {
    const handler = vi.fn();
    onUnauthenticated(handler);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'bad_credentials', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
    const err = await api.post('/login', { username: 'x', password: 'y' }).catch(e => e);
    expect(err.code).toBe('bad_credentials');
    expect(handler).not.toHaveBeenCalled();
  });

  it('maps a network failure to status 0 / network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.get('/me').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('network');
    expect(err.message).toMatch(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
  });

  it('gives a Thai fallback for a non-JSON 502', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const err = await api.get('/me').catch(e => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่');
  });
});

class FakeXHR {
  static last = null;
  constructor() {
    this.upload = {};
    FakeXHR.last = this;
  }
  open(method, url) { this.method = method; this.url = url; }
  send(body) { this.body = body; }
  abort() { this.onabort?.(); }
  respond(status, obj) {
    this.status = status;
    this.responseText = obj === undefined ? '' : JSON.stringify(obj);
    this.onload();
  }
}

describe('uploadFile', () => {
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXHR));
  afterEach(() => vi.unstubAllGlobals());

  it('posts multipart field "file" with cookies and reports progress', async () => {
    const onProgress = vi.fn();
    const file = new File(['hello'], 'a.pdf', { type: 'application/pdf' });
    const p = uploadFile('/submissions/clip/files?kind=work', file, { onProgress });
    const xhr = FakeXHR.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/submissions/clip/files?kind=work');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.body.get('file').name).toBe('a.pdf');
    xhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 200 });
    expect(onProgress).toHaveBeenCalledWith(25);
    xhr.respond(200, { file: { fileId: 3 } });
    await expect(p).resolves.toEqual({ file: { fileId: 3 } });
  });

  it('rejects with the server error (413)', async () => {
    const p = uploadFile('/x', new File(['x'], 'b.zip'));
    FakeXHR.last.respond(413, { error: 'too_large', message: 'ไฟล์มีขนาดใหญ่เกินกำหนด' });
    const err = await p.catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('too_large');
  });

  it('rejects on network error and on abort', async () => {
    const p1 = uploadFile('/x', new File(['x'], 'b.zip'));
    FakeXHR.last.onerror();
    expect((await p1.catch(e => e)).code).toBe('network');

    const ctrl = new AbortController();
    const p2 = uploadFile('/x', new File(['x'], 'b.zip'), { signal: ctrl.signal });
    ctrl.abort();
    expect((await p2.catch(e => e)).code).toBe('aborted');
  });
});
