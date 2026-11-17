import { prisma } from '../lib/prisma.js';

// Verifica se o banco responde e se as tabelas da migração existem.
export async function checkDatabase() {
  try {
    const [activities, logs, reports] = await Promise.all([
      prisma.activity.count(),
      prisma.activityLog.count(),
      prisma.report.count(),
    ]);
    return { status: 'ok', counts: { activities, logs, reports } };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
