import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { getTrack } from '../../data/tracks';
import { WarningCircle } from '@phosphor-icons/react';

// กลุ่มสาขา picker — only rendered for tracks that have subjectGroups (theory / practice).
// University and department are set per member in MemberModal.
export const FacultySection = ({ trackId, isLocked, error, number }) => {
  const { submissions, updateField } = usePortal();
  const sub = submissions[trackId] || {};
  const groups = getTrack(trackId).subjectGroups || [];

  if (!groups.length) return null;

  return (
    <div className="card" id="section-subjectGroup">
      <div>
        <h3 className="section-title">
          {number && <span className="section-num">{number}</span>}
          กลุ่มสาขา <span className="required">*</span>
        </h3>
        <p className="section-desc">เลือกกลุ่มสาขาที่ส่งเข้าประกวด</p>
      </div>

      <div>
        <select
          aria-label="กลุ่มสาขา"
          className={`select ${error && !sub.subjectGroup ? 'has-error' : ''}`}
          disabled={isLocked}
          value={sub.subjectGroup || ''}
          onChange={(e) => updateField(trackId, 'subjectGroup', e.target.value)}
        >
          <option value="" disabled>— เลือกกลุ่มสาขา —</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {error && !sub.subjectGroup && (
          <div className="field-error"><WarningCircle size={16} weight="fill" />{error}</div>
        )}
      </div>
    </div>
  );
};
