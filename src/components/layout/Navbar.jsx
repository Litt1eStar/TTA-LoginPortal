import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { initials } from '../../utils/formatters';
import {
  SquaresFour,
  PaperPlaneTilt,
  ClockCounterClockwise,
  SignOut,
  ArrowsClockwise,
  Certificate
} from '@phosphor-icons/react';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeTrackId, resetAllDataToDefault } = usePortal();

  if (!user) return null;

  const navItems = [
    {
      id: 'dashboard',
      path: '/dashboard',
      label: 'หน้าหลัก',
      icon: SquaresFour,
      isActive: location.pathname === '/dashboard' || location.pathname === '/'
    },
    {
      id: 'submit',
      path: `/submit/${activeTrackId || 'theory'}`,
      label: 'ส่งผลงาน',
      icon: PaperPlaneTilt,
      isActive: location.pathname.startsWith('/submit')
    },
    {
      id: 'history',
      path: '/history',
      label: 'ประวัติการส่ง',
      icon: ClockCounterClockwise,
      isActive: location.pathname === '/history'
    },
    {
      // Logged-in only; coordinators download their university's certificates (FEEDBACK #5)
      id: 'certificates',
      path: '/certificates',
      label: 'เกียรติบัตร',
      icon: Certificate,
      isActive: location.pathname === '/certificates'
    }
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
      <div className="app-container nav-row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
        gap: '20px'
      }}>
        {/* Brand & Logo */}
        <div
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer'
          }}
        >
          <img
            src="/assets/ttaa13-logo.png"
            alt="Thailand Teaching Academy Award 2027"
            style={{ height: '42px', width: 'auto', display: 'block' }}
          />
          <span
            className="nav-brand-text"
            style={{ fontSize: '17px', fontWeight: 700, color: '#1B1D29', whiteSpace: 'nowrap' }}
          >
            ระบบส่งผลงาน TTA 2027
          </span>
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
            const isActive = item.isActive;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#1B1D29' : '#4F5366',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  boxShadow: isActive ? '0 2px 6px rgba(27, 29, 41, 0.08)' : 'none',
                  transition: 'all 0.18s'
                }}
              >
                <Icon size={19} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#FF5F1C' : '#4F5366'} />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Badge & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User profile */}
          <div
            className="nav-user"
            title={`${user.name} · ${user.university}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#FAFAFC',
              border: '1px solid #ECECF1',
              padding: '6px 14px 6px 6px',
              borderRadius: '24px'
            }}
          >
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
              fontSize: '14px',
              boxShadow: '0 2px 6px rgba(255, 95, 28, 0.3)'
            }}>
              {initials(user.name)}
            </div>
            <span
              className="nav-user-text"
              style={{ fontSize: '15px', fontWeight: 700, color: '#1B1D29', whiteSpace: 'nowrap' }}
            >
              {user.name}
            </span>
          </div>

          {/* Reset Demo Data button */}
          <button
            onClick={resetAllDataToDefault}
            title="รีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น"
            aria-label="รีเซ็ตข้อมูลตัวอย่าง"
            className="nav-reset"
            style={{
              background: 'transparent',
              border: '1px solid #ECECF1',
              color: '#4F5366',
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
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            <SignOut size={16} weight="bold" />
            <span className="nav-label" style={{ whiteSpace: 'nowrap' }}>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
