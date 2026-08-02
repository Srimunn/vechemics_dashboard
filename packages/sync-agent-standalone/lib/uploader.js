'use strict';

const axios = require('axios');
const { config } = require('./config');
const { logger } = require('./logger');

const BATCH_SIZE = 500;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  return axios.create({
    baseURL: config.BACKEND_URL,
    headers: { 'X-Sync-Token': config.SYNC_AGENT_TOKEN, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
}

function isRetryable(status) {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

async function postWithBackoff(c, urlPath, body) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await c.post(urlPath, body);
      return;
    } catch (err) {
      const status = err && err.response && err.response.status;
      if (attempt === MAX_RETRIES || !isRetryable(status)) {
        throw new Error(`POST ${urlPath} failed (status ${status || 'n/a'}): ${err && err.message}`);
      }
      const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
      logger.warn({ urlPath, status, attempt, delay }, 'Upload failed; backing off');
      await sleep(delay);
    }
  }
}

/** Push normalized records to /api/sync/ingest in batches. Returns count sent. */
async function push(syncId, jobType, data) {
  if (!data || data.length === 0) return 0;
  const c = client();
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    await postWithBackoff(c, '/api/sync/ingest', { syncId, jobType, data: chunk });
  }
  return data.length;
}

/** Report a finished run so the dashboard shows a "last sync" time. */
async function postSyncLog(log) {
  try {
    await postWithBackoff(client(), '/api/sync/log', log);
  } catch (err) {
    logger.warn({ err: err && err.message }, 'Failed to post sync log (non-fatal)');
  }
}

/** Call refresh-kpi endpoint to compute Bank/Cash/GST from ledger entries. */
async function triggerRefreshKpi() {
  try {
    const c = client();
    await postWithBackoff(c, '/api/sync/refresh-kpi', {});
  } catch (err) {
    logger.warn({ err: err && err.message }, 'Failed to trigger refresh-kpi');
  }
}

/** Fetch existing KPI snapshot to preserve Bank/Cash/GST values. */
async function fetchKpiSnapshot() {
  try {
    const c = client();
    const res = await c.get('/api/sync/kpi-snapshot');
    return res.data && res.data.snapshot ? res.data.snapshot : null;
  } catch (err) {
    logger.warn({ err: err && err.message }, 'Failed to fetch existing KPI snapshot');
    return null;
  }
}

module.exports = { push, postSyncLog, triggerRefreshKpi, fetchKpiSnapshot };
