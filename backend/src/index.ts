import { createServer } from 'node:http';
import { createApp } from './app.js';
import { initIo } from './realtime/io.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

async function main() {
  const app = createApp();
  const server = createServer(app);
  initIo(server);

  server.listen(env.port, () => {
    logger.info(`LandGuard API listening on http://localhost:${env.port}`, { env: env.nodeEnv });
    logger.info(`Health: http://localhost:${env.port}/api/health`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down…`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { message: (err as Error).message });
  process.exit(1);
});
