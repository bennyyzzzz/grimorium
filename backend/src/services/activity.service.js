import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { addDays, dateKeyToDate, toDateKey } from '../utils/date.js';

export const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS'];
const CLOSED_STATUSES = ['COMPLETED', 'CANCELED'];
const IMPORTANCE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const logsOrder = [{ executionDate: 'desc' }, { createdAt: 'desc' }];

// ---------- Serialização ----------

export function isOverdue(activity, today = toDateKey()) {
  return OPEN_STATUSES.includes(activity.status) && !!activity.dueDate && activity.dueDate < today;
}

function serializeListItem(activity, today) {
  const { logs, _count, ...rest } = activity;
  return {
    ...rest,
    isOverdue: isOverdue(activity, today),
    logsCount: _count.logs,
    lastExecutionDate: logs[0]?.executionDate ?? null,
  };
}

function serializeDetail(activity) {
  return { ...activity, isOverdue: isOverdue(activity) };
}

// Abertas primeiro (atrasadas no topo, depois por prazo e prioridade); fechadas por última atualização.
function compareActivities(a, b) {
  const aOpen = OPEN_STATUSES.includes(a.status);
  const bOpen = OPEN_STATUSES.includes(b.status);
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (!aOpen) return b.updatedAt - a.updatedAt;

  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const byImportance = IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
  if (byImportance) return byImportance;
  return b.createdAt - a.createdAt;
}

function dueFilter(due, today) {
  switch (due) {
    case 'overdue':
      return { dueDate: { lt: today }, status: { in: OPEN_STATUSES } };
    case 'today':
      return { dueDate: today };
    case 'week':
      return { dueDate: { gte: today, lte: addDays(today, 7) } };
    case 'none':
      return { dueDate: null };
    default:
      return null;
  }
}

async function findOrFail(client, id) {
  const activity = await client.activity.findUnique({ where: { id } });
  if (!activity) throw new AppError('Demanda não encontrada', 404);
  return activity;
}

// ---------- Registro de execução (regra de contabilização) ----------

/**
 * Cria um ActivityLog. Com `onlyIfNoneThatDay`, não cria se a atividade já possui
 * registro na mesma data — usado nos registros automáticos (início/conclusão),
 * evitando duplicidade no mesmo dia.
 */
async function registerExecution(
  tx,
  { activityId, executionDate, description, timeSpent = null, onlyIfNoneThatDay = false },
) {
  if (onlyIfNoneThatDay) {
    const existing = await tx.activityLog.findFirst({ where: { activityId, executionDate } });
    if (existing) return existing;
  }
  return tx.activityLog.create({ data: { activityId, executionDate, description, timeSpent } });
}

// ---------- CRUD ----------

export async function listActivities(filters = {}) {
  const today = toDateKey();
  const and = [];

  if (filters.type) and.push({ type: filters.type });
  if (filters.status) and.push({ status: filters.status });
  if (filters.importance) and.push({ importance: filters.importance });
  if (filters.category) and.push({ category: filters.category });
  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
        { contactName: { contains: filters.search } },
      ],
    });
  }
  const due = dueFilter(filters.due, today);
  if (due) and.push(due);

  const activities = await prisma.activity.findMany({
    where: { AND: and },
    include: {
      _count: { select: { logs: true } },
      logs: { select: { executionDate: true }, orderBy: logsOrder, take: 1 },
    },
  });

  return activities.map((a) => serializeListItem(a, today)).sort(compareActivities);
}

export async function listCategories() {
  const rows = await prisma.activity.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

export async function getActivity(id) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { logs: { orderBy: logsOrder } },
  });
  if (!activity) throw new AppError('Demanda não encontrada', 404);
  return serializeDetail(activity);
}

export async function createActivity(data) {
  const { channel, contactName, ...taskData } = data; // demandas não têm campos de contato
  const activity = await prisma.activity.create({ data: { ...taskData, type: 'TASK' } });
  return getActivity(activity.id);
}

/**
 * Registra um contato (chat, WhatsApp, ligação...) em um único passo:
 * cria a atividade do tipo CONTACT já com o registro de execução na data do contato,
 * de modo que conta como trabalho executado naquele dia.
 * - Sem retorno pendente: nasce concluído.
 * - Com retorno pendente (followUp): fica em andamento, com prazo opcional.
 *
 * `source`/`externalId` permitem que integrações futuras importem contatos
 * de forma idempotente: o mesmo externalId de uma origem nunca é duplicado.
 */
