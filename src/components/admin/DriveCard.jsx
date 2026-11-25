import React, { useCallback, useEffect, useState } from 'react';
import { GoogleDriveLogo, ArrowsClockwise, ArrowSquareOut } from '@phosphor-icons/react';
import { api } from '../../api';

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);
const GB = <abbr title="กิกะไบต์">GB</abbr>;

export const DriveCard = () => {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const data = await api.get('/admin/google/status');
      setState({ loading: false, error: '', data });
    } catch (err) {
      setState({ loading: false, error: err.message || 'โหลดสถานะไม่สำเร็จ', data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const limit = Number(data?.quota?.limit) || 0;
  const usage = Number(data?.quota?.usage) || 0;
  const pct = limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

  return (
    <section className="adm-drive" aria-labelledby="drive-title">
      <div className="adm-drive-head">
        <h2 id="drive-title"><GoogleDriveLogo size={24} weight="duotone" /> Google Drive (วิดีโอสื่อสร้างสรรค์)</h2>
        <button type="button" className="btn btn-sm" onClick={load} disabled={state.loading} aria-busy={state.loading}>
          <ArrowsClockwise size={16} /> รีเฟรช
        </button>
      </div>

      {state.loading && !data && <p className="adm-note">กำลังโหลดสถานะ…</p>}
      {state.error && <p role="alert" className="adm-note adm-note--error">{state.error}</p>}

      {data && (
        <>
          <div className="adm-drive-account">
            <span className={data.connected ? 'badge badge-blue' : 'badge badge-orange'}>
              {data.connected ? 'เชื่อมต่อแล้ว' : 'ต้องเชื่อมต่อใหม่'}
            </span>
            {data.email && <span>{data.email}</span>}
          </div>

          {data.connected && data.quota && (
            <div className="adm-drive-quota">
              <span className="adm-meter" aria-hidden="true"><span style={{ transform: `scaleX(${pct / 100})` }} /></span>
              <span>
                {limit
                  ? <>ใช้ไป <span className="num">{gb(usage)}</span> {GB} จาก <span className="num">{gb(limit)}</span> {GB}, เหลือ <strong className="num">{gb(Math.max(0, limit - usage))}</strong> {GB}</>
                  : <>ใช้ไป <span className="num">{gb(usage)}</span> {GB} (ไม่จำกัดพื้นที่)</>}
              </span>
            </div>
          )}

          <div className="adm-drive-act">
            {data.connected && data.folderUrl && (
              <a className="btn btn-sm" href={data.folderUrl} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut size={16} /> เปิดโฟลเดอร์ใน Google Drive
              </a>
            )}
            <a className={data.connected ? 'btn btn-sm btn-ghost' : 'btn btn-primary btn-sm'} href="/api/admin/google/connect">
              <GoogleDriveLogo size={16} /> {data.connected ? 'เชื่อมต่อบัญชีอื่น' : 'เชื่อมต่อ Google Drive'}
            </a>
          </div>
        </>
      )}
    </section>
  );
};
