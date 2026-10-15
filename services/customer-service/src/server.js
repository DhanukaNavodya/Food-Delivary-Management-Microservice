// Load .env when running with plain Node (docker-compose and ECS pass variables directly).
import 'dotenv/config';
import { app, onStartup } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

async function start() {
  await connectDB(config.mongoUri);
  await onStartup();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`${config.serviceName} running on port ${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down ${config.serviceName}`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error(`Failed to start ${config.serviceName}:`, error);
  process.exit(1);
});
