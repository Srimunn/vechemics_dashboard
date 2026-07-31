import type { StockItem } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { stockSummary } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { text, amount, absAmount, deepCollect, parseQtyUnit } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse Stock Summary. REAL Tally 7.0 shape (validated against fixtures):
 *   positionally-aligned pairs of
 *     DSPACCNAME > DSPDISPNAME            (item name)
 *     DSPSTKINFO > DSPSTKCL > { DSPCLQTY ("39.00 NOS"), DSPCLRATE, DSPCLAMTA }
 *
 * Many items carry empty qty/amount (zero stock) — those are skipped.
 * DSPCLAMTA is negative by Tally convention for closing balance value; we store
 * its magnitude as closingValue.
 */
export function parseStockItems(parsed: unknown): StockItem[] {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const infos = deepCollect(parsed, 'DSPSTKINFO');
  const out: StockItem[] = [];

  const count = Math.min(names.length, infos.length);
  for (let i = 0; i < count; i++) {
    const name = text(names[i]!['DSPDISPNAME']);
    const closing = infos[i]!['DSPSTKCL'] as Record<string, unknown> | undefined;
    if (!name || !closing) continue;

    const amtRaw = text(closing['DSPCLAMTA']);
    if (!amtRaw.trim()) continue; // zero-stock item — no closing value

    const { quantity, unit } = parseQtyUnit(closing['DSPCLQTY']);
    out.push({
      name,
      unit,
      closingQty: quantity,
      closingValue: absAmount(closing['DSPCLAMTA']),
      avgCost: Math.abs(amount(closing['DSPCLRATE'])),
    });
  }

  return out;
}

export async function syncStockSummary(ctx: SyncContext): Promise<number> {
  logger.info('Syncing stock summary');
  const parsed = await callTally(
    stockSummary(ctx.company, ctx.fromDate, ctx.toDate),
    'stock-summary',
  );
  const items = parseStockItems(parsed);
  logger.info({ count: items.length }, 'Parsed stock items');
  return push(ctx.syncId, 'stock-summary', items);
}
