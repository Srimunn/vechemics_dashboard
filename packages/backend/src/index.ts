import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { ensureSeedUser } from './lib/seed-user.js';
import { syncRouter } from './routes/sync.js';
import { dashboardRouter } from './routes/dashboard.js';
import { authRouter } from './routes/auth.js';
import { billPnlRouter } from './routes/bill-pnl.js';
import { analyticsRouter } from './routes/analytics.js';
import { exportRouter } from './routes/export.js';

const app = express();

// CORS: lock to specific origins via CORS_ORIGIN (comma-separated) in prod;
// defaults to reflecting any origin (fine for Phase 1 — no cookies cross-site).
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' })); // sync agent batches can be large
app.use(pinoHttp({ logger }));

// Liveness / readiness probe (Railway healthcheck path).
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use('/api/sync', syncRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/bill-pnl', billPnlRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/export', exportRouter);

async function bootstrap(): Promise<void> {
  // First-boot convenience: create the CEO login if the DB has no users yet.
  await ensureSeedUser().catch((err) => logger.error({ err }, 'Seed user failed'));

  const server = app.listen(env.PORT, () => {
    logger.info(`Backend API listening on port ${env.PORT}`);
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
}

void bootstrap();
