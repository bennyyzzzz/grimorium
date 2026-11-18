import { AppError } from '../utils/AppError.js';
import { isDateKey, toDateKey } from '../utils/date.js';

export const IMPORTANCES = ['HIGH', 'MEDIUM', 'LOW'];
export const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];
export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'];
export const TYPES = ['TASK', 'CONTACT'];
export const CHANNELS = ['CHAT', 'WHATSAPP', 'CALL', 'EMAIL', 'MEETING', 'OTHER'];

function optionalText(value, field, max) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new AppError(`Valor inválido para o campo ${field}`);
  const text = value.trim();
  if (text.length > max) throw new AppError(`${field}: máximo de ${max} caracteres`);
  return text || null;
}

function requiredText(value, field, max) {
  const text = optionalText(value ?? null, field, max);
  if (!text) throw new AppError(`Preencha o campo ${field}`);
  return text;
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw new AppError(`Valor inválido para o campo ${field}`);
  return value;
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('ID inválido');
  return id;
}

// Dia de referência de uma execução: padrão hoje, nunca no futuro.
export function parseExecutionDate(value, field = 'Data') {
  if (value === undefined || value === null || value === '') return toDateKey();
  if (!isDateKey(value)) throw new AppError(`${field} inválida (use AAAA-MM-DD)`);
  if (value > toDateKey()) throw new AppError(`${field} não pode estar no futuro`);
  return value;
}

export function parseActivityInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || body.title !== undefined) data.title = requiredText(body.title, 'Título', 200);

  const description = optionalText(body.description, 'Descrição', 5000);
  if (description !== undefined) data.description = description;

  const category = optionalText(body.category, 'Categoria', 60);
  if (category !== undefined) data.category = category;

  if (body.importance !== undefined) data.importance = oneOf(body.importance, IMPORTANCES, 'Prioridade');

  const dueDate = parseDueDate(body.dueDate);
  if (dueDate !== undefined) data.dueDate = dueDate;

  // Campos de contato só são aceitos na edição; o tipo não muda depois de criado.
  if (body.channel !== undefined) data.channel = oneOf(body.channel, CHANNELS, 'Canal');
  const contactName = optionalText(body.contactName, 'Contato', 120);
  if (contactName !== undefined) data.contactName = contactName;

  return data;
}

function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (isDateKey(value)) return value;
  throw new AppError('Prazo inválido (use AAAA-MM-DD)');
}

function parseTimeSpent(value) {
  if (value === undefined || value === null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) {
    throw new AppError('Tempo gasto deve ser um número inteiro de minutos entre 1 e 1440');
  }
  return minutes;
}

export function parseContactInput(body = {}) {
  const timeSpent = parseTimeSpent(body.timeSpent);

  return {
    title: requiredText(body.title, 'Assunto', 200),
    contactName: optionalText(body.contactName, 'Contato', 120) ?? null,
    channel: oneOf(body.channel ?? 'OTHER', CHANNELS, 'Canal'),
    summary: optionalText(body.summary, 'O que foi tratado', 2000) ?? null,
    category: optionalText(body.category, 'Categoria', 60) ?? null,
    importance: oneOf(body.importance ?? 'MEDIUM', IMPORTANCES, 'Prioridade'),
    date: parseExecutionDate(body.date, 'Data do contato'),
    timeSpent,
    followUp: body.followUp === true,
    dueDate: parseDueDate(body.dueDate) ?? null,
  };
}

export function parseStatusInput(body = {}) {
  return {
    status: oneOf(body.status, STATUSES, 'Status'),
    note: optionalText(body.note, 'Observação', 2000) ?? null,
    date: parseExecutionDate(body.date),
  };
}

export function parseLogInput(body = {}) {
  return {
    description: requiredText(body.description, 'Descrição do registro', 2000),
    timeSpent: parseTimeSpent(body.timeSpent),
    executionDate: parseExecutionDate(body.executionDate, 'Data da execução'),
  };
}

const MAX_PERIOD_DAYS = 366;

// Período inclusivo; padrão: hoje. Datas futuras são permitidas no fim (não há registros futuros).
export function parsePeriod(query = {}) {
  const today = toDateKey();
  const from = query.from || today;
  const to = query.to || from;
  if (!isDateKey(from) || !isDateKey(to)) throw new AppError('Período inválido (use AAAA-MM-DD)');
  if (from > to) throw new AppError('A data inicial deve ser anterior ou igual à data final');

  const days = (new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86_400_000 + 1;
  if (days > MAX_PERIOD_DAYS) throw new AppError(`O período deve ter no máximo ${MAX_PERIOD_DAYS} dias`);

  return { from, to };
}

const MAX_EXPORT_IDS = 1000;

/**
 * Parâmetros da exportação:
 * - filtros da lista (type, status, importance, category, due, search);
 * - período opcional (from/to): atividades com execução ou criação no período;
 * - ids opcionais (seleção manual, separados por vírgula).
 */
export function parseExportQuery(query = {}) {
  const options = {
    filters: parseListFilters(query),
    period: null,
    ids: null,
    includeLibrary: query.library === '1', // backup .zip: inclui a Biblioteca inteira (não usa período/filtros)
  };

  if (query.from || query.to) options.period = parsePeriod(query);

  if (query.ids) {
    const ids = String(query.ids).split(',').filter(Boolean).map(parseId);
    if (ids.length > MAX_EXPORT_IDS) throw new AppError(`Selecione no máximo ${MAX_EXPORT_IDS} itens por exportação`);
    options.ids = [...new Set(ids)];
  }

  return options;
}

export function parseListFilters(query = {}) {
  const filters = {};
  if (query.type) filters.type = oneOf(query.type, TYPES, 'Tipo');
  if (query.status) filters.status = oneOf(query.status, STATUSES, 'Status');
  if (query.importance) filters.importance = oneOf(query.importance, IMPORTANCES, 'Prioridade');
  if (query.category) filters.category = String(query.category);
  if (query.due) filters.due = oneOf(query.due, DUE_FILTERS, 'Filtro de prazo');
  if (query.search) filters.search = String(query.search).trim();
  return filters;
}
