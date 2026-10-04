import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { VideoCamera, GithubLogo, GoogleDriveLogo } from '@phosphor-icons/react';

export const ExternalLinksSection = ({ trackId, isLocked }) => {
  const { submissions, updateLink } = usePortal();
  const links = submissions[trackId]?.links || {};

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      border: '1px solid #ECECF1',
      padding: '24px',
      boxShadow: '0 2px 10px rgba(27, 29, 41, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }}>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
          ลิงก์ผลงานภายนอก (External Links)
        </h3>
        <p style={{ fontSize: '13px', color: '#6B6F80', marginTop: '2px' }}>
          แนบลิงก์วิดีโอสาธิต ซอร์สโค้ด หรือโฟลเดอร์คลาวด์สำหรับผลงานขนาดใหญ่
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Video Presentation */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#1B1D29',
            marginBottom: '6px'
          }}>
            <VideoCamera size={16} color="#FF5F1C" weight="fill" />
            <span>ลิงก์วิดีโอคลิปนำเสนอ (YouTube / Vimeo / Loom)</span>
          </label>
          <input
            type="url"
            disabled={isLocked}
            value={links.video || ''}
            onChange={(e) => updateLink(trackId, 'video', e.target.value)}
            placeholder="https://youtu.be/..."
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1.5px solid #E0E1E8',
              fontSize: '13.5px',
              color: '#1B1D29',
              background: isLocked ? '#F6F6F9' : '#FAFAFC',
              cursor: isLocked ? 'not-allowed' : 'text'
            }}
          />
        </div>

        {/* GitHub Repository */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#1B1D29',
            marginBottom: '6px'
          }}>
            <GithubLogo size={16} color="#1B1D29" weight="fill" />
            <span>GitHub Repository (สำหรับ Software / Hardware)</span>
          </label>
          <input
            type="url"
            disabled={isLocked}
            value={links.github || ''}
            onChange={(e) => updateLink(trackId, 'github', e.target.value)}
            placeholder="https://github.com/..."
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1.5px solid #E0E1E8',
              fontSize: '13.5px',
              color: '#1B1D29',
              background: isLocked ? '#F6F6F9' : '#FAFAFC',
              cursor: isLocked ? 'not-allowed' : 'text'
            }}
          />
        </div>

        {/* Google Drive */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#1B1D29',
            marginBottom: '6px'
          }}>
            <GoogleDriveLogo size={16} color="#0A65B0" weight="fill" />
            <span>Google Drive / Cloud Storage</span>
          </label>
          <input
            type="url"
            disabled={isLocked}
            value={links.drive || ''}
            onChange={(e) => updateLink(trackId, 'drive', e.target.value)}
            placeholder="https://drive.google.com/..."
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1.5px solid #E0E1E8',
              fontSize: '13.5px',
              color: '#1B1D29',
              background: isLocked ? '#F6F6F9' : '#FAFAFC',
              cursor: isLocked ? 'not-allowed' : 'text'
            }}
          />
        </div>
      </div>
    </div>
  );
};
