import React, { useState, useEffect, useRef } from 'react';
import { usePortal } from '../../context/PortalContext';
import { TITLE_PREFIXES, DEPARTMENTS, PHOTO_RULES } from '../../data/referenceData';
import { processPhoto } from '../../utils/photo';
import { X, ChalkboardTeacher, Student, Plus, Buildings, WarningCircle, Camera, Trash } from '@phosphor-icons/react';

const FieldError = ({ msg }) => msg ? (
  <div className="field-error"><WarningCircle size={16} weight="fill" />{msg}</div>
) : null;

export const MemberModal = ({ isOpen, onClose, trackId, initialType = 'student', initialMember = null }) => {
  const { addOrUpdateMember, submissions, user } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('3');
  const [isLeader, setIsLeader] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const photoInput = useRef(null);

  useEffect(() => {
    if (initialMember) {
      setType(initialMember.type || 'student');
      setTitle(initialMember.title || '');
      setFullName(initialMember.fullName || '');
      setStudentId(initialMember.studentId || '');
      setEmail(initialMember.email || '');
      setPhone(initialMember.phone || '');
      // Older records may hold a free-text value; only keep it if it's a valid option
      setDept(DEPARTMENTS.includes(initialMember.dept) ? initialMember.dept : '');
      setYear(initialMember.year || '3');
      setIsLeader(!!initialMember.isLeader);
      setPhoto(initialMember.photo || null);
    } else {
      setType(initialType);
      setTitle(initialType === 'advisor' ? 'ดร.' : 'นาย');
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setDept('');
      setYear('3');
      setIsLeader(false);
      setPhoto(null);
    }
    setErrors({});
  }, [initialMember, initialType, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!initialMember;
  const isAdvisor = type === 'advisor';

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    if (!dept) errs.dept = 'กรุณาเลือกหน่วยงาน';
    if (email.trim()) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'รูปแบบอีเมลไม่ถูกต้อง';
      else {
        const emailDup = sub.members.some(m => m.id !== (initialMember?.id) && (m.email || '').toLowerCase() === email.trim().toLowerCase());
        if (emailDup) errs.email = 'อีเมลนี้มีสมาชิกคนอื่นในทีมใช้แล้ว';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (addAnother = false) => {
    if (!validate()) return;

    addOrUpdateMember(trackId, {
      id: initialMember?.id,
      type,
      title,
      fullName: fullName.trim(),
      studentId: isAdvisor ? '' : studentId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dept,
      year: isAdvisor ? '' : year,
      isLeader: isAdvisor ? false : isLeader,
      photo
    });

    if (addAnother && !isAdvisor) {
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setIsLeader(false);
      setPhoto(null);
      setErrors({});
    } else {
      onClose();
    }
  };

  const clearError = (key) => errors[key] && setErrors(prev => ({ ...prev, [key]: '' }));

  const handlePhoto = async (file) => {
    if (!file) return;
    const res = await processPhoto(file);
    if (res.success) {
      setPhoto(res.photo);
      clearError('photo');
    } else {
      setErrors(prev => ({ ...prev, photo: res.error }));
    }
  };

  const typeTab = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => setType(value)}
      style={{
        padding: '10px',
        borderRadius: '10px',
        fontWeight: 700,
        fontSize: '15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: type === value ? '#FFFFFF' : 'transparent',
        color: type === value ? 'var(--text-dark)' : 'var(--text-muted)',
        boxShadow: type === value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
      }}
    >
      <Icon size={18} weight="bold" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="modal-overlay">
      <div className="modal animate-slide-up" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isAdvisor ? 'var(--yellow-bg)' : 'var(--blue-bg)',
              color: isAdvisor ? '#B07A00' : 'var(--blue-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isAdvisor ? <ChalkboardTeacher size={22} weight="duotone" /> : <Student size={22} weight="duotone" />}
            </div>
            <h3 className="modal-title">
              {isEditing ? 'แก้ไข' : 'เพิ่ม'}{isAdvisor ? 'อาจารย์ที่ปรึกษา' : 'ผู้แข่งขัน'}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {!isEditing && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: 'var(--bg-main)',
              padding: '4px',
              borderRadius: '14px',
              gap: '4px'
            }}>
              {typeTab('student', Student, 'ผู้แข่งขัน')}
              {typeTab('advisor', ChalkboardTeacher, 'อาจารย์ที่ปรึกษา')}
            </div>
          )}

          {/* Personal photo: each person uploads their own */}
          <div>
            <span className="field-label">
              รูปถ่าย <span className="required">*</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '84px',
                height: '104px',
                borderRadius: '14px',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'var(--bg-main)',
                border: photo ? '1px solid var(--border-light)' : '2px dashed #C4C6D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)'
              }}>
                {photo
                  ? <img src={photo.dataUrl} alt="รูปถ่าย" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} weight="duotone" />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm" onClick={() => photoInput.current?.click()}>
                    <Camera size={16} weight="bold" />
                    <span>{photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</span>
                  </button>
                  {photo && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto(null)}>
                      <Trash size={16} weight="bold" />
                      <span>ลบรูป</span>
                    </button>
                  )}
                </div>
                <span className="field-hint" style={{ marginTop: 0 }}>
                  ไฟล์ {PHOTO_RULES.exts.join(', ').toUpperCase()} ไม่เกิน {PHOTO_RULES.maxMB} MB
                </span>
              </div>
              <input
                ref={photoInput}
                type="file"
                accept={PHOTO_RULES.exts.map(e => '.' + e).join(',')}
                style={{ display: 'none' }}
                aria-label="อัปโหลดรูปถ่าย"
                onChange={(e) => { handlePhoto(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            <FieldError msg={errors.photo} />
          </div>

          {/* Title + name */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2.2fr', gap: '12px' }}>
            <div>
              <label className="field-label" htmlFor="m-title">คำนำหน้า</label>
              <select id="m-title" className="select" value={title} onChange={(e) => setTitle(e.target.value)}>
                {title && !TITLE_PREFIXES.includes(title) && <option value={title}>{title}</option>}
                {TITLE_PREFIXES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="m-name">
                ชื่อ-นามสกุล <span className="required">*</span>
              </label>
              <input
                id="m-name"
                type="text"
                className={`input ${errors.fullName ? 'has-error' : ''}`}
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); clearError('fullName'); }}
                placeholder="เช่น สมชาย ใจดี"
              />
              <FieldError msg={errors.fullName} />
            </div>
          </div>

          {/* University (read-only from account) */}
          <div>
            <label className="field-label">มหาวิทยาลัย</label>
            <div className="readonly-field" title="กำหนดจากบัญชีผู้ใช้ แก้ไขไม่ได้">
              <Buildings size={20} weight="duotone" color="var(--primary)" />
              <span>{user?.university || '-'}</span>
            </div>
          </div>

          {/* Department dropdown */}
          <div>
            <label className="field-label" htmlFor="m-dept">
              หน่วยงาน <span className="required">*</span>
            </label>
            <select
              id="m-dept"
              className={`select ${errors.dept ? 'has-error' : ''}`}
              value={dept}
              onChange={(e) => { setDept(e.target.value); clearError('dept'); }}
            >
              <option value="" disabled>เลือกหน่วยงาน</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <FieldError msg={errors.dept} />
          </div>

          {/* Student ID + year */}
          {!isAdvisor && (
            <div className="grid-2">
              <div>
                <label className="field-label" htmlFor="m-sid">รหัสนักศึกษา</label>
                <input
                  id="m-sid"
                  type="text"
                  className="input"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="เช่น 6401234567"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="m-year">ชั้นปี</label>
                <select id="m-year" className="select" value={year} onChange={(e) => setYear(e.target.value)}>
                  {['1', '2', '3', '4', '5'].map(y => <option key={y} value={y}>ปี {y}</option>)}
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="grid-2">
            <div>
              <label className="field-label" htmlFor="m-email">อีเมล</label>
              <input
                id="m-email"
                type="email"
                className={`input ${errors.email ? 'has-error' : ''}`}
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                placeholder="name@university.ac.th"
              />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <label className="field-label" htmlFor="m-phone">เบอร์โทรศัพท์</label>
              <input
                id="m-phone"
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081-234-5678"
              />
            </div>
          </div>

          {!isAdvisor && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--bg-main)',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: '15px'
            }}>
              <input
                type="checkbox"
                checked={isLeader}
                onChange={(e) => setIsLeader(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
              />
              <span>ให้คนนี้เป็น <strong>หัวหน้าทีม</strong></span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          {!isEditing && !isAdvisor && (
            <button type="button" className="btn btn-danger" onClick={() => handleSave(true)}>
              <Plus size={16} weight="bold" />
              <span>บันทึกและเพิ่มอีกคน</span>
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => handleSave(false)}>
            {isEditing ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
};
