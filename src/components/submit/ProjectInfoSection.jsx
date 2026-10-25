import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { WarningCircle } from '@phosphor-icons/react';

export const ProjectInfoSection = ({ trackId, isLocked, error, number }) => {
  const { submissions, updateField } = usePortal();
  const sub = submissions[trackId] || {};

  return (
    <div className="card" id="section-projectName">
      <div>
        <h3 className="section-title">
          {number && <span className="section-num">{number}</span>}
          ข้อมูลผลงาน
        </h3>
        <p className="section-desc">ชื่อผลงานและสรุปเนื้อหาสำหรับคณะกรรมการ</p>
      </div>

      <div>
        <label className="field-label" htmlFor="p-name">
          ชื่อผลงาน <span className="required">*</span>
        </label>
        <input
          id="p-name"
          type="text"
          className={`input ${error ? 'has-error' : ''}`}
          disabled={isLocked}
          value={sub.projectName || ''}
          onChange={(e) => updateField(trackId, 'projectName', e.target.value)}
          placeholder="เช่น เรียนรู้ไฟฟ้าใน 60 วินาที"
        />
        {error && <div className="field-error"><WarningCircle size={16} weight="fill" />{error}</div>}
      </div>

      <div>
        <label className="field-label" htmlFor="p-summary">สรุปผลงาน</label>
        <textarea
          id="p-summary"
          rows={4}
          className="textarea"
          disabled={isLocked}
          value={sub.summary || ''}
          onChange={(e) => updateField(trackId, 'summary', e.target.value)}
          placeholder="แนวคิด วัตถุประสงค์ และประโยชน์ที่ได้รับ"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="p-notes">หมายเหตุถึงคณะกรรมการ</label>
        <input
          id="p-notes"
          type="text"
          className="input"
          disabled={isLocked}
          value={sub.notes || ''}
          onChange={(e) => updateField(trackId, 'notes', e.target.value)}
          placeholder="ถ้ามี"
        />
      </div>
    </div>
  );
};
