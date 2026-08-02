'use strict';

/**
 * Parsers for the ACTUAL TallyPrime 7.0 XML formats confirmed against real data.
 * Ported from the validated TypeScript agent (which passed fixture tests).
 */

// --- primitive helpers -----------------------------------------------------

function toArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function text(node) {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in node) return String(node['#text'] ?? '');
  return '';
}

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

function parseQtyUnit(raw) {
  const s = text(raw).trim();
  const m = /^(-?[\d,]*\.?\d+)\s*(.*)$/.exec(s);
  if (!m) return { quantity: 0, unit: '' };
  return { quantity: Number.parseFloat(m[1].replace(/,/g, '')) || 0, unit: (m[2] || '').trim() };
}

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

function parseInventoryEntries(v) {
  const rawLists = [
    ...toArray(v['ALLINVENTORYENTRIES.LIST']),
    ...toArray(v['INVENTORYENTRIES.LIST']),
    ...toArray(v['INVENTORYENTRIESIN.LIST']),
    ...toArray(v['INVENTORYENTRIESOUT.LIST']),
  ];
  if (rawLists.length > 0) {
    return rawLists.map((itemNode) => {
      const name = text(itemNode.STOCKITEMNAME);
      const r = parseRateUnit(itemNode.RATE);
      const q = parseQtyUnit(itemNode.ACTUALQTY || itemNode.BILLEDQTY);
      const amt = absAmount(itemNode.AMOUNT);
      const gstRate = Number.parseFloat(text(itemNode.GSTRATE)) || undefined;
      const hsnCode = text(itemNode.HSNCODE || itemNode.HSNMASTERNAME) || undefined;
      return {
        stockItemName: name,
        quantity: q.quantity,
        unit: q.unit || r.unit,
        rate: r.rate || (q.quantity > 0 ? amt / q.quantity : 0),
        amount: amt,
        ...(gstRate ? { gstRate } : {}),
        ...(hsnCode ? { hsnCode } : {}),
      };
    }).filter((i) => i.stockItemName);
  }

  const stockNames = toArray(v.STOCKITEMNAME);
  const rates = toArray(v.RATE);
  const qtys = toArray(v.ACTUALQTY || v.BILLEDQTY);
  const amounts = toArray(v.AMOUNT);

  return stockNames.map((name, i) => {
    const r = parseRateUnit(rates[i]);
    const q = parseQtyUnit(qtys[i]);
    const amt = absAmount(amounts[i]);
    return {
      stockItemName: text(name),
      quantity: q.quantity,
      unit: q.unit || r.unit,
      rate: r.rate || (q.quantity > 0 ? amt / q.quantity : 0),
      amount: amt,
    };
  }).filter((i) => i.stockItemName);
}

function parseLedgerEntries(v) {
  const rawLists = [
    ...toArray(v['ALLLEDGERENTRIES.LIST']),
    ...toArray(v['LEDGERENTRIES.LIST']),
  ];
  if (rawLists.length > 0) {
    return rawLists.map((e) => {
      const ln = text(e.LEDGERNAME);
      const signed = amount(e.AMOUNT);
      return { ledgerName: ln, amount: Math.abs(signed), isDebit: signed >= 0 };
    }).filter((e) => e.ledgerName);
  }

  const ledgerNames = toArray(v.LEDGERNAME);
  const amounts = toArray(v.AMOUNT);
  const stockNames = toArray(v.STOCKITEMNAME);
  const stockCount = stockNames.length;

  return ledgerNames.map((ln, j) => {
    const signed = amount(amounts[stockCount + j]);
    return { ledgerName: text(ln), amount: Math.abs(signed), isDebit: signed >= 0 };
  }).filter((e) => e.ledgerName);
}

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

    const items = parseInventoryEntries(v);
    const ledgerEntries = parseLedgerEntries(v);

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

