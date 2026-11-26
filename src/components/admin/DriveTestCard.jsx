import React, { useEffect, useRef, useState } from 'react';
import {
  TestTube, Browser, HardDrives, UploadSimple, CheckCircle, XCircle, CircleNotch, Circle, Trash, ArrowSquareOut
} from '@phosphor-icons/react';
import { api } from '../../api';
import { formatSize } from '../../utils/formatters';
import { MAX_VIDEO_MB } from '../../utils/resumableUpload';
import { BROWSER_STEPS, SERVER_STEPS, runBrowserUploadTest, runServerUploadTest, makeSampleFile } from '../../utils/driveTest';

const STATUS_ICON = {
  idle: <Circle size={18} aria-hidden="true" />,
  running: <CircleNotch size={18} className="adm-spin" aria-hidden="true" />,
  ok: <CheckCircle size={18} weight="fill" aria-hidden="true" />,
  fail: <XCircle size={18} weight="fill" aria-hidden="true" />
};
const STATUS_TEXT = { idle: 'รอ', running: 'กำลังทำ', ok: 'ผ่าน', fail: 'ไม่ผ่าน' };

const newRun = (kind, title, steps) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind, title, startedAt: Date.now(), finishedAt: null, result: null,
  steps: steps.map(s => ({ label: s.label, status: 'idle', progress: null, message: '' }))
});

