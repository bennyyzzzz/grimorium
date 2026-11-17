import { checkDatabase } from '../services/health.service.js';

export async function getHealth(req, res) {
  const database = await checkDatabase();
  const ok = database.status === 'ok';

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    api: 'ok',
    database,
    timestamp: new Date().toISOString(),
  });
}
