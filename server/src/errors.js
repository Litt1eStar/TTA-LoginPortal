export const ERRORS = {
  bad_request: 'ข้อมูลไม่ถูกต้อง',
  unauthenticated: 'กรุณาเข้าสู่ระบบ',
  bad_credentials: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  forbidden: 'ไม่มีสิทธิ์เข้าถึง',
  deadline_passed: 'หมดเวลาส่งผลงานแล้ว',
  not_found: 'ไม่พบข้อมูล',
  version_conflict: 'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดใหม่',
  too_large: 'ไฟล์มีขนาดใหญ่เกินกำหนด',
  bad_type: 'ไม่รองรับไฟล์ประเภทนี้',
  incomplete: 'ยังกรอกข้อมูลไม่ครบ',
  locked: 'ส่งผลงานแล้ว แก้ไขไม่ได้',
  rate_limited: 'ลองใหม่อีกครั้งในภายหลัง',
  drive_unavailable: 'ยังไม่ได้เชื่อมต่อ Google Drive',
  server_error: 'เกิดข้อผิดพลาด กรุณาลองใหม่'
};

const CODE_BY_STATUS = { 400: 'bad_request', 401: 'unauthenticated', 403: 'forbidden', 404: 'not_found', 413: 'too_large', 415: 'bad_type', 429: 'rate_limited' };

export function httpError(status, code, message = ERRORS[code], extra = {}) {
  const err = new Error(message);
  err.statusCode = status;
  err.code = code;
  err.extra = extra;
  err.isHttpError = true;
  return err;
}

export function errorHandler(err, request, reply) {
  if (err.isHttpError) {
    if (err.statusCode >= 500) request.log.error(err);
    return reply.code(err.statusCode).send({ error: err.code, message: err.message, ...err.extra });
  }
  if (err.validation) {
    return reply.code(400).send({ error: 'bad_request', message: ERRORS.bad_request });
  }
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  if (status >= 500) {
    request.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: ERRORS.server_error });
  }
  const code = CODE_BY_STATUS[status] || 'bad_request';
  return reply.code(status).send({ error: code, message: ERRORS[code] });
}

export function notFoundHandler(request, reply) {
  reply.code(404).send({ error: 'not_found', message: ERRORS.not_found });
}
