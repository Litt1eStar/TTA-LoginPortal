import React from 'react';
import { usePortal } from '../../context/PortalContext';

export const ProjectInfoSection = ({ trackId, isLocked, error }) => {
  const { submissions, updateField } = usePortal();
  const sub = submissions[trackId] || {};

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
          ข้อมูลผลงาน (Project Information)
        </h3>
        <p style={{ fontSize: '13px', color: '#6B6F80', marginTop: '2px' }}>
          ระบุชื่อผลงานและบทคัดย่อสรุปเนื้อหาสำคัญสำหรับคณะกรรมการพิจารณา
        </p>
      </div>

      {/* Project Name */}
      <div>
        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#1B1D29', marginBottom: '8px' }}>
          ชื่อผลงาน (Project Title) <span style={{ color: '#FF5F1C' }}>*</span>
        </label>
        <input
          type="text"
          disabled={isLocked}
          value={sub.projectName || ''}
          onChange={(e) => updateField(trackId, 'projectName', e.target.value)}
          placeholder="เช่น สื่อการสอนนวัตกรรมดิจิทัลเพื่อพัฒนาทักษะแห่งศตวรรษที่ 21"
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: '12px',
            border: error ? '1.5px solid #FF5F1C' : '1.5px solid #E0E1E8',
            fontSize: '14.5px',
            color: '#1B1D29',
            background: isLocked ? '#F6F6F9' : '#FAFAFC',
            cursor: isLocked ? 'not-allowed' : 'text'
          }}
        />
        {error && (
          <div style={{ fontSize: '12.5px', color: '#FF5F1C', marginTop: '6px', fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>

      {/* Summary */}
      <div>
        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#1B1D29', marginBottom: '8px' }}>
          บทคัดย่อ / สรุปสาระสำคัญ (Executive Summary)
        </label>
        <textarea
          rows={4}
          disabled={isLocked}
          value={sub.summary || ''}
          onChange={(e) => updateField(trackId, 'summary', e.target.value)}
          placeholder="สรุปแนวคิด วัตถุประสงค์ วิธีการดำเนินงาน และประโยชน์ที่ได้รับ..."
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: '12px',
            border: '1.5px solid #E0E1E8',
            fontSize: '14px',
            color: '#1B1D29',
            background: isLocked ? '#F6F6F9' : '#FAFAFC',
            resize: 'vertical',
            lineHeight: 1.5,
            cursor: isLocked ? 'not-allowed' : 'text'
          }}
        />
      </div>

      {/* Notes */}
      <div>
        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#1B1D29', marginBottom: '8px' }}>
          หมายเหตุเพิ่มเติมถึงคณะกรรมการ (Notes)
        </label>
        <input
          type="text"
          disabled={isLocked}
          value={sub.notes || ''}
          onChange={(e) => updateField(trackId, 'notes', e.target.value)}
          placeholder="ข้อมูลเฉพาะ อุปกรณ์ที่ต้องใช้ หรือคำแนะนำในการทดสอบ (ถ้ามี)"
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: '12px',
            border: '1.5px solid #E0E1E8',
            fontSize: '14px',
            color: '#1B1D29',
            background: isLocked ? '#F6F6F9' : '#FAFAFC',
            cursor: isLocked ? 'not-allowed' : 'text'
          }}
        />
      </div>
    </div>
  );
};
