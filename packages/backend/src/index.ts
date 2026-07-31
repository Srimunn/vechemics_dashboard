import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { syncRouter } from './routes/sync.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // sync agent batches can be large
app.use(pinoHttp({ logger }));

// Liveness / readiness probe.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use('/api/sync', syncRouter);

const server = app.listen(env.PORT, () => {
  logger.info(`Backend API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown so Railway restarts don't leak the DB pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
