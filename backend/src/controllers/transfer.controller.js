import {
  EXPORT_FORMATS,
  exportActivities,
  importActivities,
  previewExport,
} from '../services/transfer.service.js';
import { parseExportQuery } from '../validators/activity.validator.js';
import { AppError } from '../utils/AppError.js';

// GET /api/transfer/export?format=json|csv|csv-logs&from&to&ids&[filtros da lista]
export async function exportFile(req, res) {
  const format = req.query.format || 'json';
  if (!EXPORT_FORMATS.includes(format)) throw new AppError('Formato inválido (use json, csv ou csv-logs)');

  const { filename, contentType, body } = await exportActivities(parseExportQuery(req.query), format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

// GET /api/transfer/export/preview?from&to&ids&[filtros] — contagem antes de baixar
export async function preview(req, res) {
  res.json(await previewExport(parseExportQuery(req.query)));
}

// POST /api/transfer/import (corpo: JSON exportado pelo Grimorium)
export async function importFile(req, res) {
  res.json(await importActivities(req.body));
}
