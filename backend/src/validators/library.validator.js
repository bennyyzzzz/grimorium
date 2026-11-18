import { AppError } from '../utils/AppError.js';

export const ENTRY_KINDS = ['HOWTO', 'TEST', 'SNIPPET', 'NOTE'];
const MAX_CONTENT = 200_000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

function text(value, field, max, { required = false } = {}) {
  if (value === undefined) return undefined;
  if (value !== null && typeof value !== 'string') throw new AppError(`Valor inválido para o campo ${field}`);
  const trimmed = (value ?? '').trim();
  if (required && !trimmed) throw new AppError(`Preencha o campo ${field}`);
  if (trimmed.length > max) throw new AppError(`${field}: máximo de ${max.toLocaleString('pt-BR')} caracteres`);
  return trimmed;
}

// Tags: minúsculas, sem vírgulas, sem duplicatas.
export function normalizeTags(value) {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const tags = [];
  for (const raw of list) {
    if (typeof raw !== 'string') throw new AppError('Tags inválidas');
    const tag = raw.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '-');
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) throw new AppError(`Cada tag deve ter no máximo ${MAX_TAG_LENGTH} caracteres`);
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new AppError(`Use no máximo ${MAX_TAGS} tags`);
  return tags;
}

export function parseEntryInput(body = {}, { partial = false } = {}) {
  const data = {};

  const title = text(partial ? body.title : body.title ?? null, 'Título', 200, { required: true });
  if (title !== undefined) data.title = title;

  if (body.kind !== undefined) {
    if (!ENTRY_KINDS.includes(body.kind)) throw new AppError('Valor inválido para o campo Tipo');
    data.kind = body.kind;
  }

  const summary = text(body.summary, 'Resumo', 300);
  if (summary !== undefined) data.summary = summary || null;

  const content = text(body.content, 'Conteúdo', MAX_CONTENT);
  if (content !== undefined) data.content = content;

  const tags = normalizeTags(body.tags);
  if (tags !== undefined) data.tags = tags;

  if (body.pinned !== undefined) data.pinned = body.pinned === true;

  return data;
}

export function parseLibraryFilters(query = {}) {
  const filters = {};
  if (query.search) filters.search = String(query.search).trim();
  if (query.kind) {
    if (!ENTRY_KINDS.includes(query.kind)) throw new AppError('Tipo inválido');
    filters.kind = query.kind;
  }
  if (query.tag) filters.tag = normalizeTags([String(query.tag)])[0];
  return filters;
}
