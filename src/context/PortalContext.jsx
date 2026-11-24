import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTrack, defaultRole, usesLeader } from '../data/tracks';
import { DEPT_BY_UNIVERSITY, departmentForUniversity } from '../data/referenceData';
import { generateId } from '../utils/formatters';
import { api, ApiError, onUnauthenticated, uploadFile } from '../api';
import { createAutosaver, entryData } from '../utils/autosave';
import confetti from 'canvas-confetti';

// Submit celebration in the brand colours: a centre burst, then two side cannons
const CONFETTI_COLORS = ['#FF5F1C', '#FF8D20', '#FFC525', '#2A9FF7', '#FFFFFF'];
const celebrate = () => {
  const base = { colors: CONFETTI_COLORS, disableForReducedMotion: true, zIndex: 10000 };
  confetti({ ...base, particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.62 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 55, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 55, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
  }, 220);
};

const PortalContext = createContext(null);

const STORAGE_KEY_TRACK = 'ttaa13_track';
const WORK_EXTS = ['pdf', 'zip', 'ppt', 'pptx'];
const MAX_WORK_MB = 50;

const loginErrorMessage = (err) => {
  if (!(err instanceof ApiError)) return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';
  if (err.status === 401) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  if (err.status === 429) return 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 1 นาทีแล้วลองใหม่';
  return err.message;
};

