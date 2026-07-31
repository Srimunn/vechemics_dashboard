import type { Outstanding, OutstandingType } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { billsReceivable, billsPayable } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { toArray, text, absAmount, tallyDateToIso } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse a Bills Receivable / Bills Payable report into Outstanding[]. Common
 * shape: ENVELOPE > BODY > DATA > (BILLFIXED|BILLS)[] with BILLDATE, BILLREF,
 * PARTYNAME/LEDGERNAME, BILLDUEDATE, CLOSINGBAL/BILLAMOUNT, OVERDUEDAYS.
 * BEST-EFFORT until validated against real ./samples XML.
 */
export function parseOutstandings(parsed: unknown, type: OutstandingType): Outstanding[] {
  const root = parsed as Record<string, unknown> | undefined;
  const body = (root?.['ENVELOPE'] as Record<string, unknown> | undefined)?.['BODY'];
  const data = (body as Record<string, unknown> | undefined)?.['DATA'] ?? body;
  const container = (data as Record<string, unknown> | undefined) ?? {};

  const nodes = [
    ...toArray(container['BILLFIXED'] as Record<string, unknown>[]),
    ...toArray(container['BILLS'] as Record<string, unknown>[]),
    ...toArray(container['BILL'] as Record<string, unknown>[]),
  ];

  return nodes.map((n) => {
    const billDate = tallyDateToIso(n['BILLDATE']) ?? new Date().toISOString();
    const out: Outstanding = {
      type,
      billDate,
      billRef: text(n['BILLREF'] ?? n['NAME'] ?? n['BILLNUMBER']),
      partyName: text(n['PARTYNAME'] ?? n['LEDGERNAME']),
      pendingAmount: absAmount(n['CLOSINGBAL'] ?? n['BILLAMOUNT'] ?? n['AMOUNT']),
      overdueDays: Number.parseInt(text(n['OVERDUEDAYS'] ?? n['AGEOFBILL']), 10) || 0,
    };
    const due = tallyDateToIso(n['BILLDUEDATE'] ?? n['DUEDATE']);
    if (due) out.dueDate = due;
    return out;
  }).filter((o) => o.partyName || o.billRef);
}

export async function syncBillsReceivable(ctx: SyncContext): Promise<number> {
  logger.info('Syncing bills receivable');
  const parsed = await callTally(
    billsReceivable(ctx.company, ctx.fromDate, ctx.toDate),
    'bills-receivable',
  );
  const rows = parseOutstandings(parsed, 'receivable');
  logger.info({ count: rows.length }, 'Parsed receivables');
  return push(ctx.syncId, 'bills-receivable', rows);
}

export async function syncBillsPayable(ctx: SyncContext): Promise<number> {
  logger.info('Syncing bills payable');
  const parsed = await callTally(
    billsPayable(ctx.company, ctx.fromDate, ctx.toDate),
    'bills-payable',
  );
  const rows = parseOutstandings(parsed, 'payable');
  logger.info({ count: rows.length }, 'Parsed payables');
  return push(ctx.syncId, 'bills-payable', rows);
}
