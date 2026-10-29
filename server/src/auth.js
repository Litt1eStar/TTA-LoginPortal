import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import { httpError } from './errors.js';
import { getUserAuth, getUserByUsername, bumpSessionVersion, toClientUser } from './users.js';
import { listEntries } from './entries.js';

export const COOKIE_NAME = 'tta_session';
const MAX_AGE = 7 * 24 * 3600;
const MAX_FUTURE_SKEW = 60;
const IP_LOGIN_MAX = 30;
const IP_LOGIN_WINDOW_MS = 60_000;
// Compared when the username is unknown, so timing does not reveal it. Computed once, same cost as real users.
let dummyHash = null;

function cookieOptions(config) {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: MAX_AGE };
}

function submissionsFor(db, user) {
  return user.role === 'coordinator' ? listEntries(db, user.universityId) : {};
}

async function authPlugin(app, { db, config }) {
  dummyHash ??= bcrypt.hashSync('dummy-password', 12);
  app.decorateRequest('user', null);

  async function requireUser(request) {
    const raw = request.cookies[COOKIE_NAME];
    if (!raw) throw httpError(401, 'unauthenticated');
    const { valid, value } = request.unsignCookie(raw);
    const m = valid && /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!m) throw httpError(401, 'unauthenticated');
    const age = Math.floor(Date.now() / 1000) - Number(m[3]);
    if (age > MAX_AGE || age < -MAX_FUTURE_SKEW) throw httpError(401, 'unauthenticated');
    const record = getUserAuth(db, Number(m[1]));
    if (!record || record.disabled || record.sessionVersion !== Number(m[2])) throw httpError(401, 'unauthenticated');
    request.user = record.user;
  }

  async function requireAdmin(request) {
    await requireUser(request);
    if (request.user.role !== 'admin') throw httpError(403, 'forbidden');
  }

  async function requireCoordinator(request) {
    await requireUser(request);
    if (request.user.role !== 'coordinator') throw httpError(403, 'forbidden');
  }

  app.decorate('requireUser', requireUser);
  app.decorate('requireAdmin', requireAdmin);
  app.decorate('requireCoordinator', requireCoordinator);

  // Second login cap: per IP alone, whatever the username (in-memory, fixed window).
  const ipHits = new Map();
  async function ipLoginCap(request) {
    const now = Date.now();
    if (ipHits.size > 10000) for (const [k, v] of ipHits) if (v.reset <= now) ipHits.delete(k);
    let hit = ipHits.get(request.ip);
    if (!hit || hit.reset <= now) { hit = { count: 0, reset: now + IP_LOGIN_WINDOW_MS }; ipHits.set(request.ip, hit); }
    if (++hit.count > IP_LOGIN_MAX) throw httpError(429, 'rate_limited');
  }

  app.post('/api/login', {
    preHandler: ipLoginCap,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request) => `${request.ip}|${String(request.body?.username || '').trim().toLowerCase()}`
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: { type: 'string', minLength: 1, maxLength: 100 }, password: { type: 'string', minLength: 1, maxLength: 200 } }
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body;
    const row = getUserByUsername(db, username.trim().toLowerCase());
    if (!row) {
      await bcrypt.compare(password, dummyHash);
      throw httpError(401, 'bad_credentials');
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok || row.disabled === 1) throw httpError(401, 'bad_credentials');
    const record = getUserAuth(db, row.id);
    reply.setCookie(COOKIE_NAME, `${row.id}.${record.sessionVersion}.${Math.floor(Date.now() / 1000)}`, cookieOptions(config));
    return { user: toClientUser(record.user), submissions: submissionsFor(db, record.user) };
  });

  app.post('/api/logout', { preHandler: requireUser }, async (request, reply) => {
    bumpSessionVersion(db, request.user.id);
    const { maxAge, ...clearOpts } = cookieOptions(config);
    reply.clearCookie(COOKIE_NAME, clearOpts);
    return { ok: true };
  });

  app.get('/api/me', { preHandler: requireUser }, async (request) => {
    return { user: toClientUser(request.user), submissions: submissionsFor(db, request.user) };
  });
}

export default fp(authPlugin, { name: 'tta-auth' });
