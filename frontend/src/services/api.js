// Cliente HTTP central. Todas as chamadas ao backend passam por aqui.
const BASE_URL = '/api';

const OFFLINE_MESSAGE = 'Não foi possível conectar ao servidor. Verifique se o backend está em execução.';

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    const error = new Error(OFFLINE_MESSAGE);
    error.status = 0;
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Sem corpo JSON em erro 5xx/502: o proxy não alcançou o backend.
    const fallback = response.status >= 500 ? OFFLINE_MESSAGE : `Erro ${response.status}`;
    const error = new Error(data?.error || fallback);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export const healthService = {
  check: () => api.get('/health'),
};
