import { prisma } from '../lib/prisma.js';

/**
 * Contabilização de atividades executadas.
 *
 * Uma atividade conta em um dia somente se tiver ao menos um ActivityLog naquela data,
 * e conta UMA vez por dia, independentemente de quantos registros tenha.
 * Demandas abertas sem registro no dia nunca são contabilizadas.
 */

// Atividades distintas executadas em um dia, com seus registros daquele dia.
export async function getExecutionsByDate(date) {
  const logs = await prisma.activityLog.findMany({
    where: { executionDate: date },
    orderBy: { createdAt: 'asc' },
    include: {
      activity: {
        select: { id: true, title: true, category: true, importance: true, status: true },
      },
    },
  });

  const byActivity = new Map();
  for (const { activity, ...log } of logs) {
    if (!byActivity.has(activity.id)) byActivity.set(activity.id, { ...activity, logs: [] });
    byActivity.get(activity.id).logs.push(log);
  }

  const activities = [...byActivity.values()];
  return { date, executedCount: activities.length, activities };
}

// { "YYYY-MM-DD": quantidade de atividades distintas executadas } no intervalo.
export async function countExecutedByDay(from, to) {
  const groups = await prisma.activityLog.groupBy({
    by: ['executionDate', 'activityId'],
    where: { executionDate: { gte: from, lte: to } },
  });

  const counts = {};
  for (const { executionDate } of groups) counts[executionDate] = (counts[executionDate] || 0) + 1;
  return counts;
}
