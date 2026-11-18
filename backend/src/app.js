import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors());
  // A importação recebe backups maiores; as demais rotas mantêm o limite padrão (100kb).
  app.use('/api/transfer/import', express.json({ limit: '20mb' }));
  // Entradas da Biblioteca podem ter conteúdo longo (código, passo a passo extenso).
  app.use('/api/library', express.json({ limit: '2mb' }));
  app.use(express.json());

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
