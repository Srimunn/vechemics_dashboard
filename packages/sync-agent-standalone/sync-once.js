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

  // Step 1: Execute all Tally queries and collect parsed data
  for (const job of jobs) {
    try {
      const { parsed } = await callTally(job.xml, job.name);
      collected[job.name] = job.parse(parsed);
    } catch (err) {
      failures++;
      console.error(`[${job.name}] Tally fetch FAILED: ${err.message}`);
    }
  }

  // Step 2: Build Stock Item Cost map
  const stockMap = new Map();
  (collected['stock-summary'] || []).forEach((item) => {
    stockMap.set(item.name.toLowerCase().trim(), item.avgCost || 0);
  });

  // Step 3: Enrich Sales Vouchers with item cost, profit, and margin
  const enrichVouchers = (vouchers) => {
    if (!Array.isArray(vouchers)) return;
    vouchers.forEach((v) => {
      if (v.voucherType === 'Sales' && Array.isArray(v.items)) {
        v.items.forEach((item) => {
          const avgCost = stockMap.get(item.stockItemName.toLowerCase().trim()) || (item.rate * 0.8);
          item.costRate = avgCost;
          item.costAmount = Math.round(avgCost * item.quantity * 100) / 100;
          item.profit = Math.round((item.amount - item.costAmount) * 100) / 100;
          item.marginPct = item.amount > 0 ? Math.round((item.profit / item.amount) * 10000) / 100 : 0;
        });
      }
    });
  };

  enrichVouchers(collected['voucher-register-sales']);
  enrichVouchers(collected['day-book']);

  // Step 4: Push collected payloads to backend
  for (const job of jobs) {
    if (!collected[job.name]) continue;
    try {
      const sent = await push(syncId, job.jobType, collected[job.name]);
      totalRecords += sent;
      console.log(`[${job.name}] -> ${job.jobType}: pushed ${sent} record(s)`);
    } catch (err) {
      failures++;
      console.error(`[${job.name}] Push FAILED: ${err.message}`);
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
