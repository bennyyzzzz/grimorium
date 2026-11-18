import { api } from './api.js';

const BASE = '/library';

function queryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v);
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

// Upload usa FormData (multipart): não passa pelo api.request, que envia JSON.
async function uploadAttachments(id, files) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const response = await fetch(`/api${BASE}/${id}/attachments`, { method: 'POST', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Falha ao enviar anexos');
  return data;
}

export const libraryService = {
  list: (filters) => api.get(`${BASE}${queryString(filters)}`),
  tags: () => api.get(`${BASE}/tags`),
  get: (id) => api.get(`${BASE}/${id}`),
  create: (data) => api.post(BASE, data),
  update: (id, data) => api.put(`${BASE}/${id}`, data),
  remove: (id) => api.delete(`${BASE}/${id}`),
  uploadAttachments,
  githubStatus: () => api.get(`${BASE}/github/status`),
  importGithub: (url) => api.post(`${BASE}/import-github`, { url }),
  syncGithub: (id) => api.post(`${BASE}/${id}/sync-github`),
  removeAttachment: (id, attachmentId) => api.delete(`${BASE}/${id}/attachments/${attachmentId}`),
  attachmentUrl: (id, attachmentId, { inline = false } = {}) =>
    `/api${BASE}/${id}/attachments/${attachmentId}${inline ? '?inline=1' : ''}`,
};
