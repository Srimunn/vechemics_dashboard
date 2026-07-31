import type { Ledger } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { profitAndLoss } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { text, amount, deepCollect } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse a Profit & Loss statement. REAL Tally 7.0 shape (validated against
 * fixtures): positionally-aligned pairs of
 *     DSPACCNAME > DSPDISPNAME              (line name)
 *     PLAMT      > { PLSUBAMT, BSMAINAMT }  (amount)
 *
 * Amounts: group totals sit in BSMAINAMT, sub-items in PLSUBAMT. Signs are as
 * Tally exports them (this company: income positive, expenses negative), so we
 * PRESERVE the sign — downstream profit math relies on it:
 *   Gross Profit = Sales Accounts + Income (Direct) + Cost of Sales
 *   Net Profit   = Gross Profit + Expenses (Indirect)      (indirect is negative)
 *
 * Lines land in the DB as Ledger rows (parentGroup 'Profit & Loss') via the
 * ledger ingest path, so the figures are queryable without a new table.
 */
export function parseProfitAndLoss(parsed: unknown): Ledger[] {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const amts = deepCollect(parsed, 'PLAMT');
  const out: Ledger[] = [];

  const count = Math.min(names.length, amts.length);
  for (let i = 0; i < count; i++) {
    const name = text(names[i]!['DSPDISPNAME']);
    if (!name) continue;

    const main = text(amts[i]!['BSMAINAMT']);
    const sub = text(amts[i]!['PLSUBAMT']);
    // Prefer whichever cell is populated (group total vs sub-item).
    const bal = amount(main || sub);

    out.push({
      name,
      parentGroup: 'Profit & Loss',
      openingBalance: 0,
      currentBalance: bal,
      isDebit: bal >= 0,
    });
  }

  return out;
}

export async function syncProfitAndLoss(ctx: SyncContext): Promise<number> {
  logger.info('Syncing profit and loss');
  const parsed = await callTally(
    profitAndLoss(ctx.company, ctx.fromDate, ctx.toDate),
    'profit-and-loss',
  );
  const lines = parseProfitAndLoss(parsed);
  logger.info({ count: lines.length }, 'Parsed P&L lines');
  return push(ctx.syncId, 'profit-and-loss', lines);
}
