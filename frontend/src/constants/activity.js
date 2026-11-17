export const IMPORTANCE = {
  HIGH: { label: 'Alta', tone: 'danger' },
  MEDIUM: { label: 'Média', tone: 'warning' },
  LOW: { label: 'Baixa', tone: 'neutral' },
};

export const STATUS = {
  PENDING: { label: 'Pendente', tone: 'neutral' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'accent' },
  COMPLETED: { label: 'Concluída', tone: 'success' },
  CANCELED: { label: 'Cancelada', tone: 'muted' },
};

export const ACTIVITY_TYPE = {
  TASK: { label: 'Demanda' },
  CONTACT: { label: 'Contato' },
};

export const CHANNEL = {
  CHAT: { label: 'Chat' },
  WHATSAPP: { label: 'WhatsApp' },
  CALL: { label: 'Ligação' },
  EMAIL: { label: 'E-mail' },
  MEETING: { label: 'Reunião' },
  OTHER: { label: 'Outro' },
};

export const DUE_FILTERS = [
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'today', label: 'Vencem hoje' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'none', label: 'Sem prazo' },
];

export const toOptions = (map) => Object.entries(map).map(([value, { label }]) => ({ value, label }));
