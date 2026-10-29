# Backend C: Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the React portal to the API from plans A and B. The app gets its login, entries, autosave, photo and work-file uploads, submit, and the สื่อสร้างสรรค์ video upload from the server instead of localStorage and demo data.

**Architecture:**
- A small `src/api.js` (fetch for JSON, XHR for multipart uploads) is the only code that talks to `/api`.
- `PortalContext` boots from `GET /api/me` and keeps the same function names it has now.
- It autosaves each changed entry through a pure, tested `createAutosaver` helper (`src/utils/autosave.js`). The helper debounces by 1 s, tracks the last-saved JSON and the version per entry, and runs one request at a time per entry.
- The video goes straight from the browser to Google Drive with a resumable session. The chunk/resume logic is a pure, tested module (`src/utils/resumableUpload.js`).
- Vite proxies `/api` to the API on port 3001.

**Tech Stack:** React 18, Vite 6.4, react-router 7, plain `fetch` / `XMLHttpRequest`, `vitest` 5 (node environment) for the pure modules. UI is checked by hand in the browser.

**Binding contract:** `docs/superpowers/plans/2026-10-29-backend-00-contracts.md`, including its "Amendments from plan A":
- `links` is `{ video }` only.
- Submit bumps `version`.
- 500 `server_error` has the message "เกิดข้อผิดพลาด กรุณาลองใหม่".

---

## Decisions

- **Tests:** only `vitest`, with `environment: 'node'`. Node ≥ 22 already has `fetch`, `Response`, `Blob`, `File`, `FormData`, `atob` and `DOMException`.
  - jsdom and @testing-library/react are **not** added. Every tested unit is pure, and jsdom's `FormData` rejects Node `Blob`s, which would make the upload tests harder, not easier. (Checked versions: vitest 5.0.5 needs vite ^6.4.0, and the repo has 6.4.3. jsdom is 30.1.3 if it's ever needed.)
- **Autosave:** an effect runs on every `submissions` change and calls `autosaver.schedule(key, entryData(entry))` for each entry that isn't submitted. The autosaver ignores entries whose data JSON equals the last-saved JSON, so only the changed entry is sent.
  - `entryData` removes the computed fields (`status`, `draftAt`, `submittedAt`, `hash`, `version`). It also drops work files that are still uploading or failed.
- **Server reply on save:** only `status`, `draftAt` and `version` are merged back into local state. Text typed while the request was in flight is kept.
- **Version:** the autosaver owns it per entry.
  - It is set from every server entry (load, 409, submit, 423 refresh).
  - It is updated after each successful save.
- **Photos:** a replaced or removed photo is not deleted on the server (orphan rows are harmless; YAGNI). Work files are deleted with `DELETE /api/files/:id`. The video is deleted with its own route.
- **Admin:** an admin who logs in goes to `/admin`. In this plan that route shows a placeholder (`AdminHome` inside `App.jsx`), and plan D replaces the route element. Coordinator routes send admins to `/admin`.
- **Server messages first (plan B amendments):** wherever the server sends a `message`, the UI shows it unchanged, because `ApiError.message` is the server's text.
  - 503 `drive_unavailable` can say either "ยังไม่ได้เชื่อมต่อ Google Drive" or "Google Drive ขัดข้อง กรุณาลองใหม่".
  - 422 on video confirm is shown the same way.
  - The 40-file cap (400 "แนบไฟล์ได้สูงสุด 40 ไฟล์ต่อรายการ") appears on the failed file's row.
  - `entry.video` is only ever `{ driveFileId, name, size, mime }` or `null`, and only on `clip`.
- **Builds:** `npm run build` rewrites the tracked `dist/` folder. After **every** build, run `git checkout -- dist; git clean -fq dist`. Never commit `dist/`.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `package.json` | modify | `vitest` devDependency, `test` script |
| `vite.config.js` | modify | `/api` proxy, vitest config |
| `src/api.js` | new | `ApiError`, `api.get/post/put/del`, `onUnauthenticated`, `uploadFile` |
| `src/api.test.js` | new | tests for `api.js` |
| `src/utils/autosave.js` | new | `entryData`, `createAutosaver` |
| `src/utils/autosave.test.js` | new | tests |
| `src/utils/photo.js` | modify | add `dataUrlToBlob`, `dataUrlToFile` |
| `src/utils/photo.test.js` | new | tests |
| `src/utils/resumableUpload.js` | new | `validateVideoFile`, `uploadResumable` (Drive resumable PUT) |
| `src/utils/resumableUpload.test.js` | new | tests |
| `src/context/PortalContext.jsx` | rewrite | server boot, login/logout, autosave, uploads, submit |
| `src/components/layout/FullPageLoader.jsx` | new | boot loader |
| `src/App.jsx` | rewrite | loading gate, admin redirect, `/admin` placeholder |
| `src/components/auth/LoginView.jsx` | modify | async login, no demo fill or demo hint |
| `src/components/submit/SubmitView.jsx` | modify | async save/submit, VideoUploader |
| `src/components/submit/ConfirmSubmitModal.jsx` | rewrite | async confirm, server errors |
| `src/components/layout/Navbar.jsx` | modify | save indicator instead of reset button |
| `src/index.css` | modify | `.nav-reset` → `.nav-save` |
| `src/components/submit/MemberModal.jsx` | modify | photo upload |
| `src/components/submit/FileUploader.jsx` | rewrite | progress, server errors |
| `src/components/submit/VideoUploader.jsx` | new | video upload to Drive |
| `src/data/accounts.js` | delete | |
| `src/data/seedData.js` | rewrite | only `emptySubmission` (with `links: { video: '' }`) |

---

### Task 0: Preflight

**Files:** none

