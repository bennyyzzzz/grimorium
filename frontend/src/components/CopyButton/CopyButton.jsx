import { useEffect, useState } from 'react';

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Alternativa para contextos sem a Clipboard API (ex.: http fora de localhost).
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

// Botão de copiar com retorno visual ("Copiado") por 2 segundos.
export default function CopyButton({ getText, label = 'Copiar', copiedLabel = 'Copiado', className = 'btn btn-sm' }) {
  const [state, setState] = useState('idle'); // idle | copied | error

  useEffect(() => {
    if (state === 'idle') return undefined;
    const id = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(id);
  }, [state]);

  async function handleClick() {
    try {
      await writeClipboard(getText());
      setState('copied');
    } catch {
      setState('error');
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick} aria-live="polite">
      {state === 'copied' ? `✓ ${copiedLabel}` : state === 'error' ? 'Falha ao copiar' : label}
    </button>
  );
}
