import React from 'react';
import { WarningCircle, X, Check, LockSimple } from '@phosphor-icons/react';

export const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, track, submission }) => {
  if (!isOpen) return null;

  const advisors = (submission.members || []).filter(m => m.type === 'advisor').length;
  const students = (submission.members || []).filter(m => m.type === 'student').length;
  const filesCount = (submission.files || []).filter(f => f.status === 'done').length;
  const linksCount = ['video', 'github', 'drive'].filter(k => submission.links && submission.links[k]).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(22, 24, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '16px'
    }}>
      <div
        className="animate-slide-up"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: 'min(100%, 480px)',
          boxShadow: '0 24px 60px -12px rgba(22, 24, 42, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #ECECF1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: '#FFF1EB',
              color: '#FF5F1C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LockSimple size={20} weight="fill" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
                ยืนยันการส่งผลงาน
              </h3>
              <p style={{ fontSize: '12.5px', color: '#6B6F80' }}>
                {track?.th} ({track?.en})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#6B6F80',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#FFF8F4',
            border: '1px solid #FFD0BD',
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            gap: '10px'
          }}>
            <WarningCircle size={20} weight="fill" color="#FF5F1C" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#1B1D29', lineHeight: 1.5 }}>
              เมื่อยืนยันส่งผลงานแล้ว <strong>ระบบจะล็อกข้อมูลและไม่สามารถแก้ไขได้</strong> เพื่อให้คณะกรรมการเริ่มการพิจารณาตัดสิน
            </div>
          </div>

          {/* Submission Summary Box */}
          <div style={{
            background: '#FAFAFC',
            border: '1px solid #ECECF1',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#6B6F80', textTransform: 'uppercase' }}>
                ชื่อผลงาน
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1B1D29', marginTop: '2px' }}>
                {submission.projectName || '—'}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              borderTop: '1px solid #ECECF1',
              paddingTop: '10px'
            }}>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6B6F80', fontWeight: 600 }}>ทีมผู้จัดทำ</div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B1D29' }}>
                  อาจารย์ {advisors} ท่าน · นศ. {students} คน
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6B6F80', fontWeight: 600 }}>ไฟล์และลิงก์</div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B1D29' }}>
                  {filesCount} ไฟล์ · {linksCount} ลิงก์
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #ECECF1',
          background: '#FAFAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid #E0E1E8',
              color: '#6B6F80',
              fontWeight: 600,
              fontSize: '13.5px'
            }}
          >
            กลับไปตรวจสอบ
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(255, 95, 28, 0.35)'
            }}
          >
            <Check size={16} weight="bold" />
            <span>ยืนยันส่งผลงาน</span>
          </button>
        </div>
      </div>
    </div>
  );
};
