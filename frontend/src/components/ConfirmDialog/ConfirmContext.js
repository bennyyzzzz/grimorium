import { createContext } from 'react';

// Fornece a função confirm(options) => Promise<boolean>. Ver ConfirmProvider e hooks/useConfirm.
export const ConfirmContext = createContext(null);
