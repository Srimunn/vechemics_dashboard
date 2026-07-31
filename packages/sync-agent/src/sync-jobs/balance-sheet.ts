import type { Ledger } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { balanceSheet } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { toArray, text, amount } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * The Balance Sheet report is hierarchical (groups > ledgers). For Phase 1 we
 * flatten the leaf balances into Ledger[] and send them via the same
 * 'balance-sheet' ingest path (the backend treats them as ledger balance
 * updates). BEST-EFFORT until validated against real ./samples XML.
 */
export function parseBalanceSheet(parsed: unknown): Ledger[] {
  const root = parsed as Record<string, unknown> | undefined;
  const body = (root?.['ENVELOPE'] as Record<string, unknown> | undefined)?.['BODY'];
  const data = (body as Record<string, unknown> | undefined)?.['DATA'] ?? body;

  const out: Ledger[] = [];

  // Walk the tree collecting any node that looks like a named balance line.
  const visit = (node: unknown, parentGroup: string): void => {
    for (const item of toArray(node as Record<string, unknown>[])) {
      if (!item || typeof item !== 'object') continue;
      const name = (item['@_NAME'] as string) || text(item['NAME']);
      const amtNode = item['AMOUNT'] ?? item['CLOSINGBALANCE'];
      if (name && amtNode !== undefined) {
        const bal = amount(amtNode);
        out.push({
          name,
          parentGroup: parentGroup || 'Balance Sheet',
          openingBalance: 0,
          currentBalance: bal,
          isDebit: bal >= 0,
        });
      }
      // Recurse into common child containers.
      for (const key of ['BSNAME', 'BSAMT', 'DSPACCNAME', 'SUBGROUP', 'LEDGER']) {
        if (item[key]) visit(item[key], name || parentGroup);
      }
    }
  };

  visit(data, '');
  return out.filter((l) => l.name);
}

export async function syncBalanceSheet(ctx: SyncContext): Promise<number> {
  logger.info('Syncing balance sheet');
  const parsed = await callTally(
    balanceSheet(ctx.company, ctx.fromDate, ctx.toDate),
    'balance-sheet',
  );
  const ledgers = parseBalanceSheet(parsed);
  logger.info({ count: ledgers.length }, 'Parsed balance-sheet lines');
  return push(ctx.syncId, 'balance-sheet', ledgers);
}
