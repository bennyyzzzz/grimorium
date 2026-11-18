import * as library from '../services/library.service.js';
import { parseId } from '../validators/activity.validator.js';
import { parseEntryInput, parseLibraryFilters } from '../validators/library.validator.js';
import { decodeOriginalName } from '../middlewares/upload.js';
import { removeLibraryFiles } from '../utils/storage.js';
import { githubTokenConfigured } from '../services/github.service.js';

// Só imagens raster comuns podem abrir no navegador; todo o resto (inclusive SVG/HTML) é sempre download.
const INLINE_SAFE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export async function list(req, res) {
  res.json(await library.listEntries(parseLibraryFilters(req.query)));
}

export async function tags(req, res) {
  res.json(await library.listTags());
}

export async function show(req, res) {
  res.json(await library.getEntry(parseId(req.params.id)));
}

export async function create(req, res) {
  res.status(201).json(await library.createEntry(parseEntryInput(req.body)));
}

export async function update(req, res) {
  res.json(await library.updateEntry(parseId(req.params.id), parseEntryInput(req.body, { partial: true })));
}

export async function remove(req, res) {
  await library.deleteEntry(parseId(req.params.id));
  res.status(204).end();
}

// ---------- GitHub ----------

export async function githubStatus(req, res) {
  res.json({ tokenConfigured: githubTokenConfigured() });
}

// POST /api/library/import-github { url }
export async function importGithub(req, res) {
  const { entry, existing } = await library.importFromGithub(req.body?.url);
  res.status(existing ? 200 : 201).json({ entry, existing });
}

// POST /api/library/:id/sync-github
export async function syncGithub(req, res) {
  res.json(await library.syncFromGithub(parseId(req.params.id)));
}

// ---------- Anexos ----------

export async function uploadAttachments(req, res) {
  const files = (req.files ?? []).map((f) => ({
    originalName: decodeOriginalName(f.originalname),
    storedName: f.filename,
    mimeType: f.mimetype,
    size: f.size,
  }));

  let entryId;
  try {
    entryId = parseId(req.params.id);
  } catch (err) {
    await removeLibraryFiles(files.map((f) => f.storedName));
    throw err;
  }
  res.status(201).json(await library.addAttachments(entryId, files));
}

export async function downloadAttachment(req, res) {
  const attachment = await library.getAttachment(parseId(req.params.id), parseId(req.params.attachmentId));
  const inline = req.query.inline === '1' && INLINE_SAFE_TYPES.has(attachment.mimeType);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (inline) {
    res.type(attachment.mimeType);
    res.sendFile(attachment.path, { headers: { 'Content-Disposition': 'inline' } });
  } else {
    res.download(attachment.path, attachment.originalName);
  }
}

export async function removeAttachment(req, res) {
  res.json(await library.removeAttachment(parseId(req.params.id), parseId(req.params.attachmentId)));
}
