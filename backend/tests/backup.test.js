// Backup geral (.zip): atividades + Biblioteca + anexos, exportação e restauração via HTTP.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { prisma, clearDatabase } from './helpers/db.js';

const activities = await import('../src/services/activity.service.js');
const library = await import('../src/services/library.service.js');
const { LIBRARY_DIR, STORAGE_ROOT, TMP_DIR } = await import('../src/utils/storage.js');
const { createApp } = await import('../src/app.js');

let server;
let api;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  api = `http://localhost:${server.address().port}/api`;
});

const clearFiles = () => {
  for (const dir of [LIBRARY_DIR, TMP_DIR]) for (const f of readdirSync(dir)) rmSync(path.join(dir, f), { force: true });
};

beforeEach(async () => {
  await clearDatabase();
  clearFiles();
});

after(async () => {
  server.close();
  await prisma.$disconnect();
  rmSync(STORAGE_ROOT, { recursive: true, force: true });
});

async function uploadAttachment(entryId, name, content, type = 'text/plain') {
  const form = new FormData();
  form.append('files', new Blob([content], { type }), name);
  const res = await fetch(`${api}/library/${entryId}/attachments`, { method: 'POST', body: form });
  assert.equal(res.status, 201);
}

async function seed() {
  const task = await activities.createActivity({ title: 'Fechar mês', category: 'Financeiro' });
  await activities.addLog(task.id, { description: 'conciliação', executionDate: '2026-01-05' });

  const entry = await library.createEntry({
    title: 'Teste de login',
    kind: 'TEST',
    content: '## Como executar\n`npx cypress run`',
    tags: ['cypress'],
    pinned: true,
  });
  await uploadAttachment(entry.id, 'relatório.txt', 'conteúdo do anexo ✓');
  await uploadAttachment(entry.id, 'print.png', Buffer.from([137, 80, 78, 71]), 'image/png');
  await library.createEntry({ title: 'Anotação sem anexo', kind: 'NOTE', content: 'texto' });
}

async function downloadBackup(query = 'library=1') {
  const res = await fetch(`${api}/transfer/export?format=backup&${query}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/zip');
  return Buffer.from(await res.arrayBuffer());
}

async function importZip(buffer, name = 'backup.zip') {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/zip' }), name);
  const res = await fetch(`${api}/transfer/import-zip`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() };
}

test('backup .zip contém o JSON, a Biblioteca e os arquivos dos anexos', async () => {
  await seed();
  const zip = new AdmZip(await downloadBackup());
  const names = zip.getEntries().map((e) => e.entryName);

  assert.ok(names.includes('grimorium-backup.json'));
  assert.ok(names.includes('LEIA-ME.txt'));
  assert.equal(names.filter((n) => n.startsWith('attachments/')).length, 2);

  const doc = JSON.parse(zip.getEntry('grimorium-backup.json').getData().toString('utf8'));
  assert.equal(doc.version, 2);
  assert.equal(doc.activities.length, 1);
  assert.equal(doc.library.length, 2);
  assert.deepEqual(doc.missingFiles, []);
});

test('restaura tudo em um Grimorium vazio, inclusive o conteúdo dos anexos', async () => {
  await seed();
  const backup = await downloadBackup();

  await clearDatabase(); // simula outro computador
  clearFiles();

  const { status, body } = await importZip(backup);
  assert.equal(status, 200);
  assert.deepEqual(body.activities, { total: 1, created: 1, skipped: 0, errors: [] });
  assert.deepEqual(body.library, { total: 2, created: 2, skipped: 0, attachments: 2, errors: [] });

  const [restored] = await library.listEntries({ search: 'login' });
  assert.equal(restored.pinned, true);
  assert.deepEqual(restored.tags, ['cypress']);
  const full = await library.getEntry(restored.id);
  const txt = full.attachments.find((a) => a.originalName === 'relatório.txt');
  assert.equal(readFileSync(path.join(LIBRARY_DIR, txt.storedName), 'utf8'), 'conteúdo do anexo ✓');

  const [task] = await activities.listActivities();
  assert.equal(task.title, 'Fechar mês');
  assert.equal(task.logsCount, 1);
  assert.equal(readdirSync(TMP_DIR).length, 0); // o .zip temporário foi apagado
});

test('importar o mesmo backup de novo não duplica nada nem grava arquivos extras', async () => {
  await seed();
  const backup = await downloadBackup();
  const filesBefore = readdirSync(LIBRARY_DIR).length;

  const { body } = await importZip(backup);
  assert.equal(body.activities.skipped, 1);
  assert.equal(body.library.skipped, 2);
  assert.equal(body.library.attachments, 0);
  assert.equal(readdirSync(LIBRARY_DIR).length, filesBefore);
});

test('sem "library=1" o backup leva só as atividades', async () => {
  await seed();
  const zip = new AdmZip(await downloadBackup(''));
  const doc = JSON.parse(zip.getEntry('grimorium-backup.json').getData().toString('utf8'));
  assert.equal(doc.library, undefined);
  assert.equal(zip.getEntries().filter((e) => e.entryName.startsWith('attachments/')).length, 0);
});

test('prévia informa entradas, anexos e tamanho da Biblioteca', async () => {
  await seed();
  const res = await fetch(`${api}/transfer/export/preview?library=1`);
  const preview = await res.json();
  assert.equal(preview.library.entries, 2);
  assert.equal(preview.library.attachments, 2);
  assert.ok(preview.library.bytes > 0);
});

test('backup .json antigo (só atividades) continua importável', async () => {
  const res = await fetch(`${api}/transfer/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: 'grimorium', version: 1, activities: [{ title: 'Do backup antigo' }] }),
  });
  const body = await res.json();
  assert.equal(body.activities.created, 1);
  assert.equal(body.library.total, 0);
});

test('segurança: caminhos maliciosos no backup não gravam arquivos fora da pasta', async () => {
  const zip = new AdmZip();
  zip.addFile(
    'grimorium-backup.json',
    Buffer.from(
      JSON.stringify({
        app: 'grimorium',
        version: 2,
        activities: [],
        library: [
          {
            title: 'Entrada maliciosa',
            attachments: [{ originalName: 'x.txt', file: '../../evil.txt' }],
          },
        ],
      }),
    ),
  );
  zip.addFile('evil.txt', Buffer.from('mal'));

  const { status, body } = await importZip(zip.toBuffer());
  assert.equal(status, 200);
  assert.equal(body.library.created, 1); // a entrada entra…
  assert.equal(body.library.attachments, 0); // …mas o anexo é recusado
  assert.match(body.library.errors[0].message, /caminho do arquivo inválido/);
  assert.equal(existsSync(path.resolve(LIBRARY_DIR, '../../evil.txt')), false);
  assert.equal(readdirSync(LIBRARY_DIR).length, 0);
});

test('rejeita .zip que não é backup do Grimorium e arquivo corrompido', async () => {
  const notBackup = new AdmZip();
  notBackup.addFile('foto.jpg', Buffer.from('x'));
  const a = await importZip(notBackup.toBuffer());
  assert.equal(a.status, 400);
  assert.match(a.body.error, /não é um backup do Grimorium/);

  const b = await importZip(Buffer.from('isto não é um zip'));
  assert.equal(b.status, 400);
  assert.equal(readdirSync(TMP_DIR).length, 0);
});
