import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { libraryFilePath, removeLibraryFiles } from '../utils/storage.js';
import { parseEntryInput } from '../validators/library.validator.js';

/**
 * Biblioteca dentro do backup geral.
 * - Exportação: entradas (com código do GitHub) + lista de anexos a incluir no .zip.
 * - Importação: idempotente (uid ou sourceUrl já existentes são ignorados); anexos recebem novos nomes em disco.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 5000;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Caminho do anexo dentro do .zip: attachments/<uid da entrada>/<nome em disco>
export const ATTACHMENT_ZIP_PATH = /^attachments\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,80}$/;

const columnToTags = (column) => (column ? column.split(',').filter(Boolean) : []);
const iso = (date) => date?.toISOString() ?? null;

// ---------- Exportação ----------

/** @returns {{ entries: object[], files: { zipPath, diskPath }[], missingFiles: string[] }} */
export async function exportLibrary() {
  const rows = await prisma.libraryEntry.findMany({
    include: { attachments: { orderBy: { createdAt: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  const files = [];
  const missingFiles = [];

  const entries = rows.map((entry) => ({
    uid: entry.uid,
    title: entry.title,
    kind: entry.kind,
    summary: entry.summary,
    content: entry.content,
    tags: columnToTags(entry.tags),
    pinned: entry.pinned,
    createdAt: iso(entry.createdAt),
    sourceUrl: entry.sourceUrl,
    sourceLabel: entry.sourceLabel,
    sourceLanguage: entry.sourceLanguage,
    sourceCode: entry.sourceCode,
    sourceSyncedAt: iso(entry.sourceSyncedAt),
    attachments: entry.attachments.map((a) => {
      const zipPath = `attachments/${entry.uid}/${a.storedName}`;
      const diskPath = libraryFilePath(a.storedName);
      if (existsSync(diskPath)) files.push({ zipPath, diskPath });
      else missingFiles.push(`${entry.title} → ${a.originalName}`);
      return { originalName: a.originalName, mimeType: a.mimeType, size: a.size, createdAt: iso(a.createdAt), file: zipPath };
    }),
  }));

  return { entries, files, missingFiles };
}

export async function previewLibrary() {
  const [entries, attachments, bytes] = await Promise.all([
    prisma.libraryEntry.count(),
    prisma.attachment.count(),
    prisma.attachment.aggregate({ _sum: { size: true } }),
  ]);
  return { entries, attachments, bytes: bytes._sum.size ?? 0 };
}

// ---------- Importação ----------

function optionalText(value, field, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new AppError(`${field} inválido`);
  return value;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} inválida`);
  return date;
}

function parseLibraryItem(item) {
  if (!item || typeof item !== 'object') throw new AppError('Item não é um objeto');

  const base = parseEntryInput({
    title: item.title,
    kind: item.kind ?? 'NOTE',
    summary: item.summary ?? null,
    content: item.content ?? '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    pinned: item.pinned === true,
  });

  const uid = item.uid ?? randomUUID();
  if (typeof uid !== 'string' || !UID_PATTERN.test(uid)) throw new AppError('uid inválido');

  const attachments = item.attachments ?? [];
  if (!Array.isArray(attachments)) throw new AppError('"attachments" deve ser uma lista');

  return {
    uid,
    data: {
      ...base,
      tags: base.tags.length ? `,${base.tags.join(',')},` : '',
      createdAt: optionalDate(item.createdAt, 'Data de criação') ?? undefined,
      sourceUrl: optionalText(item.sourceUrl, 'Link do GitHub', 1000),
      sourceLabel: optionalText(item.sourceLabel, 'Origem do GitHub', 500),
      sourceLanguage: optionalText(item.sourceLanguage, 'Linguagem', 40),
      sourceCode: optionalText(item.sourceCode, 'Código importado', 500_000),
      sourceSyncedAt: optionalDate(item.sourceSyncedAt, 'Data de sincronização'),
    },
    attachments,
  };
}

const safeExtension = (name) =>
  path.extname(String(name ?? '')).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);

/**
 * @param {object[]} items  entradas do backup
 * @param {(zipPath: string) => Buffer | null} [readAttachment]  lê o anexo do .zip (ausente em backups .json)
 */
export async function importLibrary(items, readAttachment = null) {
  const result = { total: 0, created: 0, skipped: 0, attachments: 0, errors: [] };
  if (items === undefined || items === null) return result;
  if (!Array.isArray(items)) throw new AppError('Arquivo inválido: "library" deve ser uma lista');
  if (items.length > MAX_IMPORT_ENTRIES) throw new AppError(`Máximo de ${MAX_IMPORT_ENTRIES} entradas da Biblioteca por importação`);
  result.total = items.length;

  for (const [index, item] of items.entries()) {
    const title = typeof item?.title === 'string' ? item.title : null;
    let parsed;
    try {
      parsed = parseLibraryItem(item);
    } catch (err) {
      result.errors.push({ index, title, message: err.message });
      continue;
    }

    const duplicate = await prisma.libraryEntry.findFirst({
      where: { OR: [{ uid: parsed.uid }, ...(parsed.data.sourceUrl ? [{ sourceUrl: parsed.data.sourceUrl }] : [])] },
      select: { id: true },
    });
    if (duplicate) {
      result.skipped += 1;
      continue;
    }

    const entry = await prisma.libraryEntry.create({ data: { ...parsed.data, uid: parsed.uid } });
    result.created += 1;

    for (const attachment of parsed.attachments) {
      const name = typeof attachment?.originalName === 'string' ? attachment.originalName.slice(0, 255) : 'anexo';
      try {
        if (!readAttachment) throw new AppError('backup em .json não contém os arquivos (use o .zip)');
        if (typeof attachment?.file !== 'string' || !ATTACHMENT_ZIP_PATH.test(attachment.file)) {
          throw new AppError('caminho do arquivo inválido no backup');
        }
        const buffer = readAttachment(attachment.file);
        if (!buffer) throw new AppError('arquivo ausente no backup');
        if (buffer.length > MAX_ATTACHMENT_BYTES) throw new AppError('arquivo maior que 25 MB');

        const storedName = `${randomUUID()}${safeExtension(name)}`;
        await writeFile(libraryFilePath(storedName), buffer);
        try {
          await prisma.attachment.create({
            data: {
              entryId: entry.id,
              originalName: name,
              storedName,
              mimeType: optionalText(attachment.mimeType, 'Tipo do arquivo', 120) ?? 'application/octet-stream',
              size: buffer.length,
              createdAt: optionalDate(attachment.createdAt, 'Data do anexo') ?? undefined,
            },
          });
        } catch (err) {
          await removeLibraryFiles([storedName]);
          throw err;
        }
        result.attachments += 1;
      } catch (err) {
        result.errors.push({ index, title, message: `Anexo “${name}”: ${err.message}` });
      }
    }
  }

  return result;
}
