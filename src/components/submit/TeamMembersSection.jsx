import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { MemberModal } from './MemberModal';
import { CsvImportModal } from './CsvImportModal';
import { initials } from '../../utils/formatters';
import {
  UsersThree,
  ChalkboardTeacher,
  Student,
  Plus,
  FileCsv,
  PencilSimple,
  Trash,
  Crown
} from '@phosphor-icons/react';

export const TeamMembersSection = ({ trackId, isLocked, error }) => {
  const { submissions, removeMember, makeLeader } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [modalType, setModalType] = useState('student');
  const [editingMember, setEditingMember] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const advisor = sub.members.find(m => m.type === 'advisor');
  const students = sub.members.filter(m => m.type === 'student');

  const handleOpenAdd = (type) => {
    setModalType(type);
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const handleOpenEdit = (member) => {
    setModalType(member.type);
    setEditingMember(member);
    setMemberModalOpen(true);
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      border: '1px solid #ECECF1',
      padding: '24px',
      boxShadow: '0 2px 10px rgba(27, 29, 41, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '22px'
    }}>
      {/* Header and Action Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
              รายชื่อทีมผู้จัดทำ (Team Roster) <span style={{ color: '#FF5F1C' }}>*</span>
            </h3>
            <span style={{
              background: '#F0F1F5',
              padding: '3px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#4A4E5E'
            }}>
              อาจารย์ {advisor ? 1 : 0} · นักศึกษา {students.length}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#6B6F80', marginTop: '2px' }}>
            ข้อกำหนด: อาจารย์ที่ปรึกษา 1 ท่าน และนักศึกษาอย่างน้อย 1 คนพร้อมกำหนดหัวหน้าทีม
          </p>
        </div>

        {!isLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!advisor && (
              <button
                type="button"
                onClick={() => handleOpenAdd('advisor')}
                style={{
                  background: '#FFF8DB',
                  border: '1px solid rgba(255, 197, 37, 0.4)',
                  color: '#8A5A00',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} weight="bold" />
                <span>เพิ่มอาจารย์</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenAdd('student')}
              style={{
                background: '#EAF5FE',
                border: '1px solid rgba(42, 159, 247, 0.3)',
                color: '#0A65B0',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} weight="bold" />
              <span>เพิ่มนักศึกษา</span>
            </button>

            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              style={{
                background: '#FAFAFC',
                border: '1px solid #ECECF1',
                color: '#1B1D29',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileCsv size={16} weight="bold" color="#FF5F1C" />
              <span>นำเข้า CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: '#FFF1EB',
          border: '1px solid rgba(255, 95, 28, 0.3)',
          color: '#C2410C',
          padding: '10px 14px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          {error}
        </div>
      )}

      {/* 1. Advisor Section */}
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#8A5A00',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px'
        }}>
          อาจารย์ที่ปรึกษา (Faculty Advisor)
        </div>

        {advisor ? (
          <div style={{
            background: '#FFFDF5',
            border: '1px solid #F5E8BE',
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#FFF8DB',
                color: '#D99A00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 800
              }}>
                {initials(advisor.fullName)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#1B1D29' }}>
                    {[advisor.title, advisor.fullName].filter(Boolean).join(' ')}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#FFF8DB',
                    color: '#8A5A00',
                    padding: '2px 8px',
                    borderRadius: '8px'
                  }}>
                    อาจารย์ที่ปรึกษา
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#6B6F80', marginTop: '2px' }}>
                  {[advisor.email, advisor.phone, advisor.dept].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {!isLocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(advisor)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #ECECF1',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#4A4E5E',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <PencilSimple size={13} weight="bold" />
                  <span>แก้ไข</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeMember(trackId, advisor.id)}
                  style={{
                    background: '#FFF1EB',
                    border: '1px solid rgba(255, 95, 28, 0.2)',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#C2410C',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash size={13} weight="bold" />
                  <span>ลบ</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => !isLocked && handleOpenAdd('advisor')}
            style={{
              border: '1.5px dashed #D5D7E0',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              background: '#FAFAFC',
              cursor: isLocked ? 'default' : 'pointer'
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#6B6F80' }}>
              ยังไม่ได้ระบุอาจารย์ที่ปรึกษาสำหรับหมวดหมู่นี้
            </div>
            {!isLocked && (
              <div style={{ fontSize: '12.5px', color: '#FF5F1C', fontWeight: 700, marginTop: '4px' }}>
                + คลิกเพื่อเพิ่มอาจารย์ที่ปรึกษา
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Students Section */}
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#0A65B0',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px'
        }}>
          สมาชิกนักศึกษา (Student Members — {students.length} คน)
        </div>

        {students.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((st, index) => (
              <div
                key={st.id}
                style={{
                  background: '#FAFAFC',
                  border: '1px solid #ECECF1',
                  borderRadius: '16px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: st.isLeader ? '#FFF1EB' : '#EAF5FE',
                    color: st.isLeader ? '#FF5F1C' : '#2A9FF7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 800
                  }}>
                    {initials(st.fullName)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#1B1D29' }}>
                        {index + 1}. {st.fullName}
                      </span>
                      {st.isLeader && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#FFF1EB',
                          color: '#FF5F1C',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <Crown size={12} weight="fill" />
                          <span>หัวหน้าทีม</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B6F80', marginTop: '2px' }}>
                      {[st.studentId, st.email, [st.faculty, st.year ? `ปี ${st.year}` : ''].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>

                {!isLocked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!st.isLeader && students.length > 1 && (
                      <button
                        type="button"
                        onClick={() => makeLeader(trackId, st.id)}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #ECECF1',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#6B6F80',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Crown size={12} weight="bold" />
                        <span>ตั้งเป็นหัวหน้า</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(st)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #ECECF1',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#4A4E5E',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <PencilSimple size={12} weight="bold" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeMember(trackId, st.id)}
                      style={{
                        background: '#FFF1EB',
                        border: '1px solid rgba(255, 95, 28, 0.2)',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#C2410C',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash size={12} weight="bold" />
                      <span>ลบ</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => !isLocked && handleOpenAdd('student')}
            style={{
              border: '1.5px dashed #D5D7E0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              background: '#FAFAFC',
              cursor: isLocked ? 'default' : 'pointer'
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#6B6F80' }}>
              ยังไม่มีนักศึกษาในทีมนี้ (ต้องมีอย่างน้อย 1 คน)
            </div>
            {!isLocked && (
              <div style={{ fontSize: '12.5px', color: '#2A9FF7', fontWeight: 700, marginTop: '4px' }}>
                + คลิกเพื่อเพิ่มนักศึกษา หรือนำเข้าจากไฟล์ CSV
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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
