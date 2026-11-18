import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { LIBRARY_DIR } from '../utils/storage.js';

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_FILES_PER_UPLOAD = 10;

// Navegadores enviam o nome em UTF-8, mas o parser o lê como latin1: corrige acentos ("relatório.pdf").
export function decodeOriginalName(name) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

// Em disco, o arquivo recebe um nome aleatório: o nome original nunca vira caminho no servidor.
const storage = multer.diskStorage({
  destination: LIBRARY_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(decodeOriginalName(file.originalname)).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadAttachments = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_UPLOAD },
}).array('files', MAX_FILES_PER_UPLOAD);
