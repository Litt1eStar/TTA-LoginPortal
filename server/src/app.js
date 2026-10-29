import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { errorHandler, notFoundHandler, httpError } from './errors.js';
import authPlugin from './auth.js';
import submissionsPlugin from './submissions.js';

export function buildApp({ db, config, logger = false }) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 1024 * 1024 });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(helmet);
  app.register(compress);
  app.register(cookie, { secret: config.sessionSecret });
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => httpError(429, 'rate_limited')
  });

  app.register(authPlugin, { db, config });
  app.register(submissionsPlugin, { db, config });
  return app;
}
