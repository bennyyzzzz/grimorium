// Biblioteca: entradas em Markdown, tags, busca e anexos (upload/download via HTTP).
import { test, beforeEach, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { prisma, clearDatabase } from './helpers/db.js';

assert.equal(process.env.STORAGE_DIR, 'storage-test', 'Os testes devem usar a pasta de arquivos de teste');

const library = await import('../src/services/library.service.js');
const { LIBRARY_DIR, STORAGE_ROOT } = await import('../src/utils/storage.js');
const { createApp } = await import('../src/app.js');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}/api/library`;
});

beforeEach(async () => {
  await clearDatabase();
  for (const file of readdirSync(LIBRARY_DIR)) rmSync(`${LIBRARY_DIR}/${file}`);
});

after(async () => {
  server.close();
  await prisma.$disconnect();
  rmSync(STORAGE_ROOT, { recursive: true, force: true });
});

async function upload(entryId, files) {
  const form = new FormData();
  for (const { name, content, type } of files) form.append('files', new Blob([content], { type }), name);
  return fetch(`${baseUrl}/${entryId}/attachments`, { method: 'POST', body: form });
}

test('cria entrada com tags normalizadas e gera prévia sem marcação de Markdown', async () => {
  const entry = await library.createEntry({
    title: 'Deploy do backend',
    kind: 'HOWTO',
    content: '## Passo a passo\n1. Rodar **build**\n```bash\nnpm run build\n```\nPronto.',
    tags: ['Deploy', ' backend ', 'deploy', 'Node JS'],
  });

  assert.deepEqual(entry.tags, ['deploy', 'backend', 'node-js']);
  const [listed] = await library.listEntries();
  assert.equal(listed.excerpt, 'Passo a passo 1. Rodar build Pronto.');
  assert.equal(listed.content, undefined); // a lista não carrega o conteúdo inteiro
});

test('busca por título, conteúdo e tag; filtra por tipo e tag exata', async () => {
  await library.createEntry({ title: 'Teste de login', kind: 'TEST', content: 'cy.visit("/login")', tags: ['cypress', 'e2e'] });
  await library.createEntry({ title: 'Configurar VPN', kind: 'HOWTO', content: 'Abrir o cliente', tags: ['rede'] });
  await library.createEntry({ title: 'Teste de carrinho', kind: 'TEST', tags: ['cypress-api'] });

  const titles = async (filters) => (await library.listEntries(filters)).map((e) => e.title).sort();

  assert.deepEqual(await titles({ search: 'cy.visit' }), ['Teste de login']);
  assert.deepEqual(await titles({ search: 'vpn' }), ['Configurar VPN']);
  assert.deepEqual(await titles({ kind: 'TEST' }), ['Teste de carrinho', 'Teste de login']);
  assert.deepEqual(await titles({ tag: 'cypress' }), ['Teste de login']); // tag exata, não "cypress-api"
  assert.deepEqual(await library.listTags(), [
    { tag: 'cypress', count: 1 },
    { tag: 'cypress-api', count: 1 },
    { tag: 'e2e', count: 1 },
    { tag: 'rede', count: 1 },
  ]);
});

test('entradas fixadas aparecem primeiro', async () => {
  await library.createEntry({ title: 'Comum' });
  await library.createEntry({ title: 'Fixada', pinned: true });
  await library.createEntry({ title: 'Mais recente' });
  assert.equal((await library.listEntries())[0].title, 'Fixada');
});

test('upload via HTTP: grava em disco, preserva nome com acento e baixa como anexo', async () => {
  const entry = await library.createEntry({ title: 'Teste automatizado' });
  const res = await upload(entry.id, [
    { name: 'relatório-teste.spec.js', content: 'describe("x", () => {})', type: 'text/javascript' },
    { name: 'print.png', content: 'fakepng', type: 'image/png' },
  ]);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.attachments.length, 2);
  assert.equal(body.attachments[0].originalName, 'relatório-teste.spec.js');
  assert.equal(readdirSync(LIBRARY_DIR).length, 2);

  const [js, png] = body.attachments;
  const download = await fetch(`${baseUrl}/${entry.id}/attachments/${js.id}`);
  assert.equal(await download.text(), 'describe("x", () => {})');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);

  // Imagem raster pode abrir inline; JS pedido inline continua como download.
  const inlinePng = await fetch(`${baseUrl}/${entry.id}/attachments/${png.id}?inline=1`);
  assert.match(inlinePng.headers.get('content-disposition'), /^inline/);
  const inlineJs = await fetch(`${baseUrl}/${entry.id}/attachments/${js.id}?inline=1`);
  assert.match(inlineJs.headers.get('content-disposition'), /^attachment;/);
});

test('upload para entrada inexistente não deixa arquivos órfãos em disco', async () => {
  const res = await upload(99999, [{ name: 'a.txt', content: 'x', type: 'text/plain' }]);
  assert.equal(res.status, 404);
  assert.equal(readdirSync(LIBRARY_DIR).length, 0);
});

test('excluir anexo ou entrada remove os arquivos do disco', async () => {
  const entry = await library.createEntry({ title: 'Com anexos' });
  const body = await (await upload(entry.id, [
    { name: 'a.txt', content: 'a', type: 'text/plain' },
    { name: 'b.txt', content: 'b', type: 'text/plain' },
  ])).json();

  const [first] = body.attachments;
  await library.removeAttachment(entry.id, first.id);
  assert.equal(existsSync(`${LIBRARY_DIR}/${first.storedName}`), false);
  assert.equal(readdirSync(LIBRARY_DIR).length, 1);

  await library.deleteEntry(entry.id);
  assert.equal(readdirSync(LIBRARY_DIR).length, 0);
  assert.equal(await prisma.attachment.count(), 0);
});

test('validação: título obrigatório e tipo válido', async () => {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '  ', kind: 'HOWTO' }),
  });
  assert.equal(res.status, 400);

  const bad = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'x', kind: 'MAGIA' }),
  });
  assert.equal(bad.status, 400);
});
