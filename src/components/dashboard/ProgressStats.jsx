import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import { CheckCircle, Clock, CircleDashed } from '@phosphor-icons/react';

export const ProgressStats = () => {
  const { user, submissions } = usePortal();

  const total = TRACKS.length;
  let submitted = 0;
  let draft = 0;
  let notStarted = 0;

  TRACKS.forEach(t => {
    const s = submissions[t.id]?.status || 'not_started';
    if (s === 'submitted') submitted++;
    else if (s === 'draft') draft++;
    else notStarted++;
  });

  const percentage = Math.round((submitted / total) * 100);

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px',
      padding: '24px',
      border: '1px solid #ECECF1',
      boxShadow: '0 4px 20px -2px rgba(27, 29, 41, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '20px'
    }}>
      {/* Top greeting */}
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#FF5F1C',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>มหาวิทยาลัย</span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#FF5F1C' }} />
          <span>{user?.university}</span>
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1B1D29', letterSpacing: '-0.3px' }}>
          สวัสดี คุณ{user?.name ? user.name.split(' ')[0] : ''}
        </h2>
      </div>

      {/* Progress Bar & percentage */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B6F80' }}>
              ความคืบหน้ารวม
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
              ส่งแล้ว {submitted} จาก {total} ประเภท
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#FF5F1C' }}>
            {percentage}%
          </div>
        </div>

        {/* Progress Bar Track */}
        <div style={{
          width: '100%',
          height: '10px',
          background: '#F0F1F5',
          borderRadius: '20px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FF5F1C 0%, #FF8D20 100%)',
            borderRadius: '20px',
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
          }} />
        </div>
      </div>

      {/* Quick summary badges */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        paddingTop: '8px',
        borderTop: '1px solid #F0F1F5'
      }}>
        <div style={{
          background: '#EAF5FE',
          borderRadius: '14px',
          padding: '10px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#0A65B0', fontSize: '12px', fontWeight: 700 }}>
            <CheckCircle size={14} weight="fill" />
            <span>ส่งแล้ว</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0A65B0', marginTop: '2px' }}>
            {submitted}
          </div>
        </div>

        <div style={{
          background: '#FFF8DB',
          borderRadius: '14px',
          padding: '10px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#8A5A00', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={14} weight="fill" />
            <span>ฉบับร่าง</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#8A5A00', marginTop: '2px' }}>
            {draft}
          </div>
        </div>

        <div style={{
          background: '#F4F5F8',
          borderRadius: '14px',
          padding: '10px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#6B6F80', fontSize: '12px', fontWeight: 700 }}>
            <CircleDashed size={14} weight="bold" />
            <span>ยังไม่เริ่ม</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#4A4E5E', marginTop: '2px' }}>
            {notStarted}
          </div>
        </div>
      </div>
    </div>
  );
};
