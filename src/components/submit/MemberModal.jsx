import React, { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { X, ChalkboardTeacher, Student, Plus } from '@phosphor-icons/react';

export const MemberModal = ({ isOpen, onClose, trackId, initialType = 'student', initialMember = null }) => {
  const { addOrUpdateMember, submissions } = usePortal();
  const sub = submissions[trackId] || { members: [] };

  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deptOrFaculty, setDeptOrFaculty] = useState('');
  const [year, setYear] = useState('3');
  const [isLeader, setIsLeader] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialMember) {
      setType(initialMember.type || 'student');
      setTitle(initialMember.title || '');
      setFullName(initialMember.fullName || '');
      setStudentId(initialMember.studentId || '');
      setEmail(initialMember.email || '');
      setPhone(initialMember.phone || '');
      setDeptOrFaculty(initialMember.dept || initialMember.faculty || '');
      setYear(initialMember.year || '3');
      setIsLeader(!!initialMember.isLeader);
    } else {
      setType(initialType);
      setTitle(initialType === 'advisor' ? 'ดร.' : '');
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setDeptOrFaculty('');
      setYear('3');
      setIsLeader(false);
    }
    setErrors({});
  }, [initialMember, initialType, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!initialMember;

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    if (!email.trim()) errs.email = 'กรุณากรอกอีเมล';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    else {
      const emailDup = sub.members.some(m => m.id !== (initialMember?.id) && m.email.toLowerCase() === email.trim().toLowerCase());
      if (emailDup) errs.email = 'อีเมลนี้ถูกใช้งานโดยสมาชิกคนอื่นในทีมแล้ว';
    }

    if (type === 'student' && !studentId.trim()) {
      errs.studentId = 'กรุณากรอกรหัสนักศึกษา';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (addAnother = false) => {
    if (!validate()) return;

    const data = {
      id: initialMember?.id,
      type,
      title: type === 'advisor' ? title : '',
      fullName: fullName.trim(),
      studentId: type === 'student' ? studentId.trim() : '',
      email: email.trim(),
      phone: phone.trim(),
      dept: type === 'advisor' ? deptOrFaculty.trim() : '',
      faculty: type === 'student' ? deptOrFaculty.trim() : '',
      year: type === 'student' ? year : '',
      isLeader: type === 'student' ? isLeader : false
    };

    addOrUpdateMember(trackId, data);

    if (addAnother && type === 'student') {
      setFullName('');
      setStudentId('');
      setEmail('');
      setPhone('');
      setIsLeader(false);
      setErrors({});
    } else {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(22, 24, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '16px'
    }}>
      <div
        className="animate-slide-up"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: 'min(100%, 520px)',
          boxShadow: '0 24px 60px -12px rgba(22, 24, 42, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #ECECF1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: type === 'advisor' ? '#FFF8DB' : '#EAF5FE',
              color: type === 'advisor' ? '#D99A00' : '#2A9FF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {type === 'advisor' ? <ChalkboardTeacher size={22} weight="duotone" /> : <Student size={22} weight="duotone" />}
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1B1D29' }}>
                {isEditing ? 'แก้ไขข้อมูล' : 'เพิ่ม'}{type === 'advisor' ? 'อาจารย์ที่ปรึกษา' : 'นักศึกษา'}
              </h3>
              <p style={{ fontSize: '12.5px', color: '#6B6F80' }}>
                {type === 'advisor' ? 'อาจารย์ผู้ดูแลผลงาน 1 ท่านต่อหมวดหมู่' : 'สมาชิกทีมนักศึกษาผู้จัดทำผลงาน'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#6B6F80',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Body Form */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Member type switcher (only if not editing) */}
          {!isEditing && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#F6F6F9',
              padding: '4px',
              borderRadius: '14px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => setType('student')}
                style={{
                  padding: '9px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'student' ? '#FFFFFF' : 'transparent',
                  color: type === 'student' ? '#1B1D29' : '#6B6F80',
                  boxShadow: type === 'student' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Student size={17} weight="bold" />
                <span>นักศึกษา</span>
              </button>
              <button
                type="button"
                onClick={() => setType('advisor')}
                style={{
                  padding: '9px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'advisor' ? '#FFFFFF' : 'transparent',
                  color: type === 'advisor' ? '#1B1D29' : '#6B6F80',
                  boxShadow: type === 'advisor' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <ChalkboardTeacher size={17} weight="bold" />
                <span>อาจารย์ที่ปรึกษา</span>
              </button>
            </div>
          )}

          {/* Academic Title for Advisor */}
          {type === 'advisor' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                คำนำหน้าทางวิชาการ (Academic Title)
              </label>
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #E0E1E8',
                  fontSize: '14px',
                  color: '#1B1D29',
                  background: '#FAFAFC'
                }}
              >
                <option value="ดร.">ดร. (Dr.)</option>
                <option value="ผศ.">ผศ. (Asst. Prof.)</option>
                <option value="ผศ.ดร.">ผศ.ดร. (Asst. Prof. Dr.)</option>
                <option value="รศ.">รศ. (Assoc. Prof.)</option>
                <option value="รศ.ดร.">รศ.ดร. (Assoc. Prof. Dr.)</option>
                <option value="ศ.">ศ. (Prof.)</option>
                <option value="ศ.ดร.">ศ.ดร. (Prof. Dr.)</option>
                <option value="อาจารย์">อาจารย์ (Lecturer)</option>
              </select>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
              ชื่อ - นามสกุล <span style={{ color: '#FF5F1C' }}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
              }}
              placeholder="เช่น สมชาย ใจดี"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                border: errors.fullName ? '1.5px solid #FF5F1C' : '1.5px solid #E0E1E8',
                fontSize: '14px',
                color: '#1B1D29',
                background: '#FAFAFC'
              }}
            />
            {errors.fullName && (
              <div style={{ fontSize: '12px', color: '#FF5F1C', marginTop: '4px', fontWeight: 600 }}>
                {errors.fullName}
              </div>
            )}
          </div>

          {/* Student ID (only for students) */}
          {type === 'student' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                รหัสนักศึกษา (Student ID) <span style={{ color: '#FF5F1C' }}>*</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  if (errors.studentId) setErrors(prev => ({ ...prev, studentId: '' }));
                }}
                placeholder="เช่น 6401234567"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: errors.studentId ? '1.5px solid #FF5F1C' : '1.5px solid #E0E1E8',
                  fontSize: '14px',
                  color: '#1B1D29',
                  background: '#FAFAFC'
                }}
              />
              {errors.studentId && (
                <div style={{ fontSize: '12px', color: '#FF5F1C', marginTop: '4px', fontWeight: 600 }}>
                  {errors.studentId}
                </div>
              )}
            </div>
          )}

          {/* Email & Phone Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                อีเมล (Email) <span style={{ color: '#FF5F1C' }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="name@university.ac.th"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: errors.email ? '1.5px solid #FF5F1C' : '1.5px solid #E0E1E8',
                  fontSize: '14px',
                  color: '#1B1D29',
                  background: '#FAFAFC'
                }}
              />
              {errors.email && (
                <div style={{ fontSize: '12px', color: '#FF5F1C', marginTop: '4px', fontWeight: 600 }}>
                  {errors.email}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                เบอร์โทรศัพท์ (Phone)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081-234-5678"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #E0E1E8',
                  fontSize: '14px',
                  color: '#1B1D29',
                  background: '#FAFAFC'
                }}
              />
            </div>
          </div>

          {/* Faculty / Dept & Year */}
          <div style={{ display: 'grid', gridTemplateColumns: type === 'student' ? '2fr 1fr' : '1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                {type === 'advisor' ? 'คณะ / ภาควิชา (Department)' : 'คณะ / สาขาวิชา (Faculty / Major)'}
              </label>
              <input
                type="text"
                value={deptOrFaculty}
                onChange={(e) => setDeptOrFaculty(e.target.value)}
                placeholder={type === 'advisor' ? 'เช่น คณะครุศาสตร์' : 'เช่น วิศวกรรมคอมพิวเตอร์'}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #E0E1E8',
                  fontSize: '14px',
                  color: '#1B1D29',
                  background: '#FAFAFC'
                }}
              />
            </div>

            {type === 'student' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1B1D29', marginBottom: '6px' }}>
                  ชั้นปี (Year)
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #E0E1E8',
                    fontSize: '14px',
                    color: '#1B1D29',
                    background: '#FAFAFC'
                  }}
                >
                  <option value="1">ปี 1</option>
                  <option value="2">ปี 2</option>
                  <option value="3">ปี 3</option>
                  <option value="4">ปี 4</option>
                  <option value="5">ปี 5</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
            )}
          </div>

          {/* Leader checkbox for student */}
          {type === 'student' && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#F6F6F9',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={isLeader}
                onChange={(e) => setIsLeader(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#FF5F1C' }}
              />
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1B1D29' }}>
                กำหนดให้นักศึกษาคนนี้เป็น <strong>หัวหน้าทีม (Team Leader)</strong>
              </span>
            </label>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #ECECF1',
          background: '#FAFAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid #E0E1E8',
              color: '#6B6F80',
              fontWeight: 600,
              fontSize: '13.5px'
            }}
          >
            ยกเลิก
          </button>

          {!isEditing && type === 'student' && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: '#FFF1EB',
                border: '1px solid rgba(255, 95, 28, 0.3)',
                color: '#C2410C',
                fontWeight: 700,
                fontSize: '13.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} weight="bold" />
              <span>บันทึกและเพิ่มอีกคน</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave(false)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF5F1C 0%, #FF8D20 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13.5px',
              boxShadow: '0 4px 12px rgba(255, 95, 28, 0.35)'
            }}
          >
            {isEditing ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
};
