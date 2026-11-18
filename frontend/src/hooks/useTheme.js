import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'grimorium-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export const THEME_OPTIONS = ['light', 'dark', 'system'];

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function resolve(preference) {
  if (preference === 'system') return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  return preference;
}

function apply(preference) {
  document.documentElement.setAttribute('data-theme', resolve(preference));
}

/** Preferência de tema: "light", "dark" ou "system". */
export function useTheme() {
  const [preference, setPreference] = useState(readPreference);

  // Aplica a escolha e acompanha o sistema no modo "sistema".
  useEffect(() => {
    apply(preference);
    if (preference !== 'system') return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  // Sincroniza abas abertas.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setPreference(readPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const choose = useCallback((next) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    setPreference(next);
  }, []);

  return { preference, setPreference: choose };
}
