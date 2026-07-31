import { callTally } from '../tally-client.js';
import { dayBook } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { parseVouchers } from './voucher-parser.js';
import type { SyncContext } from './context.js';

/** Day Book: every voucher (all types) in the date range. */
export async function syncDayBook(ctx: SyncContext): Promise<number> {
  logger.info({ from: ctx.fromDate, to: ctx.toDate }, 'Syncing day book');
  const parsed = await callTally(dayBook(ctx.company, ctx.fromDate, ctx.toDate), 'day-book');
  const vouchers = parseVouchers(parsed);
  logger.info({ count: vouchers.length }, 'Parsed day-book vouchers');
  return push(ctx.syncId, 'day-book', vouchers);
}
