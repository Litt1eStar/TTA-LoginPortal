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
    if (where === 'https://www.googleapis.com/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(init.body);
      const id = `folder-${++seq}`;
      files.set(id, { id, name: body.name, mimeType: body.mimeType, parents: body.parents || [] });
      return json(200, { id });
    }
    if (where === 'https://www.googleapis.com/upload/drive/v3/files' && method === 'POST') {
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
      return json(200, { ...files.get(id), trashed: false });
    }
    return json(500, { error: `fake google: unhandled ${method} ${where}` });
  }

  const addFile = (meta) => files.set(meta.id, meta);
  const foldersNamed = (name) =>
    [...files.values()].filter(f => f.mimeType === FOLDER_MIME && f.name === name);
  return { fetch, calls, files, addFile, foldersNamed };
}
