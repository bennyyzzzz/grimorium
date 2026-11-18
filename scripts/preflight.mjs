#!/usr/bin/env node
/**
 * Preparação do Grimorium antes de iniciar — funciona no Windows, Linux, WSL e macOS.
 * Roda sozinho em `npm start`, `npm run dev` e `npm run setup` (só usa módulos nativos do Node).
 *
 * 1. Verifica a versão do Node.js (Vite 7 exige 20.19+ ou 22.12+).
 * 2. Cria backend/.env a partir do .env.example, se não existir.
 * 3. Instala as dependências (raiz, backend, frontend) quando:
 *    - ainda não foram instaladas;
 *    - foram instaladas em outro sistema (ex.: WSL × Windows na mesma pasta);
 *    - o package-lock.json mudou (ex.: depois de um `git pull` com dependências novas).
 *    Usa `npm ci`: instala exatamente o lockfile, sem reescrevê-lo.
 * 4. Gera o Prisma Client se o schema mudou e aplica migrações pendentes (nunca apaga dados).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROJECTS = [
  { dir: '.', label: 'raiz' },
  { dir: 'backend', label: 'backend' },
  { dir: 'frontend', label: 'frontend' },
];
const PLATFORM = `${process.platform}-${process.arch}`;
const STATE_FILE = '.grimorium-install.json'; // guardado dentro de cada node_modules

const info = (msg) => console.log(`• ${msg}`);

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(command, args, cwd, { quiet = false, shell = process.platform === 'win32' } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: quiet ? 'pipe' : 'inherit',
    shell, // npm é um .cmd no Windows
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (quiet) process.stderr.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    fail(`Falha ao executar "${command} ${args.join(' ')}" em ${cwd === ROOT ? 'raiz' : path.relative(ROOT, cwd)}.`);
  }
}

const hashFile = (file) => (existsSync(file) ? createHash('sha1').update(readFileSync(file)).digest('hex') : null);

function readState(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// ---------- 1. Node.js ----------
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
if (!nodeOk) {
  fail(
    `Node.js ${process.versions.node} não é suportado.\n` +
      '  O Grimorium precisa do Node.js 20.19+ ou 22.12+ (recomendado: versão LTS mais recente).\n' +
      '  • Windows: baixe em https://nodejs.org\n' +
      '  • Linux/WSL/macOS com nvm: nvm install --lts && nvm use --lts\n' +
      '  Depois, abra um terminal novo e rode o Grimorium de novo.',
  );
}

// ---------- 2. backend/.env ----------
const envFile = path.join(ROOT, 'backend', '.env');
if (!existsSync(envFile)) {
  copyFileSync(path.join(ROOT, 'backend', '.env.example'), envFile);
  info('backend/.env criado a partir do .env.example');
}

// ---------- 3. Dependências ----------

/**
 * Instalações feitas antes deste script não têm o arquivo de estado. Em vez de reinstalar tudo,
 * confere as peças que dependem do sistema operacional; se forem deste sistema, aproveita a instalação.
 */
function legacyInstallMatchesPlatform(dir, nodeModules) {
  if (dir === 'frontend') {
    // O Vite usa o Rollup, que instala um binário próprio de cada sistema (@rollup/rollup-<sistema>-<arquitetura>…)
    const rollupDir = path.join(nodeModules, '@rollup');
    return existsSync(rollupDir) && readdirSync(rollupDir).some((name) => name.startsWith(`rollup-${process.platform}-${process.arch}`));
  }
  if (dir === 'backend') {
    const clientDir = path.join(nodeModules, '.prisma', 'client');
    if (!existsSync(clientDir)) return false;
    const engines = readdirSync(clientDir).filter((name) => name.includes('query_engine'));
    const marker = { win32: 'windows', linux: '.so.node', darwin: 'darwin' }[process.platform];
    return engines.some((name) => name.includes(marker));
  }
  return true; // raiz: só dependências em JavaScript puro
}

// Porta do backend: a do backend/.env (PORT=…), ou 3333.
function backendPort() {
  const match = readFileSync(envFile, 'utf8').match(/^\s*PORT\s*=\s*"?(\d+)"?/m);
  return match ? Number(match[1]) : 3333;
}

async function grimoriumIsRunning() {
  try {
    const res = await fetch(`http://localhost:${backendPort()}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status === 503;
  } catch {
    return false;
  }
}

const pending = [];
for (const { dir, label } of PROJECTS) {
  const cwd = path.join(ROOT, dir);
  const nodeModules = path.join(cwd, 'node_modules');
  const stateFile = path.join(nodeModules, STATE_FILE);
  const lockHash = hashFile(path.join(cwd, 'package-lock.json'));
  const saveState = () =>
    writeFileSync(stateFile, JSON.stringify({ platform: PLATFORM, lockHash, installedAt: new Date().toISOString() }, null, 2));

  let reason = null;
  if (!existsSync(nodeModules)) {
    reason = 'instalando pela primeira vez';
  } else {
    const state = readState(stateFile);
    if (!state) {
      if (legacyInstallMatchesPlatform(dir, nodeModules)) saveState(); // instalação existente e compatível
      else reason = `instaladas em outro sistema ou incompletas, reinstalando para ${PLATFORM}`;
    } else if (state.platform !== PLATFORM) {
      reason = `instaladas em outro sistema (${state.platform}), reinstalando para ${PLATFORM}`;
    } else if (state.lockHash !== lockHash) {
      reason = 'dependências mudaram (package-lock.json atualizado)';
    }
  }
  if (reason) pending.push({ cwd, label, reason, saveState });
}

if (pending.length && (await grimoriumIsRunning())) {
  fail(
    'As dependências precisam ser (re)instaladas, mas o Grimorium está em execução.\n' +
      '  Feche o Grimorium (janela do terminal ou npm run dev) e inicie de novo.',
  );
}

for (const { cwd, label, reason, saveState } of pending) {
  info(`Dependências (${label}): ${reason}…`);
  run('npm', ['ci', '--no-audit', '--no-fund'], cwd);
  saveState();
}

// ---------- 4. Banco de dados ----------
const backend = path.join(ROOT, 'backend');
const schemaHash = hashFile(path.join(backend, 'prisma', 'schema.prisma'));
// CLI do Prisma chamada direto pelo Node (bem mais rápido que npx, principalmente no Windows).
const prisma = (...args) =>
  run(process.execPath, [path.join(backend, 'node_modules', 'prisma', 'build', 'index.js'), ...args], backend, {
    quiet: true,
    shell: false,
  });
const prismaStateFile = path.join(backend, 'node_modules', '.grimorium-prisma.json');
if (readState(prismaStateFile)?.schemaHash !== schemaHash) {
  if (!pending.length && (await grimoriumIsRunning())) {
    fail(
      'O acesso ao banco de dados precisa ser preparado (primeira execução desta versão ou estrutura nova),\n' +
        '  mas o Grimorium está em execução. Feche o Grimorium e inicie de novo.',
    );
  }
  info('Gerando o Prisma Client…');
  prisma('generate');
  writeFileSync(prismaStateFile, JSON.stringify({ schemaHash }, null, 2));
}
prisma('migrate', 'deploy');

info('Grimorium pronto.');
