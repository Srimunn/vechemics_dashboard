'use strict';

/**
 * Consolidated VChemics Standalone Sync Agent
 * 
 * Runs one full sync cycle:
 * 1. Fetch all reports from Tally (P&L, BS, Stock, Day Book, Bills Rec, Bills Pay, Voucher Registers)
 * 2. Parse vouchers with full item details and ledger entries
 * 3. Push vouchers with items to backend
 * 4. Push bills receivable and payable to backend
 * 5. Call refresh-kpi to calculate Bank/Cash/GST from ledger entries
 * 6. Fetch existing KPI snapshot to preserve Bank/Cash/GST values
 * 7. Extract P&L and Balance Sheet values
 * 8. Push kpi-direct with ALL 13 values (preserving Bank/Cash/GST)
 * 
 * Schedule with Windows Task Scheduler via run-sync.bat (every 15 minutes).
 */

const { config, validate } = require('./lib/config');
const { callTally } = require('./lib/tally-client');
const { buildJobs } = require('./lib/reports');
const { push, postSyncLog, triggerRefreshKpi, fetchKpiSnapshot } = require('./lib/uploader');
const { extractKpiDirect } = require('./lib/parsers');

validate({ requireBackend: true });

async function main() {
  const startedAt = new Date();
  const syncId = `standalone-${startedAt.getTime()}`;

  console.log('VChemics Consolidated Standalone Sync Agent');
  console.log('-------------------------------------------');
  console.log(`Tally URL : ${config.TALLY_URL}`);
  console.log(`Backend   : ${config.BACKEND_URL}`);
  console.log(`Company   : ${config.COMPANY_NAME}`);
  console.log(`Date Range: ${config.FY_START} -> ${config.TO_DATE}\n`);

  const jobs = buildJobs(config);
  let totalRecords = 0;
  let failures = 0;
  const collected = {};

  // Step 1: Fetch all reports from Tally and parse
  for (const job of jobs) {
    try {
      const { raw, parsed } = await callTally(job.xml, job.name);
      collected[job.name] = job.parse(parsed, raw);
    } catch (err) {
      failures++;
      console.error(`[${job.name}] Tally fetch FAILED: ${err.message}`);
    }
  }

  // Step 2: Build Stock Item Cost map & enrich Sales Vouchers
  const stockMap = new Map();
  (collected['stock-summary'] || []).forEach((item) => {
    stockMap.set(item.name.toLowerCase().trim(), item.avgCost || 0);
  });

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

  const voucherJobKeys = [
    'day-book',
    'voucher-register-sales',
    'voucher-register-purchase',
    'voucher-register-receipt',
    'voucher-register-payment',
  ];
  voucherJobKeys.forEach((key) => enrichVouchers(collected[key]));

  // Step 3 & 4: Push vouchers and bills to backend
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

  // Step 5: Call refresh-kpi to calculate Bank/Cash/GST from ledger entries in DB
  console.log('[refresh-kpi] Refreshing backend KPI calculations...');
  await triggerRefreshKpi();

  // Step 6: Fetch existing KPI snapshot to preserve Bank/Cash/GST values
  console.log('[kpi-snapshot] Fetching existing KPI snapshot...');
  const existingSnapshot = await fetchKpiSnapshot();

  // Step 7 & 8: Extract P&L and Balance Sheet values, then push kpi-direct
  let kpiPushed = false;
  try {
    const snapshot = extractKpiDirect({
      balanceSheetRows: collected['balance-sheet'] || [],
      pnlRows: collected['profit-and-loss'] || [],
      stockItems: collected['stock-summary'] || [],
      receivables: collected['bills-receivable'] || [],
      payables: collected['bills-payable'] || [],
      ledgers: collected['trial-balance'] || [],
      vouchersToday: collected['day-book'] || [],
      existingSnapshot,
    });
    const sent = await push(syncId, 'kpi-direct', [snapshot]);
    totalRecords += sent;
    kpiPushed = true;
    console.log(`[kpi-direct] -> kpi-direct: pushed ${sent} snapshot record`);
  } catch (err) {
    console.error(`[kpi-direct] FAILED: ${err.message}`);
  }

  // Calculate voucher, item, and bill totals for summary log
  const voucherMap = new Map();
  voucherJobKeys.forEach((key) => {
    (collected[key] || []).forEach((v) => {
      if (v && v.tallyGuid) voucherMap.set(v.tallyGuid, v);
    });
  });
  const totalVouchersCount = voucherMap.size;
  let totalItemsCount = 0;
  voucherMap.forEach((v) => {
    totalItemsCount += Array.isArray(v.items) ? v.items.length : 0;
  });

  const totalBillsCount =
    (collected['bills-receivable'] || []).length +
    (collected['bills-payable'] || []).length;

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

  console.log(`\nSync complete: ${totalVouchersCount} vouchers, ${totalItemsCount} items, ${totalBillsCount} bills, KPIs updated`);
  process.exit(status === 'failed' ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
