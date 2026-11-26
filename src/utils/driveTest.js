// Admin "test Google Drive upload" runner. Pure apart from the injected api / upload, so it is
// unit-tested; DriveTestCard.jsx only renders the steps it reports.

import { uploadResumable } from './resumableUpload.js';

// One entry per step: what it checks, and what to look at when it fails.
export const BROWSER_STEPS = [
  {
    label: 'เซิร์ฟเวอร์ขอสิทธิ์อัปโหลดจาก Google Drive',
    hint: 'ตรวจสถานะการเชื่อมต่อ Google Drive ด้านบน (ถ้าหมดอายุให้กด "เชื่อมต่อบัญชีอื่น" แล้วเลือกบัญชีเดิม) และค่า GOOGLE_* / TOKEN_KEY ใน .env'
  },
  {
    label: 'เบราว์เซอร์ส่งไฟล์ไป Google Drive',
    hint: 'เบราว์เซอร์ส่งไฟล์ตรงไป Google: ตรวจว่าเปิดเว็บผ่าน https และ APP_ORIGIN ใน .env ตรงกับที่อยู่เว็บ (เช่น https://tta2027.kmutt.ac.th) และเครือข่ายไม่บล็อก googleapis.com'
  },
  {
    label: 'ตรวจไฟล์ใน Google Drive',
    hint: 'ไฟล์ไปไม่ครบหรือไม่อยู่ในโฟลเดอร์ทดสอบ: ลองอีกครั้ง ถ้ายังไม่ผ่านให้ดูโฟลเดอร์ทดสอบใน Google Drive'
  }
];

export const SERVER_STEPS = [
  {
    label: 'เซิร์ฟเวอร์อัปโหลดไฟล์ไป Google Drive (แบบเดียวกับการซิงก์รูปสมาชิก)',
    hint: 'ตรวจสถานะการเชื่อมต่อ Google Drive ด้านบน และว่าเซิร์ฟเวอร์ออกอินเทอร์เน็ตไปยัง googleapis.com ได้'
  }
];

const errorText = (err) =>
  err?.name === 'AbortError' ? 'ยกเลิกแล้ว' : (err?.message || 'ไม่สำเร็จ');

// onStep(index, { status: 'running' | 'ok' | 'fail', progress?, message? })
export async function runBrowserUploadTest({ file, api, uploadImpl = uploadResumable, onStep, signal }) {
  let step = 0;
  try {
    onStep(0, { status: 'running' });
    const { uploadUrl, folderUrl } = await api.post('/admin/drive-test/session', {
      name: file.name, size: file.size, mime: file.type || 'application/octet-stream'
    });
    onStep(0, { status: 'ok' });

    step = 1;
    onStep(1, { status: 'running', progress: 0 });
    const { driveFileId } = await uploadImpl({
      uploadUrl, file, signal, maxRetries: 2,
      onProgress: (progress) => onStep(1, { status: 'running', progress })
    });
    onStep(1, { status: 'ok', progress: 100 });

    step = 2;
    onStep(2, { status: 'running' });
    const confirmed = await api.post('/admin/drive-test/confirm', { driveFileId, size: file.size });
    onStep(2, { status: 'ok' });
    return { ok: true, file: confirmed.file, folderUrl: confirmed.folderUrl || folderUrl };
  } catch (err) {
    onStep(step, { status: 'fail', message: errorText(err) });
    return { ok: false, hint: BROWSER_STEPS[step].hint };
  }
}

export async function runServerUploadTest({ api, onStep }) {
  try {
    onStep(0, { status: 'running' });
    const { file, folderUrl } = await api.post('/admin/drive-test/server', {});
    onStep(0, { status: 'ok' });
    return { ok: true, file, folderUrl };
  } catch (err) {
    onStep(0, { status: 'fail', message: errorText(err) });
    return { ok: false, hint: SERVER_STEPS[0].hint };
  }
}

// ~200 KB text file, so the test is quick but still moves real data.
export function makeSampleFile(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const line = `TTA 2027 portal: browser -> Google Drive upload test, ${now.toISOString()}\n`;
  const text = line.repeat(Math.ceil((200 * 1024) / line.length));
  return new File([text], `tta-upload-test-${stamp}.txt`, { type: 'text/plain' });
}
