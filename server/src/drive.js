import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getTrack, parseEntryKey } from '../../src/data/tracks.js';
import { httpError } from './errors.js';
import { getSetting, setSetting, deleteSetting, deleteSettingsLike } from './settings.js';
import { encrypt, decrypt, isValidTokenKey } from './crypto.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FETCH_TIMEOUT_MS = 20000;
export const FOLDER_MIME_TYPE = FOLDER_MIME;
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const ROOT_FOLDER_NAME = 'TTA2027';
export const DRIVE_DOWN = 'Google Drive ขัดข้อง กรุณาลองใหม่';

const PHOTO_MIME_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

const safeDriveName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 100);
const escapeDriveQ = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function entryDriveFolderName(key) {
  const track = getTrack(key);
  const { groupIdx } = parseEntryKey(key);
  return groupIdx != null ? `${track.th} - ${track.subjectGroups[groupIdx]}` : track.th;
}

export function memberDrivePhotoName(member, ext = 'webp', fallbackName = '') {
  const full = `${String(member?.title || '').trim()}${String(member?.fullName || '').trim()}`.trim();
  const base = safeDriveName(full || fallbackName || member?.id || 'photo') || 'photo';
  return `${base}.${ext}`;
}

function uniqueDriveName(used, wanted) {
  if (!used.has(wanted)) { used.add(wanted); return wanted; }
  const dot = wanted.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const name = `${base}-${n}${ext}`;
  used.add(name);
  return name;
}

export const driveUnavailable = (message = 'ยังไม่ได้เชื่อมต่อ Google Drive') =>
  httpError(503, 'drive_unavailable', message);
const driveDown = () => driveUnavailable(DRIVE_DOWN);

