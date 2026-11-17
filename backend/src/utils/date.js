// Datas de referência (dia de trabalho, prazo) são tratadas como "YYYY-MM-DD"
// no fuso local do servidor. Ferramenta pessoal: servidor e usuário estão no mesmo fuso.

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

// Converte um dia de referência em timestamp: agora, se for hoje; meio-dia daquele dia, se for retroativo.
export function dateKeyToDate(key) {
  return key === toDateKey() ? new Date() : new Date(`${key}T12:00:00`);
}

export function addDays(key, days) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
