import type { Voucher, VoucherItem, VoucherLedgerEntry, VoucherType } from '@vchemics/shared';
import {
  toArray, text, amount, absAmount, tallyDateToIso, deepCollect, parseQtyUnit, parseRateUnit,
} from '../parsers.js';

/**
 * Parse a Tally Day Book / Voucher Register export into normalized Voucher[].
 *
 * REAL Tally 7.0 shape (flat — validated against fixtures):
 *   TALLYMESSAGE > VOUCHER (attrs VCHTYPE, VCHKEY, REMOTEID, ACTION, OBJVIEW)
 *     DATE, PARTYLEDGERNAME, VOUCHERNUMBER, BASICBUYERNAME
 *     Inventory (repeated, positionally aligned):
 *       STOCKITEMNAME[], RATE[] ("1779.66/NOS"), ACTUALQTY[] (" 2.00 NOS")
 *     Ledger entries (repeated): LEDGERNAME[]
 *     AMOUNT[]  <-- shared list: the FIRST (#stock items) are inventory amounts,
 *                   the REMAINING (#ledger names) are ledger-entry amounts, in
 *                   document order (inventory block precedes ledger block).
 *
 * Ledger AMOUNT sign follows Tally's voucher convention (negative = credit,
 * e.g. the party line on a sale). We store magnitude + an isDebit flag.
 */

const KNOWN_TYPES: VoucherType[] = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra'];

function normalizeVoucherType(raw: string): VoucherType | null {
  const v = raw.trim().toLowerCase();
  const hit = KNOWN_TYPES.find((t) => t.toLowerCase() === v);
  if (hit) return hit;
  if (v.includes('sale')) return 'Sales';
  if (v.includes('purchase')) return 'Purchase';
  if (v.includes('receipt')) return 'Receipt';
  if (v.includes('payment')) return 'Payment';
  if (v.includes('journal')) return 'Journal';
  if (v.includes('contra')) return 'Contra';
  return null;
}

export function parseVouchers(parsed: unknown, restrictTo?: VoucherType): Voucher[] {
  const vouchers = deepCollect(parsed, 'VOUCHER');
  const out: Voucher[] = [];

  for (const v of vouchers) {
    const rawType = (v['@_VCHTYPE'] as string) || text(v['VOUCHERTYPENAME']);
    const vType = normalizeVoucherType(rawType);
    if (!vType) continue;
    if (restrictTo && vType !== restrictTo) continue;

    const voucherNumber = text(v['VOUCHERNUMBER']);
    const dateIso = tallyDateToIso(v['DATE']) ?? new Date().toISOString();

    // Dedup key: prefer Tally's stable VCHKEY, then REMOTEID/GUID, else compose.
    const tallyGuid =
      (v['@_VCHKEY'] as string) ||
      (v['@_REMOTEID'] as string) ||
      text(v['GUID']) ||
      text(v['MASTERID']) ||
      `${vType}:${voucherNumber}:${dateIso}`;

    // Positionally-aligned inventory arrays.
    const stockNames = toArray(v['STOCKITEMNAME']);
    const rates = toArray(v['RATE']);
    const qtys = toArray(v['ACTUALQTY']);
    const ledgerNames = toArray(v['LEDGERNAME']);
    const amounts = toArray(v['AMOUNT']);
    const stockCount = stockNames.length;

    const items: VoucherItem[] = stockNames.map((name, i) => {
      const { rate, unit } = parseRateUnit(rates[i]);
      const { quantity, unit: qUnit } = parseQtyUnit(qtys[i]);
      return {
        stockItemName: text(name),
        quantity,
        unit: qUnit || unit,
        rate,
        amount: absAmount(amounts[i]),
      };
    });

    const ledgerEntries: VoucherLedgerEntry[] = ledgerNames.map((ln, j) => {
      const raw = amounts[stockCount + j];
      const signed = amount(raw);
      return {
        ledgerName: text(ln),
        amount: Math.abs(signed),
        isDebit: signed >= 0, // positive AMOUNT = debit; negative (e.g. party on a sale) = credit
      };
    });

    // Invoice total = largest ledger-entry magnitude (the party/settlement line).
    const total =
      ledgerEntries.length > 0
        ? ledgerEntries.reduce((max, e) => Math.max(max, e.amount), 0)
        : absAmount(v['AMOUNT']);

    const partyName = text(v['PARTYLEDGERNAME']) || text(v['BASICBUYERNAME']) || text(v['PARTYNAME']);
    const narration = text(v['NARRATION']);

    const voucher: Voucher = {
      tallyGuid,
      voucherType: vType,
      voucherNumber,
      date: dateIso,
      amount: total,
      isCancelled: text(v['ISCANCELLED']).toLowerCase() === 'yes',
      items,
      ledgerEntries,
    };
    if (partyName) voucher.partyName = partyName;
    if (narration) voucher.narration = narration;

    out.push(voucher);
  }

  return out;
}
