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
