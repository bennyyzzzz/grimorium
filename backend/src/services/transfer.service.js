import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { prisma } from '../lib/prisma.js';
import { exportLibrary, importLibrary, previewLibrary, ATTACHMENT_ZIP_PATH } from './libraryBackup.service.js';
import { AppError } from '../utils/AppError.js';
import { toCsv } from '../utils/csv.js';
import { isDateKey, toDateKey } from '../utils/date.js';
import { buildActivityWhere, canonicalCategory } from './activity.service.js';
import {
  STATUSES,
  TYPES,
  parseActivityInput,
  parseLogInput,
} from '../validators/activity.validator.js';

/**
 * Exportação e importação (backup geral).
 *
 * - backup (.zip): grimorium-backup.json (atividades + registros + Biblioteca) + pasta attachments/ com os anexos.
 * - json: só atividades e registros (formato antigo; continua importável).
 * - CSV "atividades": uma linha por demanda/contato, para planilhas.
 * - CSV "registros": uma linha por execução, para análises de produtividade.
 *
 * A importação é idempotente: itens cujo `uid` (ou origem externa) já existe são ignorados.
 */

export const EXPORT_FORMATS = ['backup', 'json', 'csv', 'csv-logs'];
const FORMAT_VERSION = 2; // 2 = pode conter "library"
const BACKUP_JSON_NAME = 'grimorium-backup.json';
const MAX_BACKUP_JSON_BYTES = 100 * 1024 * 1024;
const MAX_BACKUP_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // proteção contra "zip bomb"
const MAX_IMPORT_ACTIVITIES = 5000;
const MAX_LOGS_PER_ACTIVITY = 5000;

const LABELS = {
  type: { TASK: 'Demanda', CONTACT: 'Contato' },
  importance: { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' },
  status: { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída', CANCELED: 'Cancelada' },
  channel: { CHAT: 'Chat', WHATSAPP: 'WhatsApp', CALL: 'Ligação', EMAIL: 'E-mail', MEETING: 'Reunião', OTHER: 'Outro' },
};

const dateOnly = (value) => (value ? toDateKey(new Date(value)) : '');

// ---------- Exportação ----------

// Atividades com execução OU criação no período; seleção manual por ids; filtros da lista.
function buildExportWhere({ filters = {}, period = null, ids = null } = {}) {
  const and = [buildActivityWhere(filters)];
  if (ids) and.push({ id: { in: ids } });
  if (period) {
    and.push({
      OR: [
        { logs: { some: { executionDate: { gte: period.from, lte: period.to } } } },
        { createdAt: { gte: new Date(`${period.from}T00:00:00`), lte: new Date(`${period.to}T23:59:59.999`) } },
      ],
    });
  }
  return { AND: and };
}

const logInPeriod = (period) => (log) =>
  !period || (log.executionDate >= period.from && log.executionDate <= period.to);

function fileSuffix({ period, ids }) {
  if (ids) return `selecao-${toDateKey()}`;
  if (period) return period.from === period.to ? period.from : `${period.from}_a_${period.to}`;
  return toDateKey();
}

// Prévia: quantas atividades e registros sairão no arquivo (CSV de registros conta só os do período).
export async function previewExport(options = {}) {
  const where = buildExportWhere(options);
  const { period } = options;
  const [activities, logs, logsInPeriod] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activityLog.count({ where: { activity: { is: where } } }),
    period
      ? prisma.activityLog.count({
          where: { activity: { is: where }, executionDate: { gte: period.from, lte: period.to } },
        })
      : null,
  ]);
  const library = options.includeLibrary ? await previewLibrary() : null;
  return { activities, logs, logsInPeriod: logsInPeriod ?? logs, library };
}

