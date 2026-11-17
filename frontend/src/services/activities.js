import { api } from './api.js';

function queryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

export const activityService = {
  list: (filters) => api.get(`/activities${queryString(filters)}`),
  categories: () => api.get('/activities/categories'),
  get: (id) => api.get(`/activities/${id}`),
  create: (data) => api.post('/activities', data),
  createContact: (data) => api.post('/activities/contacts', data),
  update: (id, data) => api.put(`/activities/${id}`, data),
  remove: (id) => api.delete(`/activities/${id}`),
  changeStatus: (id, body) => api.patch(`/activities/${id}/status`, body),
  addLog: (id, data) => api.post(`/activities/${id}/logs`, data),
  removeLog: (id, logId) => api.delete(`/activities/${id}/logs/${logId}`),
};
