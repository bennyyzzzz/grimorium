import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT) || 3333;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Grimorium API rodando em http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
