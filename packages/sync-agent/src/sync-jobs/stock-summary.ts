import type { StockItem } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { stockSummary } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { toArray, text, amount, absAmount, attrOrText } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse Stock Summary. Common shape:
 *   ENVELOPE > BODY > DATA > (COLLECTION|TALLYMESSAGE) > STOCKITEM[] / STOCKSUMMARY[]
 *     name, base units, closing qty, closing value, closing rate (avg cost)
 * BEST-EFFORT until validated against real ./samples XML.
 */
export function parseStockItems(parsed: unknown): StockItem[] {
  const root = parsed as Record<string, unknown> | undefined;
  const body = (root?.['ENVELOPE'] as Record<string, unknown> | undefined)?.['BODY'];
  const data = (body as Record<string, unknown> | undefined)?.['DATA'] ?? body;
  const container = (data as Record<string, unknown> | undefined) ?? {};

  const nodes = [
    ...toArray(container['STOCKITEM'] as Record<string, unknown>[]),
    ...toArray(container['STOCKSUMMARY'] as Record<string, unknown>[]),
    // When wrapped in a collection:
    ...toArray(
      (container['COLLECTION'] as Record<string, unknown> | undefined)?.['STOCKITEM'] as
        | Record<string, unknown>[]
        | undefined,
    ),
  ];

  return nodes.map((n) => {
    const { quantity } = parseQty(text(n['CLOSINGBALANCE'] ?? n['CLOSINGQTY']));
    const item: StockItem = {
      name: attrOrText(n, '@_NAME', 'NAME') || text(n['STOCKITEMNAME']),
      unit: text(n['BASEUNITS'] ?? n['BASEUNIT']) || parseUnit(text(n['CLOSINGBALANCE'])),
      closingQty: quantity,
      closingValue: absAmount(n['CLOSINGVALUE']),
      avgCost: Math.abs(amount(rateOnly(text(n['CLOSINGRATE'])))),
    };
    const hsn = text(n['HSNCODE'] ?? n['GSTHSNNAME']);
    const gst = Number.parseFloat(text(n['GSTRATE']));
    if (hsn) item.hsnCode = hsn;
    if (Number.isFinite(gst)) item.gstRate = gst;
    return item;
  }).filter((i) => i.name);
}

function parseQty(raw: string): { quantity: number } {
  const m = /^(-?[\d,]*\.?\d+)/.exec(raw.trim());
  return { quantity: m ? Number.parseFloat(m[1]!.replace(/,/g, '')) || 0 : 0 };
}

function parseUnit(raw: string): string {
  const m = /[\d,.\s-]*(.*)$/.exec(raw.trim());
  return (m?.[1] ?? '').trim();
}

function rateOnly(raw: string): string {
  return raw.split('/')[0] ?? raw;
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
