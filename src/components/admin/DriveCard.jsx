import React, { useCallback, useEffect, useState } from 'react';
import { GoogleDriveLogo, ArrowsClockwise } from '@phosphor-icons/react';
import { api } from '../../api';

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);

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
    <section className="card" aria-labelledby="drive-title">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GoogleDriveLogo size={26} weight="duotone" color="var(--blue)" />
          <h2 id="drive-title" className="section-title">Google Drive (วิดีโอสื่อสร้างสรรค์)</h2>
        </div>
        <button type="button" className="btn btn-sm" onClick={load} disabled={state.loading}>
          <ArrowsClockwise size={16} /> รีเฟรช
        </button>
      </div>

      {state.loading && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด…</p>}
      {state.error && <p role="alert" style={{ color: 'var(--danger)' }}>{state.error}</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className={data.connected ? 'badge badge-blue' : 'badge badge-orange'}>
              {data.connected ? 'เชื่อมต่อแล้ว' : 'ต้องเชื่อมต่อใหม่'}
            </span>
            {data.email && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{data.email}</span>}
          </div>

          {data.connected && data.quota && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="seg-tip-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dark)' }}>
                {limit
                  ? <>ใช้ไป {gb(usage)} GB จาก {gb(limit)} GB · เหลือ <strong>{gb(Math.max(0, limit - usage))} GB</strong></>
                  : <>ใช้ไป {gb(usage)} GB (ไม่จำกัดพื้นที่)</>}
              </div>
            </div>
          )}

          <div>
            <a className={data.connected ? 'btn btn-sm' : 'btn btn-primary btn-sm'} href="/api/admin/google/connect">
              <GoogleDriveLogo size={16} /> {data.connected ? 'เชื่อมต่อบัญชีอื่น' : 'เชื่อมต่อ Google Drive'}
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
