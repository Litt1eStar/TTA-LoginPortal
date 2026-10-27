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
    { id: 'dashboard', path: '/dashboard', label: 'หน้าหลัก', icon: SquaresFour, isActive: location.pathname === '/dashboard' || location.pathname === '/' },
    { id: 'submit', path: `/submit/${activeTrackId || 'theory'}`, label: 'ส่งผลงาน', icon: PaperPlaneTilt, isActive: location.pathname.startsWith('/submit') },
    { id: 'history', path: '/history', label: 'ประวัติการส่ง', icon: ClockCounterClockwise, isActive: location.pathname === '/history' },
    // Logged-in only; coordinators download their university's certificates (FEEDBACK #5)
    { id: 'certificates', path: '/certificates', label: 'เกียรติบัตร', icon: Certificate, isActive: location.pathname === '/certificates' }
  ];

  const ghostBtn = {
    background: '#FAFAFC',
    border: '1px solid var(--border-light)',
    color: 'var(--text-muted)',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: 600
  };

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(27, 29, 41, 0.04)'
    }}>
      <div className="app-container nav-row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
        gap: '20px'
      }}>
        {/* Brand: logo sits on a white tile so its navy lettering stays readable */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          aria-label="ไปหน้าหลัก"
          style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'transparent', padding: 0 }}
        >
          <span style={{ background: '#FFFFFF', borderRadius: '12px', padding: '5px 8px', display: 'flex' }}>
            <img
              src="/assets/ttaa13-logo.png"
              alt="Thailand Teaching Academy Award 2027"
              style={{ height: '34px', width: 'auto', display: 'block' }}
            />
          </span>
          <span
            className="nav-brand-text"
            style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap' }}
          >
            TTA Portal
          </span>
        </button>

        {/* Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-main)', padding: '4px', borderRadius: '999px' }}>
          {navItems.map(({ id, path, label, icon: Icon, isActive }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(path)}
              title={label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '999px',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-dark)' : 'var(--text-muted)',
                background: isActive ? '#FFFFFF' : 'transparent',
                boxShadow: isActive ? '0 2px 6px rgba(27, 29, 41, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(27,29,41,0.05)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={19} weight={isActive ? 'fill' : 'regular'} color={isActive ? 'var(--primary)' : 'currentColor'} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* User & actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="nav-user"
            title={`${user.name} · ${user.university}`}
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px'
            }}>
              {initials(user.name)}
            </div>
            <span
              className="nav-user-text"
              style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)', whiteSpace: 'nowrap' }}
            >
              {user.name}
            </span>
          </div>

          <button
            type="button"
            className="nav-reset"
            onClick={resetAllDataToDefault}
            title="รีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น"
            aria-label="รีเซ็ตข้อมูลตัวอย่าง"
            style={{ ...ghostBtn, width: '40px' }}
          >
            <ArrowsClockwise size={18} />
          </button>

          <button
            type="button"
            onClick={logout}
            title="ออกจากระบบ"
            style={{ ...ghostBtn, padding: '0 14px' }}
          >
            <SignOut size={17} weight="bold" />
            <span className="nav-label" style={{ whiteSpace: 'nowrap' }}>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
