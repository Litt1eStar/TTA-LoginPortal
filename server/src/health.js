// Public liveness + DB check for Docker HEALTHCHECK, systemd checks and uptime monitors
export default async function healthPlugin(app, { db }) {
  app.get('/api/health', async () => {
    db.prepare('SELECT 1').get();
    return { ok: true, time: new Date().toISOString() };
  });
}
