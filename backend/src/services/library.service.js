import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { libraryFilePath, removeLibraryFiles } from '../utils/storage.js';
import { normalizeTags } from '../validators/library.validator.js';
import { fetchGithubFile } from './github.service.js';

/**
 * Biblioteca: repositório pessoal de passo a passo, testes automatizados, snippets e anotações.
 * Conteúdo em Markdown; anexos ficam em disco (storage/library) e só os metadados no banco.
 */

const EXCERPT_LENGTH = 180;

const tagsToColumn = (tags) => (tags.length ? `,${tags.join(',')},` : '');
const columnToTags = (column) => (column ? column.split(',').filter(Boolean) : []);

// Prévia em texto puro: remove blocos de código e marcações de Markdown.
function excerpt(content) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, EXCERPT_LENGTH);
}

// Normaliza as tags aqui também: o serviço pode ser chamado diretamente (integrações, importação).
function toDb(data) {
  const { tags, ...rest } = data;
  return tags === undefined ? rest : { ...rest, tags: tagsToColumn(normalizeTags(tags)) };
}

function serializeEntry(entry) {
  return { ...entry, tags: columnToTags(entry.tags) };
}

async function findOrFail(id) {
  const entry = await prisma.libraryEntry.findUnique({ where: { id }, select: { id: true } });
  if (!entry) throw new AppError('Entrada não encontrada', 404);
  return entry;
}

// ---------- Entradas ----------

export async function listEntries({ search, kind, tag } = {}) {
  const and = [];
  if (kind) and.push({ kind });
  if (tag) and.push({ tags: { contains: `,${tag},` } });
  if (search) {
    and.push({
      OR: [
        { title: { contains: search } },
        { summary: { contains: search } },
        { content: { contains: search } },
        { tags: { contains: search.toLowerCase() } },
        { sourceCode: { contains: search } },
        { sourceLabel: { contains: search } },
      ],
    });
  }

  const entries = await prisma.libraryEntry.findMany({
    where: { AND: and },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    include: { _count: { select: { attachments: true } } },
  });

  // A lista não carrega conteúdo nem código inteiros, só a prévia.
  return entries.map(({ content, sourceCode, _count, ...entry }) => ({
    ...serializeEntry(entry),
    excerpt: entry.summary || excerpt(content) || (entry.sourceLabel ? `GitHub · ${entry.sourceLabel}` : ''),
    attachmentsCount: _count.attachments,
  }));
}

// Tags em uso, com contagem, das mais usadas para as menos.
export async function listTags() {
  const rows = await prisma.libraryEntry.findMany({ select: { tags: true } });
  const counts = new Map();
  for (const row of rows) for (const tag of columnToTags(row.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function getEntry(id) {
  const entry = await prisma.libraryEntry.findUnique({
    where: { id },
    include: { attachments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!entry) throw new AppError('Entrada não encontrada', 404);
  return serializeEntry(entry);
}

export async function createEntry(data) {
  const entry = await prisma.libraryEntry.create({ data: toDb({ tags: [], ...data }) });
  return getEntry(entry.id);
}

export async function updateEntry(id, data) {
  await findOrFail(id);
  await prisma.libraryEntry.update({ where: { id }, data: toDb(data) });
  return getEntry(id);
}

export async function deleteEntry(id) {
  const entry = await prisma.libraryEntry.findUnique({
    where: { id },
    include: { attachments: { select: { storedName: true } } },
  });
  if (!entry) throw new AppError('Entrada não encontrada', 404);
  await prisma.libraryEntry.delete({ where: { id } });
  await removeLibraryFiles(entry.attachments.map((a) => a.storedName));
}

// ---------- GitHub ----------

/**
 * Cria uma entrada a partir de um arquivo do GitHub (ou Gist).
 * O código fica em `sourceCode`, separado das anotações. Importar o mesmo arquivo de novo
 * não duplica: devolve a entrada existente (`existing: true`).
 */
export async function importFromGithub(url) {
  const file = await fetchGithubFile(url);

  const existing = await prisma.libraryEntry.findUnique({
    where: { sourceUrl: file.canonicalUrl },
    select: { id: true },
  });
  if (existing) return { entry: await getEntry(existing.id), existing: true };

  const created = await prisma.libraryEntry.create({
    data: {
      title: file.fileName,
      kind: file.isTest ? 'TEST' : 'SNIPPET',
      tags: tagsToColumn(normalizeTags(['github', file.repo])),
      content: '',
      sourceUrl: file.canonicalUrl,
      sourceLabel: file.label,
      sourceLanguage: file.language || null,
      sourceCode: file.code,
      sourceSyncedAt: new Date(),
    },
  });
  return { entry: await getEntry(created.id), existing: false };
}

// Busca a versão atual no GitHub e substitui apenas o código (as anotações ficam intactas).
export async function syncFromGithub(id) {
  const entry = await prisma.libraryEntry.findUnique({
    where: { id },
    select: { id: true, sourceUrl: true, sourceCode: true },
  });
  if (!entry) throw new AppError('Entrada não encontrada', 404);
  if (!entry.sourceUrl) throw new AppError('Esta entrada não está vinculada ao GitHub');

  const file = await fetchGithubFile(entry.sourceUrl);
  const changed = file.code !== entry.sourceCode;

  await prisma.libraryEntry.update({
    where: { id },
    data: {
      sourceSyncedAt: new Date(),
      ...(changed && { sourceCode: file.code, sourceLanguage: file.language || null, sourceLabel: file.label }),
    },
  });
  return { entry: await getEntry(id), changed };
}

// ---------- Anexos ----------

/**
 * Registra arquivos já gravados em disco pelo upload.
 * Se a entrada não existir, os arquivos recém-gravados são removidos (sem lixo em disco).
 */
export async function addAttachments(entryId, files) {
  if (!files?.length) throw new AppError('Nenhum arquivo enviado');
  try {
    await findOrFail(entryId);
  } catch (err) {
    await removeLibraryFiles(files.map((f) => f.storedName));
    throw err;
  }

  await prisma.attachment.createMany({
    data: files.map((f) => ({
      entryId,
      originalName: f.originalName.slice(0, 255),
      storedName: f.storedName,
      mimeType: f.mimeType || 'application/octet-stream',
      size: f.size,
    })),
  });
  await prisma.libraryEntry.update({ where: { id: entryId }, data: { updatedAt: new Date() } });
  return getEntry(entryId);
}

export async function getAttachment(entryId, attachmentId) {
  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, entryId } });
  if (!attachment) throw new AppError('Anexo não encontrado', 404);
  return { ...attachment, path: libraryFilePath(attachment.storedName) };
}

export async function removeAttachment(entryId, attachmentId) {
  const attachment = await getAttachment(entryId, attachmentId);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await removeLibraryFiles([attachment.storedName]);
  return getEntry(entryId);
}
