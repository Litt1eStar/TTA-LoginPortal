import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { errorHandler, notFoundHandler, httpError } from './errors.js';
import authPlugin from './auth.js';
import submissionsPlugin from './submissions.js';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UPLOAD_PATH = /^\/api\/submissions\/[^/]+\/files$/;

// Unknown options (e.g. googleFetch, added by later plans) are ignored.
export function buildApp({ db, config, logger = false }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 1024 * 1024 });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.removeContentTypeParser('text/plain');

  // Block cross-site form posts: bodies must be JSON (or multipart on the upload route only).
  app.addHook('onRequest', async (request) => {
    if (!BODY_METHODS.has(request.method)) return;
    const path = request.url.split('?')[0];
    if (!path.startsWith('/api/')) return;
    const len = request.headers['content-length'];
    const hasBody = request.headers['transfer-encoding'] !== undefined || (len !== undefined && len !== '0');
    if (!hasBody) return;
    const type = String(request.headers['content-type'] || '').toLowerCase();
    if (type.startsWith('application/json')) return;
    if (type.startsWith('multipart/form-data') && UPLOAD_PATH.test(path)) return;
    throw httpError(415, 'bad_type');
  });

  app.register(helmet);
  app.register(compress);
  app.register(cookie, { secret: config.sessionSecret });
  app.register(rateLimit, {
    global: false,
    hook: 'preHandler', // so the login keyGenerator can read the parsed body
    errorResponseBuilder: () => httpError(429, 'rate_limited')
  });

  app.register(authPlugin, { db, config });
  app.register(submissionsPlugin, { db, config });
  return app;
}
