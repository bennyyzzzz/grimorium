import { rm } from 'node:fs/promises';
import {
  EXPORT_FORMATS,
  exportActivities,
  importBackup,
  openBackupZip,
  previewExport,
} from '../services/transfer.service.js';
import { parseExportQuery } from '../validators/activity.validator.js';
import { AppError } from '../utils/AppError.js';

// GET /api/transfer/export?format=backup|json|csv|csv-logs&library=1&from&to&ids&[filtros da lista]
export async function exportFile(req, res) {
  const format = req.query.format || 'backup';
  if (!EXPORT_FORMATS.includes(format)) throw new AppError('Formato inválido (use backup, json, csv ou csv-logs)');

  const { filename, contentType, body } = await exportActivities(parseExportQuery(req.query), format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

// GET /api/transfer/export/preview?library=1&from&to&ids&[filtros] — contagem antes de baixar
export async function preview(req, res) {
  res.json(await previewExport(parseExportQuery(req.query)));
}

// POST /api/transfer/import (corpo: JSON exportado pelo Grimorium — formato antigo ou sem anexos)
export async function importFile(req, res) {
  res.json(await importBackup(req.body));
}

// POST /api/transfer/import-zip (multipart, campo "file": backup .zip com Biblioteca e anexos)
export async function importZip(req, res) {
  if (!req.file) throw new AppError('Envie o arquivo .zip do backup');
  try {
    const { payload, readAttachment } = openBackupZip(req.file.path);
    res.json(await importBackup(payload, readAttachment));
  } finally {
    await rm(req.file.path, { force: true });
  }
}
