import cron from 'node-cron';
import express from 'express';
import { config } from './config.js';
import { logger } from './logger.js';
import { runSync } from './sync-jobs/index.js';
import { fetchPendingTrigger } from './uploader.js';

/**
 * Sync-agent entry point. Runs on the Vchemics PC (ideally as a Windows
 * Service). Responsibilities:
 *   - full sync on startup
 *   - every 15 min: incremental sync
 *   - midnight: full sync
 *   - poll the backend for manual "Refresh Tally Data" triggers
 *   - expose a local POST /trigger-sync endpoint (for direct/manual kicks)
 *
 * `--once` runs a single full sync and exits (handy for testing / cron-less use).
 */

let running = false;

/** Guard so overlapping schedules never run two syncs at once. */
async function guardedSync(type: 'full' | 'incremental' | 'manual'): Promise<void> {
  if (running) {
    logger.warn({ type }, 'Sync already in progress; skipping this trigger');
    return;
  }
  running = true;
  try {
    await runSync(type);
  } catch (err) {
    logger.error({ err, type }, 'Sync run threw');
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--once')) {
    await guardedSync('full');
    process.exit(0);
  }

  logger.info(
    { tally: config.TALLY_URL, backend: config.BACKEND_URL, company: config.COMPANY_NAME },
    'Sync agent starting',
  );

  // Full sync on startup.
  void guardedSync('full');

  // Every 15 minutes: incremental.
  cron.schedule('*/15 * * * *', () => void guardedSync('incremental'));

  // Midnight: full sync.
  cron.schedule('0 0 * * *', () => void guardedSync('full'));

  // Poll the backend for a pending manual refresh.
  setInterval(() => {
    void (async () => {
      const trigger = await fetchPendingTrigger();
      if (trigger) {
        logger.info({ triggerId: trigger.id }, 'Manual refresh trigger received');
        await guardedSync('manual');
      }
    })();
  }, config.POLL_INTERVAL_SECONDS * 1000);

  // Local trigger endpoint (e.g. a LAN button, or a forwarded backend webhook).
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok', running }));
  app.post('/trigger-sync', (_req, res) => {
    void guardedSync('manual');
    res.json({ ok: true, message: 'Manual sync started' });
  });
  app.listen(config.LOCAL_TRIGGER_PORT, () => {
    logger.info(`Local trigger endpoint on http://localhost:${config.LOCAL_TRIGGER_PORT}`);
  });
}

void main();
