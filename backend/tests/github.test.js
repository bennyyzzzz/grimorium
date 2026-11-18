// Importação de código do GitHub para a Biblioteca. A API do GitHub é simulada (sem internet).
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, clearDatabase } from './helpers/db.js';

const { parseGithubUrl, languageFromPath, looksLikeTest } = await import('../src/services/github.service.js');
const library = await import('../src/services/library.service.js');

// ---------- API do GitHub simulada ----------
const remote = new Map(); // caminho da API -> { status, body, headers }
const requested = [];
const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== 'api.github.com') return realFetch(input, init);
  requested.push({ url: url.toString(), auth: init?.headers?.Authorization ?? null });
  const hit = remote.get(url.pathname + url.search);
  if (!hit) return new Response('Not Found', { status: 404 });
  const body = typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body);
  return new Response(body, { status: hit.status ?? 200, headers: hit.headers ?? {} });
};

const FILE_URL = 'https://github.com/empresa/app/blob/main/cypress/e2e/login.cy.js';
const FILE_API = '/repos/empresa/app/contents/cypress/e2e/login.cy.js?ref=main';

beforeEach(async () => {
  await clearDatabase();
  remote.clear();
  requested.length = 0;
  delete process.env.GITHUB_TOKEN;
});

after(async () => {
  globalThis.fetch = realFetch;
  await prisma.$disconnect();
});

test('interpreta links de arquivo, raw e Gist', () => {
  assert.deepEqual(parseGithubUrl(FILE_URL), {
    type: 'file', owner: 'empresa', repo: 'app', ref: 'main', path: 'cypress/e2e/login.cy.js',
  });
  assert.deepEqual(parseGithubUrl('https://raw.githubusercontent.com/empresa/app/abc123/src/util.ts'), {
    type: 'file', owner: 'empresa', repo: 'app', ref: 'abc123', path: 'src/util.ts',
  });
  assert.deepEqual(parseGithubUrl('https://gist.github.com/ana/4f2a9c#file-deploy-sh'), {
    type: 'gist', id: '4f2a9c', fileAnchor: 'deploy-sh',
  });
});

test('recusa links de outros sites, de pastas e não https (sem buscar nada)', () => {
  assert.throws(() => parseGithubUrl('https://evil.com/empresa/app/blob/main/a.js'), /Só são aceitos/);
  assert.throws(() => parseGithubUrl('http://github.com/empresa/app/blob/main/a.js'), /https/);
  assert.throws(() => parseGithubUrl('https://github.com/empresa/app/tree/main/src'), /link de um arquivo/);
  assert.throws(() => parseGithubUrl('não é link'), /Link inválido/);
});

test('detecta linguagem e se o arquivo é de teste', () => {
  assert.equal(languageFromPath('cypress/e2e/login.cy.js'), 'javascript');
  assert.equal(languageFromPath('Dockerfile'), 'dockerfile');
  assert.equal(languageFromPath('features/login.feature'), 'gherkin');
  assert.equal(looksLikeTest('cypress/e2e/login.cy.js'), true);
  assert.equal(looksLikeTest('src/__tests__/util.ts'), true);
  assert.equal(looksLikeTest('src/services/payment.js'), false);
});

test('importa arquivo: cria entrada de teste com código separado das anotações', async () => {
  remote.set(FILE_API, { body: 'describe("login", () => {});' });
  const { entry, existing } = await library.importFromGithub(FILE_URL);

  assert.equal(existing, false);
  assert.equal(entry.title, 'login.cy.js');
  assert.equal(entry.kind, 'TEST');
  assert.equal(entry.sourceLanguage, 'javascript');
  assert.equal(entry.sourceCode, 'describe("login", () => {});');
  assert.equal(entry.sourceLabel, 'empresa/app · cypress/e2e/login.cy.js @ main');
  assert.equal(entry.content, '');
  assert.deepEqual(entry.tags, ['github', 'app']);
  assert.equal(requested[0].auth, null); // sem token configurado, nada é enviado
});

test('importar o mesmo arquivo de novo devolve a entrada existente', async () => {
  remote.set(FILE_API, { body: 'x' });
  const first = await library.importFromGithub(FILE_URL);
  const again = await library.importFromGithub(`${FILE_URL}?plain=1`);

  assert.equal(again.existing, true);
  assert.equal(again.entry.id, first.entry.id);
  assert.equal(await prisma.libraryEntry.count(), 1);
});

test('atualizar do GitHub troca só o código e preserva as anotações', async () => {
  remote.set(FILE_API, { body: 'versão 1' });
  const { entry } = await library.importFromGithub(FILE_URL);
  await library.updateEntry(entry.id, { content: '## Como executar\nnpx cypress run' });

  remote.set(FILE_API, { body: 'versão 2' });
  const synced = await library.syncFromGithub(entry.id);
  assert.equal(synced.changed, true);
  assert.equal(synced.entry.sourceCode, 'versão 2');
  assert.equal(synced.entry.content, '## Como executar\nnpx cypress run');

  const unchanged = await library.syncFromGithub(entry.id);
  assert.equal(unchanged.changed, false);
});

test('importa arquivo específico de um Gist com vários arquivos', async () => {
  remote.set('/gists/4f2a9c', {
    body: {
      owner: { login: 'ana' },
      files: {
        'README.md': { filename: 'README.md', content: '# leia-me' },
        'deploy.sh': { filename: 'deploy.sh', content: 'npm run build' },
      },
    },
  });
  const { entry } = await library.importFromGithub('https://gist.github.com/ana/4f2a9c#file-deploy-sh');
  assert.equal(entry.title, 'deploy.sh');
  assert.equal(entry.sourceLanguage, 'bash');
  assert.equal(entry.sourceCode, 'npm run build');
  assert.equal(entry.kind, 'SNIPPET');
});

test('erros do GitHub viram mensagens claras; o token é enviado quando configurado', async () => {
  await assert.rejects(library.importFromGithub(FILE_URL), /repositório for privado, configure GITHUB_TOKEN/);

  process.env.GITHUB_TOKEN = 'ghp_teste';
  remote.set(FILE_API, { status: 403, body: '{}', headers: { 'x-ratelimit-remaining': '0' } });
  await assert.rejects(library.importFromGithub(FILE_URL), /Limite de requisições/);
  assert.equal(requested.at(-1).auth, 'Bearer ghp_teste');
  assert.equal(await prisma.libraryEntry.count(), 0);
});

test('busca encontra entradas pelo código importado', async () => {
  remote.set(FILE_API, { body: 'cy.intercept("POST", "/api/sessao")' });
  await library.importFromGithub(FILE_URL);
  const found = await library.listEntries({ search: 'cy.intercept' });
  assert.equal(found.length, 1);
  assert.equal(found[0].sourceCode, undefined); // a lista não carrega o código inteiro
});