function toJsonDocument(activities, { filters, period, ids }) {
  return {
    app: 'grimorium',
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scope: { filters, period, selectedIds: ids?.length ?? null },
    count: activities.length,
    activities: activities.map((a) => ({
      uid: a.uid,
      type: a.type,
      title: a.title,
      description: a.description,
      category: a.category,
      importance: a.importance,
      status: a.status,
      channel: a.channel,
      contactName: a.contactName,
      dueDate: a.dueDate,
      createdAt: a.createdAt.toISOString(),
      startedAt: a.startedAt?.toISOString() ?? null,
      completedAt: a.completedAt?.toISOString() ?? null,
      source: a.source,
      externalId: a.externalId,
      logs: a.logs.map((l) => ({
        executionDate: l.executionDate,
        description: l.description,
        timeSpent: l.timeSpent,
        createdAt: l.createdAt.toISOString(),
      })),
    })),
  };
}

const ACTIVITY_COLUMNS = [
  { header: 'ID', value: (a) => a.id },
  { header: 'Tipo', value: (a) => LABELS.type[a.type] },
  { header: 'Título', value: (a) => a.title },
  { header: 'Descrição', value: (a) => a.description },
  { header: 'Categoria', value: (a) => a.category },
  { header: 'Prioridade', value: (a) => LABELS.importance[a.importance] },
  { header: 'Status', value: (a) => LABELS.status[a.status] },
  { header: 'Canal', value: (a) => LABELS.channel[a.channel] },
  { header: 'Com quem', value: (a) => a.contactName },
  { header: 'Criada em', value: (a) => dateOnly(a.createdAt) },
  { header: 'Início', value: (a) => dateOnly(a.startedAt) },
  { header: 'Prazo', value: (a) => a.dueDate },
  { header: 'Conclusão', value: (a) => dateOnly(a.completedAt) },
  { header: 'Registros de execução', value: (a) => a.logs.length },
  { header: 'Dias com execução', value: (a) => new Set(a.logs.map((l) => l.executionDate)).size },
  { header: 'Tempo total (min)', value: (a) => a.logs.reduce((sum, l) => sum + (l.timeSpent || 0), 0) || '' },
  { header: 'Último registro', value: (a) => a.logs.at(-1)?.executionDate },
];

// Com período, as colunas de totais refletem só os registros do período (e o cabeçalho diz isso).
const PERIOD_TOTAL_HEADERS = {
  'Registros de execução': 'Registros no período',
  'Dias com execução': 'Dias com execução no período',
  'Tempo total (min)': 'Tempo no período (min)',
  'Último registro': 'Último registro no período',
};

const activityColumns = (period) =>
  period ? ACTIVITY_COLUMNS.map((c) => ({ ...c, header: PERIOD_TOTAL_HEADERS[c.header] ?? c.header })) : ACTIVITY_COLUMNS;

const LOG_COLUMNS = [
  { header: 'Data da execução', value: (r) => r.log.executionDate },
  { header: 'ID da atividade', value: (r) => r.activity.id },
  { header: 'Tipo', value: (r) => LABELS.type[r.activity.type] },
  { header: 'Título', value: (r) => r.activity.title },
  { header: 'Categoria', value: (r) => r.activity.category },
  { header: 'Prioridade', value: (r) => LABELS.importance[r.activity.importance] },
  { header: 'Status atual', value: (r) => LABELS.status[r.activity.status] },
  { header: 'Canal', value: (r) => LABELS.channel[r.activity.channel] },
  { header: 'Com quem', value: (r) => r.activity.contactName },
  { header: 'O que foi feito', value: (r) => r.log.description },
  { header: 'Tempo (min)', value: (r) => r.log.timeSpent },
];

/**
 * @param {{ filters?: object, period?: {from, to} | null, ids?: number[] | null }} options
 * O JSON leva o histórico COMPLETO de cada atividade incluída (backup íntegro: reimportar não perde registros);
 * os CSVs consideram apenas os registros dentro do período.
 */
