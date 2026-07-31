import axios, { AxiosError } from 'axios';
import type { SyncJobPayload, SyncJobType, PendingTrigger } from '@vchemics/shared';
import { config } from './config.js';
import { logger } from './logger.js';

const BATCH_SIZE = 500;
const MAX_RETRIES = 5;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const client = axios.create({
  baseURL: config.BACKEND_URL,
  headers: { 'X-Sync-Token': config.SYNC_AGENT_TOKEN, 'Content-Type': 'application/json' },
  timeout: 30_000,
});

/** Is this HTTP status worth retrying (transient)? */
function isRetryable(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

async function postWithBackoff(path: string, body: unknown): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await client.post(path, body);
      return;
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      if (attempt === MAX_RETRIES || !isRetryable(status)) {
        throw new Error(
          `POST ${path} failed (status ${status ?? 'n/a'}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1));
      logger.warn({ path, status, attempt, delay }, 'Upload failed; backing off');
      await sleep(delay);
    }
  }
}

/**
 * Push normalized records to the backend ingest endpoint, chunked into batches
 * so a single request never carries the whole chart of accounts / voucher set.
 */
export async function push(
  syncId: string,
  jobType: SyncJobType,
  data: unknown[],
): Promise<number> {
  if (data.length === 0) {
    logger.info({ jobType }, 'Nothing to upload (0 records)');
    return 0;
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    // The discriminated union is validated server-side; cast is safe because
    // each caller passes the data shape matching its jobType.
    const payload = { syncId, jobType, data: chunk } as unknown as SyncJobPayload;
    await postWithBackoff('/api/sync/ingest', payload);
    logger.debug({ jobType, batch: i / BATCH_SIZE + 1, size: chunk.length }, 'Batch uploaded');
  }

  logger.info({ jobType, total: data.length }, 'Upload complete');
  return data.length;
}

/** Report a finished sync run so the dashboard can show a "last sync" time. */
export async function postSyncLog(log: {
  startedAt: string;
  finishedAt: string;
  syncType: 'incremental' | 'full' | 'manual';
  status: 'success' | 'partial' | 'failed';
  recordsSynced: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await postWithBackoff('/api/sync/log', log);
  } catch (err) {
    logger.warn({ err }, 'Failed to post sync log (non-fatal)');
  }
}

/** Poll the backend for a pending manual "Refresh Tally Data" trigger. */
export async function fetchPendingTrigger(): Promise<PendingTrigger | null> {
  try {
    const res = await client.get<{ trigger: PendingTrigger | null }>('/api/sync/pending-trigger');
    return res.data.trigger;
  } catch (err) {
    logger.warn({ err }, 'Failed to poll pending trigger');
    return null;
  }
}