export async function createContact({
  title,
  contactName = null,
  channel = 'OTHER',
  summary = null,
  category = null,
  importance = 'MEDIUM',
  date = toDateKey(),
  timeSpent = null,
  followUp = false,
  dueDate = null,
  source = 'manual',
  externalId = null,
}) {
  if (externalId) {
    const existing = await prisma.activity.findUnique({
      where: { source_externalId: { source, externalId } },
    });
    if (existing) return getActivity(existing.id);
  }

  const when = dateKeyToDate(date);
  const activity = await prisma.activity.create({
    data: {
      type: 'CONTACT',
      title,
      contactName,
      channel,
      category,
      importance,
      dueDate: followUp ? dueDate : null,
      status: followUp ? 'IN_PROGRESS' : 'COMPLETED',
      startedAt: when,
      completedAt: followUp ? null : when,
      source,
      externalId,
      logs: {
        create: { executionDate: date, description: summary || 'Contato registrado', timeSpent },
      },
    },
  });

  return getActivity(activity.id);
}

export async function updateActivity(id, data) {
  await prisma.activity.update({ where: { id }, data });
  return getActivity(id);
}

export async function deleteActivity(id) {
  await prisma.activity.delete({ where: { id } });
}

// ---------- Status ----------

/**
 * Altera o status aplicando as regras de negócio:
 * - Iniciar pela primeira vez: define startedAt e cria o primeiro registro de execução.
 * - Concluir: define completedAt e cria registro de conclusão, salvo se já houver registro no dia.
 * - Uma observação (`note`) informada pelo usuário sempre vira um registro.
 * - Voltar para pendente/cancelar/reabrir não gera registro (não é trabalho executado).
 */
export async function changeStatus(id, status, { date = toDateKey(), note = null } = {}) {
  await prisma.$transaction(async (tx) => {
    const activity = await findOrFail(tx, id);
    if (activity.status === status) throw new AppError('A demanda já está com esse status', 409);

    const when = dateKeyToDate(date);
    const data = { status, completedAt: null };
    let execution = null;

    if (status === 'IN_PROGRESS') {
      if (!activity.startedAt) {
        data.startedAt = when;
        execution = { description: note || 'Demanda iniciada' };
      } else if (note) {
        execution = { description: note };
      }
    }

    if (status === 'COMPLETED') {
      data.completedAt = when;
      if (!activity.startedAt) data.startedAt = when;
      execution = { description: note || 'Demanda concluída' };
    }

    await tx.activity.update({ where: { id }, data });

    if (execution) {
      await registerExecution(tx, {
        activityId: id,
        executionDate: date,
        description: execution.description,
        onlyIfNoneThatDay: !note,
      });
    }
  });

  return getActivity(id);
}

// ---------- Registros de execução ----------

/**
 * Adiciona um registro de execução manual.
 * Registrar trabalho em uma demanda pendente a coloca em andamento.
 */
export async function addLog(id, { description, timeSpent = null, executionDate = toDateKey() }) {
  await prisma.$transaction(async (tx) => {
    const activity = await findOrFail(tx, id);
    if (CLOSED_STATUSES.includes(activity.status)) {
      throw new AppError('Reabra a demanda para registrar uma nova execução', 422);
    }

    const startedBefore = activity.startedAt && toDateKey(activity.startedAt) <= executionDate;
    const data = {};
    if (activity.status === 'PENDING') data.status = 'IN_PROGRESS';
    if (!startedBefore) data.startedAt = dateKeyToDate(executionDate);
    if (Object.keys(data).length) await tx.activity.update({ where: { id }, data });

    await registerExecution(tx, { activityId: id, executionDate, description, timeSpent });
  });

  return getActivity(id);
}

export async function removeLog(activityId, logId) {
  const log = await prisma.activityLog.findFirst({ where: { id: logId, activityId } });
  if (!log) throw new AppError('Registro de execução não encontrado', 404);
  await prisma.activityLog.delete({ where: { id: logId } });
  return getActivity(activityId);
}
