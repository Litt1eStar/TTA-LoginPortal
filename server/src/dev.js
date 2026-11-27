import { httpError } from './errors.js';
import { queryAuditLogs, getAuditLogById, buildAuditLogsCsv } from './audit.js';

const bangkokStamp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');

export default async function devPlugin(app, { db }) {
  const pre = { preHandler: app.requireDev };

  app.get('/api/dev/logs', pre, async (request) => {
    const universities = db.prepare('SELECT id, code, name FROM universities ORDER BY id').all();
    const result = queryAuditLogs(db, request.query);
    return { ...result, universities };
  });

  app.get('/api/dev/logs/:id', pre, async (request) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw httpError(400, 'bad_request');
    const log = getAuditLogById(db, id);
    if (!log) throw httpError(404, 'not_found');
    return { log };
  });

  app.get('/api/dev/logs.csv', pre, async (request, reply) => {
    const { logs } = queryAuditLogs(db, { ...request.query, limit: 5000, offset: 0 });
    const csv = buildAuditLogsCsv(logs);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tta-audit-logs-${bangkokStamp()}.csv"`)
      .header('Cache-Control', 'no-store');
    return csv;
  });
}
