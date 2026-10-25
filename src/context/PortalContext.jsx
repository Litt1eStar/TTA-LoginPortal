import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ACCOUNTS, DEMO_PASSWORD } from '../data/accounts';
import { getTrack } from '../data/tracks';
import { PHOTO_RULES } from '../data/referenceData';
import { createSeedSubmissions } from '../data/seedData';
import { generateReceiptHash, generateId } from '../utils/formatters';
import confetti from 'canvas-confetti';

const PortalContext = createContext(null);

const STORAGE_KEY_AUTH = 'ttaa13_auth';
const STORAGE_KEY_SUBMISSIONS = 'tta27_submissions_v2';
const STORAGE_KEY_TRACK = 'ttaa13_track';

export const PortalProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loginStyle, setLoginStyle] = useState('mosaic'); // 'mosaic' | 'classic'

  // Derive current view from current route path
  const currentView = location.pathname.startsWith('/submit')
    ? 'submit'
    : location.pathname.startsWith('/history')
    ? 'history'
    : 'dashboard';

  const [activeTrackId, setActiveTrackId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TRACK) || 'theory';
    } catch {
      return 'theory';
    }
  });

  const [submissions, setSubmissions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      return saved ? JSON.parse(saved) : createSeedSubmissions();
    } catch {
      return createSeedSubmissions();
    }
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastUndo, setToastUndo] = useState(null);

  // Sync state to local storage
  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
    } catch (e) {
      console.error(e);
    }
  }, [submissions]);


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRACK, activeTrackId);
    } catch (e) {
      console.error(e);
    }
  }, [activeTrackId]);

  // Toast handler with undo
  const showToast = (message, undoAction = null) => {
    setToast(message);
    setToastUndo(() => undoAction);
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
      setToast(null);
      setToastUndo(null);
    }, undoAction ? 6000 : 3500);
  };

  const handleUndo = () => {
    if (toastUndo) {
      toastUndo();
      setToast(null);
      setToastUndo(null);
    }
  };

  // Login & Logout
  const login = (username, password) => {
    const cleanUser = (username || '').trim().toLowerCase();
    const account = ACCOUNTS[cleanUser];

    if (!cleanUser || !password) {
      return { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    }
    if (!account || password !== DEMO_PASSWORD) {
      return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ทดลองใช้ rep.rtc / ttaa2026)' };
    }

    setUser(account);
    showToast(`ยินดีต้อนรับ คุณ${account.name}`);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
    navigate('/login');
  };

  // Track & View navigation
  const openTrack = (trackId) => {
    setActiveTrackId(trackId);
    navigate(`/submit/${trackId}`);
  };

  const setView = (v) => {
    if (v === 'submit') {
      navigate(`/submit/${activeTrackId || 'theory'}`);
    } else {
      navigate(`/${v}`);
    }
  };

  // Submissions operations
  const updateSubmission = (trackId, patch) => {
    setSubmissions(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        ...patch
      }
    }));
  };

  const updateField = (trackId, field, value) => {
    updateSubmission(trackId, { [field]: value });
  };

  const updateLink = (trackId, linkField, value) => {
    setSubmissions(prev => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        links: {
          ...prev[trackId].links,
          [linkField]: value
        }
      }
    }));
  };

  // Keep at most `limit` advisors, dropping the oldest ones first
  const capAdvisors = (members, limit) => {
    const advisors = members.filter(m => m.type === 'advisor');
    if (advisors.length <= limit) return members;
    const dropIds = new Set(advisors.slice(0, advisors.length - limit).map(m => m.id));
    return members.filter(m => !dropIds.has(m.id));
  };

  const ensureStudentLeader = (members = []) => {
    const students = members.filter(m => m.type === 'student');
    if (students.length > 0 && !students.some(m => m.isLeader)) {
      const firstId = students[0].id;
      return members.map(m => m.id === firstId ? { ...m, isLeader: true } : m);
    }
    return members;
  };

  const addOrUpdateMember = (trackId, memberData) => {
    const sub = submissions[trackId];
    let members = [...sub.members];
    const isEdit = !!memberData.id;
    // University always comes from the logged-in account
    memberData = { ...memberData, university: user?.university || '' };

    if (isEdit) {
      members = members.map(m => m.id === memberData.id ? { ...m, ...memberData } : m);
    } else {
      const newMember = {
        ...memberData,
        id: generateId('m'),
        source: 'manual'
      };
      members.push(newMember);
      // Over the track's advisor limit → replace the oldest advisor
      members = capAdvisors(members, getTrack(trackId).advisorCount || 1);
    }

    // Ensure only one student leader if this member was marked leader
    if (memberData.type === 'student' && memberData.isLeader) {
      const targetId = memberData.id || members[members.length - 1].id;
      members = members.map(m => m.type === 'student' ? { ...m, isLeader: m.id === targetId } : m);
    }

    members = ensureStudentLeader(members);
    updateSubmission(trackId, { members });
    showToast(isEdit ? `แก้ไขข้อมูล ${memberData.fullName} สำเร็จ` : `เพิ่ม ${memberData.fullName} ในทีมแล้ว`);
  };

  const removeMember = (trackId, memberId) => {
    const prevMembers = submissions[trackId].members;
    const removed = prevMembers.find(m => m.id === memberId);
    const updated = ensureStudentLeader(prevMembers.filter(m => m.id !== memberId));

    updateSubmission(trackId, { members: updated });
    showToast(`ลบ ${removed ? removed.fullName : 'สมาชิก'} แล้ว`, () => {
      updateSubmission(trackId, { members: prevMembers });
    });
  };

  const makeLeader = (trackId, studentId) => {
    const prev = submissions[trackId].members;
    const updated = prev.map(m => m.type === 'student' ? { ...m, isLeader: m.id === studentId } : m);
    updateSubmission(trackId, { members: updated });
    const target = updated.find(m => m.id === studentId);
    showToast(`ตั้ง ${target ? target.fullName : ''} เป็นหัวหน้าทีมแล้ว`);
  };

  const importCsvMembers = (trackId, incomingRows, mode = 'append') => {
    const prevMembers = submissions[trackId].members;
    const base = mode === 'replace' ? [] : [...prevMembers];

    // Incoming advisors push out the oldest ones once the track's limit is reached
    const stamped = incomingRows.map(r => ({ ...r, university: user?.university || '' }));
    let combined = capAdvisors([...base, ...stamped], getTrack(trackId).advisorCount || 1);
    combined = ensureStudentLeader(combined);

    updateSubmission(trackId, { members: combined });
    showToast(`นำเข้า ${incomingRows.length} รายชื่อสำเร็จ`, () => {
      updateSubmission(trackId, { members: prevMembers });
    });
  };

  // Files
  const addFiles = (trackId, fileList) => {
    const sub = submissions[trackId];
    const newFiles = Array.from(fileList || []).map(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const isAllowed = ['pdf', 'zip', 'ppt', 'pptx'].includes(ext);
      return {
        id: generateId('f'),
        name: f.name,
        size: f.size,
        ext,
        progress: isAllowed ? 100 : 0,
        status: isAllowed ? 'done' : 'error',
        error: isAllowed ? '' : 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ PDF, ZIP, PPT, PPTX)'
      };
    });

    updateSubmission(trackId, { files: [...sub.files, ...newFiles] });
    showToast(`อัปโหลด ${newFiles.length} ไฟล์เรียบร้อย`);
  };

  const removeFile = (trackId, fileId) => {
    const sub = submissions[trackId];
    const prevFiles = sub.files;
    const fileToRemove = prevFiles.find(f => f.id === fileId);
    const updated = prevFiles.filter(f => f.id !== fileId);

    updateSubmission(trackId, { files: updated });
    showToast(`ลบไฟล์ ${fileToRemove ? fileToRemove.name : ''} แล้ว`, () => {
      updateSubmission(trackId, { files: prevFiles });
    });
  };

  // Applicant photo: validate, shrink to max 600px JPEG so it fits in localStorage
  const setPhoto = (trackId, file) => new Promise((resolve) => {
    if (!file) {
      updateSubmission(trackId, { photo: null });
      return resolve({ success: true });
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!PHOTO_RULES.exts.includes(ext)) {
      return resolve({ success: false, error: `รองรับเฉพาะไฟล์ ${PHOTO_RULES.exts.join(', ').toUpperCase()}` });
    }
    if (file.size > PHOTO_RULES.maxMB * 1024 * 1024) {
      return resolve({ success: false, error: `ขนาดไฟล์ต้องไม่เกิน ${PHOTO_RULES.maxMB} MB` });
    }

    const reader = new FileReader();
    reader.onerror = () => resolve({ success: false, error: 'ไม่สามารถอ่านไฟล์ภาพได้' });
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve({ success: false, error: 'ไฟล์ภาพไม่ถูกต้อง' });
      img.onload = () => {
        const scale = Math.min(1, 600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        updateSubmission(trackId, {
          photo: { name: file.name, size: file.size, ext, dataUrl: canvas.toDataURL('image/jpeg', 0.85) }
        });
        showToast('อัปโหลดภาพถ่ายผู้สมัครเรียบร้อย');
        resolve({ success: true });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  // Draft & Submit
  const saveDraft = (trackId) => {
    const sub = submissions[trackId];
    if (getTrack(trackId).needsWorkInfo && !(sub.projectName || '').trim()) {
      return { success: false, error: 'กรุณาตั้งชื่อผลงานก่อนบันทึกฉบับร่าง' };
    }
    updateSubmission(trackId, {
      status: 'draft',
      draftAt: new Date().toISOString()
    });
    showToast('บันทึกฉบับร่างเรียบร้อยแล้ว');
    return { success: true };
  };

  const confirmSubmit = (trackId) => {
    const hash = generateReceiptHash();
    updateSubmission(trackId, {
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      hash
    });

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    showToast('ส่งผลงานเรียบร้อยและระบบทำการล็อกข้อมูลแล้ว');
    return hash;
  };

  const resetAllDataToDefault = () => {
    const defaultData = createSeedSubmissions();
    setSubmissions(defaultData);
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(defaultData));
    showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว');
  };

  return (
    <PortalContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loginStyle,
        setLoginStyle,
        currentView,
        setView,
        activeTrackId,
        setActiveTrackId,
        openTrack,
        submissions,
        updateSubmission,
        updateField,
        updateLink,
        addOrUpdateMember,
        removeMember,
        makeLeader,
        importCsvMembers,
        addFiles,
        removeFile,
        setPhoto,
        saveDraft,
        confirmSubmit,
        resetAllDataToDefault,
        bannerDismissed,
        dismissBanner: () => setBannerDismissed(true),
        toast,
        toastUndo,
        showToast,
        handleUndo
      }}
    >
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
};
