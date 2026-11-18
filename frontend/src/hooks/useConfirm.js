import { useContext } from 'react';
import { ConfirmContext } from '../components/ConfirmDialog/ConfirmContext.js';

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, message, confirmLabel, tone })) { ... }
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return confirm;
}