- [ ] **Step 1:** Switch to the branch:
  ```
  git switch backend
  ```
  (It was created by plan A. If it's missing, run `git switch -c backend`.)
- [ ] **Step 2:** Run `git status`. `src/utils/photo.js` may hold an uncommitted WebP change from the user.
  - If it's there, commit it on its own first: `git add src/utils/photo.js; git commit -m "feat(photo): encode member photos as WebP with JPEG fallback"` plus the trailer below.
  - Task 4 builds on that version, the one that returns `ext: 'webp' | 'jpg'`.
  - Leave the untracked `docs/` work alone; plan files are committed by the coordinator.
- [ ] **Step 3:** Run `cd server; npm install; npm test` (Plan A/B APIs must exist and pass), then `cd ..`.

Every commit message in this plan ends with:

```

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

### Task 1: Vitest and the dev proxy

**Files:**
- Modify: `package.json` (scripts and devDependencies)
- Modify: `vite.config.js` (whole file)

- [ ] **Step 1:** Run `npm install -D vitest@^5.0.5`.
- [ ] **Step 2:** In `package.json` `"scripts"`, add `"test": "vitest run"` after `"preview"`. The block becomes:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  ```
- [ ] **Step 3:** Replace `vite.config.js` with:
  ```js
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      // The API (server/) listens on 3001; the Google OAuth callback also comes through here
      proxy: { '/api': 'http://localhost:3001' }
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js']
    }
  });
  ```
- [ ] **Step 4:** Run `npm test`. Expected: vitest reports "No test files found" and exits with code 1. That is fine at this point.
- [ ] **Step 5:** Commit:
  ```
  git add package.json package-lock.json vite.config.js
  git commit -m "chore(frontend): add vitest and proxy /api to the API server"
  ```

### Task 2: `src/api.js`

**Files:**
- Create: `src/api.test.js`, `src/api.js`

- [ ] **Step 1: Write the failing test.** Create `src/api.test.js`:
  ```js
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
  ```
- [ ] **Step 2:** Run `npm test -- src/api.test.js`. Expected: FAIL, because `./api.js` does not exist.
- [ ] **Step 3: Implement.** Create `src/api.js`:
  ```js
  // The only module that talks to the portal API.
  // Contract: docs/superpowers/plans/2026-10-29-backend-00-contracts.md

  const BASE = '/api';

  const NETWORK_MESSAGE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  const SERVER_MESSAGE = 'เกิดข้อผิดพลาด กรุณาลองใหม่';

  // Used when a response has no { error, message } body (proxy errors, HTML pages)
  const FALLBACK = {
    400: ['bad_request', 'ข้อมูลไม่ถูกต้อง'],
    401: ['unauthenticated', 'กรุณาเข้าสู่ระบบ'],
    403: ['forbidden', 'ไม่มีสิทธิ์เข้าถึง'],
    404: ['not_found', 'ไม่พบข้อมูล'],
    409: ['version_conflict', 'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่'],
    413: ['too_large', 'ไฟล์มีขนาดใหญ่เกินกำหนด'],
    415: ['bad_type', 'ไม่รองรับไฟล์ประเภทนี้'],
    422: ['incomplete', 'ยังกรอกข้อมูลไม่ครบ'],
    423: ['locked', 'ส่งผลงานแล้ว แก้ไขไม่ได้'],
    429: ['rate_limited', 'ลองใหม่อีกครั้งในภายหลัง']
  };

  export class ApiError extends Error {
    constructor(status, code, message, extra = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.extra = extra;
    }
  }

  let unauthenticatedHandler = null;

  // Called (once per failing request) when the session is missing or expired
  export function onUnauthenticated(fn) {
    unauthenticatedHandler = fn;
  }

  const parseJson = (text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  // Status + parsed body -> body, or throws ApiError
  function toResult(status, body) {
    if (status >= 200 && status < 300) return body;
    const { error, message, ...extra } = body && typeof body === 'object' ? body : {};
    const [fallbackCode, fallbackMessage] = FALLBACK[status] || ['server_error', SERVER_MESSAGE];
    const err = new ApiError(status, error || fallbackCode, message || fallbackMessage, extra);
    if (status === 401 && err.code === 'unauthenticated' && unauthenticatedHandler) {
      unauthenticatedHandler(err);
    }
    throw err;
  }

  async function request(method, path, body) {
    const init = { method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(BASE + path, init);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new ApiError(0, 'network', NETWORK_MESSAGE);
    }
    return toResult(res.status, parseJson(await res.text()));
  }

  export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request('DELETE', path)
  };

  // Multipart upload (field "file") with progress 0–100. XHR because fetch has no upload progress.
  export function uploadFile(path, file, { onProgress, signal } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ApiError(0, 'aborted', 'ยกเลิกการอัปโหลดแล้ว'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', BASE + path);
      xhr.withCredentials = true;
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        try {
          resolve(toResult(xhr.status, parseJson(xhr.responseText)));
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new ApiError(0, 'network', NETWORK_MESSAGE));
      xhr.onabort = () => reject(new ApiError(0, 'aborted', 'ยกเลิกการอัปโหลดแล้ว'));
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });

      const form = new FormData();
      form.append('file', file, file.name || 'upload');
      xhr.send(form);
    });
  }
  ```
- [ ] **Step 4:** Run `npm test -- src/api.test.js`. Expected: PASS (11 tests).
- [ ] **Step 5:** Commit:
  ```
  git add src/api.js src/api.test.js
  git commit -m "feat(frontend): add API client with Thai errors and upload progress"
  ```

### Task 3: Autosave helper

**Files:**
- Create: `src/utils/autosave.test.js`, `src/utils/autosave.js`

- [ ] **Step 1: Write the failing test.** Create `src/utils/autosave.test.js`:
  ```js
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { createAutosaver, entryData } from './autosave.js';

  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  describe('entryData', () => {
    it('drops computed fields and files that are not uploaded', () => {
      const out = entryData({
        status: 'draft', draftAt: 'x', submittedAt: null, hash: null, version: 4,
        projectName: 'P',
        files: [
          { id: 1, fileId: 1, status: 'done', name: 'a.pdf' },
          { id: 'f-1', status: 'uploading', progress: 40 },
          { id: 'f-2', status: 'error', error: 'bad' }
        ]
      });
      expect(out).toEqual({ projectName: 'P', files: [{ id: 1, fileId: 1, status: 'done', name: 'a.pdf' }] });
    });
  });

  describe('createAutosaver', () => {
    let save, states, errors, saver;
    beforeEach(() => {
      vi.useFakeTimers();
      save = vi.fn(async (key, data, version) => ({ ...data, version: version + 1 }));
      states = [];
      errors = [];
      saver = createAutosaver({
        save,
        delay: 1000,
        onStateChange: (s) => states.push(s),
        onError: (key, err) => errors.push([key, err])
      });
      saver.setBaseline('clip', { projectName: '' }, 1);
    });
    afterEach(() => vi.useRealTimers());

    it('saves about 1 s after a change', async () => {
      saver.schedule('clip', { projectName: 'A' });
      await vi.advanceTimersByTimeAsync(999);
      expect(save).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(save).toHaveBeenCalledWith('clip', { projectName: 'A' }, 1);
      expect(states).toEqual(['saving', 'saved']);
    });

    it('does nothing when the data equals the last saved data', async () => {
      expect(saver.schedule('clip', { projectName: '' })).toBe(false);
      await vi.advanceTimersByTimeAsync(5000);
      expect(save).not.toHaveBeenCalled();
    });

    it('debounces several quick changes into one save of the last data', async () => {
      saver.schedule('clip', { projectName: 'A' });
      await vi.advanceTimersByTimeAsync(500);
      saver.schedule('clip', { projectName: 'AB' });
      await vi.advanceTimersByTimeAsync(1000);
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('clip', { projectName: 'AB' }, 1);
    });

    it('uses the version returned by the previous save', async () => {
      saver.schedule('clip', { projectName: 'A' });
      await vi.advanceTimersByTimeAsync(1000);
      saver.schedule('clip', { projectName: 'B' });
      await vi.advanceTimersByTimeAsync(1000);
      expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'B' }, 2);
    });

    it('cancels a pending save when the data goes back to the saved value', async () => {
      saver.schedule('clip', { projectName: 'A' });
      saver.schedule('clip', { projectName: '' });
      await vi.advanceTimersByTimeAsync(2000);
      expect(save).not.toHaveBeenCalled();
    });

    it('flush saves at once; without changes it returns null unless forced', async () => {
      expect(await saver.flush('clip')).toBeNull();
      expect(save).not.toHaveBeenCalled();
      const entry = await saver.flush('clip', { force: true });
      expect(save).toHaveBeenCalledWith('clip', { projectName: '' }, 1);
      expect(entry.version).toBe(2);
    });

    it('flush sends pending data without waiting for the timer', async () => {
      saver.schedule('clip', { projectName: 'A' });
      await saver.flush('clip');
      expect(save).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('on failure reports the error, keeps the data, and retries on flush', async () => {
      const boom = new Error('offline');
      save.mockRejectedValueOnce(boom);
      saver.schedule('clip', { projectName: 'A' });
      await vi.advanceTimersByTimeAsync(1000);
      expect(errors).toEqual([['clip', boom]]);
      expect(states.at(-1)).toBe('error');
      expect(saver.hasUnsaved()).toBe(true);
      await saver.flush('clip');
      expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'A' }, 1);
      expect(saver.hasUnsaved()).toBe(false);
    });

    it('flush rejects with the save error', async () => {
      save.mockRejectedValueOnce(new Error('nope'));
      saver.schedule('clip', { projectName: 'A' });
      await expect(saver.flush('clip')).rejects.toThrow('nope');
    });

    it('setBaseline drops a pending change and sets the version', async () => {
      saver.schedule('clip', { projectName: 'A' });
      saver.setBaseline('clip', { projectName: 'server' }, 9);
      await vi.advanceTimersByTimeAsync(2000);
      expect(save).not.toHaveBeenCalled();
      saver.schedule('clip', { projectName: 'C' });
      await vi.advanceTimersByTimeAsync(1000);
      expect(save).toHaveBeenCalledWith('clip', { projectName: 'C' }, 9);
    });

    it('runs one save at a time per entry, the second with the new version', async () => {
      const first = deferred();
      save.mockImplementationOnce(() => first.promise);
      saver.schedule('clip', { projectName: 'A' });
      await vi.advanceTimersByTimeAsync(1000);
      saver.schedule('clip', { projectName: 'AB' });
      const second = saver.flush('clip');
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledTimes(1);
      first.resolve({ projectName: 'A', version: 2 });
      await second;
      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'AB' }, 2);
    });

    it('flushAll saves every pending entry and never rejects', async () => {
      saver.setBaseline('dance', { notes: '' }, 3);
      saver.schedule('clip', { projectName: 'A' });
      saver.schedule('dance', { notes: 'n' });
      save.mockRejectedValueOnce(new Error('x'));
      await expect(saver.flushAll()).resolves.toBeUndefined();
      expect(save).toHaveBeenCalledTimes(2);
    });

    it('reset forgets everything', async () => {
      saver.schedule('clip', { projectName: 'A' });
      saver.reset();
      await vi.advanceTimersByTimeAsync(2000);
      expect(save).not.toHaveBeenCalled();
      expect(saver.hasUnsaved()).toBe(false);
    });
  });
  ```
- [ ] **Step 2:** Run `npm test -- src/utils/autosave.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Create `src/utils/autosave.js`:
  ```js
  // Per-entry debounced autosave. Pure: no React, no fetch.
  // save(key, data, version) -> Promise<entry with .version>

  const COMPUTED = ['status', 'draftAt', 'submittedAt', 'hash', 'version'];

  // The part of an entry the server stores (PUT /submissions/:key { data }).
  // Work files still uploading or failed are local-only.
  export const entryData = (entry) => {
    const out = {};
    Object.keys(entry || {}).forEach((k) => {
      if (!COMPUTED.includes(k)) out[k] = entry[k];
    });
    if (Array.isArray(out.files)) out.files = out.files.filter(f => f.status === 'done' && f.fileId != null);
    return out;
  };

  export function createAutosaver({ save, delay = 1000, onStateChange = () => {}, onError = () => {} }) {
    const saved = new Map();    // key -> { json, version }
    const pending = new Map();  // key -> data waiting to be sent
    const timers = new Map();   // key -> timeout id
    const inflight = new Map(); // key -> promise of the running save
    let active = 0;
    let generation = 0;         // bumped by reset(); stale saves are ignored

    const clearTimer = (key) => {
      clearTimeout(timers.get(key));
      timers.delete(key);
    };

    const setBaseline = (key, data, version) => {
      clearTimer(key);
      pending.delete(key);
      saved.set(key, { json: JSON.stringify(data), version });
    };

    const schedule = (key, data) => {
      const base = saved.get(key);
      if (base && base.json === JSON.stringify(data)) {
        clearTimer(key);
        pending.delete(key);
        return false;
      }
      pending.set(key, data);
      clearTimer(key);
      timers.set(key, setTimeout(() => {
        timers.delete(key);
        flush(key).catch(() => {}); // already reported through onError
      }, delay));
      return true;
    };

    const flush = async (key, { force = false } = {}) => {
      clearTimer(key);
      const running = inflight.get(key);
      if (running) await running.catch(() => {});

      const base = saved.get(key);
      let data = pending.get(key);
      if (data === undefined) {
        if (!force || !base) return null;
        data = JSON.parse(base.json);
      }
      const json = JSON.stringify(data);
      if (!force && base && base.json === json) {
        pending.delete(key);
        return null;
      }
      pending.delete(key);

      const gen = generation;
      active += 1;
      onStateChange('saving');
      const promise = Promise.resolve().then(() => save(key, data, base ? base.version : 1));
      inflight.set(key, promise);
      try {
        const entry = await promise;
        if (gen === generation) saved.set(key, { json, version: entry.version });
        active -= 1;
        if (gen === generation) onStateChange(active > 0 ? 'saving' : 'saved');
        return entry;
      } catch (err) {
        active -= 1;
        if (gen === generation) {
          // Keep the data so the next flush (or the next change) sends it again
          if (!pending.has(key)) pending.set(key, data);
          onStateChange('error');
          onError(key, err);
        }
        throw err;
      } finally {
        if (inflight.get(key) === promise) inflight.delete(key);
      }
    };

    const flushAll = async () => {
      const keys = new Set([...pending.keys(), ...inflight.keys()]);
      await Promise.allSettled([...keys].map(k => flush(k)));
    };

    const hasUnsaved = () => pending.size > 0 || inflight.size > 0;

    const reset = () => {
      generation += 1;
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      pending.clear();
      saved.clear();
      inflight.clear();
      active = 0;
    };

    return { setBaseline, schedule, flush, flushAll, hasUnsaved, reset };
  }
  ```
- [ ] **Step 4:** Run `npm test -- src/utils/autosave.test.js`. Expected: PASS (14 tests).
- [ ] **Step 5:** Commit:
  ```
  git add src/utils/autosave.js src/utils/autosave.test.js
  git commit -m "feat(frontend): add per-entry debounced autosave helper"
  ```

### Task 4: Photo data URL → File

**Files:**
- Create: `src/utils/photo.test.js`
- Modify: `src/utils/photo.js` (append after the end of `processPhoto`)

- [ ] **Step 1: Write the failing test.** Create `src/utils/photo.test.js`:
  ```js
  import { describe, it, expect } from 'vitest';
  import { dataUrlToBlob, dataUrlToFile } from './photo.js';

  const DATA_URL = 'data:image/webp;base64,' + Buffer.from('RIFFxxxxWEBP').toString('base64');

  describe('dataUrlToBlob', () => {
    it('decodes the bytes and keeps the mime type', async () => {
      const blob = dataUrlToBlob(DATA_URL);
      expect(blob.type).toBe('image/webp');
      expect(Buffer.from(await blob.arrayBuffer()).toString()).toBe('RIFFxxxxWEBP');
    });
  });

  describe('dataUrlToFile', () => {
    it('wraps the blob in a named File', () => {
      const file = dataUrlToFile(DATA_URL, 'photo.webp');
      expect(file.name).toBe('photo.webp');
      expect(file.type).toBe('image/webp');
      expect(file.size).toBe(12);
    });
  });
  ```
- [ ] **Step 2:** Run `npm test -- src/utils/photo.test.js`. Expected: FAIL (`dataUrlToBlob` is not a function / not exported).
- [ ] **Step 3: Implement.** Append to the end of `src/utils/photo.js`:
  ```js

  // "data:image/webp;base64,..." -> Blob, so the resized photo can be uploaded
  export const dataUrlToBlob = (dataUrl) => {
    const [head, b64 = ''] = String(dataUrl).split(',');
    const mime = /^data:([^;,]+)/.exec(head)?.[1] || 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  export const dataUrlToFile = (dataUrl, name) => {
    const blob = dataUrlToBlob(dataUrl);
    return new File([blob], name, { type: blob.type });
  };
  ```
- [ ] **Step 4:** Run `npm test -- src/utils/photo.test.js`. Expected: PASS (2 tests).
- [ ] **Step 5:** Commit:
  ```
  git add src/utils/photo.js src/utils/photo.test.js
  git commit -m "feat(photo): convert resized photo data URL to an uploadable File"
  ```

### Task 5: Resumable Drive upload helper

**Files:**
- Create: `src/utils/resumableUpload.test.js`, `src/utils/resumableUpload.js`

How Google's resumable protocol works here:
- Each chunk is a `PUT uploadUrl` with `Content-Range: bytes a-b/size`.
- Every chunk except the last must be a multiple of 256 KiB (8 MiB is).
- An unfinished upload answers `308` with `Range: bytes=0-N`.
- A finished upload answers `200`/`201` with the file JSON (`id`).
- A status query is `PUT` with an empty body and `Content-Range: bytes */size`.
- `fetch` returns a 308 that has no `Location` header as-is; it does not follow it.

- [ ] **Step 1: Write the failing test.** Create `src/utils/resumableUpload.test.js`:
  ```js
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
  ```
- [ ] **Step 2:** Run `npm test -- src/utils/resumableUpload.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Create `src/utils/resumableUpload.js`:
  ```js
  // Browser -> Google Drive resumable upload (the API only creates the session).
  // Pure apart from the injected fetch / sleep, so it is unit-tested.

  export const CHUNK_SIZE = 8 * 1024 * 1024; // must be a multiple of 256 KiB
  export const MAX_VIDEO_MB = 500;
  export const VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime' };

  const NETWORK_MESSAGE = 'การเชื่อมต่อขัดข้อง อัปโหลดวิดีโอไม่สำเร็จ กรุณาลองใหม่';
  const EXPIRED_MESSAGE = 'การอัปโหลดหมดอายุ กรุณาเลือกไฟล์แล้วอัปโหลดใหม่';

  export function validateVideoFile(file, maxMB = MAX_VIDEO_MB) {
    const ext = (String(file.name).split('.').pop() || '').toLowerCase();
    if (!VIDEO_TYPES[ext]) return { ok: false, error: 'รองรับเฉพาะไฟล์ MP4 หรือ MOV' };
    if (!file.size) return { ok: false, error: 'ไฟล์ว่างเปล่า' };
    if (file.size > maxMB * 1024 * 1024) return { ok: false, error: `ไฟล์วิดีโอต้องไม่เกิน ${maxMB} MB` };
    return { ok: true, mime: VIDEO_TYPES[ext] };
  }

  const abortError = () => new DOMException('Upload aborted', 'AbortError');

  // "bytes=0-1234" -> 1235 (next byte to send); no header -> 0
  const nextOffset = (res) => {
    const m = /bytes=\d+-(\d+)/.exec(res.headers.get('Range') || '');
    return m ? Number(m[1]) + 1 : 0;
  };

  export async function uploadResumable({
    uploadUrl,
    file,
    chunkSize = CHUNK_SIZE,
    onProgress = () => {},
    signal,
    maxRetries = 5,
    fetchImpl = (...args) => fetch(...args),
    sleep = (ms) => new Promise(r => setTimeout(r, ms))
  }) {
    const size = file.size;
    let offset = 0;
    let failures = 0; // > 0 means "ask Google where we are" before sending more

    const backoff = async () => {
      failures += 1;
      if (failures > maxRetries) throw new Error(NETWORK_MESSAGE);
      await sleep(Math.min(1000 * 2 ** (failures - 1), 15000));
    };

    onProgress(0);
    for (;;) {
      if (signal?.aborted) throw abortError();
      let res;
      try {
        if (failures > 0) {
          res = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes */${size}` }, signal });
        } else {
          const end = Math.min(offset + chunkSize, size);
          res = await fetchImpl(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${size}` },
            body: file.slice(offset, end),
            signal
          });
        }
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        await backoff();
        continue;
      }

      if (res.status === 200 || res.status === 201) {
        const body = await res.json();
        onProgress(100);
        return { driveFileId: body.id };
      }
      if (res.status === 308) {
        offset = nextOffset(res);
        failures = 0;
        onProgress(Math.floor((offset / size) * 100));
        continue;
      }
      if (res.status === 404 || res.status === 410) throw new Error(EXPIRED_MESSAGE);
      if (res.status >= 500) {
        await backoff();
        continue;
      }
      throw new Error(`อัปโหลดวิดีโอไม่สำเร็จ (รหัส ${res.status})`);
    }
  }
  ```
- [ ] **Step 4:** Run `npm test -- src/utils/resumableUpload.test.js`. Expected: PASS (9 tests). Then run `npm test`. Expected: every test passes.
- [ ] **Step 5:** Commit:
  ```
  git add src/utils/resumableUpload.js src/utils/resumableUpload.test.js
  git commit -m "feat(video): add chunked, resumable Google Drive upload helper"
  ```

### Task 6: PortalContext on the server, loader, routes and login

**Files:**
- Rewrite: `src/context/PortalContext.jsx` (whole file)
- Create: `src/components/layout/FullPageLoader.jsx`
- Rewrite: `src/App.jsx` (whole file)
- Modify: `src/components/auth/LoginView.jsx`:
  - lines 1–54 (imports, state, handlers)
  - lines 141 and 157–177 (placeholder, password label row)
  - lines 221–251 (demo banner)

- [ ] **Step 1:** Replace `src/context/PortalContext.jsx` with:
  ```jsx
  import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
  import { useNavigate, useLocation } from 'react-router-dom';
  import { getTrack } from '../data/tracks';
  import { generateId } from '../utils/formatters';
  import { api, ApiError, onUnauthenticated, uploadFile } from '../api';
  import { createAutosaver, entryData } from '../utils/autosave';
  import confetti from 'canvas-confetti';

  const PortalContext = createContext(null);

  const STORAGE_KEY_TRACK = 'ttaa13_track';
  const WORK_EXTS = ['pdf', 'zip', 'ppt', 'pptx'];
  const MAX_WORK_MB = 50;

  const loginErrorMessage = (err) => {
    if (!(err instanceof ApiError)) return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';
    if (err.status === 401) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (err.status === 429) return 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 1 นาทีแล้วลองใหม่';
    return err.message;
  };

  export const PortalProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auth state: comes from the server session cookie, never from localStorage
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

    const [loginStyle, setLoginStyle] = useState('mosaic'); // 'mosaic' | 'classic'

    // Derive current view from current route path
    const currentView = location.pathname.startsWith('/submit')
      ? 'submit'
      : location.pathname.startsWith('/history')
      ? 'history'
      : 'dashboard';

    const [activeTrackId, setActiveTrackId] = useState(() => {
      try {
        return localStorage.getItem(STORAGE_KEY_TRACK) || 'theory';
      } catch {
        return 'theory';
      }
    });

    // { [entryKey]: Entry } as returned by the API
    const [submissions, setSubmissions] = useState({});

    const [toast, setToast] = useState(null);
    const [toastUndo, setToastUndo] = useState(null);

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_TRACK, activeTrackId);
      } catch (e) {
        console.error(e);
      }
    }, [activeTrackId]);

    // Toast handler with undo
    const showToast = (message, undoAction = null) => {
      setToast(message);
      setToastUndo(() => undoAction);
      clearTimeout(window._toastTimeout);
      window._toastTimeout = setTimeout(() => {
        setToast(null);
        setToastUndo(null);
      }, undoAction ? 6000 : 3500);
    };

    const handleUndo = () => {
      if (toastUndo) {
        toastUndo();
        setToast(null);
        setToastUndo(null);
      }
    };

    // Callbacks made once (autosaver, 401 handler) read the latest values through refs
    const userRef = useRef(user);
    userRef.current = user;
    const saveErrorRef = useRef(null);

    const autosaverRef = useRef(null);
    if (!autosaverRef.current) {
      autosaverRef.current = createAutosaver({
        delay: 1000,
        save: async (key, data, version) => {
          const { entry } = await api.put(`/submissions/${key}`, { data, version });
          // Keep what was typed meanwhile; take status, time and version from the server
          setSubmissions(prev => (prev[key]
            ? { ...prev, [key]: { ...prev[key], status: entry.status, draftAt: entry.draftAt, version: entry.version } }
            : prev));
          return entry;
        },
        onStateChange: (s) => setSaveState(s),
        onError: (key, err) => saveErrorRef.current?.(key, err)
      });
    }
    const autosaver = autosaverRef.current;

    // Put a server entry into state and mark it as the saved baseline
    const replaceEntry = (key, entry) => {
      autosaver.setBaseline(key, entryData(entry), entry.version);
      setSubmissions(prev => ({ ...prev, [key]: entry }));
    };

    // 423 has no entry in its body: reload the list and take that entry
    const refreshEntry = async (key) => {
      try {
        const { submissions: all } = await api.get('/submissions');
        if (all[key]) replaceEntry(key, all[key]);
      } catch {
        // the next action will show the error
      }
    };

    saveErrorRef.current = (key, err) => {
      if (!(err instanceof ApiError)) {
        showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่');
        return;
      }
      if (err.code === 'unauthenticated') return; // handled by onUnauthenticated
      if (err.code === 'version_conflict' && err.extra.entry) {
        replaceEntry(key, err.extra.entry);
        setSaveState('idle');
        showToast('ข้อมูลถูกแก้ไขจากที่อื่น ระบบโหลดข้อมูลล่าสุดให้แล้ว');
        return;
      }
      if (err.code === 'locked') {
        refreshEntry(key);
        setSaveState('idle');
      }
      showToast(err.message); // deadline_passed, locked, network, server_error …
    };

    const startSession = (u, subs) => {
      autosaver.reset();
      Object.entries(subs || {}).forEach(([key, e]) => autosaver.setBaseline(key, entryData(e), e.version));
      setSubmissions(subs || {});
      setUser(u);
      setSaveState('idle');
    };

    const endSession = () => {
      autosaver.reset();
      setUser(null);
      setSubmissions({});
      setSaveState('idle');
    };

    // Boot: is there a session cookie already?
    useEffect(() => {
      let cancelled = false;
      api.get('/me')
        .then(({ user: u, submissions: subs }) => { if (!cancelled) startSession(u, subs); })
        .catch((err) => { if (!cancelled && err.status !== 401) showToast(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Session expired or revoked while using the app
    useEffect(() => {
      onUnauthenticated(() => {
        if (!userRef.current) return;
        endSession();
        showToast('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง');
        navigate('/login');
      });
      return () => onUnauthenticated(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Autosave: hand every editable entry to the autosaver; it sends only changed ones
    useEffect(() => {
      if (!user || user.role !== 'coordinator') return;
      Object.entries(submissions).forEach(([key, sub]) => {
        if (sub.status === 'submitted') return;
        autosaver.schedule(key, entryData(sub));
      });
    }, [submissions, user, autosaver]);

    // Warn before closing the tab with unsaved changes
    useEffect(() => {
      const onBeforeUnload = (e) => {
        if (!autosaver.hasUnsaved()) return;
        autosaver.flushAll();
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [autosaver]);

    // Login & Logout
    const login = async (username, password) => {
      const cleanUser = (username || '').trim().toLowerCase();
      if (!cleanUser || !password) {
        return { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
      }
      try {
        const { user: u, submissions: subs } = await api.post('/login', { username: cleanUser, password });
        startSession(u, subs);
        showToast(`ยินดีต้อนรับ คุณ${u.name}`);
        return { success: true, user: u };
      } catch (err) {
        return { success: false, error: loginErrorMessage(err) };
      }
    };

    const logout = async () => {
      await autosaver.flushAll();
      try {
        await api.post('/logout');
      } catch {
        // the cookie may already be gone; log out on this side anyway
      }
      endSession();
      showToast('ออกจากระบบเรียบร้อยแล้ว');
      navigate('/login');
    };

    // Track & View navigation
    const openTrack = (trackId) => {
      setActiveTrackId(trackId);
      navigate(`/submit/${trackId}`);
    };

    const setView = (v) => {
      if (v === 'submit') {
        navigate(`/submit/${activeTrackId || 'theory'}`);
      } else {
        navigate(`/${v}`);
      }
    };

    // Submissions operations (functional updates: uploads finish in any order)
    const patchEntry = (key, fn) =>
      setSubmissions(prev => (prev[key] ? { ...prev, [key]: fn(prev[key]) } : prev));

    const updateSubmission = (trackId, patch) => patchEntry(trackId, sub => ({ ...sub, ...patch }));

    const updateField = (trackId, field, value) => {
      updateSubmission(trackId, { [field]: value });
    };

    const updateLink = (trackId, linkField, value) => {
      patchEntry(trackId, sub => ({ ...sub, links: { ...sub.links, [linkField]: value } }));
    };

    // Keep at most `limit` advisors, dropping the oldest ones first
    const capAdvisors = (members, limit) => {
      const advisors = members.filter(m => m.type === 'advisor');
      if (advisors.length <= limit) return members;
      const dropIds = new Set(advisors.slice(0, advisors.length - limit).map(m => m.id));
      return members.filter(m => !dropIds.has(m.id));
    };

    const ensureStudentLeader = (members = []) => {
      const students = members.filter(m => m.type === 'student');
      if (students.length > 0 && !students.some(m => m.isLeader)) {
        const firstId = students[0].id;
        return members.map(m => m.id === firstId ? { ...m, isLeader: true } : m);
      }
      return members;
    };

    const addOrUpdateMember = (trackId, memberData) => {
      const sub = submissions[trackId];
      let members = [...sub.members];
      const isEdit = !!memberData.id;
      // University always comes from the logged-in account
      memberData = { ...memberData, university: user?.university || '' };

      if (isEdit) {
        members = members.map(m => m.id === memberData.id ? { ...m, ...memberData } : m);
      } else {
        const newMember = {
          ...memberData,
          id: generateId('m'),
          source: 'manual'
        };
        members.push(newMember);
        // Over the track's advisor limit → replace the oldest advisor
        members = capAdvisors(members, getTrack(trackId).advisorCount || 1);
      }

      // Ensure only one student leader if this member was marked leader
      if (memberData.type === 'student' && memberData.isLeader) {
        const targetId = memberData.id || members[members.length - 1].id;
        members = members.map(m => m.type === 'student' ? { ...m, isLeader: m.id === targetId } : m);
      }

      members = ensureStudentLeader(members);
      updateSubmission(trackId, { members });
      showToast(isEdit ? `แก้ไขข้อมูล ${memberData.fullName} สำเร็จ` : `เพิ่ม ${memberData.fullName} ในทีมแล้ว`);
    };

    const removeMember = (trackId, memberId) => {
      const prevMembers = submissions[trackId].members;
      const removed = prevMembers.find(m => m.id === memberId);
      const updated = ensureStudentLeader(prevMembers.filter(m => m.id !== memberId));

      updateSubmission(trackId, { members: updated });
      showToast(`ลบ ${removed ? removed.fullName : 'สมาชิก'} แล้ว`, () => {
        updateSubmission(trackId, { members: prevMembers });
      });
    };

    const makeLeader = (trackId, studentId) => {
      const prev = submissions[trackId].members;
      const updated = prev.map(m => m.type === 'student' ? { ...m, isLeader: m.id === studentId } : m);
      updateSubmission(trackId, { members: updated });
      const target = updated.find(m => m.id === studentId);
      showToast(`ตั้ง ${target ? target.fullName : ''} เป็นหัวหน้าทีมแล้ว`);
    };

    const importCsvMembers = (trackId, incomingRows, mode = 'append') => {
      const prevMembers = submissions[trackId].members;
      const base = mode === 'replace' ? [] : [...prevMembers];

      // Incoming advisors push out the oldest ones once the track's limit is reached
      const stamped = incomingRows.map(r => ({ ...r, university: user?.university || '' }));
      let combined = capAdvisors([...base, ...stamped], getTrack(trackId).advisorCount || 1);
      combined = ensureStudentLeader(combined);

      updateSubmission(trackId, { members: combined });
      showToast(`นำเข้า ${incomingRows.length} รายชื่อสำเร็จ`, () => {
        updateSubmission(trackId, { members: prevMembers });
      });
    };

    // Files (work files: upload to the server, then the FileRef is autosaved with the entry)
    const patchFile = (key, localId, patch) =>
      patchEntry(key, sub => ({ ...sub, files: sub.files.map(f => (f.id === localId ? { ...f, ...patch } : f)) }));

    const addFiles = (trackId, fileList) => {
      const picked = Array.from(fileList || []);
      if (!picked.length) return;

      const rows = picked.map(file => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        let error = '';
        if (!WORK_EXTS.includes(ext)) error = 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ PDF, ZIP, PPT, PPTX)';
        else if (file.size > MAX_WORK_MB * 1024 * 1024) error = `ไฟล์มีขนาดใหญ่เกิน ${MAX_WORK_MB} MB`;
        return {
          file,
          row: { id: generateId('f'), name: file.name, size: file.size, ext, progress: 0, status: error ? 'error' : 'uploading', error }
        };
      });
      patchEntry(trackId, sub => ({ ...sub, files: [...sub.files, ...rows.map(r => r.row)] }));

      rows.filter(r => r.row.status === 'uploading').forEach(({ file, row }) => {
        uploadFile(`/submissions/${trackId}/files?kind=work`, file, {
          onProgress: (p) => patchFile(trackId, row.id, { progress: p })
        })
          .then(({ file: ref }) => {
            patchFile(trackId, row.id, { ...ref, error: '' });
            showToast(`อัปโหลด ${ref.name} เรียบร้อย`);
          })
          .catch(err => patchFile(trackId, row.id, { status: 'error', progress: 0, error: err.message }));
      });
    };

    const removeFile = async (trackId, fileId) => {
      const target = (submissions[trackId]?.files || []).find(f => f.id === fileId);
      if (!target || target.status === 'uploading') return;

      patchEntry(trackId, sub => ({ ...sub, files: sub.files.filter(f => f.id !== fileId) }));
      if (target.fileId == null) {
        showToast(`ลบไฟล์ ${target.name} แล้ว`); // a failed upload, only on this screen
        return;
      }
      try {
        await api.del(`/files/${target.fileId}`);
        showToast(`ลบไฟล์ ${target.name} แล้ว`);
      } catch (err) {
        if (err.status === 404) {
          showToast(`ลบไฟล์ ${target.name} แล้ว`);
          return;
        }
        patchEntry(trackId, sub => ({ ...sub, files: [...sub.files, target] }));
        showToast(err.message);
      }
    };

    // Draft & Submit
    const saveDraft = async (trackId) => {
      const sub = submissions[trackId];
      if (getTrack(trackId).needsWorkInfo && !(sub.projectName || '').trim()) {
        return { success: false, field: 'projectName', error: 'กรุณาตั้งชื่อผลงานก่อนบันทึกฉบับร่าง' };
      }
      autosaver.schedule(trackId, entryData(sub));
      try {
        await autosaver.flush(trackId, { force: true });
        showToast('บันทึกฉบับร่างเรียบร้อยแล้ว');
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message }; // the toast came from onError
      }
    };

    const confirmSubmit = async (trackId) => {
      try {
        await autosaver.flush(trackId);
        const { entry } = await api.post(`/submissions/${trackId}/submit`);
        replaceEntry(trackId, entry); // submit bumps version: take the server's
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        showToast('ส่งผลงานเรียบร้อยและระบบทำการล็อกข้อมูลแล้ว');
        return { success: true, hash: entry.hash };
      } catch (err) {
        if (err instanceof ApiError && err.code === 'incomplete') {
          return { success: false, error: err.message, failed: err.extra.failed || [] };
        }
        if (err instanceof ApiError && err.code === 'locked') refreshEntry(trackId);
        return { success: false, error: err.message || 'ส่งผลงานไม่สำเร็จ กรุณาลองใหม่', failed: [] };
      }
    };

    return (
      <PortalContext.Provider
        value={{
          user,
          isAuthenticated: !!user,
          isAdmin: user?.role === 'admin',
          loading,
          saveState,
          login,
          logout,
          loginStyle,
          setLoginStyle,
          currentView,
          setView,
          activeTrackId,
          setActiveTrackId,
          openTrack,
          submissions,
          updateSubmission,
          updateField,
          updateLink,
          addOrUpdateMember,
          removeMember,
          makeLeader,
          importCsvMembers,
          addFiles,
          removeFile,
          saveDraft,
          confirmSubmit,
          toast,
          toastUndo,
          showToast,
          handleUndo
        }}
      >
        {children}
      </PortalContext.Provider>
    );
  };

  export const usePortal = () => {
    const context = useContext(PortalContext);
    if (!context) {
      throw new Error('usePortal must be used within a PortalProvider');
    }
    return context;
  };
  ```
- [ ] **Step 2:** Create `src/components/layout/FullPageLoader.jsx`:
  ```jsx
  import React from 'react';

  // Shown while GET /api/me decides whether a session exists
  export const FullPageLoader = () => (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#F6F6F9',
        color: 'var(--text-muted)',
        fontSize: '15px'
      }}
    >
      <img
        src="/assets/ttaa13-logo.png"
        alt=""
        style={{ height: '48px', width: 'auto', animation: 'ttaa-pulse 1.4s ease-in-out infinite' }}
      />
      <span>กำลังโหลด…</span>
    </div>
  );
  ```
- [ ] **Step 3:** Replace `src/App.jsx` with:
  ```jsx
  import React from 'react';
  import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
  import { usePortal } from './context/PortalContext';
  import { LoginView } from './components/auth/LoginView';
  import { Navbar } from './components/layout/Navbar';
  import { Toast } from './components/layout/Toast';
  import { FullPageLoader } from './components/layout/FullPageLoader';
  import { DashboardView } from './components/dashboard/DashboardView';
  import { SubmitView } from './components/submit/SubmitView';
  import { HistoryView } from './components/history/HistoryView';
  import { CertificatesView } from './components/certificates/CertificatesView';

  const homeFor = (user) => (user?.role === 'admin' ? '/admin' : '/dashboard');

  // Coordinator routes: guard & layout
  function ProtectedLayout() {
    const { isAuthenticated, user } = usePortal();
    const location = useLocation();

    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />

        <main style={{ flex: 1 }}>
          <Outlet />
        </main>

        <Toast />
      </div>
    );
  }

  // Admin routes: guard & layout (plan D fills in the page)
  function AdminLayout() {
    const { isAuthenticated, user } = usePortal();
    const location = useLocation();

    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (user.role !== 'admin') {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
        <Toast />
      </div>
    );
  }

  // Placeholder until plan D replaces this route element with the real admin page
  function AdminHome() {
    const { user, logout } = usePortal();
    return (
      <div className="app-container" style={{ padding: '48px 20px' }}>
        <div className="card">
          <h1 style={{ fontSize: '26px', fontWeight: 700 }}>ผู้ดูแลระบบ</h1>
          <p style={{ color: 'var(--text-muted)' }}>สวัสดี คุณ{user.name} หน้าสำหรับผู้ดูแลระบบกำลังจัดทำ</p>
          <div>
            <button type="button" className="btn" onClick={logout}>ออกจากระบบ</button>
          </div>
        </div>
      </div>
    );
  }

  // Public-only Route Guard (Login page)
  function PublicLoginRoute() {
    const { isAuthenticated, user } = usePortal();
    const location = useLocation();

    if (isAuthenticated) {
      const from = user.role === 'admin' ? '/admin' : (location.state?.from?.pathname || '/dashboard');
      return <Navigate to={from} replace />;
    }

    return (
      <main>
        <LoginView />
        <Toast />
      </main>
    );
  }

  // Redirect /submit to active track (e.g. /submit/theory)
  function SubmitRedirect() {
    const { activeTrackId } = usePortal();
    return <Navigate to={`/submit/${activeTrackId || 'theory'}`} replace />;
  }

  export default function App() {
    const { isAuthenticated, loading, user } = usePortal();

    if (loading) return <FullPageLoader />;

    return (
      <Routes>
        {/* Login path: /login */}
        <Route path="/login" element={<PublicLoginRoute />} />

        {/* Coordinator routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/submit" element={<SubmitRedirect />} />
          <Route path="/submit/:trackId" element={<SubmitView />} />
          <Route path="/submit/:trackId/:groupIdx" element={<SubmitView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/certificates" element={<CertificatesView />} />
        </Route>

        {/* Admin routes */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />
        </Route>

        {/* Fallback route */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? homeFor(user) : '/login'} replace />}
        />
      </Routes>
    );
  }
  ```
- [ ] **Step 4:** In `src/components/auth/LoginView.jsx`, replace lines 1–54 (from `import React` through the end of `handleFillDemo`) with:
  ```jsx
  import React, { useState } from 'react';
  import { useNavigate, useLocation } from 'react-router-dom';
  import { usePortal } from '../../context/PortalContext';
  import { MosaicHero } from './MosaicHero';
  import { Eye, EyeSlash, LockKey, User, WarningCircle } from '@phosphor-icons/react';

  export const LoginView = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = usePortal();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [shake, setShake] = useState(false);

    const triggerShake = () => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError('');

      if (!username.trim() || !password) {
        setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        triggerShake();
        return;
      }

      setIsLoading(true);
      const res = await login(username, password);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error);
        triggerShake();
        return;
      }
      const destination = res.user.role === 'admin'
        ? '/admin'
        : (location.state?.from?.pathname || '/dashboard');
      navigate(destination, { replace: true });
    };
  ```
- [ ] **Step 5:** In the same file, change the username placeholder `placeholder="เช่น rep.rtc หรือ rep.svu"` to `placeholder="เช่น kmutt"`.
- [ ] **Step 6:** In the same file, replace the password label row (the `<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>` block that holds the label and the "กรอกบัญชีทดลอง" button, original lines 157–177) with:
  ```jsx
              <label style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 700,
                color: '#1B1D29',
                marginBottom: '8px'
              }}>
                รหัสผ่าน (Password)
              </label>
  ```
- [ ] **Step 7:** In the same file, delete the whole `{/* Demo Helper Banner */}` block: the comment and its `<div>…</div>`, which contains "ผู้ประสานงานทดลอง" and the "กรอกให้" button (original lines 221–251).
- [ ] **Step 8:** Check that nothing refers to the removed code:
  ```
  git grep -n "DEMO_PASSWORD\|handleFillDemo\|Sparkle\|rep.rtc" src/components/auth
  ```
  Expected: no output.
- [ ] **Step 9:** Run `npm run build`. Expected: build succeeds. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 10: Manual check.**
  1. Terminal 1: `cd server; npm run seed; npm run dev`. The seed reads `../../data/TTA-portal-accounts.md`.
  2. Terminal 2 (repo root): `npm run dev`.
  3. Check each of these:
     - The first load shows "กำลังโหลด…" briefly, then the login page. It has no demo banner, no "กรอกบัญชีทดลอง", and an empty username.
     - A wrong password shows "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" and shakes.
     - Eleven fast wrong tries show the 429 message.
     - Logging in as `kmutt` (password from the accounts note) lands on `/dashboard` with 17 entries.
     - Reloading the page keeps you logged in (cookie, then `/me`).
     - In the dashboard, type in the clip project name. After about 1 s, DevTools → Network shows one `PUT /api/submissions/clip`. Typing the same text again sends no PUT.
     - The same login in another browser shows the typed data.
     - Logging in as `admin1` lands on `/admin` (placeholder). Opening `/dashboard` redirects to `/admin`.
     - Logout returns to `/login`. Then `/dashboard` redirects to `/login`.
- [ ] **Step 11:** Commit:
  ```
  git add src/context/PortalContext.jsx src/components/layout/FullPageLoader.jsx src/App.jsx src/components/auth/LoginView.jsx
  git commit -m "feat(frontend): load session and entries from the API with per-entry autosave"
  ```

### Task 7: Async draft and submit (SubmitView, ConfirmSubmitModal)

**Files:**
- Modify: `src/components/submit/SubmitView.jsx` lines 63–89 (`handleSaveDraft`, `handleConfirmSubmit`)
- Rewrite: `src/components/submit/ConfirmSubmitModal.jsx` (whole file)

- [ ] **Step 1:** In `SubmitView.jsx`, replace lines 63–89 (from `const handleSaveDraft = () => {` through the end of `handleConfirmSubmit`) with:
  ```jsx
    const handleSaveDraft = async () => {
      const res = await saveDraft(entryId);
      if (res.success) {
        setFormErrors({});
      } else if (res.field) {
        setFormErrors({ [res.field]: res.error });
        showToast(res.error);
      }
      // Server errors were already shown as a toast by PortalContext
    };

    const handleAttemptSubmit = () => {
      const errors = getFormErrors(getRequirements(activeTrack, sub));
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        showToast('ยังกรอกข้อมูลไม่ครบ กรุณาตรวจสอบรายการที่มีเครื่องหมายสีแดง');
        const first = Object.keys(errors)[0];
        document.getElementById(`section-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      setFormErrors({});
      setConfirmModalOpen(true);
    };

    // Returns the result so the modal can show the server's reason when it refuses
    const handleConfirmSubmit = async () => {
      const res = await confirmSubmit(entryId);
      if (res.success) setConfirmModalOpen(false);
      return res;
    };
  ```
- [ ] **Step 2:** Replace `src/components/submit/ConfirmSubmitModal.jsx` with:
  ```jsx
  import React, { useState, useEffect } from 'react';
  import { WarningCircle, X, Check, LockSimple } from '@phosphor-icons/react';

  const SummaryItem = ({ label, children, wide }) => (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-dark)' }}>{children}</div>
    </div>
  );

  // onConfirm: async () => { success, error?, failed?: [{ key, label, error }] }
  export const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, track, submission }) => {
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [failed, setFailed] = useState([]);

    // Reset every time the popup opens
    useEffect(() => {
      if (isOpen) {
        setAcknowledged(false);
        setSubmitting(false);
        setError('');
        setFailed([]);
      }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
      setSubmitting(true);
      setError('');
      setFailed([]);
      const res = await onConfirm();
      if (!res?.success) {
        setSubmitting(false);
        setError(res?.error || 'ส่งผลงานไม่สำเร็จ กรุณาลองใหม่');
        setFailed(res?.failed || []);
      }
    };

    const showWorkInfo = !!track?.needsWorkInfo;
    const advisors = (submission.members || []).filter(m => m.type === 'advisor').length;
    const students = (submission.members || []).filter(m => m.type === 'student').length;
    const filesCount = (submission.files || []).filter(f => f.status === 'done').length;
    const linksCount = (submission.links?.video ? 1 : 0);

    return (
      <div className="modal-overlay">
        <div className="modal animate-slide-up" role="dialog" aria-modal="true" style={{ width: 'min(100%, 520px)' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <LockSimple size={22} weight="fill" />
              </div>
              <div>
                <h3 className="modal-title">ยืนยันการส่งผลงาน</h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{track?.full}</p>
              </div>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} disabled={submitting} aria-label="ปิด">
              <X size={20} weight="bold" />
            </button>
          </div>

          <div className="modal-body">
            <div className="alert alert-error" style={{ fontWeight: 500 }}>
              <WarningCircle size={20} weight="fill" />
              <span>เมื่อยืนยันแล้ว <strong>ระบบจะล็อกข้อมูลและแก้ไขไม่ได้</strong></span>
            </div>

            {error && (
              <div className="alert alert-error" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <WarningCircle size={20} weight="fill" />
                  <span>{error}</span>
                </div>
                {failed.length > 0 && (
                  <ul style={{ margin: '4px 0 0 28px', padding: 0 }}>
                    {failed.map(f => (
                      <li key={f.key}>{f.label}{f.error ? `: ${f.error}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{
              background: '#FAFAFC',
              border: '1px solid var(--border-light)',
              borderRadius: '14px',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px'
            }}>
              {showWorkInfo && (
                <SummaryItem label="ชื่อผลงาน" wide>{submission.projectName || '-'}</SummaryItem>
              )}
              <SummaryItem label="ทีม">อาจารย์ {advisors} · ผู้แข่งขัน {students}</SummaryItem>
              {showWorkInfo
                ? <SummaryItem label="ไฟล์และลิงก์">{filesCount} ไฟล์ · {linksCount} ลิงก์{submission.video ? ' · วิดีโอ 1' : ''}</SummaryItem>
                : <SummaryItem label="รูปถ่าย">
                    {(submission.members || []).filter(m => m.photo?.dataUrl).length}/{(submission.members || []).length} คน
                  </SummaryItem>}
              {submission.subjectGroup && (
                <SummaryItem label="กลุ่มสาขา" wide>{submission.subjectGroup}</SummaryItem>
              )}
            </div>

            {/* Must tick before confirming (FEEDBACK #4) */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--bg-main)',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: '15px'
            }}>
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={submitting}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', flexShrink: 0 }}
              />
              <span>ข้าพเจ้าตรวจสอบแล้วว่า <strong>ข้อมูลถูกต้องครบถ้วน</strong></span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>กลับไปตรวจสอบ</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={!acknowledged || submitting}>
              <Check size={18} weight="bold" />
              <span>{submitting ? 'กำลังส่ง…' : 'ยืนยันส่งผลงาน'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };
  ```
- [ ] **Step 3:** Run `npm run build`. Expected: build succeeds. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 4: Manual check.** Run both servers as in Task 6 and log in as `kmutt`.
  - Clip: an empty project name with "บันทึกฉบับร่าง" shows the red field error. Fill it in, then save. The toast "บันทึกฉบับร่างเรียบร้อยแล้ว" appears and the dashboard status is "ฉบับร่าง".
  - Fill a culture entry completely (e.g. `singing`; photos come in Task 9, so for now pick an entry whose requirements you can meet, or do this step again after Task 9) and submit. Confetti plays, the entry locks, the receipt hash shows in history, and a reload keeps it locked.
  - Forced 422: in DevTools, `fetch('/api/submissions/dance/submit',{method:'POST'})` returns 422 `failed`. Open the confirm modal on an entry the server considers incomplete (e.g. after removing a member in another tab). The modal stays open and lists the failed items.
  - Forced 409: open the same entry in two browsers and type in both. The second shows "ข้อมูลถูกแก้ไขจากที่อื่น ระบบโหลดข้อมูลล่าสุดให้แล้ว" and its fields switch to the server's version.
- [ ] **Step 5:** Commit:
  ```
  git add src/components/submit/SubmitView.jsx src/components/submit/ConfirmSubmitModal.jsx
  git commit -m "feat(submit): await server save/submit and show refused submit reasons"
  ```

### Task 8: Navbar save indicator

**Files:**
- Modify: `src/components/layout/Navbar.jsx`:
  - lines 1–17 (imports and destructuring; add `SaveIndicator`)
  - lines 141–150 (reset button)
- Modify: `src/index.css` lines 697–698 (`.nav-reset` selector)

- [ ] **Step 1:** In `Navbar.jsx`, replace lines 1–17 (from `import React` through `const { user, logout, activeTrackId, resetAllDataToDefault } = usePortal();`) with:
  ```jsx
  import React from 'react';
  import { useNavigate, useLocation } from 'react-router-dom';
  import { usePortal } from '../../context/PortalContext';
  import { initials } from '../../utils/formatters';
  import {
    SquaresFour,
    PaperPlaneTilt,
    ClockCounterClockwise,
    SignOut,
    Certificate,
    CloudArrowUp,
    CloudCheck,
    CloudWarning
  } from '@phosphor-icons/react';

  const SAVE_STATES = {
    saving: { Icon: CloudArrowUp, text: 'กำลังบันทึก…', color: 'var(--text-muted)' },
    saved: { Icon: CloudCheck, text: 'บันทึกแล้ว', color: '#1F7A3D' },
    error: { Icon: CloudWarning, text: 'บันทึกไม่สำเร็จ', color: 'var(--danger)' }
  };

  // Autosave state: "กำลังบันทึก… / บันทึกแล้ว"; nothing before the first save
  const SaveIndicator = ({ state }) => {
    const meta = SAVE_STATES[state];
    if (!meta) return null;
    const { Icon, text, color } = meta;
    return (
      <span
        className="nav-save"
        role="status"
        aria-live="polite"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color, whiteSpace: 'nowrap' }}
      >
        <Icon size={18} weight="bold" />
        <span>{text}</span>
      </span>
    );
  };

  export const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, activeTrackId, saveState } = usePortal();
  ```
- [ ] **Step 2:** In the same file, replace the reset button (the `<button type="button" className="nav-reset" onClick={resetAllDataToDefault} …>…</button>` block, original lines 141–150) with:
  ```jsx
            <SaveIndicator state={saveState} />
  ```
  Then move this `<SaveIndicator … />` line so it is the **first** child of the "User & actions" `<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>`, before the `nav-user` div. The indicator then sits left of the user's name.
- [ ] **Step 3:** In `src/index.css`, inside `@media (max-width: 480px)`, replace:
  ```css
    .nav-user,
    .nav-reset {
  ```
  with:
  ```css
    .nav-user,
    .nav-save {
  ```
- [ ] **Step 4:** Run `git grep -n "resetAllDataToDefault\|nav-reset" src`. Expected: no output.
- [ ] **Step 5:** Run `npm run build`. Expected: success. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 6: Manual check.**
  - There's no reset button.
  - Typing shows "กำลังบันทึก…", then "บันทึกแล้ว".
  - Stopping the API (Ctrl+C in terminal 1) and typing shows "บันทึกไม่สำเร็จ" and the connection toast. Restarting the API and clicking "บันทึกฉบับร่าง" saves it.
  - At a 400 px window width, the indicator is hidden.
- [ ] **Step 7:** Commit:
  ```
  git add src/components/layout/Navbar.jsx src/index.css
  git commit -m "feat(navbar): replace demo reset with autosave indicator"
  ```

### Task 9: Photo upload in MemberModal

**Files:**
- Modify: `src/components/submit/MemberModal.jsx`:
  - lines 1–5 (imports)
  - line 25 (state)
  - lines 76–78 (`handleSave` start)
  - lines 108–117 (`handlePhoto`)
  - lines 204–217 (photo box and buttons)
  - lines 364–374 (footer)

- [ ] **Step 1:** Replace lines 1–5 (the imports) with:
  ```jsx
  import React, { useState, useEffect, useRef } from 'react';
  import { usePortal } from '../../context/PortalContext';
  import { TITLE_PREFIXES, DEPARTMENTS, PHOTO_RULES } from '../../data/referenceData';
  import { processPhoto, dataUrlToFile } from '../../utils/photo';
  import { uploadFile } from '../../api';
  import { X, ChalkboardTeacher, Student, Plus, Buildings, WarningCircle, Camera, Trash } from '@phosphor-icons/react';
  ```
- [ ] **Step 2:** After `const [errors, setErrors] = useState({});`, add:
  ```jsx
    const [photoBusy, setPhotoBusy] = useState(false);
  ```
- [ ] **Step 3:** Replace the first lines of `handleSave`:
  ```jsx
    const handleSave = (addAnother = false) => {
      if (!validate()) return;
  ```
  with:
  ```jsx
    const handleSave = (addAnother = false) => {
      if (photoBusy) return;
      if (!validate()) return;
  ```
- [ ] **Step 4:** Replace the whole `handlePhoto` function with:
  ```jsx
    // Resize in the browser, upload, then keep the server's PhotoRef ({ fileId, dataUrl: '/api/files/<id>', … })
    const handlePhoto = async (file) => {
      if (!file) return;
      const res = await processPhoto(file);
      if (!res.success) {
        setErrors(prev => ({ ...prev, photo: res.error }));
        return;
      }
      setPhotoBusy(true);
      setErrors(prev => ({ ...prev, photo: '' }));
      try {
        const upload = dataUrlToFile(res.photo.dataUrl, `photo.${res.photo.ext}`);
        const { file: ref } = await uploadFile(`/submissions/${trackId}/files?kind=photo`, upload);
        setPhoto(ref);
      } catch (err) {
        setErrors(prev => ({ ...prev, photo: err.message || 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' }));
      } finally {
        setPhotoBusy(false);
      }
    };
  ```
- [ ] **Step 5:** Replace the photo preview and its buttons, from `{photo` (the line `? <img src={photo.dataUrl} …`) through the closing `)}` of the "ลบรูป" button, with:
  ```jsx
                  {photoBusy
                    ? <span style={{ fontSize: '12.5px', fontWeight: 600, textAlign: 'center', padding: '4px' }}>กำลังอัปโหลด…</span>
                    : photo
                      ? <img src={photo.dataUrl} alt="รูปถ่าย" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Camera size={28} weight="duotone" />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm" disabled={photoBusy} onClick={() => photoInput.current?.click()}>
                      <Camera size={16} weight="bold" />
                      <span>{photoBusy ? 'กำลังอัปโหลด…' : photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</span>
                    </button>
                    {photo && !photoBusy && (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto(null)}>
                        <Trash size={16} weight="bold" />
                        <span>ลบรูป</span>
                      </button>
                    )}
  ```
  The replaced range starts at `{photo` inside the 84×104 box and ends at the `)}` after the "ลบรูป" button. The next lines (`</div>` and the `field-hint` span) stay unchanged.
- [ ] **Step 6:** Replace the modal footer (`<div className="modal-footer">` … its closing `</div>`) with:
  ```jsx
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
            {!isEditing && !isAdvisor && (
              <button type="button" className="btn btn-danger" disabled={photoBusy} onClick={() => handleSave(true)}>
                <Plus size={16} weight="bold" />
                <span>บันทึกและเพิ่มอีกคน</span>
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={photoBusy} onClick={() => handleSave(false)}>
              {isEditing ? 'บันทึกการแก้ไข' : 'บันทึก'}
            </button>
          </div>
  ```
- [ ] **Step 7:** Run `npm run build`. Expected: success. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 8: Manual check** (log in as `kmutt`, entry `singing`):
  - Add an advisor with a JPG photo. The box shows "กำลังอัปโหลด…" and the save buttons are disabled.
  - Then the preview appears. Network shows `POST /api/submissions/singing/files?kind=photo` → 200 and `<img src="/api/files/<id>">`.
  - Save the member. One `PUT` follows about 1 s later.
  - Reload: the photo still shows (served by the API, cached).
  - Pick a `.gif`: the client error appears and nothing is uploaded.
  - Stop the API and pick a photo: the field error shows the connection message.
  - Complete the entry and submit it. It succeeds (the server's file-reference check passes).
- [ ] **Step 9:** Commit:
  ```
  git add src/components/submit/MemberModal.jsx
  git commit -m "feat(members): upload resized photos to the server"
  ```

### Task 10: FileUploader with real progress

**Files:**
- Rewrite: `src/components/submit/FileUploader.jsx` (whole file)

- [ ] **Step 1:** Replace the file with:
  ```jsx
  import React, { useState } from 'react';
  import { usePortal } from '../../context/PortalContext';
  import { SectionNum } from './SectionNum';
  import { formatSize } from '../../utils/formatters';
  import {
    UploadSimple,
    FilePdf,
    FileZip,
    FilePpt,
    File,
    Trash,
    CheckCircle,
    WarningCircle
  } from '@phosphor-icons/react';

  const fileIcon = (ext) => {
    switch (ext) {
      case 'pdf': return <FilePdf size={24} weight="fill" color="var(--primary)" />;
      case 'zip': return <FileZip size={24} weight="fill" color="#B07A00" />;
      case 'ppt':
      case 'pptx': return <FilePpt size={24} weight="fill" color="var(--danger)" />;
      default: return <File size={24} weight="fill" color="var(--text-muted)" />;
    }
  };

  const ProgressBar = ({ value }) => (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={{ height: '6px', width: '100%', minWidth: '120px', borderRadius: '999px', background: 'var(--bg-main)', overflow: 'hidden', marginTop: '6px' }}
    >
      <div style={{ height: '100%', width: `${value}%`, background: 'var(--primary)', transition: 'width 0.2s' }} />
    </div>
  );

  export const FileUploader = ({ trackId, isLocked, error, number, done }) => {
    const { submissions, addFiles, removeFile } = usePortal();
    const sub = submissions[trackId] || { files: [] };
    const [isDragging, setIsDragging] = useState(false);
    const inputId = `file-upload-${trackId}`;

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (isLocked) return;
      if (e.dataTransfer.files?.length) addFiles(trackId, e.dataTransfer.files);
    };

    const handleInputChange = (e) => {
      if (e.target.files?.length) addFiles(trackId, e.target.files);
      e.target.value = '';
    };

    return (
      <div className="card" id="section-deliverables">
        <div>
          <h3 className="section-title">
            <SectionNum number={number} done={done} />
            ไฟล์ผลงาน
          </h3>
          <p className="section-desc">ไฟล์ PDF, ZIP, PPT หรือ PPTX ไม่เกิน 50 MB ต่อไฟล์</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <WarningCircle size={18} weight="fill" />
            <span>{error}</span>
          </div>
        )}

        {!isLocked && (
          <div
            className="dropzone clickable"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById(inputId)?.click()}
            style={{
              borderColor: isDragging ? 'var(--primary)' : undefined,
              background: isDragging ? '#FFF8F4' : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              id={inputId}
              type="file"
              multiple
              accept=".pdf,.zip,.ppt,.pptx"
              style={{ display: 'none' }}
              onChange={handleInputChange}
            />
            <UploadSimple size={30} weight="bold" color="var(--primary)" />
            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
              คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
            </div>
          </div>
        )}

        {sub.files?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sub.files.map((file) => {
              const isError = file.status === 'error';
              const isUploading = file.status === 'uploading';
              return (
                <div
                  key={file.id}
                  className="row-item"
                  style={isError ? { background: '#FFF8F4', borderColor: '#FFD0BD', flexWrap: 'nowrap' } : { flexWrap: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    {fileIcon(file.ext)}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {file.url && !isUploading ? (
                        <a
                          className="row-title"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {file.name}
                        </a>
                      ) : (
                        <div className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </div>
                      )}
                      <div className="row-meta" style={isError ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                        {isError
                          ? file.error
                          : isUploading
                            ? `กำลังอัปโหลด ${file.progress || 0}% · ${formatSize(file.size)}`
                            : formatSize(file.size)}
                      </div>
                      {isUploading && <ProgressBar value={file.progress || 0} />}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {file.status === 'done' && (
                      <span className="badge badge-blue">
                        <CheckCircle size={14} weight="fill" />
                        พร้อมส่ง
                      </span>
                    )}
                    {!isLocked && !isUploading && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removeFile(trackId, file.id)}
                        title="ลบไฟล์"
                        aria-label={`ลบไฟล์ ${file.name}`}
                      >
                        <Trash size={18} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          isLocked && <div className="dropzone">ไม่มีไฟล์ที่อัปโหลด</div>
        )}
      </div>
    );
  };
  ```
- [ ] **Step 2:** Run `npm run build`. Expected: success. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 3: Manual check** (entry `clip`):
  - Drop a 20 MB PDF. The progress bar and percentage rise. To see it, use DevTools → Network throttling "Fast 4G".
  - It then shows "พร้อมส่ง", and its name links to `/api/files/<id>` (opens).
  - A PUT follows about 1 s later. Reload: the file is still listed.
  - A `.docx` shows the client error row, with no request.
  - A PDF renamed from an `.exe` shows the server 415 "ไม่รองรับไฟล์ประเภทนี้".
  - A 60 MB PDF shows the client size error. To see the server 413, temporarily set `MAX_WORK_MB=1` in `server/.env`.
  - Delete a file: `DELETE /api/files/<id>` → 200, then a PUT. After reload it's gone.
  - Delete an error row: no request.
  - Upload a 41st file to one entry (a small PDF copied many times): that row shows the server's "แนบไฟล์ได้สูงสุด 40 ไฟล์ต่อรายการ".
- [ ] **Step 4:** Commit:
  ```
  git add src/components/submit/FileUploader.jsx
  git commit -m "feat(files): real work-file uploads with progress and server errors"
  ```

### Task 11: Video upload for สื่อสร้างสรรค์

**Files:**
- Create: `src/components/submit/VideoUploader.jsx`
- Modify: `src/components/submit/SubmitView.jsx`:
  - line 12 (import)
  - lines 187–199 (render after `ExternalLinksSection`)

- [ ] **Step 1:** Create `src/components/submit/VideoUploader.jsx`:
  ```jsx
  import React, { useEffect, useRef, useState } from 'react';
  import { usePortal } from '../../context/PortalContext';
  import { api } from '../../api';
  import { uploadResumable, validateVideoFile, MAX_VIDEO_MB } from '../../utils/resumableUpload';
  import { formatSize } from '../../utils/formatters';
  import { SectionNum } from './SectionNum';
  import { VideoCamera, UploadSimple, Trash, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';

  // Clip only. Flow:
  // 1. POST /api/submissions/clip/video, which gives a Drive resumable uploadUrl
  // 2. PUT the file to Drive in 8 MB chunks, resuming after drops
  // 3. POST /confirm, which gives a VideoRef; it is stored in entry.video and autosaved
  export const VideoUploader = ({ trackId, isLocked, number }) => {
    const { submissions, updateField } = usePortal();
    const video = submissions[trackId]?.video || null;

    const [progress, setProgress] = useState(null); // null when idle, 0–100 while uploading
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const abortRef = useRef(null);
    const inputRef = useRef(null);

    // Leaving the page stops a running upload
    useEffect(() => () => abortRef.current?.abort(), []);

    const startUpload = async (file) => {
      if (!file) return;
      const check = validateVideoFile(file, MAX_VIDEO_MB);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      setError('');
      setBusy(true);
      setProgress(0);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { uploadUrl } = await api.post('/submissions/clip/video', { name: file.name, size: file.size, mime: check.mime });
        const { driveFileId } = await uploadResumable({ uploadUrl, file, onProgress: setProgress, signal: controller.signal });
        const { video: ref } = await api.post('/submissions/clip/video/confirm', { driveFileId });
        updateField(trackId, 'video', ref);
      } catch (err) {
        setError(err?.name === 'AbortError' ? 'ยกเลิกการอัปโหลดแล้ว' : (err?.message || 'อัปโหลดวิดีโอไม่สำเร็จ กรุณาลองใหม่'));
      } finally {
        abortRef.current = null;
        setBusy(false);
        setProgress(null);
      }
    };

    const removeVideo = async () => {
      if (!video) return;
      setBusy(true);
      setError('');
      try {
        await api.del(`/submissions/clip/video/${encodeURIComponent(video.driveFileId)}`);
        updateField(trackId, 'video', null);
      } catch (err) {
        if (err.status === 404) updateField(trackId, 'video', null);
        else setError(err.message);
      } finally {
        setBusy(false);
      }
    };

    const uploading = progress !== null;

    return (
      <div className="card" id="section-video">
        <div>
          <h3 className="section-title">
            <SectionNum number={number} done={!!video} />
            ไฟล์วิดีโอ
          </h3>
          <p className="section-desc">ไฟล์ MP4 หรือ MOV ไม่เกิน {MAX_VIDEO_MB} MB (ไม่บังคับ หากแนบลิงก์ YouTube แล้ว)</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <WarningCircle size={18} weight="fill" />
            <span>{error}</span>
          </div>
        )}

        {video ? (
          <div className="row-item" style={{ flexWrap: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <VideoCamera size={24} weight="fill" color="var(--primary)" />
              <div style={{ minWidth: 0 }}>
                <div className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</div>
                <div className="row-meta">{formatSize(video.size)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span className="badge badge-blue">
                <CheckCircle size={14} weight="fill" />
                อัปโหลดแล้ว
              </span>
              {!isLocked && (
                <button type="button" className="icon-btn" disabled={busy} onClick={removeVideo} title="ลบวิดีโอ" aria-label={`ลบวิดีโอ ${video.name}`}>
                  <Trash size={18} weight="bold" />
                </button>
              )}
            </div>
          </div>
        ) : uploading ? (
          <div className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span className="row-title">กำลังอัปโหลดวิดีโอ {progress}%</span>
              <button type="button" className="btn btn-sm" onClick={() => abortRef.current?.abort()}>
                <X size={16} weight="bold" />
                <span>ยกเลิก</span>
              </button>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              style={{ height: '8px', borderRadius: '999px', background: 'var(--bg-main)', overflow: 'hidden' }}
            >
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.3s' }} />
            </div>
            <span className="row-meta">อย่าปิดหน้านี้จนกว่าจะอัปโหลดเสร็จ หากสัญญาณหลุด ระบบจะอัปโหลดต่อให้อัตโนมัติ</span>
          </div>
        ) : isLocked ? (
          <div className="dropzone">ไม่มีไฟล์วิดีโอ</div>
        ) : (
          <div
            className="dropzone clickable"
            onClick={() => !busy && inputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,video/mp4,video/quicktime"
              style={{ display: 'none' }}
              aria-label="เลือกไฟล์วิดีโอ"
              onChange={(e) => { startUpload(e.target.files?.[0]); e.target.value = ''; }}
            />
            <UploadSimple size={30} weight="bold" color="var(--primary)" />
            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>คลิกเพื่อเลือกไฟล์วิดีโอ</div>
          </div>
        )}
      </div>
    );
  };
  ```
- [ ] **Step 2:** In `SubmitView.jsx`, after `import { FileUploader } from './FileUploader';` add:
  ```jsx
  import { VideoUploader } from './VideoUploader';
  ```
- [ ] **Step 3:** In `SubmitView.jsx`, replace the `needsWorkInfo` fragment (from `{activeTrack.needsWorkInfo && (` through its closing `)}`) with:
  ```jsx
                {activeTrack.needsWorkInfo && (
                  <>
                    <ProjectInfoSection
                      trackId={entryId}
                      isLocked={isLocked}
                      error={formErrors.projectName}
                      number={next()}
                      done={done('projectName')}
                    />
                    <ExternalLinksSection
                      trackId={entryId}
                      isLocked={isLocked}
                      number={next()}
                      done={hasLink}
                    />
                    {activeTrack.id === 'clip' && (
                      <VideoUploader
                        trackId={entryId}
                        isLocked={isLocked}
                        number={next()}
                      />
                    )}
                    <FileUploader
                      trackId={entryId}
                      isLocked={isLocked}
                      error={formErrors.deliverables}
                      number={next()}
                      done={done('deliverables')}
                    />
                  </>
                )}
  ```
- [ ] **Step 4:** Run `npm run build`. Expected: success. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 5: Manual check.**
  - Needs plan B's Google connection: as `admin1`, connect Drive with `GET /api/admin/google/connect`, then log in as `kmutt` and open `/submit/clip`.
  - Pick a `.avi`, then a 600 MB file: client errors, no request.
  - Pick a 100 MB MP4. `POST /api/submissions/clip/video` → `uploadUrl`. Network shows `PUT` chunks to `googleapis.com` with `Content-Range`, 308s, and finally 200. The bar moves in 8 MB steps.
  - Then `POST …/confirm` → row "อัปโหลดแล้ว", followed by a `PUT /api/submissions/clip` containing `video`.
  - The file is in Drive under `TTA 2027 วิดีโอ/kmutt/`.
  - Resume: during an upload, set DevTools Network to "Offline" for about 5 s, then back. A `PUT` with `bytes */size` follows and the upload continues from the reported offset (not 0).
  - Cancel mid-upload: "ยกเลิกการอัปโหลดแล้ว".
  - Remove: `DELETE /api/submissions/clip/video/<id>` → picker shows again, then a PUT with `video: null`. Reload confirms it.
  - With Drive not connected, choosing a file shows the server's 503 message ("ยังไม่ได้เชื่อมต่อ Google Drive", or "Google Drive ขัดข้อง กรุณาลองใหม่" for a Drive error after connecting).
  - If the browser can't read the `Range` header on 308 (CORS), resume restarts from 0. Note it in the PR and see "Contract issues".
- [ ] **Step 6:** Commit:
  ```
  git add src/components/submit/VideoUploader.jsx src/components/submit/SubmitView.jsx
  git commit -m "feat(video): upload สื่อสร้างสรรค์ video to Google Drive with resume"
  ```

### Task 12: Remove demo data from the live build

**Files:**
- Delete: `src/data/accounts.js`
- Rewrite: `src/data/seedData.js` (whole file)

- [ ] **Step 1:** Run `git grep -n "data/accounts\|createSeedSubmissions" src server`. Expected: only `src/data/seedData.js` itself (its own definition). If anything else appears, it is a leftover from Tasks 6–8; fix it first.
- [ ] **Step 2:** Run `git rm src/data/accounts.js`.
- [ ] **Step 3:** Replace `src/data/seedData.js` with:
  ```js
  // Shape of one blank entry. Shared with the server (server/src/entries.js imports it),
  // so keep this file free of browser APIs and of imports from React files.
  // Only `links.video` is kept (contracts amendment 1).
  export const emptySubmission = (extra = {}) => ({
    status: 'not_started',
    projectName: '',
    summary: '',
    notes: '',
    members: [],
    files: [],
    links: { video: '' },
    subjectGroup: '',
    ...extra
  });
  ```
- [ ] **Step 4:** Run `cd server; npm test; cd ..`. Expected: every server test passes (`blankData` already drops `github`/`drive` per amendment 1, so it doesn't depend on them). Then run `npm test`. Expected: every frontend test passes.
- [ ] **Step 5:** Run `npm run build`. Expected: success. Then run `git checkout -- dist; git clean -fq dist`.
- [ ] **Step 6:** Commit:
  ```
  git add -A src/data
  git commit -m "chore(frontend): drop demo accounts and seed submissions"
  ```

### Task 13: Full flow check

**Files:** none

- [ ] **Step 1:** Run `npm test` (all frontend tests pass) and `cd server; npm test; cd ..`.
- [ ] **Step 2:** With both servers running, as `kmutt`, go through the whole flow:
  1. Log in.
  2. Fill `theory.g0`: advisor + 2 students with photos.
  3. Wait for "บันทึกแล้ว". Submit and see confetti and the lock.
  4. `clip`: name, YouTube link, one PDF, video. Submit.
  5. Log out. Log in again in a second browser: everything is identical and locked.
  6. History shows hashes from the server.
- [ ] **Step 3:** As `rmutt`, confirm none of `kmutt`'s data shows.
- [ ] **Step 4:** Run `git status`. Expected: clean, with no `dist/` changes.
- [ ] **Step 5:** Run `git log --oneline -15` to confirm one commit per task.

---

## Self-review notes

- Every contract name is used exactly:
  - `ApiError{status,code,extra}`, `api.get/post/put/del`, `onUnauthenticated`, `uploadFile(path, file, {onProgress, signal})`
  - the proxy
  - `loading` and `saveState`
  - all of the old context names, except `resetAllDataToDefault`, which is removed on purpose
- The amendments are applied:
  - `links: { video }` in `seedData`
  - the submit response's `version` goes through `replaceEntry` and so becomes the autosaver baseline
  - the `server_error` fallback is "เกิดข้อผิดพลาด กรุณาลองใหม่" (api test)
