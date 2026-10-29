// Multipart body for app.inject(), field name "file".
export function multipartBody(filename, bytes, contentType = 'application/octet-stream') {
  const boundary = '----ttatest' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, Buffer.from(bytes), tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }
  };
}

// Smallest bytes file-type recognises as JPEG; `fill` changes the content (and so the sha256).
export function jpegBytes(size = 64, fill = 0) {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
  return Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, size - head.length), fill)]);
}

export const pdfBytes = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const cfbBytes = () =>
  Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)]);

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// A real one-entry stored zip (file-type reports application/zip).
export function zipBytes(entryName = 'hello.txt', content = 'hi') {
  const n = Buffer.from(entryName);
  const d = Buffer.from(content);
  const crc = crc32(d);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(d.length, 18); local.writeUInt32LE(d.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(d.length, 20); central.writeUInt32LE(d.length, 24);
  central.writeUInt16LE(n.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + n.length, 12); end.writeUInt32LE(30 + n.length + d.length, 16);
  return Buffer.concat([local, n, d, central, n, end]);
}
