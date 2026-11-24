import React, { useState, useEffect, useRef } from 'react';
import { usePortal } from '../../context/PortalContext';
import { TITLE_PREFIXES, DEPT_BY_UNIVERSITY, departmentForUniversity, PHOTO_RULES } from '../../data/referenceData';
import { getTrack, trackRoles, defaultRole, hasMultipleRoles, usesLeader } from '../../data/tracks';
import { processPhoto, dataUrlToFile } from '../../utils/photo';
import { uploadFile } from '../../api';
import { X, ChalkboardTeacher, Student, Plus, Buildings, WarningCircle, Camera, Trash } from '@phosphor-icons/react';

const FieldError = ({ msg }) => msg ? (
  <div className="field-error"><WarningCircle size={16} weight="fill" />{msg}</div>
) : null;

export const MemberModal = ({ isOpen, onClose, trackId, initialType = 'student', initialMember = null }) => {
  const { addOrUpdateMember, submissions, user } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const track = getTrack(trackId);
  const roles = trackRoles(track);
  const multiRole = hasMultipleRoles(track);
  const allowLeader = usesLeader(track);
  const roleCounts = sub.members
    .filter(m => m.type === 'student' && m.id !== initialMember?.id)
    .reduce((acc, m) => {
      const r = m.role || defaultRole(track);
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
  const firstOpenRole = (counts) => (roles.find(r => (counts[r.name] || 0) < r.max) || roles[0]).name;

  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState('3');
  const [role, setRole] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const lockedDept = DEPT_BY_UNIVERSITY[user?.universityCode] || departmentForUniversity(user?.university) || '';
  // Snapshot of the form when it opened (or was cleared), to know if anything was typed
  const snapshot = useRef('');
  const formState = (o) => JSON.stringify([
    o.type, o.title, o.fullName, o.studentId, o.email, o.phone, o.year,
    o.type === 'advisor' ? '' : o.role, o.isLeader, o.photo?.fileId || o.photo?.dataUrl || null
  ]);
  const current = { type, title, fullName, studentId, email, phone, year, role, isLeader, photo };

  useEffect(() => {
    if (initialMember) {
      const initRole = initialMember.type === 'advisor' ? firstOpenRole(roleCounts) : (initialMember.role || defaultRole(track));
      setType(initialMember.type || 'student');
      setTitle(initialMember.title || '');
      setFullName(initialMember.fullName || '');
      setStudentId(initialMember.studentId || '');
      setEmail(initialMember.email || '');
      setPhone(initialMember.phone || '');
      setYear(initialMember.year || '3');
      setRole(initRole);
      setIsLeader(!!initialMember.isLeader);
      setPhoto(initialMember.photo || null);
      snapshot.current = formState({
        type: initialMember.type || 'student', title: initialMember.title || '', fullName: initialMember.fullName || '',
        studentId: initialMember.studentId || '', email: initialMember.email || '', phone: initialMember.phone || '',
        year: initialMember.year || '3', role: initRole,
        isLeader: !!initialMember.isLeader, photo: initialMember.photo || null
      });
    } else {
      const initRole = firstOpenRole(roleCounts);
      setType(initialType);
      setTitle(initialType === 'advisor' ? 'ดร.' : 'นาย');
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setYear('3');
      setRole(initRole);
      setIsLeader(false);
      setPhoto(null);
      snapshot.current = formState({
        type: initialType, title: initialType === 'advisor' ? 'ดร.' : 'นาย', fullName: '', studentId: '',
        email: '', phone: '', year: '3', role: initRole, isLeader: false, photo: null
      });
    }
    setErrors({});
    setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMember, initialType, isOpen, trackId]);

  const isDirty = formState(current) !== snapshot.current;

  // Close, but ask first if something was typed
  const requestClose = () => {
    if (photoBusy) return;
    if (isDirty) setConfirmDiscard(true); else onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmDiscard) setConfirmDiscard(false); else requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  const isEditing = !!initialMember;
  const isAdvisor = type === 'advisor';

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    if (!isAdvisor) {
      const roleDef = roles.find(r => r.name === role);
      if (!roleDef) errs.role = 'กรุณาเลือกบทบาท';
      else if ((roleCounts[role] || 0) >= roleDef.max) {
        errs.role = `บทบาท ${role} ครบจำนวนสูงสุด (${roleDef.max} คน) แล้ว`;
      }
    }
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
    if (photoBusy) return;
    if (!validate()) return;

    addOrUpdateMember(trackId, {
      id: initialMember?.id,
      type,
      title,
      fullName: fullName.trim(),
      studentId: isAdvisor ? '' : studentId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dept: lockedDept,
      year: isAdvisor ? '' : year,
      role: isAdvisor ? undefined : role,
      isLeader: isAdvisor || !allowLeader ? false : isLeader,
      photo
    });

    if (addAnother && !isAdvisor) {
      const nextCounts = { ...roleCounts, [role]: (roleCounts[role] || 0) + 1 };
      const nextRole = firstOpenRole(nextCounts);
      snapshot.current = formState({ ...current, fullName: '', studentId: '', email: '', phone: '', role: nextRole, isLeader: false, photo: null });
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setRole(nextRole);
      setIsLeader(false);
      setPhoto(null);
      setErrors({});
    } else {
      onClose();
    }
  };

  const clearError = (key) => errors[key] && setErrors(prev => ({ ...prev, [key]: '' }));

  // Resize in the browser, upload, then keep the server's PhotoRef ({ fileId, dataUrl: '/api/files/<id>', … })
  const handlePhoto = async (file) => {
    if (!file) return;
    const res = await processPhoto(file);
    if (!res.success) {
      setErrors(prev => ({ ...prev, photo: res.error }));
      return;
    }
    setPhotoBusy(true);
    setErrors(prev => ({ ...prev, photo: '' }));
    try {
      const upload = dataUrlToFile(res.photo.dataUrl, `photo.${res.photo.ext}`);
      const { file: ref } = await uploadFile(`/submissions/${trackId}/files?kind=photo`, upload);
      setPhoto(ref);
    } catch (err) {
      setErrors(prev => ({ ...prev, photo: err.message || 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' }));
    } finally {
      setPhotoBusy(false);
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
          <button type="button" className="icon-btn" onClick={requestClose} aria-label="ปิด">
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
                {photoBusy
                  ? <span style={{ fontSize: '12.5px', fontWeight: 600, textAlign: 'center', padding: '4px' }}>กำลังอัปโหลด…</span>
                  : photo
                    ? <img src={photo.dataUrl} alt="รูปถ่าย" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Camera size={28} weight="duotone" />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm" disabled={photoBusy} onClick={() => photoInput.current?.click()}>
                    <Camera size={16} weight="bold" />
                    <span>{photoBusy ? 'กำลังอัปโหลด…' : photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</span>
                  </button>
                  {photo && !photoBusy && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto(null)}>
                      <Trash size={16} weight="bold" />
                      <span>ลบรูป</span>
                    </button>
                  )}
                </div>
                <span className="field-hint" style={{ marginTop: 0 }}>
                  ไฟล์ {PHOTO_RULES.exts.join(', ').toUpperCase()} ไม่เกิน {PHOTO_RULES.maxMB} MB
                  <br />
                  ตั้งชื่อไฟล์ดังตัวอย่าง: สมชาย.jpg
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
                autoFocus
              />
              <FieldError msg={errors.fullName} />
            </div>
          </div>

          {/* Role selector when track has multiple roles */}
          {!isAdvisor && multiRole && (
            <div>
              <label className="field-label" htmlFor="m-role">
                บทบาท <span className="required">*</span>
              </label>
              <select
                id="m-role"
                className={`select ${errors.role ? 'has-error' : ''}`}
                value={role}
                onChange={(e) => { setRole(e.target.value); clearError('role'); }}
              >
                {roles.map(r => {
                  const count = roleCounts[r.name] || 0;
                  const full = count >= r.max;
                  return (
                    <option key={r.name} value={r.name} disabled={full}>
                      {r.name} ({count}/{r.max} คน){full ? ' — เต็มแล้ว' : ''}
                    </option>
                  );
                })}
              </select>
              <FieldError msg={errors.role} />
            </div>
          )}

          {/* University (read-only from account) */}
          <div>
            <label className="field-label">มหาวิทยาลัย</label>
            <div className="readonly-field" title="กำหนดจากบัญชีผู้ใช้ แก้ไขไม่ได้">
              <Buildings size={20} weight="duotone" color="var(--primary)" />
              <span>{user?.university || '-'}</span>
            </div>
          </div>

          {/* Department (locked by university) */}
          <div>
            <label className="field-label">หน่วยงาน</label>
            <div className="readonly-field" title="กำหนดตามมหาวิทยาลัย แก้ไขไม่ได้">
              <span>{lockedDept || '-'}</span>
            </div>
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

          {!isAdvisor && allowLeader && (
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
          <button type="button" className="btn" onClick={requestClose}>ยกเลิก</button>
          {!isEditing && !isAdvisor && (
            <button type="button" className="btn btn-danger" disabled={photoBusy} onClick={() => handleSave(true)}>
              <Plus size={16} weight="bold" />
              <span>บันทึกและเพิ่มอีกคน</span>
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={photoBusy} onClick={() => handleSave(false)}>
            {isEditing ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </div>

      {confirmDiscard && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDiscard(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" style={{ width: 'min(100%, 420px)' }}>
            <div className="modal-header"><div id="discard-title" className="modal-title">ยกเลิกการแก้ไข?</div></div>
            <div className="modal-body">
              <p>ข้อมูลที่กรอกไว้ยังไม่ได้บันทึก ต้องการปิดหน้าต่างนี้โดยไม่บันทึกใช่หรือไม่</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setConfirmDiscard(false)} autoFocus>กลับไปกรอกต่อ</button>
              <button type="button" className="btn btn-danger" onClick={() => { setConfirmDiscard(false); onClose(); }}>
                ปิดโดยไม่บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
