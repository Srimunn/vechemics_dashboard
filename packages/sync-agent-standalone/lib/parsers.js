'use strict';

/**
 * Parsers for the ACTUAL TallyPrime 7.0 XML formats confirmed against real data.
 * Ported from the validated TypeScript agent (which passed fixture tests).
 *
 * Normalized output shapes (these are the "types", inline — no external deps):
 *
 * Ledger      = { name, parentGroup, openingBalance, currentBalance, isDebit, gstin?, state? }
 * StockItem   = { name, unit, closingQty, closingValue, avgCost, hsnCode?, gstRate? }
 * VoucherItem = { stockItemName, quantity, unit, rate, amount, gstRate?, hsnCode? }
 * LedgerEntry = { ledgerName, amount, isDebit }
 * Voucher     = { tallyGuid, voucherType, voucherNumber, date, partyName?, narration?,
 *                 amount, isCancelled, items:[VoucherItem], ledgerEntries:[LedgerEntry] }
 */

// --- primitive helpers -----------------------------------------------------

/** fast-xml-parser yields one object for a single child, an array for many. */
function toArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Extract text from a node that may be a string, number, or { '#text': ... }. */
function text(node) {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in node) return String(node['#text'] ?? '');
  return '';
}

/** Parse a Tally amount: handles Dr/Cr suffix, commas, and sign. */
function amount(node) {
  let s = text(node).trim();
  if (!s) return 0;
  let sign = 1;
  const upper = s.toUpperCase();
  if (upper.endsWith('CR')) {
    sign = -1;
    s = s.slice(0, -2);
  } else if (upper.endsWith('DR')) {
    sign = 1;
    s = s.slice(0, -2);
  }
  s = s.replace(/,/g, '').replace(/\s/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? sign * n : 0;
}

function absAmount(node) {
  return Math.abs(amount(node));
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Tally date ("YYYYMMDD" or "D-Mon-YYYY") -> ISO string, or undefined. */
function tallyDateToIso(node) {
  const s = text(node).trim();
  if (!s) return undefined;
  const m1 = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m1) return new Date(Date.UTC(+m1[1], +m1[2] - 1, +m1[3])).toISOString();
  const m2 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(s);
  if (m2) {
    const day = +m2[1];
    const mon = MONTHS[m2[2].toLowerCase()];
    let year = +m2[3];
    if (year < 100) year += 2000;
    if (mon !== undefined) return new Date(Date.UTC(year, mon, day)).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Recursively gather every value stored under `key`, anywhere in the tree,
 * flattening arrays. Makes parsers robust to the exact wrapper depth.
 */
function deepCollect(root, key) {
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === key) {
          for (const item of toArray(v)) out.push(item);
        } else {
          visit(v);
        }
      }
    }
  };
  visit(root);
  return out;
}

/** " 2.00 NOS" / "39.00 NOS" -> { quantity, unit }. */
function parseQtyUnit(raw) {
  const s = text(raw).trim();
  const m = /^(-?[\d,]*\.?\d+)\s*(.*)$/.exec(s);
  if (!m) return { quantity: 0, unit: '' };
  return { quantity: Number.parseFloat(m[1].replace(/,/g, '')) || 0, unit: (m[2] || '').trim() };
}

/** "1779.66/NOS" -> { rate, unit }. */
function parseRateUnit(raw) {
  const s = text(raw).trim();
  const parts = s.split('/');
  return {
    rate: Number.parseFloat((parts[0] || '').replace(/,/g, '')) || 0,
    unit: (parts[1] || '').trim(),
  };
}

// --- report parsers --------------------------------------------------------

const KNOWN_TYPES = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra'];

