import { prisma } from '../lib/prisma.js';
import { addDays, toDateKey } from '../utils/date.js';
import { OPEN_STATUSES } from './activity.service.js';

const IMPORTANCES = ['HIGH', 'MEDIUM', 'LOW'];

function datesBetween(from, to) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Indicadores do período [from, to] (datas "YYYY-MM-DD", inclusivas).
 *
 * Produtividade vem SOMENTE dos registros de execução (ActivityLog):
 * - executed: atividades distintas com ao menos um registro no período;
 * - daily: atividades distintas por dia (uma atividade conta uma vez por dia);
 * - activityDays: soma dos totais diários (a mesma atividade em 3 dias = 3).
 * Demandas apenas abertas nunca entram nesses números.
 *
 * `current` é a situação atual (independe do período): pendentes, em andamento e atrasadas.
 */
export async function getDashboard({ from, to }) {
  const today = toDateKey();

  const [pairs, openActivities, completedInPeriod] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ['executionDate', 'activityId'],
      where: { executionDate: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { timeSpent: true },
    }),
    prisma.activity.findMany({
      where: { status: { in: OPEN_STATUSES } },
      select: { status: true, dueDate: true },
    }),
    prisma.activity.count({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
      },
    }),
  ]);

  const activityIds = [...new Set(pairs.map((p) => p.activityId))];
  const activities = await prisma.activity.findMany({
    where: { id: { in: activityIds } },
    select: { id: true, importance: true, type: true, category: true },
  });

  const byImportance = Object.fromEntries(IMPORTANCES.map((i) => [i, 0]));
  const byType = { TASK: 0, CONTACT: 0 };
  const categoryCounts = new Map();
  for (const a of activities) {
    byImportance[a.importance] += 1;
    byType[a.type] += 1;
    const category = a.category || 'Sem categoria';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const dailyCounts = {};
  let logsCount = 0;
  let minutes = 0;
  for (const p of pairs) {
    dailyCounts[p.executionDate] = (dailyCounts[p.executionDate] || 0) + 1;
    logsCount += p._count._all;
    minutes += p._sum.timeSpent || 0;
  }

  return {
    period: { from, to, days: datesBetween(from, to).length },
    executed: {
      activities: activityIds.length,
      activityDays: pairs.length,
      logs: logsCount,
      minutes,
      completed: completedInPeriod,
      byType,
      byImportance,
      byCategory: [...categoryCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
      daily: datesBetween(from, to).map((date) => ({ date, count: dailyCounts[date] || 0 })),
    },
    current: {
      pending: openActivities.filter((a) => a.status === 'PENDING').length,
      inProgress: openActivities.filter((a) => a.status === 'IN_PROGRESS').length,
      overdue: openActivities.filter((a) => a.dueDate && a.dueDate < today).length,
    },
  };
}
