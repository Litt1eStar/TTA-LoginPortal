import { PHOTO_RULES } from '../data/referenceData';

// Validate an image file and shrink it to a max-400px JPEG so every member's
// photo still fits in localStorage. Resolves { success, photo } or { success: false, error }.
export const processPhoto = (file) => new Promise((resolve) => {
  if (!file) return resolve({ success: false, error: 'ไม่พบไฟล์' });

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
      const scale = Math.min(1, 400 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        success: true,
        photo: { name: file.name, size: file.size, ext, dataUrl: canvas.toDataURL('image/jpeg', 0.82) }
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