function normalizeVoucherType(raw) {
  const v = String(raw || '').trim().toLowerCase();
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

/**
 * Day Book / Voucher Register -> Voucher[]. Flat format: STOCKITEMNAME/RATE/
 * ACTUALQTY arrays are positionally aligned; the shared AMOUNT list splits into
 * (#stock) inventory amounts then (#ledger) ledger amounts, in document order.
 */
function parseVouchers(parsed, restrictTo) {
  const vouchers = deepCollect(parsed, 'VOUCHER');
  const out = [];
  for (const v of vouchers) {
    const rawType = v['@_VCHTYPE'] || text(v.VOUCHERTYPENAME);
    const vType = normalizeVoucherType(rawType);
    if (!vType) continue;
    if (restrictTo && vType !== restrictTo) continue;

    const voucherNumber = text(v.VOUCHERNUMBER);
    const dateIso = tallyDateToIso(v.DATE) || new Date().toISOString();
    const tallyGuid =
      v['@_VCHKEY'] || v['@_REMOTEID'] || text(v.GUID) || text(v.MASTERID) ||
      `${vType}:${voucherNumber}:${dateIso}`;

    const stockNames = toArray(v.STOCKITEMNAME);
    const rates = toArray(v.RATE);
    const qtys = toArray(v.ACTUALQTY);
    const ledgerNames = toArray(v.LEDGERNAME);
    const amounts = toArray(v.AMOUNT);
    const stockCount = stockNames.length;

    const items = stockNames.map((name, i) => {
      const r = parseRateUnit(rates[i]);
      const q = parseQtyUnit(qtys[i]);
      return {
        stockItemName: text(name),
        quantity: q.quantity,
        unit: q.unit || r.unit,
        rate: r.rate,
        amount: absAmount(amounts[i]),
      };
    });

    const ledgerEntries = ledgerNames.map((ln, j) => {
      const signed = amount(amounts[stockCount + j]);
      return { ledgerName: text(ln), amount: Math.abs(signed), isDebit: signed >= 0 };
    });

    const total = ledgerEntries.length
      ? ledgerEntries.reduce((mx, e) => Math.max(mx, e.amount), 0)
      : absAmount(v.AMOUNT);

    const voucher = {
      tallyGuid: String(tallyGuid),
      voucherType: vType,
      voucherNumber,
      date: dateIso,
      amount: total,
      isCancelled: text(v.ISCANCELLED).toLowerCase() === 'yes',
      items,
      ledgerEntries,
    };
    const party = text(v.PARTYLEDGERNAME) || text(v.BASICBUYERNAME) || text(v.PARTYNAME);
    const narration = text(v.NARRATION);
    if (party) voucher.partyName = party;
    if (narration) voucher.narration = narration;
    out.push(voucher);
  }
  return out;
}

/** Stock Summary -> StockItem[]. DSPACCNAME + DSPSTKINFO>DSPSTKCL pairs. */
function parseStockItems(parsed) {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const infos = deepCollect(parsed, 'DSPSTKINFO');
  const out = [];
  const count = Math.min(names.length, infos.length);
  for (let i = 0; i < count; i++) {
    const name = text(names[i].DSPDISPNAME);
    const closing = infos[i].DSPSTKCL;
    if (!name || !closing) continue;
    if (!text(closing.DSPCLAMTA).trim()) continue; // zero-stock item
    const q = parseQtyUnit(closing.DSPCLQTY);
    out.push({
      name,
      unit: q.unit,
      closingQty: q.quantity,
      closingValue: absAmount(closing.DSPCLAMTA),
      avgCost: Math.abs(amount(closing.DSPCLRATE)),
    });
  }
  return out;
}

/** Balance Sheet -> Ledger[] (group rows). BSNAME + BSAMT pairs. */
function parseBalanceSheet(parsed) {
  const names = deepCollect(parsed, 'BSNAME');
  const amts = deepCollect(parsed, 'BSAMT');
  const out = [];
  const count = Math.min(names.length, amts.length);
  for (let i = 0; i < count; i++) {
    const dsp = names[i].DSPACCNAME;
    const name = text(dsp && dsp.DSPDISPNAME);
    if (!name) continue;
    const bal = amount(text(amts[i].BSMAINAMT) || text(amts[i].BSSUBAMT));
    out.push({ name, parentGroup: 'Balance Sheet', openingBalance: 0, currentBalance: bal, isDebit: bal >= 0 });
  }
  return out;
}

/** Profit & Loss -> Ledger[] (line rows). DSPACCNAME + PLAMT pairs (signs kept). */
function parseProfitAndLoss(parsed) {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const amts = deepCollect(parsed, 'PLAMT');
  const out = [];
  const count = Math.min(names.length, amts.length);
  for (let i = 0; i < count; i++) {
    const name = text(names[i].DSPDISPNAME);
    if (!name) continue;
    const bal = amount(text(amts[i].BSMAINAMT) || text(amts[i].PLSUBAMT));
    out.push({ name, parentGroup: 'Profit & Loss', openingBalance: 0, currentBalance: bal, isDebit: bal >= 0 });
  }
  return out;
}

/**
 * Trial Balance -> Ledger[] (per-ledger closing balances).
 * BEST-EFFORT: the exact Trial Balance XML wasn't confirmed. This tolerates the
 * common display shapes (DSPACCNAME + DSPCLDRAMT/DSPCLCRAMT, or + BSMAINAMT) and
 * only emits rows that have both a name and a numeric amount — so an unexpected
 * shape yields an empty result rather than garbage. Verify against the saved
 * trial-balance sample and adjust if needed.
 */
function parseTrialBalance(parsed) {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const drs = deepCollect(parsed, 'DSPCLDRAMT');
  const crs = deepCollect(parsed, 'DSPCLCRAMT');
  const mains = deepCollect(parsed, 'BSMAINAMT');
  const out = [];
  for (let i = 0; i < names.length; i++) {
    const name = text(names[i].DSPDISPNAME) || text(names[i]);
    if (!name) continue;
    let bal;
    if (drs.length || crs.length) {
      const dr = absAmount(drs[i]);
      const cr = absAmount(crs[i]);
      if (!dr && !cr) continue;
      bal = dr - cr; // debit positive, credit negative
    } else if (mains.length) {
      const m = amount(mains[i]);
      if (!m) continue;
      bal = m;
    } else {
      continue;
    }
    out.push({ name, parentGroup: 'Trial Balance', openingBalance: 0, currentBalance: bal, isDebit: bal >= 0 });
  }
  return out;
}

module.exports = {
  toArray, text, amount, absAmount, tallyDateToIso, deepCollect, parseQtyUnit, parseRateUnit,
  parseVouchers, parseStockItems, parseBalanceSheet, parseProfitAndLoss, parseTrialBalance,
};
