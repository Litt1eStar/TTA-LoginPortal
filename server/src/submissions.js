import { httpError } from './errors.js';
import { isValidEntryKey, listEntries, saveDraft, submitEntry, assertBeforeDeadline } from './entries.js';

const keyParams = {
  type: 'object',
  required: ['key'],
  properties: { key: { type: 'string', maxLength: 40 } }
};

function checkKey(key) {
  if (!isValidEntryKey(key)) throw httpError(400, 'bad_request');
}

// Coordinator routes: the university always comes from request.user, never from the URL or body.
export default async function submissionsPlugin(app, { db, config }) {
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
    assertBeforeDeadline(config);
    const { key } = request.params;
    checkKey(key);
    const { data, version } = request.body;
    return { entry: saveDraft(db, request.user.universityId, key, data, version) };
  });

  app.post('/api/submissions/:key/submit', {
    preHandler: app.requireCoordinator,
    schema: { params: keyParams }
  }, async (request) => {
    assertBeforeDeadline(config);
    const { key } = request.params;
    checkKey(key);
    return { entry: submitEntry(db, request.user.universityId, key) };
  });
}
