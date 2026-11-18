import { api } from './api.js';

// params: { from?, to?, ids?: number[], ...filtros da lista }
function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(','));
    } else if (value) {
      query.set(key, value);
    }
  }
  return query;
}

export const transferService = {
  // URL de download (o backend responde com Content-Disposition: attachment).
  exportUrl(format, params) {
    const query = toQuery(params);
    query.set('format', format);
    return `/api/transfer/export?${query}`;
  },
  preview: (params) => api.get(`/transfer/export/preview?${toQuery(params)}`),
  importBackup: (data) => api.post('/transfer/import', data),
  // Backup .zip (com Biblioteca e anexos) vai como multipart.
  async importZip(file) {
    const form = new FormData();
    form.append('file', file);
    let response;
    try {
      response = await fetch('/api/transfer/import-zip', { method: 'POST', body: form });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Falha ao importar o backup');
    return data;
  },
};
