import type { Voucher, VoucherItem, VoucherLedgerEntry, VoucherType } from '@vchemics/shared';
import { toArray, text, absAmount, tallyDateToIso } from '../parsers.js';

/**
 * Turn a parsed Tally "Export Data" response (Day Book / Voucher Register) into
 * normalized Voucher[]. BEST-EFFORT until validated against real ./samples XML —
 * the field paths below reflect the common TallyPrime shape:
 *
 *   ENVELOPE > BODY > DATA > TALLYMESSAGE[] > VOUCHER
 *     VOUCHER @_VCHTYPE, GUID, DATE, VOUCHERNUMBER, PARTYLEDGERNAME, NARRATION,
 *             ISCANCELLED,
 *       ALLLEDGERENTRIES.LIST[]   -> LEDGERNAME, AMOUNT, ISDEEMEDPOSITIVE
 *       ALLINVENTORYENTRIES.LIST[]-> STOCKITEMNAME, ACTUALQTY, RATE, AMOUNT, ...
 */

const KNOWN_TYPES: VoucherType[] = [
  'Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra',
];

function normalizeVoucherType(raw: string): VoucherType | null {
  const v = raw.trim().toLowerCase();
  const hit = KNOWN_TYPES.find((t) => t.toLowerCase() === v);
  if (hit) return hit;
  // Common Tally aliases.
  if (v.includes('sale')) return 'Sales';
  if (v.includes('purchase')) return 'Purchase';
  if (v.includes('receipt')) return 'Receipt';
  if (v.includes('payment')) return 'Payment';
  if (v.includes('journal')) return 'Journal';
  if (v.includes('contra')) return 'Contra';
  return null;
}

/** Parse a Tally quantity string like "5.000 kg" or "-2 Nos" -> {quantity, unit}. */
function parseQty(raw: string): { quantity: number; unit: string } {
  const s = text(raw).trim();
  const m = /^(-?[\d,]*\.?\d+)\s*(.*)$/.exec(s);
  if (!m) return { quantity: 0, unit: '' };
  return {
    quantity: Number.parseFloat(m[1]!.replace(/,/g, '')) || 0,
    unit: (m[2] ?? '').trim(),
  };
}

/** Parse a Tally rate string like "100.00/kg" -> 100. */
function parseRate(raw: string): number {
  const s = text(raw).trim().split('/')[0] ?? '';
  return Number.parseFloat(s.replace(/,/g, '')) || 0;
}

function parseLedgerEntries(voucher: Record<string, unknown>): VoucherLedgerEntry[] {
  const listNode =
    (voucher['ALLLEDGERENTRIES.LIST'] as unknown) ??
    (voucher['LEDGERENTRIES.LIST'] as unknown);
  return toArray(listNode as Record<string, unknown>[]).map((e) => ({
    ledgerName: text(e['LEDGERNAME']),
    amount: absAmount(e['AMOUNT']),
    isDebit: text(e['ISDEEMEDPOSITIVE']).toLowerCase() === 'yes',
  }));
}

function parseInventoryItems(voucher: Record<string, unknown>): VoucherItem[] {
  const listNode = voucher['ALLINVENTORYENTRIES.LIST'] as unknown;
  return toArray(listNode as Record<string, unknown>[]).map((it) => {
    const { quantity, unit } = parseQty(
      text(it['ACTUALQTY']) || text(it['BILLEDQTY']),
    );
    const gst = text(it['GSTRATE'] ?? it['RATEOFGST']);
    const item: VoucherItem = {
      stockItemName: text(it['STOCKITEMNAME']),
      quantity,
      unit,
      rate: parseRate(text(it['RATE'])),
      amount: absAmount(it['AMOUNT']),
    };
    const gstNum = Number.parseFloat(gst);
    if (Number.isFinite(gstNum)) item.gstRate = gstNum;
    const hsn = text(it['HSNCODE'] ?? it['GSTHSNNAME']);
    if (hsn) item.hsnCode = hsn;
    return item;
  });
}

/** Amount for the voucher: magnitude of the largest ledger entry (invoice total). */
function voucherAmount(entries: VoucherLedgerEntry[], voucher: Record<string, unknown>): number {
  if (entries.length > 0) {
    return entries.reduce((max, e) => Math.max(max, e.amount), 0);
  }
  return absAmount(voucher['AMOUNT']);
}

export function parseVouchers(parsed: unknown, restrictTo?: VoucherType): Voucher[] {
  const root = parsed as Record<string, unknown> | undefined;
  const data = (root?.['ENVELOPE'] as Record<string, unknown> | undefined)?.['BODY'];
  const dataNode = (data as Record<string, unknown> | undefined)?.['DATA'] ?? data;
  const messages = toArray(
    (dataNode as Record<string, unknown> | undefined)?.['TALLYMESSAGE'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  );

  const out: Voucher[] = [];
  for (const msg of messages) {
    const v = msg['VOUCHER'] as Record<string, unknown> | undefined;
    if (!v) continue;

    const rawType = (v['@_VCHTYPE'] as string) || text(v['VOUCHERTYPENAME']);
    const vType = normalizeVoucherType(rawType);
    if (!vType) continue;
    if (restrictTo && vType !== restrictTo) continue;

    const tallyGuid = text(v['GUID']) || text(v['MASTERID']) || text(v['VOUCHERKEY']);
    if (!tallyGuid) continue; // no dedup key -> skip rather than duplicate

    const ledgerEntries = parseLedgerEntries(v);
    const items = parseInventoryItems(v);
    const date = tallyDateToIso(v['DATE']) ?? new Date().toISOString();
    const partyName = text(v['PARTYLEDGERNAME']) || text(v['PARTYNAME']) || undefined;
    const narration = text(v['NARRATION']) || undefined;

    const voucher: Voucher = {
      tallyGuid,
      voucherType: vType,
      voucherNumber: text(v['VOUCHERNUMBER']),
      date,
      amount: voucherAmount(ledgerEntries, v),
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
