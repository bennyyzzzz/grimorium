export const ENTRY_KIND = {
  HOWTO: { label: 'Passo a passo' },
  TEST: { label: 'Testes / Teste automatizado' },
  SNIPPET: { label: 'Código / Programação' },
  NOTE: { label: 'Anotação' },
};

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

// Modelo inicial de cada tipo: dá estrutura sem obrigar a seguir.
export const ENTRY_TEMPLATES = {
  HOWTO: `## Objetivo

## Pré-requisitos
-

## Passo a passo
1.
2.
3.

## Observações
`,
  TEST: `## O que este teste valida

## Como executar
\`\`\`bash

\`\`\`

## Código
\`\`\`js

\`\`\`

## Resultado esperado
`,
  SNIPPET: `## Para que serve

## Código
\`\`\`js

\`\`\`

## Como usar
`,
  NOTE: '',
};

// Bloco de código Markdown seguro: a cerca tem mais crases do que qualquer sequência dentro do código.
export function codeFence(code, language = '') {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
