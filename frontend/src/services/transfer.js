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
};
