import type { SyncType } from '@vchemics/shared';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { postSyncLog } from '../uploader.js';
import type { SyncContext } from './context.js';
import { syncLedgerList } from './ledger-list.js';
import { syncDayBook } from './day-book.js';
import { syncVoucherRegister } from './voucher-register.js';
import { syncStockSummary } from './stock-summary.js';
import { syncBillsReceivable, syncBillsPayable } from './outstandings.js';
import { syncBalanceSheet } from './balance-sheet.js';
import { syncProfitAndLoss } from './profit-and-loss.js';
import { syncKpiDirect } from './kpi-direct.js';

/** YYYYMMDD for a given date. */
function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

type Job = { name: string; run: (ctx: SyncContext) => Promise<number> };

const JOBS: Job[] = [
  { name: 'ledger-list', run: syncLedgerList },
  { name: 'balance-sheet', run: syncBalanceSheet },
  { name: 'profit-and-loss', run: syncProfitAndLoss },
  { name: 'stock-summary', run: syncStockSummary },
  { name: 'day-book', run: syncDayBook },
  { name: 'voucher-register-sales', run: (c) => syncVoucherRegister(c, 'Sales') },
  { name: 'voucher-register-purchase', run: (c) => syncVoucherRegister(c, 'Purchase') },
  { name: 'voucher-register-receipt', run: (c) => syncVoucherRegister(c, 'Receipt') },
  { name: 'voucher-register-payment', run: (c) => syncVoucherRegister(c, 'Payment') },
  { name: 'voucher-register-journal', run: (c) => syncVoucherRegister(c, 'Journal') },
  { name: 'voucher-register-contra', run: (c) => syncVoucherRegister(c, 'Contra') },
  { name: 'bills-receivable', run: syncBillsReceivable },
  { name: 'bills-payable', run: syncBillsPayable },
  { name: 'kpi-direct', run: syncKpiDirect },
];

/**
 * Run all sync jobs. `full` syncs from the FY start; `incremental`/`manual`
 * sync today only (voucher-level reports); ledger/stock/bills are always full
 * snapshots. Individual job failures are logged and skipped so one bad report
 * doesn't abort the whole run — the overall status reflects partial failures.
 */
export async function runSync(syncType: SyncType): Promise<void> {
  const startedAt = new Date();
  const today = ymd(startedAt);
  const fromDate = syncType === 'full' ? config.FY_START : today;

  const ctx: SyncContext = {
    syncId: `${syncType}-${startedAt.getTime()}`,
    company: config.COMPANY_NAME,
    fromDate,
    toDate: today,
  };

  logger.info({ syncType, from: fromDate, to: today }, 'Starting sync run');

  let recordsSynced = 0;
  let failures = 0;

  for (const job of JOBS) {
    try {
      recordsSynced += await job.run(ctx);
    } catch (err) {
      failures++;
      logger.error({ err, job: job.name }, 'Sync job failed (continuing)');
    }
  }

  const finishedAt = new Date();
  const status = failures === 0 ? 'success' : failures === JOBS.length ? 'failed' : 'partial';

  await postSyncLog({
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    syncType,
    status,
    recordsSynced,
    ...(failures > 0 ? { errorMessage: `${failures} job(s) failed` } : {}),
  });

  logger.info(
    { syncType, status, recordsSynced, failures, ms: finishedAt.getTime() - startedAt.getTime() },
    'Sync run complete',
  );
}
