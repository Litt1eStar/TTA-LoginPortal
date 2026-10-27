import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { SectionNum } from './SectionNum';
import { MemberModal } from './MemberModal';
import { CsvImportModal } from './CsvImportModal';
import { initials } from '../../utils/formatters';
import { getTrack } from '../../data/tracks';
import { Plus, FileCsv, PencilSimple, Trash, Crown, WarningCircle } from '@phosphor-icons/react';

const fullTitleName = (m) => [m.title, m.fullName].filter(Boolean).join(' ');

export const TeamMembersSection = ({ trackId, isLocked, error, number, done }) => {
  const { submissions, removeMember, makeLeader } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [modalType, setModalType] = useState('student');
  const [editingMember, setEditingMember] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const track = getTrack(trackId);
  const advisorLimit = track.advisorCount || 1;
  const maxCompetitors = track.maxCompetitors;
  const advisors = sub.members.filter(m => m.type === 'advisor');
  const students = sub.members.filter(m => m.type === 'student');
  const canAddAdvisor = advisors.length < advisorLimit;
  const canAddStudent = !maxCompetitors || students.length < maxCompetitors;

  const openAdd = (type) => {
    setModalType(type);
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const openEdit = (member) => {
    setModalType(member.type);
    setEditingMember(member);
    setMemberModalOpen(true);
  };

  const missing = (key, text) => <span key={key} style={{ color: 'var(--danger)', fontWeight: 600 }}>{text}</span>;

  // Second line under a name: department · student ID · year (missing info shown in red)
  const metaLine = (m) => [
    m.dept || missing('nodept', 'ยังไม่ระบุหน่วยงาน'),
    !m.photo?.dataUrl && missing('nophoto', 'ยังไม่มีรูปถ่าย'),
    m.studentId,
    m.year ? `ปี ${m.year}` : ''
  ].filter(Boolean).reduce((acc, part, i) => (i === 0 ? [part] : [...acc, ' · ', part]), []);

  // Person's photo, or initials until a photo is uploaded
  const avatar = (m, colors) => (
    <div className="avatar" style={{ ...colors, overflow: 'hidden', width: '48px', height: '48px' }}>
      {m.photo?.dataUrl
        ? <img src={m.photo.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(m.fullName)}
    </div>
  );

  const rowActions = (m, extra = null) => !isLocked && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {extra}
      <button type="button" className="btn btn-sm" onClick={() => openEdit(m)}>
        <PencilSimple size={15} weight="bold" />
        <span>แก้ไข</span>
      </button>
      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeMember(trackId, m.id)}>
        <Trash size={15} weight="bold" />
        <span>ลบ</span>
      </button>
    </div>
  );

  return (
    <div className="card" id="section-team">
      {/* Header */}
      <div className="section-head">
        <div>
          <h3 className="section-title">
            <SectionNum number={number} done={done} />
            รายชื่อทีม <span className="required">*</span>
          </h3>
          <p className="section-desc">
            อาจารย์ที่ปรึกษา {advisorLimit > 1 ? `1-${advisorLimit}` : '1'} ท่าน
            {' และ '}ผู้แข่งขัน {maxCompetitors > 1 ? `1-${maxCompetitors}` : '1'} คน ทุกคนต้องมีรูปถ่ายและหน่วยงาน
          </p>
        </div>

        {!isLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {canAddAdvisor && (
              <button type="button" className="btn btn-yellow" onClick={() => openAdd('advisor')}>
                <Plus size={16} weight="bold" />
                <span>เพิ่มอาจารย์</span>
              </button>
            )}
            {canAddStudent && (
              <button type="button" className="btn btn-blue" onClick={() => openAdd('student')}>
                <Plus size={16} weight="bold" />
                <span>เพิ่มผู้แข่งขัน</span>
              </button>
            )}
            <button type="button" className="btn" onClick={() => setCsvModalOpen(true)}>
              <FileCsv size={18} weight="bold" color="var(--primary)" />
              <span>นำเข้า CSV</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <WarningCircle size={18} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {/* Advisors */}
      <div>
        <div className="subhead">
          อาจารย์ที่ปรึกษา{' '}
          <span className="badge badge-yellow">{advisors.length}/{advisorLimit}</span>
        </div>

        {advisors.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {advisors.map(a => (
              <div key={a.id} className="row-item" style={{ background: '#FFFDF5', borderColor: '#F5E8BE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  {avatar(a, { background: 'var(--yellow-bg)', color: '#B07A00' })}
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title">{fullTitleName(a)}</div>
                    <div className="row-meta">{metaLine(a)}</div>
                  </div>
                </div>
                {rowActions(a)}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`dropzone ${isLocked ? '' : 'clickable'}`}
            onClick={() => !isLocked && openAdd('advisor')}
          >
            <div>ยังไม่มีอาจารย์ที่ปรึกษา</div>
            {!isLocked && <div className="dropzone-action">+ เพิ่มอาจารย์ที่ปรึกษา</div>}
          </div>
        )}
      </div>

      {/* Competitors */}
      <div>
        <div className="subhead">
          ผู้แข่งขัน{' '}
          <span className="badge badge-blue">{students.length}{maxCompetitors ? `/${maxCompetitors}` : ''}</span>
        </div>

        {students.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((st, index) => (
              <div key={st.id} className="row-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  {avatar(st, {
                    background: st.isLeader ? 'var(--primary-subtle)' : 'var(--blue-bg)',
                    color: st.isLeader ? 'var(--primary)' : 'var(--blue-text)'
                  })}
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{index + 1}. {fullTitleName(st)}</span>
                      {st.isLeader && (
                        <span className="badge badge-orange">
                          <Crown size={13} weight="fill" />
                          หัวหน้าทีม
                        </span>
                      )}
                    </div>
                    <div className="row-meta">{metaLine(st)}</div>
                  </div>
                </div>
                {rowActions(st, !st.isLeader && students.length > 1 && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => makeLeader(trackId, st.id)}>
                    <Crown size={15} weight="bold" />
                    <span>ตั้งเป็นหัวหน้า</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`dropzone ${isLocked ? '' : 'clickable'}`}
            onClick={() => !isLocked && openAdd('student')}
          >
            <div>ยังไม่มีผู้แข่งขัน (ต้องมีอย่างน้อย 1 คน)</div>
            {!isLocked && <div className="dropzone-action">+ เพิ่มผู้แข่งขัน หรือนำเข้าจากไฟล์ CSV</div>}
          </div>
        )}
      </div>

      <MemberModal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        trackId={trackId}
        initialType={modalType}
        initialMember={editingMember}
      />

      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        trackId={trackId}
      />
    </div>
  );
};
