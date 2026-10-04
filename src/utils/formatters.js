export const daysUntil = (iso) => {
  if (!iso) return 0;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

export const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
};

export const statusMeta = (status, daysLeft) => {
  if (status === 'submitted') {
    return {
      label: 'ส่งแล้ว',
      badgeBg: 'rgba(42, 159, 247, 0.12)',
      badgeColor: '#0A65B0',
      badgeBorder: '1px solid rgba(42, 159, 247, 0.3)',
      dotColor: '#2A9FF7'
    };
  }
  if (status === 'draft') {
    return {
      label: 'ฉบับร่าง',
      badgeBg: 'rgba(255, 197, 37, 0.15)',
      badgeColor: '#8A5A00',
      badgeBorder: '1px solid rgba(255, 197, 37, 0.35)',
      dotColor: '#FFC525'
    };
  }
  if (daysLeft != null && daysLeft <= 30 && daysLeft >= 0) {
    return {
      label: 'ใกล้ปิดรับ',
      badgeBg: 'rgba(255, 95, 28, 0.12)',
      badgeColor: '#C2410C',
      badgeBorder: '1px solid rgba(255, 95, 28, 0.3)',
      dotColor: '#FF5F1C'
    };
  }
  return {
    label: 'ยังไม่เริ่ม',
    badgeBg: 'rgba(107, 111, 128, 0.1)',
    badgeColor: '#4A4E5E',
    badgeBorder: '1px solid rgba(107, 111, 128, 0.2)',
    dotColor: '#A3A6B4'
  };
};

export const teamLabel = (members = []) => {
  const advisors = members.filter(m => m.type === 'advisor').length;
  const students = members.filter(m => m.type === 'student').length;
  if (!advisors && !students) return 'ยังไม่มีทีม';
  const advText = advisors ? `อาจารย์ ${advisors} ท่าน` : 'ยังไม่มีอาจารย์';
  return `${advText} · นักศึกษา ${students} คน`;
};

export const generateReceiptHash = () => {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

export const generateId = (prefix = 'm') => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
};
