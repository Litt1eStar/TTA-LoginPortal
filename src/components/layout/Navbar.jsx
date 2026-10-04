import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { initials } from '../../utils/formatters';
import {
  SquaresFour,
  PaperPlaneTilt,
  ClockCounterClockwise,
  SignOut,
  ArrowsClockwise
} from '@phosphor-icons/react';

export const Navbar = () => {
  const { user, logout, currentView, setView, resetAllDataToDefault } = usePortal();

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'หน้าหลัก', icon: SquaresFour },
    { id: 'submit', label: 'ส่งผลงาน', icon: PaperPlaneTilt },
    { id: 'history', label: 'ประวัติการส่ง', icon: ClockCounterClockwise }
  ];

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #ECECF1',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(27, 29, 41, 0.04)'
    }}>
      <div className="app-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
        gap: '20px'
      }}>
        {/* Brand & Logo */}
        <div
          onClick={() => setView('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer'
          }}
        >
          <img
            src="/assets/ttaa13-logo.png"
            alt="Thailand Teaching Academy Award 13th"
            style={{ height: '42px', width: 'auto', display: 'block' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#1B1D29', letterSpacing: '-0.2px' }}>
              ระบบผู้ประสานงาน
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B6F80' }}>
              TTAA 13th Submission Portal
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          background: '#F6F6F9',
          padding: '4px',
          borderRadius: '16px',
          gap: '4px'
        }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#1B1D29' : '#6B6F80',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  boxShadow: isActive ? '0 2px 6px rgba(27, 29, 41, 0.08)' : 'none',
                  transition: 'all 0.18s'
                }}
              >
                <Icon size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#FF5F1C' : '#6B6F80'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Badge & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User profile */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#FAFAFC',
            border: '1px solid #ECECF1',
            padding: '6px 14px 6px 8px',
            borderRadius: '24px'
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: '0 2px 6px rgba(255, 95, 28, 0.3)'
            }}>
              {initials(user.name)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B1D29', lineHeight: 1.2 }}>
                {user.name}
              </span>
              <span style={{ fontSize: '11.5px', color: '#6B6F80', lineHeight: 1.2 }}>
                {user.university}
              </span>
            </div>
          </div>

          {/* Reset Demo Data button */}
          <button
            onClick={resetAllDataToDefault}
            title="รีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น"
            style={{
              background: 'transparent',
              border: '1px solid #ECECF1',
              color: '#6B6F80',
              padding: '8px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowsClockwise size={18} />
          </button>

          {/* Logout button */}
          <button
            onClick={logout}
            title="ออกจากระบบ"
            style={{
              background: '#FFF1EB',
              border: '1px solid rgba(255, 95, 28, 0.2)',
              color: '#C2410C',
              padding: '8px 14px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <SignOut size={16} weight="bold" />
            <span>ออก</span>
          </button>
        </div>
      </div>
    </header>
  );
};
