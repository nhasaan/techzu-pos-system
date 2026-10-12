import http from 'http';
import { createApp } from './app';
import { config } from './shared/config';
import { pool } from './shared/db';
import { logger } from './shared/utils/logger';

const app = createApp();
const server = http.createServer(app);

// Keep-alive longer than typical load balancer idle timeouts (AWS ALB: 60s) to avoid 502s on reused sockets.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

server.listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port, env: config.env }, 'Server listening');
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // Stop accepting new connections, let in-flight requests finish, then release resources.
  server.close(async () => {
    try {
      await pool.end();
    } finally {
      logger.info('Shutdown complete');
      process.exit(0);
    }
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
