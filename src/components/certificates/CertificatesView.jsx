import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { CERTIFICATES } from '../../data/referenceData';
import { Certificate, DownloadSimple, Clock } from '@phosphor-icons/react';

// Certificates for the coordinator's own university, one row per track.
// Download links come from CERTIFICATES in referenceData.js (empty until files are ready).
export const CertificatesView = () => {
  const { user } = usePortal();
  const readyCount = TRACKS.filter(t => CERTIFICATES[t.id]).length;

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px' }}>
      {/* Header */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        padding: '28px',
        marginBottom: '28px',
        boxShadow: '0 2px 8px rgba(27, 29, 41, 0.03)'
      }}>
        <div className="page-kicker">
          <Certificate size={18} weight="bold" />
          <span>เกียรติบัตร</span>
        </div>
        <h1 className="page-title">ดาวน์โหลดเกียรติบัตร</h1>
        <p style={{ fontSize: '15px', color: '#4F5366', marginTop: '4px' }}>
          เกียรติบัตรของ <strong>{user?.university}</strong> สำหรับผู้ประสานงานดาวน์โหลดไปแจกจ่าย
          {' · '}พร้อมดาวน์โหลด {readyCount}/{TRACKS.length} ประเภท
        </p>
      </div>

      {/* List */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #ECECF1',
        boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)',
        overflow: 'hidden'
      }}>
        {TRACKS.map((t, i) => {
          const url = CERTIFICATES[t.id];
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '18px 22px',
                borderTop: i === 0 ? 'none' : '1px solid #F0F1F5'
              }}
            >
              <div>
                <div className="row-title">{t.full}</div>
              </div>

              {url ? (
                <a
                  href={url}
                  download
                  style={{
                    padding: '9px 16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                >
                  <DownloadSimple size={15} weight="bold" />
                  <span>ดาวน์โหลด</span>
                </a>
              ) : (
                <span style={{
                  padding: '9px 16px',
                  borderRadius: '12px',
                  background: '#F6F6F9',
                  color: '#6B6F80',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={15} weight="bold" />
                  <span>ยังไม่เปิดให้ดาวน์โหลด</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
