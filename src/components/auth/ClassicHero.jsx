import React from 'react';

export const ClassicHero = () => {
  return (
    <div style={{
      flex: '1 1 460px',
      minHeight: '580px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #FF5F1C 0%, #FF8D20 52%, #FFC525 100%)',
      padding: 'clamp(28px, 4vw, 48px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Background drifting shapes */}
      <div style={{
        position: 'absolute',
        top: '-18%',
        left: '-22%',
        width: '78%',
        aspectRatio: '1/1',
        borderRadius: '0 0 100% 0',
        background: 'rgba(255, 255, 255, 0.14)'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-26%',
        right: '-20%',
        width: '72%',
        aspectRatio: '1/1',
        borderRadius: '50%',
        border: 'clamp(36px, 5vw, 64px) solid rgba(255, 255, 255, 0.15)'
      }} />

      <div style={{
        position: 'absolute',
        top: '58%',
        left: '8%',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: '#2A9FF7',
        opacity: 0.35,
        filter: 'blur(70px)'
      }} />

      {/* Main card */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        width: 'min(100%, 460px)'
      }}>
        <div
          className="animate-float"
          style={{
            width: '100%',
            background: '#FFFFFF',
            borderRadius: '32px',
            padding: 'clamp(28px, 4vw, 44px) clamp(28px, 4vw, 48px)',
            boxShadow: '0 40px 80px -30px rgba(120, 40, 0, 0.55), 0 2px 0 rgba(255, 255, 255, 0.6) inset'
          }}
        >
          <img
            src="/assets/ttaa13-logo.png"
            alt="Thailand Teaching Academy Award 13th"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px 12px',
          background: 'rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '14.5px',
          fontWeight: 700,
          color: '#1B1D29'
        }}>
          <span>ระบบผู้ประสานงานมหาวิทยาลัย</span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1B1D29' }} />
          <span style={{ fontWeight: 600 }}>ปิดรับผลงาน 15 ม.ค. 2570</span>
        </div>
      </div>
    </div>
  );
};
