import { AppError } from '../utils/AppError.js';

/**
 * Leitura de arquivos do GitHub para a Biblioteca.
 *
 * Segurança: o link do usuário só é ANALISADO; a requisição é sempre montada para api.github.com
 * (nunca buscamos o host informado), então não há como usar a importação para acessar outros endereços.
 * GITHUB_TOKEN (opcional, no .env) permite repositórios privados e aumenta o limite de requisições.
 */

const API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;
const MAX_CODE_LENGTH = 500_000;

const LANGUAGE_BY_EXTENSION = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
  ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', java: 'java', kt: 'kotlin', swift: 'swift', rs: 'rust',
  cs: 'csharp', php: 'php', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell',
  sql: 'sql', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', md: 'markdown', feature: 'gherkin', dockerfile: 'dockerfile',
};

const TEST_PATH = /(^|[/._-])(tests?|specs?|e2e|cy|__tests__|cypress|playwright)([/._-]|$)/i;

export const githubTokenConfigured = () => Boolean(process.env.GITHUB_TOKEN);

export function languageFromPath(filePath) {
  const name = filePath.split('/').pop().toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  return LANGUAGE_BY_EXTENSION[name.split('.').pop()] ?? '';
}

export const looksLikeTest = (filePath) => TEST_PATH.test(filePath);

/**
 * Interpreta links de arquivo do GitHub:
 * - https://github.com/{dono}/{repo}/blob/{ref}/{caminho}
 * - https://raw.githubusercontent.com/{dono}/{repo}/{ref}/{caminho}
 * - https://gist.github.com/{usuario}/{id}[#file-nome-do-arquivo]
 * (Branches com "/" no nome não são suportadas pelo formato de link: use o link "Permalink" com o hash do commit.)
 */
export function parseGithubUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    throw new AppError('Link inválido. Cole o endereço completo do arquivo no GitHub.');
  }
  if (url.protocol !== 'https:') throw new AppError('Use um link https do GitHub.');

  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (url.hostname === 'github.com') {
    const [owner, repo, mode, ref, ...path] = parts;
    if (mode !== 'blob' || !ref || !path.length) {
      throw new AppError('Use o link de um arquivo (…/blob/branch/caminho/arquivo), não de uma pasta ou repositório.');
    }
    return { type: 'file', owner, repo, ref, path: path.join('/') };
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    const [owner, repo, ref, ...path] = parts;
    if (!ref || !path.length) throw new AppError('Link raw incompleto.');
    return { type: 'file', owner, repo, ref, path: path.join('/') };
  }

  if (url.hostname === 'gist.github.com') {
    const id = parts.at(-1);
    if (!id || !/^[0-9a-f]+$/i.test(id)) throw new AppError('Link de Gist inválido.');
    // O fragmento "#file-login-cy-js" identifica o arquivo dentro do Gist.
    const fileAnchor = url.hash.startsWith('#file-') ? url.hash.slice(6) : null;
    return { type: 'gist', id, fileAnchor };
  }

  throw new AppError('Só são aceitos links do github.com, raw.githubusercontent.com ou gist.github.com.');
}

async function githubFetch(path, accept) {
  const headers = {
    Accept: accept,
    'User-Agent': 'grimorium',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let response;
  try {
    response = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new AppError('Não foi possível conectar ao GitHub. Verifique a internet e tente novamente.', 502);
  }

  if (response.ok) return response;

  if (response.status === 404) {
    throw new AppError(
      githubTokenConfigured()
        ? 'Arquivo não encontrado no GitHub (ou o token não tem acesso a este repositório).'
        : 'Arquivo não encontrado no GitHub. Se o repositório for privado, configure GITHUB_TOKEN no backend/.env.',
      404,
    );
  }
  if (response.status === 401) throw new AppError('GITHUB_TOKEN inválido ou expirado.', 502);
  if (response.status === 403 || response.status === 429) {
    const rateLimited = response.headers.get('x-ratelimit-remaining') === '0';
    throw new AppError(
      rateLimited
        ? 'Limite de requisições do GitHub atingido. Tente mais tarde ou configure GITHUB_TOKEN.'
        : 'O GitHub negou acesso a este arquivo.',
      502,
    );
  }
  throw new AppError(`O GitHub respondeu com erro ${response.status}.`, 502);
}

function ensureSize(code) {
  if (code.length > MAX_CODE_LENGTH) throw new AppError('Arquivo grande demais para importar (limite de 500 mil caracteres).');
  return code;
}

/**
 * Busca o conteúdo do arquivo.
 * @returns {{ code, fileName, language, label, canonicalUrl, isTest, repo }}
 */
export async function fetchGithubFile(input) {
  const ref = parseGithubUrl(input);

  if (ref.type === 'file') {
    const encodedPath = ref.path.split('/').map(encodeURIComponent).join('/');
    const response = await githubFetch(
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref.ref)}`,
      'application/vnd.github.raw+json',
    );
    const code = ensureSize(await response.text());
    const fileName = ref.path.split('/').pop();
    return {
      code,
      fileName,
      language: languageFromPath(ref.path),
      label: `${ref.owner}/${ref.repo} · ${ref.path} @ ${ref.ref}`,
      canonicalUrl: `https://github.com/${ref.owner}/${ref.repo}/blob/${ref.ref}/${ref.path}`,
      isTest: looksLikeTest(ref.path),
      repo: ref.repo,
    };
  }

  // Gist
  const response = await githubFetch(`/gists/${ref.id}`, 'application/vnd.github+json');
  const gist = await response.json();
  const files = Object.values(gist.files ?? {});
  if (!files.length) throw new AppError('Este Gist não tem arquivos.');

  const anchorOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const file = (ref.fileAnchor && files.find((f) => anchorOf(f.filename) === ref.fileAnchor)) || files[0];
  if (file.truncated) throw new AppError('Arquivo do Gist grande demais para importar.');

  return {
    code: ensureSize(file.content ?? ''),
    fileName: file.filename,
    language: languageFromPath(file.filename),
    label: `Gist de ${gist.owner?.login ?? 'anônimo'} · ${file.filename}`,
    canonicalUrl: `https://gist.github.com/${gist.owner?.login ? `${gist.owner.login}/` : ''}${ref.id}${
      files.length > 1 ? `#file-${anchorOf(file.filename)}` : ''
    }`,
    isTest: looksLikeTest(file.filename),
    repo: 'gist',
  };
}
