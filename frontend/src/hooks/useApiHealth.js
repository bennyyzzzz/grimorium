import { useEffect, useState } from 'react';
import { healthService } from '../services/api.js';

// Retorna 'checking' | 'ok' | 'degraded' | 'offline'
export function useApiHealth(intervalMs = 30000) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const data = await healthService.check();
        if (active) setStatus(data.status);
      } catch (error) {
        if (active) setStatus(error.status === 503 ? 'degraded' : 'offline');
      }
    }

    check();
    const id = setInterval(check, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return status;
}
