import { PHOTO_RULES } from '../data/referenceData';

// Validate an image file and shrink it to a max-400px WebP (JPEG fallback),
// so photos stay small in storage and on the wire. Resolves { success, photo } or { success: false, error }.
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
      // WebP is about half the size of JPEG at the same quality.
      // Browsers that can't encode WebP return PNG instead, so fall back to JPEG.
      let dataUrl = canvas.toDataURL('image/webp', 0.8);
      let outExt = 'webp';
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        outExt = 'jpg';
      }
      resolve({
        success: true,
        photo: { name: file.name, size: Math.round(dataUrl.length * 0.75), ext: outExt, dataUrl }
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// "data:image/webp;base64,..." -> Blob, so the resized photo can be uploaded
export const dataUrlToBlob = (dataUrl) => {
  const [head, b64 = ''] = String(dataUrl).split(',');
  const mime = /^data:([^;,]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

export const dataUrlToFile = (dataUrl, name) => {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], name, { type: blob.type });
};
