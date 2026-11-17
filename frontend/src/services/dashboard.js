import { api } from './api.js';

export const dashboardService = {
  get: ({ from, to }) => api.get(`/dashboard?from=${from}&to=${to}`),
};