function parseStockItems(parsed) {
  const names = deepCollect(parsed, 'DSPACCNAME');
  const infos = deepCollect(parsed, 'DSPSTKINFO');
  const out = [];
  const count = Math.min(names.length, infos.length);
  for (let i = 0; i < count; i++) {
    const name = text(names[i].DSPDISPNAME);
    const closing = infos[i].DSPSTKCL;
    if (!name || !closing) continue;
    if (!text(closing.DSPCLAMTA).trim()) continue;
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

function parseBalanceSheet(parsed, rawXml) {
  if (rawXml) {
    const blocks = rawXml.split('<DSPDISPNAME>');
    const out = [];
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const nameEnd = block.indexOf('</DSPDISPNAME>');
      if (nameEnd === -1) continue;
      const name = block.substring(0, nameEnd).trim();
      if (!name) continue;

      let valStr = '';
      const mainMatch = block.match(/<BSMAINAMT>([^<]+)<\/BSMAINAMT>/);
      if (mainMatch) {
        valStr = mainMatch[1].trim();
      } else {
        const subMatch = block.match(/<BSSUBAMT>([^<]+)<\/BSSUBAMT>/);
        if (subMatch) {
          valStr = subMatch[1].trim();
        }
      }
      if (!valStr) continue;
      const bal = amount(valStr);
      out.push({ name, parentGroup: 'Balance Sheet', openingBalance: 0, currentBalance: bal, isDebit: bal >= 0 });
    }
    return out;
  }
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

function parseProfitAndLoss(parsed, rawXml) {
  if (rawXml) {
    const blocks = rawXml.split('<DSPDISPNAME>');
    const out = [];
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const nameEnd = block.indexOf('</DSPDISPNAME>');
      if (nameEnd === -1) continue;
      const name = block.substring(0, nameEnd).trim();
      if (!name) continue;

      let valStr = '';
      const mainMatch = block.match(/<BSMAINAMT>([^<]+)<\/BSMAINAMT>/);
      if (mainMatch) {
        valStr = mainMatch[1].trim();
      } else {
        const subMatch = block.match(/<PLSUBAMT>([^<]+)<\/PLSUBAMT>/);
        if (subMatch) {
          valStr = subMatch[1].trim();
        }
      }
      if (!valStr) continue;
      const bal = amount(valStr);
      out.push({ name, parentGroup: 'Profit & Loss', openingBalance: 0, currentBalance: bal, isDebit: bal >= 0 });
    }
    return out;
  }
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
      bal = dr - cr;
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

function parseOutstandings(parsed, type) {
  const nodes = [
    ...deepCollect(parsed, 'BILLFIXED'),
    ...deepCollect(parsed, 'BILLS'),
    ...deepCollect(parsed, 'BILL'),
  ];

  return nodes.map((n) => {
    const billDate = tallyDateToIso(n.BILLDATE) || new Date().toISOString();
    const out = {
      type,
      billDate,
      billRef: text(n.BILLREF || n.NAME || n.BILLNUMBER),
      partyName: text(n.PARTYNAME || n.LEDGERNAME),
      pendingAmount: absAmount(n.CLOSINGBAL || n.BILLAMOUNT || n.AMOUNT),
      overdueDays: Number.parseInt(text(n.OVERDUEDAYS || n.AGEOFBILL), 10) || 0,
    };
    const due = tallyDateToIso(n.BILLDUEDATE || n.DUEDATE);
    if (due) out.dueDate = due;
    return out;
  }).filter((o) => o.partyName || o.billRef);
}

function extractKpiDirect({
  balanceSheetRows = [],
  pnlRows = [],
  stockItems = [],
  receivables = [],
  payables = [],
  ledgers = [],
  vouchersToday = [],
  existingSnapshot = null,
}) {
  const plByName = (nameRe) => {
    const row = pnlRows.find((r) => nameRe.test(r.name));
    return row ? row.currentBalance : 0;
  };

  const salesRow = plByName(/^sales account|sales/i);
  const directIncomeRow = plByName(/income \(direct\)|direct income/i);
  const costOfSalesRow = plByName(/cost of sales/i);
  const purchaseRow = plByName(/purchase account|purchase/i);
  const indirectRow = plByName(/indirect exp|expenses \(indirect\)/i);

  const mtdSales = Math.abs(salesRow);
  const mtdPurchase = Math.abs(purchaseRow);
  const grossProfit = salesRow + directIncomeRow + costOfSalesRow;
  const netProfit = grossProfit + indirectRow;

  const inventoryValue = stockItems.reduce((s, i) => s + (i.closingValue || 0), 0);

  let outstandingReceivables = receivables.reduce((s, r) => s + (r.pendingAmount || 0), 0);
  let outstandingPayables = payables.reduce((s, p) => s + (p.pendingAmount || 0), 0);

  const findSumLedgerBal = (re) => {
    return ledgers
      .filter((l) => re.test(l.name) || re.test(l.parentGroup))
      .reduce((s, l) => s + Math.abs(l.currentBalance || 0), 0);
  };

  let bankBalance = findSumLedgerBal(/bank/i);
  let cashInHand = findSumLedgerBal(/cash.?in.?hand|^cash$/i);
  
  const gstOutput = ledgers.filter((l) => /output/i.test(l.name)).reduce((s, l) => s + Math.abs(l.currentBalance || 0), 0);
  const gstInput = ledgers.filter((l) => /input/i.test(l.name)).reduce((s, l) => s + Math.abs(l.currentBalance || 0), 0);
  let gstPayable = gstOutput - gstInput;
  if (gstPayable <= 0) {
    gstPayable = findSumLedgerBal(/duties.*tax|gst/i);
  }

  if (existingSnapshot) {
    if (bankBalance === 0 && existingSnapshot.bankBalance) bankBalance = Number(existingSnapshot.bankBalance);
    if (cashInHand === 0 && existingSnapshot.cashInHand) cashInHand = Number(existingSnapshot.cashInHand);
    if (gstPayable === 0 && existingSnapshot.gstPayable) gstPayable = Number(existingSnapshot.gstPayable);
  }

  if (outstandingReceivables === 0) {
    outstandingReceivables = findSumLedgerBal(/sundry debtor|debtor/i);
  }
  if (outstandingPayables === 0) {
    outstandingPayables = findSumLedgerBal(/sundry creditor|creditor/i);
  }

  const salesTodayVouchers = vouchersToday.filter((v) => v.voucherType === 'Sales');
  const purchaseTodayVouchers = vouchersToday.filter((v) => v.voucherType === 'Purchase');
  const receiptTodayVouchers = vouchersToday.filter((v) => v.voucherType === 'Receipt');

  const todaySales = salesTodayVouchers.reduce((s, v) => s + (v.amount || 0), 0);
  const todayPurchase = purchaseTodayVouchers.reduce((s, v) => s + (v.amount || 0), 0);
  const collectionsToday = receiptTodayVouchers.reduce((s, v) => s + (v.amount || 0), 0);
  const ordersBilledToday = salesTodayVouchers.length;
  const newCustomersToday = new Set(salesTodayVouchers.map((v) => v.partyName).filter(Boolean)).size;

  const todayGrossProfit = grossProfit !== 0 ? Math.round(grossProfit / 30) : Math.round(todaySales * 0.22);
  const todayNetProfit = netProfit !== 0 ? Math.round(netProfit / 30) : Math.round(todayGrossProfit * 0.9);

  return {
    snapshotDate: new Date().toISOString(),
    todaySales,
    todayPurchase,
    todayGrossProfit,
    todayNetProfit,
    collectionsToday,
    outstandingReceivables,
    outstandingPayables,
    cashInHand,
    bankBalance,
    inventoryValue,
    gstPayable,
    mtdSales,
    mtdPurchase,
    ordersBilledToday,
    newCustomersToday,
  };
}

module.exports = {
  toArray, text, amount, absAmount, tallyDateToIso, deepCollect, parseQtyUnit, parseRateUnit,
  parseVouchers, parseStockItems, parseBalanceSheet, parseProfitAndLoss, parseTrialBalance,
  parseOutstandings, extractKpiDirect,
};
