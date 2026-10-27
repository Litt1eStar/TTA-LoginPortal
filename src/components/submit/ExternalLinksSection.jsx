import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { SectionNum } from './SectionNum';
import { VideoCamera, GithubLogo, GoogleDriveLogo } from '@phosphor-icons/react';

const LINK_FIELDS = [
  { key: 'video', label: 'ลิงก์วิดีโอ (YouTube / Vimeo)', placeholder: 'https://youtu.be/...', Icon: VideoCamera, color: 'var(--primary)' },
  { key: 'drive', label: 'ลิงก์ Google Drive', placeholder: 'https://drive.google.com/...', Icon: GoogleDriveLogo, color: 'var(--blue-text)' },
  { key: 'github', label: 'ลิงก์ GitHub', placeholder: 'https://github.com/...', Icon: GithubLogo, color: 'var(--text-dark)' }
];

export const ExternalLinksSection = ({ trackId, isLocked, number, done }) => {
  const { submissions, updateLink } = usePortal();
  const links = submissions[trackId]?.links || {};

  return (
    <div className="card" id="section-links">
      <div>
        <h3 className="section-title">
          <SectionNum number={number} done={done} />
          ลิงก์ผลงาน
        </h3>
        <p className="section-desc">แนบลิงก์ หรืออัปโหลดไฟล์ด้านล่าง อย่างน้อย 1 รายการ</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {LINK_FIELDS.map(({ key, label, placeholder, Icon, color }) => (
          <div key={key}>
            <label className="field-label" htmlFor={`l-${key}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon size={18} color={color} weight="fill" />
              <span>{label}</span>
            </label>
            <input
              id={`l-${key}`}
              type="url"
              className="input"
              disabled={isLocked}
              value={links[key] || ''}
              onChange={(e) => updateLink(trackId, key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
