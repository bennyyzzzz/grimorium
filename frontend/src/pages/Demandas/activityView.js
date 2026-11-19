import { CHANNEL } from '../../constants/activity.js';

// Linha secundária: para contatos, "Contato · WhatsApp · Maria · Categoria"; para demandas, a categoria.
export function activitySubtitle(a) {
  const parts =
    a.type === 'CONTACT' ? ['Contato', CHANNEL[a.channel]?.label, a.contactName, a.category] : [a.category];
  return parts.filter(Boolean).join(' · ');
}

// Ação rápida exibida na lista e no quadro.
export const QUICK_ACTION = {
  PENDING: { status: 'IN_PROGRESS', label: 'Iniciar' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Concluir' },
};

// Período da lista (valor '' = tudo), lembrado no navegador.
const PERIOD_KEY = 'grimorium-demandas-period';
export const LIST_PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '', label: 'Tudo' },
];

export function readPeriod() {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    return LIST_PERIODS.some((p) => p.value && p.value === saved) ? saved : '';
  } catch {
    return '';
  }
}

export function savePeriod(period) {
  try {
    if (period) localStorage.setItem(PERIOD_KEY, period);
    else localStorage.removeItem(PERIOD_KEY);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

// Visualização da página de Demandas, lembrada no navegador.
const VIEW_KEY = 'grimorium-demandas-view';
export const VIEWS = [
  { value: 'list', label: 'Lista' },
  { value: 'board', label: 'Quadro' },
];

export function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

export function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}