export async function exportActivities(options = {}, format = 'json') {
  const { period = null } = options;
  const activities = await prisma.activity.findMany({
    where: buildExportWhere(options),
    include: { logs: { orderBy: [{ executionDate: 'asc' }, { createdAt: 'asc' }] } },
    orderBy: { id: 'asc' },
  });
  const suffix = fileSuffix(options);
  const inPeriod = logInPeriod(period);

  if (format === 'csv') {
    const rows = activities.map((a) => ({ ...a, logs: a.logs.filter(inPeriod) }));
    return {
      filename: `grimorium-atividades-${suffix}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: toCsv(activityColumns(period), rows),
    };
  }

  if (format === 'csv-logs') {
    const rows = activities
      .flatMap((activity) => activity.logs.filter(inPeriod).map((log) => ({ activity, log })))
      .sort((a, b) => a.log.executionDate.localeCompare(b.log.executionDate) || a.log.createdAt - b.log.createdAt);
    return {
      filename: `grimorium-registros-${suffix}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: toCsv(LOG_COLUMNS, rows),
    };
  }

  const document = toJsonDocument(activities, options);

  if (format === 'backup') {
    const zip = new AdmZip();
    let missingFiles = [];
    if (options.includeLibrary) {
      const library = await exportLibrary();
      document.library = library.entries;
      missingFiles = library.missingFiles;
      for (const file of library.files) {
        const folder = file.zipPath.slice(0, file.zipPath.lastIndexOf('/'));
        zip.addLocalFile(file.diskPath, folder, file.zipPath.slice(folder.length + 1));
      }
    }
    document.missingFiles = missingFiles; // anexos registrados cujo arquivo não existia mais em disco
    zip.addFile(BACKUP_JSON_NAME, Buffer.from(JSON.stringify(document, null, 2), 'utf8'));
    zip.addFile(
      'LEIA-ME.txt',
      Buffer.from(
        'Backup do Grimorium.\r\nPara restaurar: Demandas > Exportar / Importar > Importar backup, escolhendo este .zip.\r\n',
        'utf8',
      ),
    );
    return { filename: `grimorium-backup-${suffix}.zip`, contentType: 'application/zip', body: zip.toBuffer() };
  }

  return {
    filename: `grimorium-backup-${suffix}.json`,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(document, null, 2),
  };
}

/**
 * Abre um backup .zip com verificações de segurança:
 * tamanho total descompactado limitado, JSON obrigatório na raiz e anexos apenas em attachments/<uid>/<arquivo>.
 * @returns {{ payload: object, readAttachment: (zipPath: string) => Buffer | null }}
 */
export function openBackupZip(filePath) {
  let zip;
  try {
    zip = new AdmZip(filePath);
  } catch {
    throw new AppError('Arquivo .zip inválido ou corrompido');
  }

  const entries = zip.getEntries();
  const totalBytes = entries.reduce((sum, e) => sum + (e.header.size || 0), 0);
  if (totalBytes > MAX_BACKUP_TOTAL_BYTES) throw new AppError('Backup grande demais para importar');

  const jsonEntry = zip.getEntry(BACKUP_JSON_NAME);
  if (!jsonEntry) throw new AppError('Este .zip não é um backup do Grimorium (falta o grimorium-backup.json)');
  if (jsonEntry.header.size > MAX_BACKUP_JSON_BYTES) throw new AppError('Backup grande demais para importar');

  let payload;
  try {
    payload = JSON.parse(jsonEntry.getData().toString('utf8'));
  } catch {
    throw new AppError('O grimorium-backup.json dentro do .zip está corrompido');
  }

  const readAttachment = (zipPath) => {
    if (!ATTACHMENT_ZIP_PATH.test(zipPath)) return null;
    const entry = zip.getEntry(zipPath);
    return entry && !entry.isDirectory ? entry.getData() : null;
  };

  return { payload, readAttachment };
}

/**
 * Importa um backup (do .zip ou de um .json): atividades e, se houver, a Biblioteca.
 * @returns {{ activities: object, library: object }}
 */
