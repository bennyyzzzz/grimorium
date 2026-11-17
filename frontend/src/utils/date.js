const pad = (n) => String(n).padStart(2, '0');

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysKey(key, days) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-11-17" -> "17/11"
export function formatShortDateKey(key) {
  if (!key) return '—';
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

// "2026-11-17" -> "ter, 17/11"
export function formatWeekdayDateKey(key) {
  const weekday = new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${weekday}, ${formatShortDateKey(key)}`;
}

// "2026-11-17" -> "17/11/2026"
export function formatDateKey(key) {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

export function formatMinutes(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}
