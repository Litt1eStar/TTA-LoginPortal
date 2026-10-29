import { FINAL_DEADLINE } from '../../src/data/tracks.js';

export function loadConfig(env = process.env) {
  if (env.NODE_ENV === 'production' && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }
  return {
    port: Number(env.PORT || 3001),
    dbPath: env.DB_PATH || 'data/portal.db',
    uploadDir: env.UPLOAD_DIR || 'data/uploads',
    sessionSecret: env.SESSION_SECRET || 'dev-only-secret-change-me-dev-only-secret',
    trustProxy: env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : false,
    cookieSecure: env.COOKIE_SECURE === 'true',
    deadline: env.DEADLINE || FINAL_DEADLINE,
    maxPhotoKB: Number(env.MAX_PHOTO_KB || 200),
    maxWorkMB: Number(env.MAX_WORK_MB || 50),
    maxVideoMB: Number(env.MAX_VIDEO_MB || 500),
    tokenKey: env.TOKEN_KEY || '',
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/admin/google/callback'
    },
    appOrigin: env.APP_ORIGIN || 'http://localhost:3000'
  };
}
