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
