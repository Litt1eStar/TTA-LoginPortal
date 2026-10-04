import React from 'react';
import { CountdownTimer } from './CountdownTimer';
import { ProgressStats } from './ProgressStats';
import { UpcomingAlert } from './UpcomingAlert';
import { TrackCard } from './TrackCard';
import { TRACKS } from '../../data/tracks';

export const DashboardView = () => {
  return (
    <div className="app-container" style={{ padding: '36px 20px 60px 20px' }}>
      {/* Top Banner Row: Progress + Countdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <ProgressStats />
        <CountdownTimer />
      </div>

      {/* Upcoming Action Banner */}
      <div style={{ marginBottom: '32px' }}>
        <UpcomingAlert />
      </div>

      {/* 10 Category Tracks Grid */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1B1D29', letterSpacing: '-0.3px' }}>
              ประเภทการแข่งขัน (10 หมวดหมู่)
            </h2>
            <p style={{ fontSize: '14px', color: '#6B6F80', marginTop: '2px' }}>
              คลิกประเภทที่ต้องการเพื่อจัดการรายชื่อทีมและอัปโหลดผลงาน
            </p>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B6F80' }}>
            Thailand Teaching Academy Award ครั้งที่ 13
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '18px'
        }}>
          {TRACKS.map(track => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </div>
    </div>
  );
};
