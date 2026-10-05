import React from 'react';
import {
  ChalkboardTeacher,
  Robot,
  MicrophoneStage,
  Flask,
  Code
} from '@phosphor-icons/react';

export const MosaicHero = () => {
  // Tile geometry and styles
  const G = '#FF5F1C';
  const B = '#16182A';
  const YE = '#FFC525';
  const Y = '#FFF8DB';
  const GH = '#2A9FF7';

  const radiusMap = {
    qbr: '0 0 100% 0',
    circle: '50%',
    leaf: '100% 0 100% 0',
    sq: '24px',
    arch: '100% 100% 0 0',
    qtl: '100% 0 0 0',
    qtr: '0 100% 0 0',
    leaf2: '0 100% 0 100%',
    qbl: '0 0 0 100%'
  };

  const tiles = [
    { type: 'shape', shape: 'qbr', bg: G },
    { type: 'icon', bg: B, Icon: ChalkboardTeacher, color: '#FFFFFF' },
    { type: 'shape', shape: 'circle', bg: YE },
    { type: 'shape', shape: 'leaf', bg: Y },

    { type: 'shape', shape: 'sq', bg: GH },
    { type: 'shape', shape: 'arch', bg: G },
    { type: 'icon', bg: YE, Icon: Robot, color: '#1B1D29' },
    { type: 'shape', shape: 'qtl', bg: B },

    { type: 'logo' }, // Spans full width (1 / -1)

    { type: 'icon', bg: G, Icon: MicrophoneStage, color: '#FFFFFF' },
    { type: 'shape', shape: 'qtr', bg: YE },
    { type: 'shape', shape: 'circle', bg: B },
    { type: 'icon', bg: GH, Icon: Flask, color: '#FFC525' },

    { type: 'shape', shape: 'leaf2', bg: B },
    { type: 'icon', bg: '#FFFFFF', Icon: Code, color: '#FF5F1C' },
    { type: 'shape', shape: 'qbl', bg: G },
    { type: 'shape', shape: 'arch', bg: Y }
  ];

  return (
    <div style={{
      flex: '1 1 460px',
      minHeight: '580px',
      position: 'relative',
      overflow: 'hidden',
      background: '#16182A',
      padding: 'clamp(28px, 4vw, 48px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '28px'
    }}>
      {/* 4x4 Grid with Logo */}
      <div style={{
        width: 'min(100%, 420px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '12px'
      }}>
        {tiles.map((t, idx) => {
          const delay = idx * 60;

          if (t.type === 'logo') {
            return (
              <div
                key="logo"
                style={{
                  gridColumn: '1 / -1',
                  aspectRatio: '2 / 1',
                  background: '#FFFFFF',
                  borderRadius: '28px 140px 28px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '7% 5.5% 7% 8%',
                  boxShadow: '0 24px 60px -20px rgba(255, 95, 28, 0.6)',
                  animation: `ttaa-pop 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`
                }}
              >
                <img
                  src="/assets/ttaa13-logo.png"
                  alt="Thailand Teaching Academy Award 13th"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            );
          }

          if (t.type === 'icon') {
            const IconComp = t.Icon;
            return (
              <div
                key={idx}
                style={{
                  aspectRatio: '1 / 1',
                  animation: `ttaa-pop 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: t.bg,
                  borderRadius: '22%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: `ttaa-float 5s ease-in-out ${idx * 300}ms infinite`
                }}>
                  <IconComp size={32} weight="duotone" color={t.color} />
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              style={{
                aspectRatio: '1 / 1',
                animation: `ttaa-pop 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                background: t.bg,
                borderRadius: radiusMap[t.shape] || '20%',
                animation: `ttaa-turn 9s cubic-bezier(0.6, 0, 0.2, 1) ${1400 + idx * 400}ms infinite`
              }} />
            </div>
          );
        })}
      </div>

      {/* Sub-label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: '13.5px',
        fontWeight: 600,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <span>ระบบผู้ประสานงานมหาวิทยาลัย</span>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#FF8D20' }} />
        <span>ปิดรับผลงาน 15 ม.ค. 2570</span>
      </div>
    </div>
  );
};
