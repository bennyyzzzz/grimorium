// Geração de CSV compatível com Excel em português:
// separador ";", BOM UTF-8 (acentos corretos) e quebra de linha CRLF.

const SEPARATOR = ';';
const BOM = '﻿';

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Evita injeção de fórmulas ao abrir em planilhas (=, +, -, @, tab, CR no início).
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * @param {{ header: string, value: (row) => any }[]} columns
 * @param {object[]} rows
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => escapeCell(c.header)).join(SEPARATOR)];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(c.value(row))).join(SEPARATOR));
  return BOM + lines.join('\r\n') + '\r\n';
}
