import { useCallback, useState } from 'react';
import { ConfirmContext } from './ConfirmContext.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Substitui o window.confirm do navegador por um diálogo próprio do sistema.
export default function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null); // { options, resolve }

  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ options, resolve })), []);

  const settle = useCallback(
    (result) => {
      request?.resolve(result);
      setRequest(null);
    },
    [request],
  );

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog {...request.options} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </ConfirmContext.Provider>
  );
}
