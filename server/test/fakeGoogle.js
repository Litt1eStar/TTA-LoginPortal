import { encrypt } from '../src/crypto.js';
import { setSetting } from '../src/settings.js';

export const GOOGLE_ENV = {
  TOKEN_KEY: '11'.repeat(32),
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret'
};
export const GOOD_CODE = 'good-code';
export const REFRESH_TOKEN = 'rt-secret-123';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Pretend the admin already connected Google.
export function connectDrive(db, config, token = REFRESH_TOKEN) {
  setSetting(db, 'google.refresh_token', encrypt(token, config.tokenKey));
  setSetting(db, 'google.email', 'lead@gmail.com');
}

// In-memory stand-in for oauth2.googleapis.com and the Drive v3 endpoints we use.
export function fakeGoogle() {
  const calls = [];
  const files = new Map();
  let seq = 0;
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    calls.push({ method, url, headers, body: init.body });
    const where = url.origin + url.pathname;

    if (where === 'https://oauth2.googleapis.com/token') {
      const p = new URLSearchParams(init.body);
      if (p.get('grant_type') === 'authorization_code') {
        if (p.get('code') !== GOOD_CODE) return json(400, { error: 'invalid_grant' });
        return json(200, { access_token: 'at-code', expires_in: 3599, refresh_token: REFRESH_TOKEN, token_type: 'Bearer' });
      }
      if (p.get('refresh_token') !== REFRESH_TOKEN) return json(400, { error: 'invalid_grant' });
      return json(200, { access_token: 'at-refresh', expires_in: 3599, token_type: 'Bearer' });
    }

    if (!/^Bearer at-/.test(headers.get('authorization') || '')) return json(401, { error: { code: 401 } });

    if (where === 'https://www.googleapis.com/drive/v3/about') {
      return json(200, { user: { emailAddress: 'lead@gmail.com' },
        storageQuota: { limit: '16106127360', usage: '1048576' } });
    }
    if (where === 'https://www.googleapis.com/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const nameMatch = /name = '((?:\\'|[^'])*)'/.exec(q);
      const mimeMatch = /mimeType = '([^']*)'/.exec(q);
      const parentMatch = /'((?:\\'|[^'])*)' in parents/.exec(q);
      const wantName = nameMatch ? nameMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
      const wantMime = mimeMatch ? mimeMatch[1] : null;
      const wantParent = parentMatch ? parentMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
      const matched = [...files.values()].filter(f => {
        if (f.trashed) return false;
        if (wantMime && f.mimeType !== wantMime) return false;
        if (wantName !== null && f.name !== wantName) return false;
        if (wantParent !== null && !(f.parents || []).includes(wantParent)) return false;
        return true;
      });
      return json(200, { files: matched });
    }
    if (where === 'https://www.googleapis.com/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(init.body);
      const id = `folder-${String(++seq).padStart(4, "0")}`;
      files.set(id, { id, name: body.name, mimeType: body.mimeType, parents: body.parents || [] });
      return json(200, { id });
    }
    if (where === 'https://www.googleapis.com/upload/drive/v3/files' && method === 'POST') {
      if (url.searchParams.get('uploadType') === 'multipart') {
        const raw = Buffer.isBuffer(init.body) ? init.body.toString('utf8') : String(init.body || '');
        const jsonMatch = /\{[\s\S]*?\}/.exec(raw);
        const meta = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        const id = `file-${String(++seq).padStart(4, "0")}`;
        const entry = {
          id,
          name: meta.name || 'file',
          mimeType: meta.mimeType || 'application/octet-stream',
          parents: meta.parents || [],
          size: String(Buffer.isBuffer(init.body) ? init.body.length : raw.length)
        };
        files.set(id, entry);
        return json(200, entry);
      }
      return new Response(null, { status: 200, headers: {
        location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fake-${++seq}` } });
    }
    const m = where.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (!files.has(id)) return json(404, { error: { code: 404, message: 'File not found' } });
      if (method === 'DELETE') {
        files.delete(id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(init.body || '{}');
        const next = { ...files.get(id), ...patch };
        files.set(id, next);
        return json(200, { ...next, trashed: false });
      }
      return json(200, { ...files.get(id), trashed: false });
    }
    return json(500, { error: `fake google: unhandled ${method} ${where}` });
  }

  const addFile = (meta) => files.set(meta.id, meta);
  const foldersNamed = (name) =>
    [...files.values()].filter(f => f.mimeType === FOLDER_MIME && f.name === name);
  return { fetch, calls, files, addFile, foldersNamed };
}
