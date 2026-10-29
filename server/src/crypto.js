import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM. Stored form: base64( iv[12] | tag[16] | ciphertext ).
function keyBuffer(hex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex || '')) {
    throw new Error('TOKEN_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function isValidTokenKey(hex) {
  return /^[0-9a-fA-F]{64}$/.test(hex || '');
}

export function encrypt(text, hexKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(hexKey), iv);
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(stored, hexKey) {
  const buf = Buffer.from(stored, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(hexKey), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}