// All Google HTTP goes through `fetch`, so tests pass a fake one.
export function createDrive({ db, config, fetch = globalThis.fetch }) {
  let cached = null;               // { token, expiresAt } — access token, memory only
  const creating = new Map();      // settings key -> Promise<folderId>, avoids duplicate folders

  const isConfigured = () =>
    !!config.google.clientId && !!config.google.clientSecret && isValidTokenKey(config.tokenKey);
  const isConnected = () => !!getSetting(db, 'google.refresh_token');

  function assertConfigured() {
    if (!isConfigured()) throw driveUnavailable('ยังไม่ได้ตั้งค่า Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / TOKEN_KEY)');
  }

  function authUrl(state) {
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state
    });
    return `${AUTH_URL}?${params}`;
  }

  // Every Google request: 20 s timeout, and any network failure becomes a 503.
  async function send(url, init) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      throw driveDown();
    }
  }

  async function readJson(res) {
    try {
      return await res.json();
    } catch {
      throw driveDown();
    }
  }

  async function postToken(params) {
    const res = await send(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        ...params
      }).toString()
    });
    if (res.status >= 500) throw driveDown();
    let body;
    try {
      body = await res.json();
    } catch {
      if (res.ok) throw driveDown();
      body = {};
    }
    return { ok: res.ok, body };
  }

  function remember(body) {
    cached = { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in || 3600) - 60) * 1000 };
  }

  async function accessToken() {
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const stored = getSetting(db, 'google.refresh_token');
    if (!stored) throw driveUnavailable();
    const { ok, body } = await postToken({ refresh_token: decrypt(stored, config.tokenKey), grant_type: 'refresh_token' });
    if (!ok) {
      if (body.error === 'invalid_grant') {
        deleteSetting(db, 'google.refresh_token'); // revoked: admin must reconnect
        throw driveUnavailable();
      }
      throw driveDown();
    }
    if (!body.access_token) throw driveDown();
    if (body.refresh_token) setSetting(db, 'google.refresh_token', encrypt(body.refresh_token, config.tokenKey));
    remember(body);
    return cached.token;
  }

  async function call(method, url, { json, rawBody, headers = {} } = {}) {
    const attempt = async () => {
      const token = await accessToken();
      return send(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(json ? { 'content-type': 'application/json; charset=UTF-8' } : {}),
          ...headers
        },
        body: json ? JSON.stringify(json) : rawBody
      });
    };
    const res = await attempt();
    if (res.status !== 401) return res;
    cached = null;            // refresh once, retry once
    return attempt();
  }

  async function callJson(method, url, opts) {
    const res = await call(method, url, opts);
    if (!res.ok) {
      const err = driveDown();
      err.status = res.status;
      throw err;
    }
    return readJson(res);
  }

  // Code from the OAuth callback -> stored (encrypted) refresh token, email and root folder.
  async function exchangeCode(code) {
    const { ok, body } = await postToken({ code, redirect_uri: config.google.redirectUri, grant_type: 'authorization_code' });
    if (!ok || !body.access_token) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    const hadToken = !!getSetting(db, 'google.refresh_token');
    if (!body.refresh_token && !hadToken) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    if (body.refresh_token) setSetting(db, 'google.refresh_token', encrypt(body.refresh_token, config.tokenKey));
    remember(body);
    try {
      const { email } = await getAbout();
      const previous = getSetting(db, 'google.email');
      if (previous && previous !== email) deleteSettingsLike(db, 'drive.'); // different account: old folder ids are useless
      setSetting(db, 'google.email', email || '');
      await ensureRootFolder();
    } catch (err) {
      if (body.refresh_token) {   // no half setup
        deleteSetting(db, 'google.refresh_token');
        deleteSetting(db, 'google.email');
        deleteSettingsLike(db, 'drive.');
        cached = null;
      }
      throw err;
    }
  }

  async function getAbout() {
    const fields = encodeURIComponent('user(emailAddress),storageQuota(limit,usage)');
    const b = await callJson('GET', `${API}/about?fields=${fields}`);
    return {
      email: b.user?.emailAddress ?? null,
      quota: {
        limit: b.storageQuota?.limit ? Number(b.storageQuota.limit) : null,
        usage: Number(b.storageQuota?.usage ?? 0)
      }
    };
  }

  async function findFolder(name, parent) {
    const q = [
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false',
      `name = '${escapeDriveQ(name)}'`,
      ...(parent ? [`'${escapeDriveQ(parent)}' in parents`] : [])
    ].join(' and ');
    const res = await callJson('GET', `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&pageSize=10`);
    return res.files?.[0]?.id || null;
  }

  function ensureFolder(key, name, parent, parentKind = 'root') {
    const existing = getSetting(db, key);
    if (existing) return Promise.resolve(existing);
    if (creating.has(key)) return creating.get(key);
    const job = (async () => {
      let id = await findFolder(name, parent);
      if (!id) {
        try {
          ({ id } = await callJson('POST', `${API}/files?fields=id`, {
            json: { name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }
          }));
        } catch (err) {
          if (parent && err.status === 404) { err.parentMissing = true; err.parentKind = parentKind; }
          throw err;
        }
      }
      setSetting(db, key, id);
      return id;
    })().finally(() => creating.delete(key));
    creating.set(key, job);
    return job;
  }

  const ensureRootFolder = () => ensureFolder('drive.root_folder', ROOT_FOLDER_NAME, null);

  async function ensureUniversityFolder(code) {
    const root = await ensureRootFolder();
    return ensureFolder(`drive.folder.${code}`, code, root, 'root');
  }

  async function ensureEntryFolder(code, entryKey) {
    const uni = await ensureUniversityFolder(code);
    return ensureFolder(`drive.folder.${code}.${entryKey}`, entryDriveFolderName(entryKey), uni, 'university');
  }

  function clearStaleFolder(code, entryKey, parentKind) {
    if (parentKind === 'root') {
      deleteSetting(db, 'drive.root_folder');
      deleteSettingsLike(db, 'drive.folder.');
    } else if (parentKind === 'university') {
      deleteSetting(db, `drive.folder.${code}`);
      deleteSettingsLike(db, `drive.folder.${code}.`);
    } else if (entryKey) {
      deleteSetting(db, `drive.folder.${code}.${entryKey}`);
    }
  }

  // Returns the one-time session URL the browser uploads to.
  async function createResumableSession({ name, size, mime, parent }) {
    const res = await call('POST', `${UPLOAD_URL}?uploadType=resumable&fields=id,name,size,mimeType`, {
      json: { name, mimeType: mime, parents: [parent] },
      headers: {
        'x-upload-content-type': mime,
        'x-upload-content-length': String(size),
        origin: config.appOrigin   // Drive echoes it in CORS headers for the browser's PUTs
      }
    });
    const location = res.headers.get('location');
    if (!res.ok || !location) {
      const err = driveDown();
      if (res.status === 404) { err.parentMissing = true; err.parentKind = 'university'; }
      throw err;
    }
    return location;
  }

  // Folder ids can go stale (deleted in Drive): forget them, recreate, retry (at most twice).
  async function createUniversitySession(code, opts) {
    for (let attempt = 0; ; attempt++) {
      try {
        const parent = await ensureUniversityFolder(code);
        return await createResumableSession({ ...opts, parent });
      } catch (err) {
        if (!err.parentMissing || attempt >= 2) throw err;
        clearStaleFolder(code, null, err.parentKind);
      }
    }
  }

  async function uploadFile({ name, mime, bytes, parent }) {
    const boundary = `tta_${randomBytes(12).toString('hex')}`;
    const meta = JSON.stringify({ name, mimeType: mime, ...(parent ? { parents: [parent] } : {}) });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
      'utf8'
    );
    const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const body = Buffer.concat([head, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), tail]);
    const res = await call('POST', `${UPLOAD_URL}?uploadType=multipart&fields=id,name,size,mimeType`, {
      headers: {
        'content-type': `multipart/related; boundary=${boundary}`,
        'content-length': String(body.length)
      },
      rawBody: body
    });
    if (!res.ok) {
      const err = driveDown();
      if (res.status === 404) { err.parentMissing = true; err.parentKind = 'entry'; }
      throw err;
    }
    return readJson(res);
  }

  async function uploadEntryFile(code, entryKey, { name, mime, bytes }) {
    for (let attempt = 0; ; attempt++) {
      try {
        const parent = await ensureEntryFolder(code, entryKey);
        return await uploadFile({ name, mime, bytes, parent });
      } catch (err) {
        if (!err.parentMissing || attempt >= 3) throw err;
        clearStaleFolder(code, entryKey, err.parentKind);
      }
    }
  }

  async function renameFile(id, name) {
    const res = await call('PATCH', `${API}/files/${encodeURIComponent(id)}?fields=id,name`, {
      json: { name }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw driveDown();
    return readJson(res);
  }

  async function getFileMeta(id) {
    const res = await call('GET', `${API}/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents,trashed`);
    if (res.status === 404) return null;
    if (!res.ok) throw driveDown();
    return readJson(res);
  }

  async function deleteFile(id) {
    const res = await call('DELETE', `${API}/files/${encodeURIComponent(id)}`);
    if (!res.ok && res.status !== 404) throw driveDown();
  }

  const photoSyncing = new Map(); // `${code}:${entryKey}` -> Promise

  function syncEntryPhotos(code, universityId, entryKey, members) {
    if (!code || !isConnected()) return Promise.resolve();
    const lockKey = `${code}:${entryKey}`;
    const prevJob = photoSyncing.get(lockKey) || Promise.resolve();
    const job = prevJob.catch(() => {}).then(async () => {
      if (!isConnected()) return;
      const settingKey = `drive.photos.${code}.${entryKey}`;
      let prevMap = {};
      try {
        const raw = getSetting(db, settingKey);
        if (raw) prevMap = JSON.parse(raw) || {};
      } catch {
        prevMap = {};
      }

      const fileStmt = db.prepare(
        'SELECT id, sha256, mime, original_name FROM files WHERE id = ? AND university_id = ? AND entry_key = ? AND kind = 0'
      );
      const usedNames = new Set();
      const desired = [];
      for (const m of members || []) {
        if (!m?.id || !m?.photo?.fileId) continue;
        const row = fileStmt.get(Number(m.photo.fileId), universityId, entryKey);
        if (!row) continue;
        const diskPath = path.resolve(config.uploadDir, row.sha256);
        if (!fs.existsSync(diskPath)) continue;
        const ext = PHOTO_MIME_EXT[row.mime] || path.extname(row.original_name).slice(1) || 'webp';
        const fallback = path.basename(row.original_name, path.extname(row.original_name));
        const wanted = memberDrivePhotoName(m, ext, fallback);
        const fileName = uniqueDriveName(usedNames, wanted);
        desired.push({
          memberId: m.id,
          fileId: row.id,
          sha256: row.sha256,
          mime: row.mime,
          fileName,
          diskPath
        });
      }

      const prevIds = Object.keys(prevMap);
      if (desired.length === 0 && prevIds.length === 0) return;

      const desiredByMember = new Map(desired.map(d => [d.memberId, d]));
      const nextMap = { ...prevMap };

      for (const memberId of prevIds) {
        const prev = prevMap[memberId];
        const cur = desiredByMember.get(memberId);
        if (!cur || cur.sha256 !== prev.sha256) {
          if (prev?.driveFileId) await deleteFile(prev.driveFileId);
          delete nextMap[memberId];
        }
      }

      for (const item of desired) {
        const prev = nextMap[item.memberId];
        if (prev && prev.sha256 === item.sha256 && prev.driveFileId) {
          if (prev.name !== item.fileName) {
            const renamed = await renameFile(prev.driveFileId, item.fileName);
            if (renamed) {
              nextMap[item.memberId] = { ...prev, fileId: item.fileId, name: item.fileName };
              continue;
            }
          } else {
            nextMap[item.memberId] = { ...prev, fileId: item.fileId };
            continue;
          }
        }
        const bytes = await fs.promises.readFile(item.diskPath);
        const uploaded = await uploadEntryFile(code, entryKey, {
          name: item.fileName,
          mime: item.mime,
          bytes
        });
        nextMap[item.memberId] = {
          fileId: item.fileId,
          sha256: item.sha256,
          name: item.fileName,
          driveFileId: uploaded.id
        };
      }

      if (Object.keys(nextMap).length > 0) {
        setSetting(db, settingKey, JSON.stringify(nextMap));
      } else {
        deleteSetting(db, settingKey);
      }
    }).finally(() => {
      if (photoSyncing.get(lockKey) === job) photoSyncing.delete(lockKey);
    });
    photoSyncing.set(lockKey, job);
    return job;
  }

  return {
    isConfigured, isConnected, assertConfigured, authUrl, exchangeCode, getAbout,
    ensureRootFolder, ensureUniversityFolder, ensureEntryFolder,
    createResumableSession, createUniversitySession,
    uploadFile, uploadEntryFile, renameFile, getFileMeta, deleteFile, syncEntryPhotos
  };
}

const STATE_COOKIE = 'tta_gstate';
const STATE_PATH = '/api/admin/google';

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Admin routes: /admin/google/connect | callback | status
export default async function driveRoutes(app, { db, config, drive }) {
  const pending = new Map(); // state -> { userId, expires }: single use, bound to the admin
  const takePending = (state, userId) => {
    const p = pending.get(state);
    pending.delete(state);
    return !!p && p.userId === userId && p.expires > Date.now();
  };

  app.get('/admin/google/connect', { preHandler: app.requireAdmin }, async (request, reply) => {
    drive.assertConfigured();
    const state = randomBytes(16).toString('hex');
    for (const [k, v] of pending) if (v.expires <= Date.now()) pending.delete(k);
    pending.set(state, { userId: request.user.id, expires: Date.now() + 600000 });
    reply.setCookie(STATE_COOKIE, state, {
      signed: true, httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: STATE_PATH, maxAge: 600
    });
    return reply.redirect(drive.authUrl(state));
  });

  app.get('/admin/google/callback', {
    preHandler: app.requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string', maxLength: 2048 },
          state: { type: 'string', maxLength: 128 },
          error: { type: 'string', maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    const { code, state, error } = request.query;
    const raw = request.cookies[STATE_COOKIE];
    const cookie = raw ? request.unsignCookie(raw) : { valid: false, value: null };
    reply.clearCookie(STATE_COOKIE, { path: STATE_PATH });
    const fresh = state ? takePending(state, request.user.id) : false;
    if (!state || !cookie.valid || !sameText(cookie.value, state) || !fresh) {
      throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    }
    if (error) return reply.redirect(`${config.appOrigin}/admin?google=denied`);
    if (!code) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    try {
      drive.assertConfigured();
      await drive.exchangeCode(code);
    } catch {
      return reply.redirect(`${config.appOrigin}/admin?google=error`);
    }
    return reply.redirect(`${config.appOrigin}/admin?google=connected`);
  });

  app.get('/admin/google/status', { preHandler: app.requireAdmin }, async () => {
    if (!drive.isConnected()) return { connected: false, email: null, quota: null, folderUrl: null };
    let quota = null;
    try {
      quota = (await drive.getAbout()).quota;
    } catch {
      // revoked token (now forgotten) or Google down: report what we know
    }
    const folderId = getSetting(db, 'drive.root_folder');
    const folderUrl = folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null;
    return { connected: drive.isConnected(), email: getSetting(db, 'google.email'), quota, folderUrl };
  });
}
