import { randomBytes, timingSafeEqual } from 'node:crypto';
import { httpError } from './errors.js';
import { getSetting, setSetting, deleteSetting, deleteSettingsLike } from './settings.js';
import { encrypt, decrypt, isValidTokenKey } from './crypto.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const ROOT_FOLDER_NAME = 'TTA 2027 วิดีโอ';

export const driveUnavailable = (message = 'ยังไม่ได้เชื่อมต่อ Google Drive') =>
  httpError(503, 'drive_unavailable', message);

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

  async function postToken(params) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        ...params
      }).toString()
    });
    const body = await res.json().catch(() => ({}));
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
      if (body.error === 'invalid_grant') deleteSetting(db, 'google.refresh_token'); // revoked: admin must reconnect
      throw driveUnavailable();
    }
    remember(body);
    return cached.token;
  }

  async function call(method, url, { json, headers = {} } = {}) {
    const token = await accessToken();
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(json ? { 'content-type': 'application/json; charset=UTF-8' } : {}),
        ...headers
      },
      body: json ? JSON.stringify(json) : undefined
    });
    if (res.status === 401) cached = null;
    return res;
  }

  async function callJson(method, url, opts) {
    const res = await call(method, url, opts);
    if (!res.ok) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return res.json();
  }

  // Code from the OAuth callback -> stored (encrypted) refresh token, email and root folder.
  async function exchangeCode(code) {
    const { ok, body } = await postToken({ code, redirect_uri: config.google.redirectUri, grant_type: 'authorization_code' });
    if (!ok || !body.refresh_token) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    setSetting(db, 'google.refresh_token', encrypt(body.refresh_token, config.tokenKey));
    remember(body);
    const { email } = await getAbout();
    const previous = getSetting(db, 'google.email');
    if (previous && previous !== email) deleteSettingsLike(db, 'drive.'); // different account: old folder ids are useless
    setSetting(db, 'google.email', email || '');
    await ensureRootFolder();
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

  function ensureFolder(key, name, parent) {
    const existing = getSetting(db, key);
    if (existing) return Promise.resolve(existing);
    if (creating.has(key)) return creating.get(key);
    const job = (async () => {
      const { id } = await callJson('POST', `${API}/files?fields=id`, {
        json: { name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }
      });
      setSetting(db, key, id);
      return id;
    })().finally(() => creating.delete(key));
    creating.set(key, job);
    return job;
  }

  const ensureRootFolder = () => ensureFolder('drive.root_folder', ROOT_FOLDER_NAME, null);

  async function ensureUniversityFolder(code) {
    const root = await ensureRootFolder();
    return ensureFolder(`drive.folder.${code}`, code, root);
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
    if (!res.ok || !location) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return location;
  }

  async function getFileMeta(id) {
    const res = await call('GET', `${API}/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents,trashed`);
    if (res.status === 404) return null;
    if (!res.ok) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
    return res.json();
  }

  async function deleteFile(id) {
    const res = await call('DELETE', `${API}/files/${encodeURIComponent(id)}`);
    if (!res.ok && res.status !== 404) throw driveUnavailable('ไม่สามารถติดต่อ Google Drive ได้ กรุณาลองใหม่');
  }

  return {
    isConfigured, isConnected, assertConfigured, authUrl, exchangeCode, getAbout,
    ensureRootFolder, ensureUniversityFolder, createResumableSession, getFileMeta, deleteFile
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
  app.get('/admin/google/connect', { preHandler: app.requireAdmin }, async (request, reply) => {
    drive.assertConfigured();
    const state = randomBytes(16).toString('hex');
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
    if (!state || !cookie.valid || !sameText(cookie.value, state)) {
      throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    }
    if (error) return reply.redirect(`${config.appOrigin}/admin?google=denied`);
    if (!code) throw httpError(400, 'bad_request', 'ข้อมูลไม่ถูกต้อง');
    drive.assertConfigured();
    await drive.exchangeCode(code);
    return reply.redirect(`${config.appOrigin}/admin?google=connected`);
  });

  app.get('/admin/google/status', { preHandler: app.requireAdmin }, async () => {
    if (!drive.isConnected()) return { connected: false, email: null, quota: null };
    let quota = null;
    try {
      quota = (await drive.getAbout()).quota;
    } catch {
      // revoked token (now forgotten) or Google down: report what we know
    }
    return { connected: drive.isConnected(), email: getSetting(db, 'google.email'), quota };
  });
}
