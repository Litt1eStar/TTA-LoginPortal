import { httpError } from './errors.js';
import { isValidEntryKey, listEntries, saveDraft, submitEntry, assertBeforeDeadline, getEntryRow, rowToEntry, blankData } from './entries.js';
import { sweepOrphanBlobs } from './files.js';
import { writeAuditLog, diffEntryData, summarizeDraftDiff } from './audit.js';
import path from 'node:path';

const keyParams = {
  type: 'object',
  required: ['key'],
  properties: { key: { type: 'string', maxLength: 40 } }
};

function checkKey(key) {
  if (!isValidEntryKey(key)) throw httpError(400, 'bad_request');
}

// Coordinator routes: the university always comes from request.user, never from the URL or body.
export default async function submissionsPlugin(app, { db, config, drive }) {
  const uploadDir = path.resolve(config.uploadDir);
  const syncPhotos = (request, key, entry) => {
    if (!drive) return;
    Promise.resolve()
      .then(() => drive.syncEntryPhotos(request.user.universityCode, request.user.universityId, key, entry.members))
      .catch(err => request.log.warn({ err, key }, 'drive photo sync failed'));
  };
  const scheduleSweep = (request) => {
    setImmediate(() => {
      sweepOrphanBlobs(db, uploadDir).catch(err => request.log.error({ err }, 'orphan sweep failed'));
    });
  };

  app.get('/api/submissions', { preHandler: app.requireCoordinator }, async (request) => {
    return { submissions: listEntries(db, request.user.universityId) };
  });

  app.put('/api/submissions/:key', {
    preHandler: app.requireCoordinator,
    schema: {
      params: keyParams,
      body: {
        type: 'object',
        required: ['data', 'version'],
        properties: { data: { type: 'object' }, version: { type: 'integer', minimum: 1 } }
      }
    }
  }, async (request) => {
    const { key } = request.params;
    checkKey(key);
    const { data, version } = request.body;
    const prevRow = getEntryRow(db, request.user.universityId, key);
    const beforeEntry = prevRow ? rowToEntry(prevRow) : blankData(key);
    const prevStatus = prevRow?.status ?? 0;

    let entry;
    try {
      assertBeforeDeadline(config);
      entry = saveDraft(db, request.user.universityId, key, data, version);
    } catch (err) {
      writeAuditLog(db, {
        request,
        action: 'submission.save_failed',
        entryKey: key,
        status: 'error',
        errorCode: err.code || 'server_error',
        summary: `บันทึกฉบับร่าง ${key} ไม่สำเร็จ (${err.code || 'error'})`,
        details: {
          clientVersion: version,
          serverVersion: prevRow?.version ?? null,
          errorCode: err.code || 'server_error'
        }
      });
      throw err;
    }

    const diff = diffEntryData(beforeEntry, entry);
    if (prevStatus === 0 || diff.hasChanges) {
      writeAuditLog(db, {
        request,
        action: 'submission.save_draft',
        entryKey: key,
        summary: summarizeDraftDiff(key, diff, prevStatus),
        details: {
          versionBefore: version,
          versionAfter: entry.version,
          diff,
          before: {
            projectName: beforeEntry.projectName,
            summary: beforeEntry.summary,
            notes: beforeEntry.notes,
            links: beforeEntry.links,
            members: beforeEntry.members,
            files: beforeEntry.files,
            video: beforeEntry.video
          },
          after: {
            projectName: entry.projectName,
            summary: entry.summary,
            notes: entry.notes,
            links: entry.links,
            members: entry.members,
            files: entry.files,
            video: entry.video
          }
        }
      });
    }

    syncPhotos(request, key, entry);
    scheduleSweep(request);
    return { entry };
  });

  app.post('/api/submissions/:key/submit', {
    preHandler: app.requireCoordinator,
    schema: { params: keyParams }
  }, async (request) => {
    const { key } = request.params;
    checkKey(key);
    let entry;
    try {
      assertBeforeDeadline(config);
      entry = submitEntry(db, request.user.universityId, key);
    } catch (err) {
      writeAuditLog(db, {
        request,
        action: 'submission.submit_failed',
        entryKey: key,
        status: 'error',
        errorCode: err.code || 'server_error',
        summary: `ส่งผลงาน ${key} ไม่สำเร็จ (${err.code || 'error'})`,
        details: {
          errorCode: err.code || 'server_error',
          failedRequirements: err.extra?.failed || []
        }
      });
      throw err;
    }

    writeAuditLog(db, {
      request,
      action: 'submission.submit',
      entryKey: key,
      targetId: entry.hash,
      summary: `ส่งผลงาน ${key} สำเร็จ (รหัสอ้างอิง ${entry.hash})`,
      details: {
        hash: entry.hash,
        version: entry.version,
        projectName: entry.projectName,
        memberCount: (entry.members || []).length,
        fileCount: (entry.files || []).length,
        hasVideo: Boolean(entry.video?.driveFileId),
        youtubeUrl: entry.links?.video || ''
      }
    });
    syncPhotos(request, key, entry);
    return { entry };
  });
}
