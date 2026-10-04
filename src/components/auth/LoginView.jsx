import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { MosaicHero } from './MosaicHero';
import { ClassicHero } from './ClassicHero';
import { Eye, EyeSlash, LockKey, User, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { DEMO_PASSWORD } from '../../data/accounts';

export const LoginView = () => {
  const { login, loginStyle, setLoginStyle } = usePortal();

  const [username, setUsername] = useState('rep.rtc');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      triggerShake();
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = login(username, password);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error);
        triggerShake();
      }
    }, 450);
  };

  const handleFillDemo = () => {
    setUsername('rep.rtc');
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexWrap: 'wrap',
      background: '#F6F6F9'
    }}>
      {/* Left Visual Column */}
      {loginStyle === 'mosaic' ? <MosaicHero /> : <ClassicHero />}

      {/* Right Login Form Column */}
      <div style={{
        flex: '1 1 440px',
        padding: 'clamp(32px, 6vw, 64px) clamp(24px, 5vw, 56px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        minHeight: '580px'
      }}>
        {/* Style Switcher Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#FF5F1C',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            background: 'rgba(255, 95, 28, 0.08)',
            padding: '5px 12px',
            borderRadius: '20px'
          }}>
            TTAA 13th Coordinator
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F6F6F9',
            padding: '3px',
            borderRadius: '20px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={() => setLoginStyle('mosaic')}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: loginStyle === 'mosaic' ? 700 : 500,
                color: loginStyle === 'mosaic' ? '#1B1D29' : '#6B6F80',
                background: loginStyle === 'mosaic' ? '#FFFFFF' : 'transparent',
                boxShadow: loginStyle === 'mosaic' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Mosaic
            </button>
            <button
              type="button"
              onClick={() => setLoginStyle('classic')}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: loginStyle === 'classic' ? 700 : 500,
                color: loginStyle === 'classic' ? '#1B1D29' : '#6B6F80',
                background: loginStyle === 'classic' ? '#FFFFFF' : 'transparent',
                boxShadow: loginStyle === 'classic' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Classic
            </button>
          </div>
        </div>

        {/* Center Form */}
        <div style={{ maxWidth: '420px', width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: '28px' }}>
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
              <div style={{
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
            <div>
              <label style={{
                display: 'block',
                fontSize: '13.5px',
                fontWeight: 700,
                color: '#1B1D29',
                marginBottom: '8px'
              }}>
                ชื่อผู้ใช้ (Username)
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={19}
                  color="#A3A6B4"
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="เช่น rep.rtc หรือ rep.svu"
                  style={{
                    width: '100%',
                    padding: '13px 16px 13px 46px',
                    borderRadius: '12px',
                    border: '1.5px solid #E0E1E8',
                    fontSize: '14.5px',
                    color: '#1B1D29',
                    background: '#FAFAFC'
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B1D29' }}>
                  รหัสผ่าน (Password)
                </label>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  style={{
                    fontSize: '12.5px',
                    color: '#FF5F1C',
                    fontWeight: 700,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkle size={13} weight="fill" />
                  <span>กรอกบัญชีทดลอง</span>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <LockKey
                  size={19}
                  color="#A3A6B4"
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="กรอกรหัสผ่าน"
                  style={{
                    width: '100%',
                    padding: '13px 46px 13px 46px',
                    borderRadius: '12px',
                    border: '1.5px solid #E0E1E8',
                    fontSize: '14.5px',
                    color: '#1B1D29',
                    background: '#FAFAFC'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

            {/* Demo Helper Banner */}
            <div style={{
              background: '#F6F6F9',
              border: '1px dashed #D5D7E0',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '12.5px',
              color: '#6B6F80',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>
                ผู้ประสานงานทดลอง: <strong>rep.rtc</strong> / รหัส: <strong>ttaa2026</strong>
              </span>
              <button
                type="button"
                onClick={handleFillDemo}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #ECECF1',
                  color: '#FF5F1C',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}
              >
                กรอกให้
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
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
              {isLoading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '12.5px',
          color: '#9A9DAD',
          borderTop: '1px solid #ECECF1',
          paddingTop: '20px'
        }}>
          Thailand Teaching Academy Award 13th · ศูนย์ประสานงานการประกวด
        </div>
      </div>
    </div>
  );
};