export async function importBackup(payload, readAttachment = null) {
  const activities = await importActivities(payload);
  const library = await importLibrary(payload.library, readAttachment);
  return { activities, library };
}

// ---------- Importação ----------

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} inválida`);
  return date;
}

function optionalString(value, field, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new AppError(`${field} inválido`);
  return value;
}

// Valida e converte um item do JSON exportado. Lança AppError com a mensagem do problema.
function parseImportItem(item) {
  if (!item || typeof item !== 'object') throw new AppError('Item não é um objeto');

  const type = item.type ?? 'TASK';
  if (!TYPES.includes(type)) throw new AppError('Tipo inválido');
  const status = item.status ?? 'PENDING';
  if (!STATUSES.includes(status)) throw new AppError('Status inválido');

  const base = parseActivityInput({
    title: item.title,
    description: item.description ?? null,
    category: item.category ?? null,
    importance: item.importance ?? 'MEDIUM',
    dueDate: item.dueDate ?? null,
    ...(type === 'CONTACT' && { channel: item.channel ?? 'OTHER', contactName: item.contactName ?? null }),
  });

  const uid = item.uid ?? randomUUID();
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(uid)) throw new AppError('uid inválido');

  const rawLogs = item.logs ?? [];
  if (!Array.isArray(rawLogs)) throw new AppError('"logs" deve ser uma lista');
  if (rawLogs.length > MAX_LOGS_PER_ACTIVITY) throw new AppError('Registros de execução demais');

  const logs = rawLogs.map((log, i) => {
    if (!log || !isDateKey(log.executionDate)) throw new AppError(`Registro ${i + 1}: data de execução inválida`);
    const parsed = parseLogInput({ ...log, description: log.description || 'Registro importado' });
    return { ...parsed, createdAt: optionalDate(log.createdAt, `Registro ${i + 1}: data de criação`) ?? undefined };
  });

  return {
    uid,
    source: optionalString(item.source, 'Origem', 60) ?? 'manual',
    externalId: optionalString(item.externalId, 'ID externo', 200),
    activity: {
      ...base,
      type,
      status,
      createdAt: optionalDate(item.createdAt, 'Data de criação') ?? undefined,
      startedAt: optionalDate(item.startedAt, 'Data de início'),
      completedAt: optionalDate(item.completedAt, 'Data de conclusão'),
    },
    logs,
  };
}

export async function importActivities(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.activities)) {
    throw new AppError('Arquivo inválido: use um JSON exportado pelo Grimorium (com a lista "activities")');
  }
  if (payload.app !== undefined && payload.app !== 'grimorium') {
    throw new AppError('Este arquivo não foi gerado pelo Grimorium');
  }
  if (typeof payload.version === 'number' && payload.version > FORMAT_VERSION) {
    throw new AppError('Arquivo gerado por uma versão mais nova do Grimorium');
  }
  if (payload.activities.length > MAX_IMPORT_ACTIVITIES) {
    throw new AppError(`Máximo de ${MAX_IMPORT_ACTIVITIES} atividades por importação`);
  }

  const result = { total: payload.activities.length, created: 0, skipped: 0, errors: [] };

  for (const [index, item] of payload.activities.entries()) {
    let data;
    try {
      data = parseImportItem(item);
    } catch (err) {
      result.errors.push({ index, title: typeof item?.title === 'string' ? item.title : null, message: err.message });
      continue;
    }

    const duplicate = await prisma.activity.findFirst({
      where: {
        OR: [
          { uid: data.uid },
          ...(data.externalId ? [{ source: data.source, externalId: data.externalId }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      result.skipped += 1;
      continue;
    }

    await prisma.activity.create({
      data: {
        ...data.activity,
        category: await canonicalCategory(data.activity.category),
        uid: data.uid,
        source: data.source,
        externalId: data.externalId,
        logs: { create: data.logs },
      },
    });
    result.created += 1;
  }

  return result;
}
