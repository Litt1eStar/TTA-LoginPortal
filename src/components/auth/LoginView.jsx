import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { MosaicHero } from './MosaicHero';
import { Eye, EyeSlash, LockKey, User, WarningCircle } from '@phosphor-icons/react';

export const LoginView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = usePortal();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      triggerShake();
      return;
    }

    setIsLoading(true);
    const res = await login(username, password);
    setIsLoading(false);
    if (!res.success) {
      setError(res.error);
      triggerShake();
      return;
    }
    const destination = res.user.role === 'admin'
      ? '/admin'
      : (location.state?.from?.pathname || '/dashboard');
    navigate(destination, { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexWrap: 'wrap',
      background: '#F6F6F9'
    }}>
      {/* Left Visual Column */}
      <MosaicHero />

      {/* Right Login Form Column */}
      <div style={{
        flex: '1 1 440px',
        padding: 'clamp(32px, 6vw, 64px) clamp(24px, 5vw, 56px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: '#FFFFFF',
        minHeight: '580px'
      }}>
        {/* Center Form */}
        <div style={{ maxWidth: '420px', width: '100%', margin: 'auto auto' }}>
          <div className="rise" style={{ marginBottom: '28px', '--d': '150ms' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#1B1D29',
              marginBottom: '8px',
              letterSpacing: '-0.5px'
            }}>
              ยินดีต้อนรับ
            </h1>
            <p style={{ fontSize: '15px', color: '#6B6F80', lineHeight: 1.5 }}>
              เข้าสู่ระบบด้วยบัญชีผู้ประสานงานมหาวิทยาลัยที่ได้รับมอบหมาย
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className={shake ? 'animate-shake' : ''}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {/* Error Message */}
            {error && (
              <div id="login-error" role="alert" className="pop-in" style={{
                background: '#FFF1EB',
                border: '1px solid rgba(255, 95, 28, 0.3)',
                color: '#C2410C',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <WarningCircle size={18} weight="fill" />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="rise" style={{ '--i': 1, '--d': '150ms' }}>
              <label htmlFor="login-username" style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 700,
                color: '#1B1D29',
                marginBottom: '8px'
              }}>
                ชื่อผู้ใช้ (Username)
              </label>
              <div className="login-field">
                <User size={19} className="field-icon" aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="เช่น kmutt"
                  className="login-input"
                  style={{ padding: '13px 16px 13px 46px' }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="rise" style={{ '--i': 2, '--d': '150ms' }}>
              <label htmlFor="login-password" style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 700,
                color: '#1B1D29',
                marginBottom: '8px'
              }}>
                รหัสผ่าน (Password)
              </label>
              <div className="login-field">
                <LockKey size={19} className="field-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="กรอกรหัสผ่าน"
                  className="login-input"
                  style={{ padding: '13px 46px 13px 46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    color: '#A3A6B4',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="shine rise"
              style={{
                '--i': 3,
                '--d': '150ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginTop: '8px',
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                boxShadow: '0 8px 20px -4px rgba(255, 95, 28, 0.4)',
                opacity: isLoading ? 0.75 : 1
              }}
            >
              {isLoading && <span className="spinner" aria-hidden="true" />}
              <span>{isLoading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="rise" style={{
          '--i': 5,
          '--d': '150ms',
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '12.5px',
          color: '#9A9DAD',
          borderTop: '1px solid #ECECF1',
          paddingTop: '20px'
        }}>
          Thailand Teaching Academy Award 2027 · ศูนย์ประสานงานการประกวด
        </div>
      </div>
    </div>
  );
};