export const PortalProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state: comes from the server session cookie, never from localStorage
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

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

  // { [entryKey]: Entry } as returned by the API
  const [submissions, setSubmissions] = useState({});

  const [toast, setToast] = useState(null);
  const [toastUndo, setToastUndo] = useState(null);
  const [toastActionLabel, setToastActionLabel] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRACK, activeTrackId);
    } catch (e) {
      console.error(e);
    }
  }, [activeTrackId]);

  // Toast handler with an optional action (undo by default; actionLabel renames the button)
  const showToast = (message, undoAction = null, actionLabel = null) => {
    setToast(message);
    setToastUndo(() => undoAction);
    setToastActionLabel(undoAction ? actionLabel : null);
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

  // Callbacks made once (autosaver, 401 handler) read the latest values through refs
  const userRef = useRef(user);
  userRef.current = user;
  const saveErrorRef = useRef(null);

  const autosaverRef = useRef(null);
  if (!autosaverRef.current) {
    autosaverRef.current = createAutosaver({
      delay: 1000,
      save: async (key, data, version) => {
        const { entry } = await api.put(`/submissions/${key}`, { data, version });
        // Keep what was typed meanwhile; take status, time and version from the server
        setSubmissions(prev => (prev[key]
          ? { ...prev, [key]: { ...prev[key], status: entry.status, draftAt: entry.draftAt, version: entry.version } }
          : prev));
        return entry;
      },
      onStateChange: (s) => setSaveState(s),
      onError: (key, err) => saveErrorRef.current?.(key, err)
    });
  }
  const autosaver = autosaverRef.current;

  // Put a server entry into state and mark it as the saved baseline
  const replaceEntry = (key, entry) => {
    autosaver.setBaseline(key, entryData(entry), entry.version);
    setSubmissions(prev => ({ ...prev, [key]: entry }));
  };

  // 423 has no entry in its body: reload the list and take that entry
  const refreshEntry = async (key) => {
    try {
      const { submissions: all } = await api.get('/submissions');
      if (all[key]) replaceEntry(key, all[key]);
    } catch {
      // the next action will show the error
    }
  };

  // Some server routes change an entry's stored data themselves and bump its version
  // (deleting the clip video). Take the server's version but keep what is typed here:
  // the baseline is the server's data, so any difference is autosaved afterwards.
  const syncVersion = async (key) => {
    try {
      const { submissions: all } = await api.get('/submissions');
      const server = all[key];
      if (!server) return;
      autosaver.setBaseline(key, entryData(server), server.version);
      setSubmissions(prev => (prev[key]
        ? { ...prev, [key]: { ...prev[key], version: server.version, status: server.status } }
        : prev));
    } catch {
      // a later save that hits a version conflict reloads the entry anyway
    }
  };

  // Save pending changes of one entry before a server action that depends on them
  const flushEntry = async (key) => {
    try {
      await autosaver.flush(key);
    } catch {
      // already shown through onError
    }
  };

  saveErrorRef.current = (key, err) => {
    if (!(err instanceof ApiError)) {
      showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่');
      return;
    }
    if (err.code === 'unauthenticated') return; // handled by onUnauthenticated
    if (err.code === 'version_conflict' && err.extra.entry) {
      replaceEntry(key, err.extra.entry);
      setSaveState('idle');
      showToast('ข้อมูลถูกแก้ไขจากที่อื่น ระบบโหลดข้อมูลล่าสุดให้แล้ว');
      return;
    }
    if (err.code === 'locked') {
      refreshEntry(key);
      setSaveState('idle');
    }
    showToast(err.message); // deadline_passed, locked, network, server_error …
  };

  const startSession = (u, subs) => {
    autosaver.reset();
    Object.entries(subs || {}).forEach(([key, e]) => autosaver.setBaseline(key, entryData(e), e.version));
    setSubmissions(subs || {});
    setUser(u);
    setSaveState('idle');
  };

  const endSession = () => {
    autosaver.reset();
    setUser(null);
    setSubmissions({});
    setSaveState('idle');
  };

  // Boot: is there a session cookie already?
  useEffect(() => {
    let cancelled = false;
    api.get('/me')
      .then(({ user: u, submissions: subs }) => { if (!cancelled) startSession(u, subs); })
      .catch((err) => { if (!cancelled && err.status !== 401) showToast(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session expired or revoked while using the app
  useEffect(() => {
    onUnauthenticated(() => {
      if (!userRef.current) return;
      endSession();
      showToast('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง');
      navigate('/login');
    });
    return () => onUnauthenticated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave: hand every editable entry to the autosaver; it sends only changed ones
  useEffect(() => {
    if (!user || user.role !== 'coordinator') return;
    Object.entries(submissions).forEach(([key, sub]) => {
      if (sub.status === 'submitted') return;
      autosaver.schedule(key, entryData(sub));
    });
  }, [submissions, user, autosaver]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!autosaver.hasUnsaved()) return;
      autosaver.flushAll();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [autosaver]);

  // Login & Logout
  const login = async (username, password) => {
    const cleanUser = (username || '').trim().toLowerCase();
    if (!cleanUser || !password) {
      return { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    }
    try {
      const { user: u, submissions: subs } = await api.post('/login', { username: cleanUser, password });
      startSession(u, subs);
      showToast(`ยินดีต้อนรับ คุณ${u.name}`);
      return { success: true, user: u };
    } catch (err) {
      return { success: false, error: loginErrorMessage(err) };
    }
  };

  const logout = async () => {
    await autosaver.flushAll();
    try {
      await api.post('/logout');
    } catch {
      // the cookie may already be gone; log out on this side anyway
    }
    endSession();
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

  // Submissions operations (functional updates: uploads finish in any order)
  const patchEntry = (key, fn) =>
    setSubmissions(prev => (prev[key] ? { ...prev, [key]: fn(prev[key]) } : prev));

  const updateSubmission = (trackId, patch) => patchEntry(trackId, sub => ({ ...sub, ...patch }));

  const updateField = (trackId, field, value) => {
    updateSubmission(trackId, { [field]: value });
  };

  const updateLink = (trackId, linkField, value) => {
    patchEntry(trackId, sub => ({ ...sub, links: { ...sub.links, [linkField]: value } }));
  };

  // Keep at most `limit` advisors, dropping the oldest ones first
  const capAdvisors = (members, limit) => {
    const advisors = members.filter(m => m.type === 'advisor');
    if (advisors.length <= limit) return members;
    const dropIds = new Set(advisors.slice(0, advisors.length - limit).map(m => m.id));
    return members.filter(m => !dropIds.has(m.id));
  };

  const ensureStudentLeader = (trackId, members = []) => {
    const track = getTrack(trackId);
    if (!usesLeader(track)) {
      return members.map(m => m.type === 'student' ? { ...m, isLeader: false } : m);
    }
    const students = members.filter(m => m.type === 'student');
    if (students.length > 0 && !students.some(m => m.isLeader)) {
      const firstId = students[0].id;
      return members.map(m => m.id === firstId ? { ...m, isLeader: true } : m);
    }
    return members;
  };

  const addOrUpdateMember = (trackId, memberData) => {
    const sub = submissions[trackId];
    const track = getTrack(trackId);
    let members = [...sub.members];
    const isEdit = !!memberData.id;
    const lockedDept = DEPT_BY_UNIVERSITY[user?.universityCode] || departmentForUniversity(user?.university) || '';
    const isParticipants = !!track.participantsOnly;
    const role = memberData.type === 'advisor' ? undefined : (memberData.role || defaultRole(track));
    // University and department always come from the logged-in account (participants have no dept/id/contact)
    memberData = isParticipants
      ? {
          ...memberData,
          type: 'student',
          role,
          university: user?.university || '',
          dept: '',
          studentId: '',
          year: '',
          email: '',
          phone: '',
          isLeader: false
        }
      : { ...memberData, ...(role ? { role } : {}), university: user?.university || '', dept: lockedDept };

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
      members = capAdvisors(members, track.advisorCount ?? 1);
    }

    // Ensure only one student leader if this track uses a team leader
    if (usesLeader(track) && memberData.type === 'student' && memberData.isLeader) {
      const targetId = memberData.id || members[members.length - 1].id;
      members = members.map(m => m.type === 'student' ? { ...m, isLeader: m.id === targetId } : m);
    }

    members = ensureStudentLeader(trackId, members);
    updateSubmission(trackId, { members });
    showToast(isEdit ? `แก้ไขข้อมูล ${memberData.fullName} สำเร็จ` : `เพิ่ม ${memberData.fullName} ในทีมแล้ว`);
  };

  const removeMember = (trackId, memberId) => {
    const prevMembers = submissions[trackId].members;
    const removed = prevMembers.find(m => m.id === memberId);
    const updated = ensureStudentLeader(trackId, prevMembers.filter(m => m.id !== memberId));

    updateSubmission(trackId, { members: updated });
    showToast(`ลบ ${removed ? removed.fullName : 'สมาชิก'} แล้ว`, () => {
      updateSubmission(trackId, { members: prevMembers });
    });
  };

  const makeLeader = (trackId, studentId) => {
    if (!usesLeader(getTrack(trackId))) return;
    const prev = submissions[trackId].members;
    const updated = prev.map(m => m.type === 'student' ? { ...m, isLeader: m.id === studentId } : m);
    updateSubmission(trackId, { members: updated });
    const target = updated.find(m => m.id === studentId);
    showToast(`ตั้ง ${target ? target.fullName : ''} เป็นหัวหน้าทีมแล้ว`);
  };

  // Files (work files: upload to the server, then the FileRef is autosaved with the entry)
  const patchFile = (key, localId, patch) =>
    patchEntry(key, sub => ({ ...sub, files: sub.files.map(f => (f.id === localId ? { ...f, ...patch } : f)) }));

  const addFiles = (trackId, fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;

    const rows = picked.map(file => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let error = '';
      if (!WORK_EXTS.includes(ext)) error = 'ไม่รองรับไฟล์ประเภทนี้ (รองรับ PDF, ZIP, PPT, PPTX)';
      else if (file.size > MAX_WORK_MB * 1024 * 1024) error = `ไฟล์มีขนาดใหญ่เกิน ${MAX_WORK_MB} MB`;
      return {
        file,
        row: { id: generateId('f'), name: file.name, size: file.size, ext, progress: 0, status: error ? 'error' : 'uploading', error }
      };
    });
    patchEntry(trackId, sub => ({ ...sub, files: [...sub.files, ...rows.map(r => r.row)] }));

    rows.filter(r => r.row.status === 'uploading').forEach(({ file, row }) => {
      uploadFile(`/submissions/${trackId}/files?kind=work`, file, {
        onProgress: (p) => patchFile(trackId, row.id, { progress: p })
      })
        .then(({ file: ref }) => {
          patchFile(trackId, row.id, { ...ref, error: '' });
          showToast(`อัปโหลด ${ref.name} เรียบร้อย`);
        })
        .catch(err => patchFile(trackId, row.id, { status: 'error', progress: 0, error: err.message }));
    });
  };

  const removeFile = async (trackId, fileId) => {
    const target = (submissions[trackId]?.files || []).find(f => f.id === fileId);
    if (!target || target.status === 'uploading') return;

    patchEntry(trackId, sub => ({ ...sub, files: sub.files.filter(f => f.id !== fileId) }));
    if (target.fileId == null) {
      showToast(`ลบไฟล์ ${target.name} แล้ว`); // a failed upload, only on this screen
      return;
    }
    try {
      await api.del(`/files/${target.fileId}`);
      showToast(`ลบไฟล์ ${target.name} แล้ว`);
    } catch (err) {
      if (err.status === 404) {
        showToast(`ลบไฟล์ ${target.name} แล้ว`);
        return;
      }
      patchEntry(trackId, sub => ({ ...sub, files: [...sub.files, target] }));
      showToast(err.message);
    }
  };

  // Draft & Submit
  const saveDraft = async (trackId) => {
    const sub = submissions[trackId];
    if (getTrack(trackId).needsWorkInfo && !(sub.projectName || '').trim()) {
      return { success: false, field: 'projectName', error: 'กรุณาตั้งชื่อผลงานก่อนบันทึกฉบับร่าง' };
    }
    autosaver.schedule(trackId, entryData(sub));
    try {
      await autosaver.flush(trackId, { force: true });
      showToast('บันทึกฉบับร่างเรียบร้อยแล้ว');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message }; // the toast came from onError
    }
  };

  const confirmSubmit = async (trackId) => {
    try {
      await autosaver.flush(trackId);
      const { entry } = await api.post(`/submissions/${trackId}/submit`);
      replaceEntry(trackId, entry); // submit bumps version: take the server's
      celebrate(); // SubmitView then shows the celebration screen with the confirmation code
      return { success: true, hash: entry.hash };
    } catch (err) {
      if (err instanceof ApiError && err.code === 'incomplete') {
        return { success: false, error: err.message, failed: err.extra.failed || [] };
      }
      if (err instanceof ApiError && err.code === 'locked') refreshEntry(trackId);
      return { success: false, error: err.message || 'ส่งผลงานไม่สำเร็จ กรุณาลองใหม่', failed: [] };
    }
  };

  return (
    <PortalContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        loading,
        saveState,
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
        addFiles,
        removeFile,
        flushEntry,
        syncVersion,
        saveDraft,
        confirmSubmit,
        toast,
        toastUndo,
        toastActionLabel,
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
