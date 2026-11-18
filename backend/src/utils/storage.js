import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do backend (independe do diretório de onde o processo foi iniciado).
const BACKEND_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Arquivos enviados ficam fora do banco, em disco. STORAGE_DIR permite isolar (ex.: testes).
export const STORAGE_ROOT = path.resolve(BACKEND_ROOT, process.env.STORAGE_DIR || 'storage');
export const LIBRARY_DIR = path.join(STORAGE_ROOT, 'library');

mkdirSync(LIBRARY_DIR, { recursive: true });

export const libraryFilePath = (storedName) => path.join(LIBRARY_DIR, path.basename(storedName));

export async function removeLibraryFiles(storedNames) {
  await Promise.all(storedNames.map((name) => rm(libraryFilePath(name), { force: true })));
}
