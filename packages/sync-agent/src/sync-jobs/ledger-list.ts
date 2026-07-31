import type { Ledger } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { listOfLedgers } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { toArray, text, amount, attrOrText } from '../parsers.js';
import type { SyncContext } from './context.js';

/**
 * Parse the "List of Ledgers" collection. Common shape:
 *   ENVELOPE > BODY > DATA > COLLECTION > LEDGER[]
 *     LEDGER @_NAME, PARENT, OPENINGBALANCE, CLOSINGBALANCE, PARTYGSTIN, LEDSTATENAME
 * BEST-EFFORT until validated against real ./samples XML.
 */
export function parseLedgers(parsed: unknown): Ledger[] {
  const root = parsed as Record<string, unknown> | undefined;
  const body = (root?.['ENVELOPE'] as Record<string, unknown> | undefined)?.['BODY'];
  const data = (body as Record<string, unknown> | undefined)?.['DATA'] ?? body;
  const collection = (data as Record<string, unknown> | undefined)?.['COLLECTION'] ?? data;
  const nodes = toArray(
    (collection as Record<string, unknown> | undefined)?.['LEDGER'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );

  return nodes.map((n) => {
    const closing = amount(n['CLOSINGBALANCE']);
    const ledger: Ledger = {
      name: attrOrText(n, '@_NAME', 'NAME'),
      parentGroup: text(n['PARENT']) || 'Unknown',
      openingBalance: amount(n['OPENINGBALANCE']),
      currentBalance: closing,
      isDebit: closing >= 0,
    };
    const gstin = text(n['PARTYGSTIN']);
    const state = text(n['LEDSTATENAME'] ?? n['LEDGERSTATENAME']);
    if (gstin) ledger.gstin = gstin;
    if (state) ledger.state = state;
    return ledger;
  }).filter((l) => l.name);
}

export async function syncLedgerList(ctx: SyncContext): Promise<number> {
  logger.info('Syncing ledger list');
  const parsed = await callTally(listOfLedgers(ctx.company), 'ledger-list');
  const ledgers = parseLedgers(parsed);
  logger.info({ count: ledgers.length }, 'Parsed ledgers');
  return push(ctx.syncId, 'ledger-list', ledgers);
}
