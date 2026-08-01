'use strict';

/**
 * Runs one full sync: reads every report from Tally, parses it, and pushes the
 * normalized records to the VChemics backend. Also records a sync log.
 *
 *   node sync-once.js
 *
 * Schedule it on the Vchemics PC with Windows Task Scheduler (e.g. every 15 min)
 * for continuous syncing — see README.md.
 */

const { config, validate } = require('./lib/config');
const { callTally } = require('./lib/tally-client');
const { buildJobs } = require('./lib/reports');
const { push, postSyncLog } = require('./lib/uploader');
const { extractKpiDirect } = require('./lib/parsers');

validate({ requireBackend: true });

async function main() {
  const startedAt = new Date();
  const syncId = `standalone-${startedAt.getTime()}`;

  console.log('VChemics full sync');
  console.log('------------------');
  console.log(`Tally   : ${config.TALLY_URL}`);
  console.log(`Backend : ${config.BACKEND_URL}`);
  console.log(`Company : ${config.COMPANY_NAME}`);
  console.log(`Range   : ${config.FY_START} -> ${config.TO_DATE}\n`);

  const jobs = buildJobs(config);
  let totalRecords = 0;
  let failures = 0;
  const collected = {};

  for (const job of jobs) {
    try {
      const { parsed } = await callTally(job.xml, job.name);
      const data = job.parse(parsed);
      collected[job.name] = data;
      const sent = await push(syncId, job.jobType, data);
      totalRecords += sent;
      console.log(`[${job.name}] -> ${job.jobType}: pushed ${sent} record(s)`);
    } catch (err) {
      failures++;
      console.error(`[${job.name}] FAILED: ${err.message}`);
    }
  }

  // Extract and push kpi-direct snapshot
  try {
    const snapshot = extractKpiDirect({
      balanceSheetRows: collected['balance-sheet'] || [],
      pnlRows: collected['profit-and-loss'] || [],
      stockItems: collected['stock-summary'] || [],
      receivables: collected['bills-receivable'] || [],
      payables: collected['bills-payable'] || [],
      ledgers: collected['trial-balance'] || [],
      vouchersToday: collected['day-book'] || [],
    });
    const sent = await push(syncId, 'kpi-direct', [snapshot]);
    totalRecords += sent;
    console.log(`[kpi-direct] -> kpi-direct: pushed ${sent} snapshot record`);
  } catch (err) {
    console.error(`[kpi-direct] FAILED: ${err.message}`);
  }

  const finishedAt = new Date();
  const status = failures === 0 ? 'success' : failures === jobs.length ? 'failed' : 'partial';

  await postSyncLog({
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    syncType: 'full',
    status,
    recordsSynced: totalRecords,
    errorMessage: failures ? `${failures} job(s) failed` : undefined,
  });

  console.log(
    `\nDone: ${status}. ${totalRecords} record(s) pushed, ${failures} job(s) failed, ` +
      `${finishedAt.getTime() - startedAt.getTime()}ms.`,
  );
  process.exit(status === 'failed' ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
