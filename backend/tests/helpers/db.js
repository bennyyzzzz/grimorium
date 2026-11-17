// Prepara o banco de teste isolado (test.db): remove o arquivo e aplica as migrações.
// Os arquivos de teste rodam em sequência (--test-concurrency=1) porque compartilham este banco.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

assert.equal(process.env.DATABASE_URL, 'file:./test.db', 'Os testes devem rodar no banco de teste');

const testDb = fileURLToPath(new URL('../../prisma/test.db', import.meta.url));
rmSync(testDb, { force: true });
rmSync(`${testDb}-journal`, { force: true });
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });

export const { prisma } = await import('../../src/lib/prisma.js');

export async function clearDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.activity.deleteMany();
}
