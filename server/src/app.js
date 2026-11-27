import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { errorHandler, httpError } from './errors.js';
import authPlugin from './auth.js';
import submissionsPlugin from './submissions.js';
import multipart from '@fastify/multipart';
import filesRoutes from './files.js';
import videoRoutes from './video.js';
import driveTestRoutes from './driveTest.js';
import driveRoutes, { createDrive } from './drive.js';
import adminPlugin from './admin.js';
import devPlugin from './dev.js';
import healthPlugin from './health.js';
import { registerStatic, spaNotFoundHandler } from './static.js';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UPLOAD_PATH = /^\/api\/submissions\/[^/]+\/files$/;

// Unknown options (e.g. googleFetch, added by later plans) are ignored.
// With BASE_PATH=/portal, '/portal', '/portal/x' and '/portal?q' are routed as '/', '/x' and '/?q'.
// Unprefixed URLs keep working (nginx also forwards /api/..., and stored photo links are /api/files/...).
function stripBasePath(basePath) {
  if (!basePath) return undefined;
  return (req) => {
    const url = req.url;
    if (url === basePath) return '/';
    if (url.startsWith(`${basePath}/`)) return url.slice(basePath.length);
    if (url.startsWith(`${basePath}?`)) return `/${url.slice(basePath.length)}`;
    return url;
  };
}

export function buildApp({ db, config, logger = false, googleFetch = globalThis.fetch }) {
  const app = Fastify({
    logger,
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
    rewriteUrl: stripBasePath(config.basePath)
  });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(spaNotFoundHandler(config));

  app.removeContentTypeParser('text/plain');

  // Like Fastify's JSON parser, but an empty body parses as {} (bodyless POSTs with a JSON content-type).
  const defaultJson = app.getDefaultJsonParser('error', 'error');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body.trim() === '') return done(null, {});
    defaultJson(req, body, done);
  });

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

  // The video uploader PUTs straight from the browser to a Drive resumable upload URL.
  // Over plain http (COOKIE_SECURE=false, e.g. http://10.2.15.250:3001) the HTTPS-only headers must be off,
  // or the browser fetches /assets/* over https and the page stays blank.
  app.register(helmet, {
    hsts: config.cookieSecure,
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", 'https://www.googleapis.com'],
        upgradeInsecureRequests: config.cookieSecure ? [] : null
      }
    }
  });
  app.register(compress);
  app.register(cookie, { secret: config.sessionSecret });
  app.register(rateLimit, {
    global: false,
    hook: 'preHandler', // so the login keyGenerator can read the parsed body
    errorResponseBuilder: () => httpError(429, 'rate_limited')
  });

  app.register(authPlugin, { db, config });
  const drive = createDrive({ db, config, fetch: googleFetch });
  app.register(submissionsPlugin, { db, config, drive });
  app.register(adminPlugin, { db, config });
  app.register(devPlugin, { db, config });
  app.register(healthPlugin, { db, config });
  registerStatic(app, config);
  app.register(multipart, { limits: { files: 1, fields: 5 } });
  app.register(filesRoutes, { prefix: '/api', db, config });
  app.register(driveRoutes, { prefix: '/api', db, config, drive });
  app.register(videoRoutes, { prefix: '/api', db, config, drive });
  app.register(driveTestRoutes, { prefix: '/api', db, config, drive });
  return app;
}
