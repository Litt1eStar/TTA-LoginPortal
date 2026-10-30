import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { notFoundHandler } from './errors.js';

// Vite build output: hashed names such as index-AbCd1234.js never change → cache forever
const HASHED = /-[A-Za-z0-9_-]{8}\.(js|css|woff2?|png|jpe?g|svg|webp)$/;

export function registerStatic(app, config) {
  if (!config.serveStatic) return;
  app.register(fastifyStatic, {
    root: path.resolve(config.staticDir),
    prefix: '/',
    wildcard: false,
    cacheControl: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.header('Cache-Control', 'no-cache');
      else if (HASHED.test(filePath)) res.header('Cache-Control', 'public, max-age=31536000, immutable');
      else res.header('Cache-Control', 'public, max-age=3600');
    }
  });
}

// SPA fallback: GET/HEAD for a page → index.html; everything under /api, or any other method → JSON 404
export function spaNotFoundHandler(config) {
  return function handler(request, reply) {
    const isPage = config.serveStatic
      && (request.method === 'GET' || request.method === 'HEAD')
      && !request.url.startsWith('/api');
    if (!isPage) return notFoundHandler(request, reply);
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  };
}
