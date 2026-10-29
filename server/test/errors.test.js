import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { httpError, errorHandler, notFoundHandler, ERRORS } from '../src/errors.js';

function app() {
  const a = Fastify({ logger: false });
  a.setErrorHandler(errorHandler);
  a.setNotFoundHandler(notFoundHandler);
  a.get('/conflict', async () => { throw httpError(409, 'version_conflict', undefined, { entry: { version: 3 } }); });
  a.get('/boom', async () => { throw new Error('secret internals'); });
  a.post('/schema', { schema: { body: { type: 'object', required: ['x'], properties: { x: { type: 'integer' } } } } }, async () => ({ ok: true }));
  return a;
}

describe('errors', () => {
  it('httpError carries status, code, default Thai message and extra', () => {
    const e = httpError(423, 'locked');
    expect(e.statusCode).toBe(423);
    expect(e.code).toBe('locked');
    expect(e.message).toBe(ERRORS.locked);
  });

  it('sends { error, message, ...extra }', async () => {
    const res = await app().inject({ method: 'GET', url: '/conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'version_conflict', message: ERRORS.version_conflict, entry: { version: 3 } });
  });

  it('hides 5xx details', async () => {
    const res = await app().inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('server_error');
    expect(res.body).not.toContain('secret internals');
  });

  it('maps validation errors to 400 bad_request', async () => {
    const res = await app().inject({ method: 'POST', url: '/schema', payload: { x: 'no' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_request', message: ERRORS.bad_request });
  });

  it('404 not_found', async () => {
    const res = await app().inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });
});
