import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';

const env = loadEnv();

import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const shutdown = async () => {
  logger.info('Shutting down...');
  const { disconnectPrisma } = await import('./config/database.js');
  server.close();
  await disconnectPrisma();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
