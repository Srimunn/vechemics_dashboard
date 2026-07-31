import type { Ledger } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { balanceSheet } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { text, amount, deepCollect } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse a Balance Sheet. REAL Tally 7.0 shape (validated against fixtures):
 *   positionally-aligned pairs of
 *     BSNAME > DSPACCNAME > DSPDISPNAME     (group name)
 *     BSAMT  > { BSSUBAMT, BSMAINAMT }       (amount; BSMAINAMT is the group total)
 *
 * Groups seen: Capital Account, Loans (Liability), Current Liabilities,
 * Suspense A/c, Profit & Loss A/c, Fixed Assets, Investments, Current Assets.
 *
 * We flatten each group into a Ledger row (parentGroup 'Balance Sheet') so the
 * figures land in the DB via the existing ledger ingest path. Signed value is
 * preserved (BSMAINAMT as exported).
 */
export function parseBalanceSheet(parsed: unknown): Ledger[] {
  const names = deepCollect(parsed, 'BSNAME');
  const amts = deepCollect(parsed, 'BSAMT');
  const out: Ledger[] = [];

  const count = Math.min(names.length, amts.length);
  for (let i = 0; i < count; i++) {
    const dsp = names[i]!['DSPACCNAME'] as Record<string, unknown> | undefined;
    const name = text(dsp?.['DSPDISPNAME']);
    if (!name) continue;

    const main = text(amts[i]!['BSMAINAMT']);
    const sub = text(amts[i]!['BSSUBAMT']);
    const bal = amount(main || sub);

    out.push({
      name,
      parentGroup: 'Balance Sheet',
      openingBalance: 0,
      currentBalance: bal,
      isDebit: bal >= 0,
    });
  }

  return out;
}

export async function syncBalanceSheet(ctx: SyncContext): Promise<number> {
  logger.info('Syncing balance sheet');
  const parsed = await callTally(
    balanceSheet(ctx.company, ctx.fromDate, ctx.toDate),
    'balance-sheet',
  );
  const ledgers = parseBalanceSheet(parsed);
  logger.info({ count: ledgers.length }, 'Parsed balance-sheet groups');
  return push(ctx.syncId, 'balance-sheet', ledgers);
}
