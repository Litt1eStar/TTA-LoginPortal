import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { CERTIFICATES, CERTIFICATE_SECTIONS } from '../../data/referenceData';
import { Certificate, DownloadSimple, Clock } from '@phosphor-icons/react';

const card = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECF1',
  boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.04)',
  overflow: 'hidden'
};

const pill = {
  padding: '9px 16px',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap'
};

// Certificates for the coordinator's own university, grouped by topic.
// Download links come from CERTIFICATES in referenceData.js (empty until files are ready).
export const CertificatesView = () => {
  const { user } = usePortal();
  const allItems = CERTIFICATE_SECTIONS.flatMap(s => s.items);
  const readyCount = allItems.filter(it => CERTIFICATES[it.key]).length;

  return (
    <div className="app-container" style={{ padding: '36px 20px 80px 20px' }}>
      {/* Header */}
      <div style={{ ...card, padding: '28px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(27, 29, 41, 0.03)', overflow: 'visible' }}>
        <div className="page-kicker">
          <Certificate size={18} weight="bold" />
          <span>เกียรติบัตร</span>
        </div>
        <h1 className="page-title">ดาวน์โหลดเกียรติบัตร</h1>
        <p style={{ fontSize: '15px', color: '#4F5366', marginTop: '4px' }}>
          เกียรติบัตรของ <strong>{user?.university}</strong> สำหรับผู้ประสานงานดาวน์โหลดไปแจกจ่าย
          {' · '}พร้อมดาวน์โหลด {readyCount}/{allItems.length} รายการ
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {CERTIFICATE_SECTIONS.map((section, si) => (
          <section key={section.title || `section-${si}`} style={card}>
            {section.title && (
              <h2 style={{
                fontSize: 'var(--fs-lg)',
                fontWeight: 700,
                color: 'var(--text-dark)',
                padding: '18px 22px',
                background: '#FAFAFC',
                borderBottom: '1px solid #F0F1F5'
              }}>
                {section.title}
              </h2>
            )}

            {section.items.map((it, i) => {
              const url = CERTIFICATES[it.key];
              return (
                <div
                  key={it.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '16px 22px',
                    borderTop: i === 0 ? 'none' : '1px solid #F0F1F5'
                  }}
                >
                  <div className="row-title">{it.label}</div>

                  {url ? (
                    <a
                      href={url}
                      download
                      style={{
                        ...pill,
                        background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
                        color: '#FFFFFF',
                        textDecoration: 'none'
                      }}
                    >
                      <DownloadSimple size={15} weight="bold" />
                      <span>ดาวน์โหลด</span>
                    </a>
                  ) : (
                    <span style={{ ...pill, background: '#F6F6F9', color: '#6B6F80' }}>
                      <Clock size={15} weight="bold" />
                      <span>ยังไม่เปิดให้ดาวน์โหลด</span>
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
};