// Admin: check that uploads to Google Drive work, on the same paths the portal uses.
export const DriveTestCard = () => {
  const [runs, setRuns] = useState([]);           // newest first
  const [busy, setBusy] = useState(false);
  const [folderUrl, setFolderUrl] = useState(null);
  const [cleanMsg, setCleanMsg] = useState('');
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchRun = (id, fn) => setRuns(rs => rs.map(r => (r.id === id ? fn(r) : r)));
  const stepUpdater = (id) => (index, patch) => patchRun(id, r => ({
    ...r,
    steps: r.steps.map((s, i) => (i === index ? { ...s, ...patch } : s))
  }));
  const finish = (id, result) => {
    patchRun(id, r => ({ ...r, finishedAt: Date.now(), result }));
    if (result.folderUrl) setFolderUrl(result.folderUrl);
  };

  const testBrowser = async (file, title) => {
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setCleanMsg(`ไฟล์ทดสอบต้องไม่เกิน ${MAX_VIDEO_MB} MB`);
      return;
    }
    setCleanMsg('');
    const run = newRun('browser', `${title}: ${file.name} (${formatSize(file.size)})`, BROWSER_STEPS);
    setRuns(rs => [run, ...rs]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      finish(run.id, await runBrowserUploadTest({ file, api, onStep: stepUpdater(run.id), signal: controller.signal }));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const testServer = async () => {
    setCleanMsg('');
    const run = newRun('server', 'เซิร์ฟเวอร์ → Google Drive', SERVER_STEPS);
    setRuns(rs => [run, ...rs]);
    setBusy(true);
    try {
      finish(run.id, await runServerUploadTest({ api, onStep: stepUpdater(run.id) }));
    } finally {
      setBusy(false);
    }
  };

  const uploaded = runs.filter(r => r.result?.ok && r.result.file && !r.deleted);

  const deleteTestFiles = async () => {
    setBusy(true);
    setCleanMsg('');
    let failed = 0;
    for (const r of uploaded) {
      try {
        await api.del(`/admin/drive-test/${encodeURIComponent(r.result.file.id)}`);
        patchRun(r.id, x => ({ ...x, deleted: true }));
      } catch {
        failed += 1;
      }
    }
    setCleanMsg(failed ? `ลบไม่สำเร็จ ${failed} ไฟล์ ลองใหม่หรือลบในโฟลเดอร์ทดสอบ` : 'ลบไฟล์ทดสอบแล้ว');
    setBusy(false);
  };

  return (
    <section className="adm-drive adm-dtest" aria-labelledby="dtest-title">
      <div className="adm-drive-head">
        <h2 id="dtest-title"><TestTube size={24} weight="duotone" /> ทดสอบการอัปโหลด Google Drive</h2>
      </div>
      <p className="adm-note">
        ใช้เส้นทางเดียวกับที่ผู้ประสานงานอัปโหลดวิดีโอ (เบราว์เซอร์ส่งไฟล์ตรงไป Google Drive)
        และการซิงก์รูปสมาชิก (เซิร์ฟเวอร์ส่งไฟล์) ไฟล์ทดสอบจะอยู่ในโฟลเดอร์ <strong>TTA2027 / _ทดสอบอัปโหลด</strong> เท่านั้น
      </p>

      <div className="adm-drive-act">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy}
          onClick={() => testBrowser(makeSampleFile(), 'เบราว์เซอร์ → Google Drive')}>
          <Browser size={16} /> ทดสอบด้วยไฟล์ตัวอย่าง
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <UploadSimple size={16} /> เลือกไฟล์เองเพื่อทดสอบ
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={testServer}>
          <HardDrives size={16} /> ทดสอบจากเซิร์ฟเวอร์
        </button>
        <input ref={inputRef} type="file" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; testBrowser(f, 'เบราว์เซอร์ → Google Drive (ไฟล์ที่เลือก)'); }} />
      </div>
      <p className="adm-note">ไฟล์ที่เลือกเองต้องไม่เกิน {MAX_VIDEO_MB} MB (เท่ากับวิดีโอของผู้ประสานงาน) ใช้ทดสอบไฟล์ใหญ่ได้</p>

      {runs.length > 0 && (
        <ol className="adm-dtest-runs" aria-live="polite">
          {runs.map(r => (
            <li key={r.id} className="adm-dtest-run">
              <div className="adm-dtest-runhead">
                <strong>{r.title}</strong>
                {r.result && (
                  <span className={r.result.ok ? 'badge badge-blue' : 'badge badge-orange'}>
                    {r.result.ok ? 'ผ่าน' : 'ไม่ผ่าน'} · {((r.finishedAt - r.startedAt) / 1000).toFixed(1)} วินาที
                  </span>
                )}
              </div>
              <ul className="adm-dtest-steps">
                {r.steps.map((s, i) => (
                  <li key={i} className={`adm-dtest-step is-${s.status}`}>
                    {STATUS_ICON[s.status]}
                    <span className="sr-only">{STATUS_TEXT[s.status]}: </span>
                    <span>
                      {s.label}
                      {s.status === 'running' && s.progress != null && <span className="num"> {s.progress}%</span>}
                      {s.message && <span className="adm-dtest-msg"> {s.message}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {r.result?.ok && r.result.file && (
                <p className="adm-note">
                  {r.deleted ? 'ลบแล้ว: ' : 'อยู่ใน Drive: '}{r.result.file.name} ({formatSize(r.result.file.size)})
                  {!r.deleted && r.result.file.url && (
                    <> · <a href={r.result.file.url} target="_blank" rel="noopener noreferrer">เปิดไฟล์</a></>
                  )}
                </p>
              )}
              {r.result && !r.result.ok && <p className="adm-note adm-note--error">สิ่งที่ควรตรวจ: {r.result.hint}</p>}
            </li>
          ))}
        </ol>
      )}

      {(folderUrl || uploaded.length > 0 || cleanMsg) && (
        <div className="adm-drive-act">
          {folderUrl && (
            <a className="btn btn-sm" href={folderUrl} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOut size={16} /> เปิดโฟลเดอร์ทดสอบ
            </a>
          )}
          {uploaded.length > 0 && (
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={deleteTestFiles}>
              <Trash size={16} /> ลบไฟล์ทดสอบ ({uploaded.length})
            </button>
          )}
          {cleanMsg && <span className="adm-note" role="status">{cleanMsg}</span>}
        </div>
      )}
    </section>
  );
};
