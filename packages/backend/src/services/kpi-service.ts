import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/** Coerce a Prisma Decimal | number | null to a plain number. */
function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + days);
  return c;
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Recompute (and upsert) the KpiSnapshot for `date` from the raw data currently
 * in the DB. Called after each relevant ingest. Formulas follow spec section 9.
 * Everything defaults to 0 when the underlying data isn't present yet.
 */
export async function computeSnapshotForDate(companyId: string, date: Date): Promise<void> {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const monthStart = startOfMonth(date);

  const [
    ledgers,
    stockItems,
    outstandings,
    salesToday,
    purchaseToday,
    receiptsToday,
    salesMtd,
    purchaseMtd,
  ] = await Promise.all([
    prisma.ledger.findMany({ where: { companyId } }),
    prisma.stockItem.findMany({ where: { companyId } }),
    prisma.outstanding.findMany({ where: { companyId } }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
      include: { items: true },
    }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: 'Receipt', isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: monthStart, lt: dayEnd } },
    }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: monthStart, lt: dayEnd } },
    }),
  ]);

  // --- Ledger sources ----------------------------------------------------
  const STATEMENT_GROUPS = new Set(['Trial Balance', 'Balance Sheet', 'Profit & Loss']);
  const plLedgers = ledgers.filter((l) => l.parentGroup === 'Profit & Loss' || /profit.*loss/i.test(l.parentGroup));

  // Sum a balance category by matching name or parentGroup
  const categoryTotal = (re: RegExp): number => {
    const matches = ledgers.filter((l) => re.test(l.name) || re.test(l.parentGroup));
    return matches.reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  };

  // Signed value of a P&L line by name.
  const plValue = (re: RegExp): number => {
    const row = plLedgers.find((l) => re.test(l.name));
    return row ? num(row.currentBalance) : 0;
  };

  // --- Sales / Purchase / Collections (voucher-derived; daily) -----------
  const todaySales = salesToday.reduce((s, v) => s + num(v.amount), 0);
  const todayPurchase = purchaseToday.reduce((s, v) => s + num(v.amount), 0);
  const collectionsToday = receiptsToday.reduce((s, v) => s + num(v.amount), 0);

  const mtdSalesVouchers = salesMtd.reduce((s, v) => s + num(v.amount), 0);
  const mtdPurchaseVouchers = purchaseMtd.reduce((s, v) => s + num(v.amount), 0);

  const pnlSalesLedgers = ledgers.filter(
    (l) => /sales/i.test(l.name) && (l.parentGroup === 'Profit & Loss' || /profit.*loss/i.test(l.parentGroup)),
  );
  let mtdSales =
    pnlSalesLedgers.length > 0
      ? pnlSalesLedgers.reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0)
      : mtdSalesVouchers;

  const pnlPurchaseLedgers = ledgers.filter(
    (l) => /purchase/i.test(l.name) && (l.parentGroup === 'Profit & Loss' || /profit.*loss/i.test(l.parentGroup)),
  );
  let mtdPurchase =
    pnlPurchaseLedgers.length > 0
      ? pnlPurchaseLedgers.reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0)
      : mtdPurchaseVouchers;

  // --- Gross / Net profit ------------------------------------------------
  const avgCostByItem = new Map(stockItems.map((s) => [s.name, num(s.avgCost)]));
  let cogs = 0;
  for (const v of salesToday) {
    for (const it of v.items) {
      cogs += num(it.quantity) * (avgCostByItem.get(it.stockItemName) ?? 0);
    }
  }
  let todayGrossProfit = todaySales - cogs;
  let todayNetProfit = todayGrossProfit;

  if (plLedgers.length > 0) {
    const plSales = plValue(/^sales account|sales/i);
    const plDirectIncome = plValue(/income \(direct\)|direct income/i);
    const plCostOfSales = plValue(/cost of sales/i);
    const plPurchase = plValue(/purchase account|purchase/i);
    const plIndirect = plValue(/indirect exp|expenses \(indirect\)/i);
    todayGrossProfit = plSales + plDirectIncome + plCostOfSales;
    todayNetProfit = todayGrossProfit + plIndirect;
    if (plSales !== 0) mtdSales = Math.abs(plSales);
    if (plPurchase !== 0) mtdPurchase = Math.abs(plPurchase);
  } else {
    const indirectNames = new Set(
      ledgers.filter((l) => /indirect exp/i.test(l.parentGroup)).map((l) => l.name),
    );
    let mtdIndirect = 0;
    if (indirectNames.size > 0) {
      const entries = await prisma.voucherLedgerEntry.findMany({
        where: {
          ledgerName: { in: [...indirectNames] },
          isDebit: true,
          voucher: { companyId, isCancelled: false, date: { gte: monthStart, lt: dayEnd } },
        },
      });
      mtdIndirect = entries.reduce((s, e) => s + num(e.amount), 0);
    }
    todayNetProfit = todayGrossProfit - mtdIndirect / daysInMonth(date);
  }

  // --- Balances ---
  const cashInHand = categoryTotal(/cash.?in.?hand|^cash accounts?$|^cash$/i);
  const bankBalance = categoryTotal(/bank/i);

  // --- GST payable ---
  const gstNamed = ledgers.filter((l) => /output|input/i.test(l.name) && /gst/i.test(l.name));
  let gstPayable;
  if (gstNamed.length > 0) {
    gstPayable =
      gstNamed.filter((l) => /output/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0) -
      gstNamed.filter((l) => /input/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  } else {
    const dutiesGroup = categoryTotal(/duties.*tax|^gst$/i);
    if (dutiesGroup !== 0) {
      gstPayable = Math.abs(dutiesGroup);
    } else {
      const gstEntries = await prisma.voucherLedgerEntry.findMany({
        where: {
          ledgerName: { contains: 'GST', mode: 'insensitive' },
          voucher: { companyId, isCancelled: false, date: { gte: monthStart, lt: dayEnd } },
        },
        select: { ledgerName: true, amount: true },
      });
      const output = gstEntries.filter((e) => /output/i.test(e.ledgerName)).reduce((s, e) => s + num(e.amount), 0);
      const input = gstEntries.filter((e) => /input/i.test(e.ledgerName)).reduce((s, e) => s + num(e.amount), 0);
      gstPayable = output - input;
    }
  }

  // --- Outstandings ---
  let outstandingReceivables = outstandings
    .filter((o) => o.type === 'receivable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingReceivables === 0) {
    outstandingReceivables = categoryTotal(/sundry debtor|account.?receivable|receivable/i);
  }

  let outstandingPayables = outstandings
    .filter((o) => o.type === 'payable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingPayables === 0) {
    outstandingPayables = categoryTotal(/sundry creditor|account.?payable|payable/i);
  }

  const inventoryValue = stockItems.reduce((s, i) => s + num(i.closingValue), 0);

  // --- Counts ---
  const ordersBilledToday = new Set(salesToday.map((v) => v.voucherNumber)).size;

  const todaysParties = [...new Set(salesToday.map((v) => v.partyName).filter(Boolean))] as string[];
  let newCustomersToday = 0;
  if (todaysParties.length > 0) {
    const priorParties = await prisma.voucher.findMany({
      where: {
        companyId,
        voucherType: 'Sales',
        partyName: { in: todaysParties },
        date: { lt: dayStart },
      },
      select: { partyName: true },
      distinct: ['partyName'],
    });
    const priorSet = new Set(priorParties.map((p) => p.partyName));
    newCustomersToday = todaysParties.filter((p) => !priorSet.has(p)).length;
  }

  const values = {
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

  await prisma.kpiSnapshot.upsert({
    where: { companyId_snapshotDate: { companyId, snapshotDate: dayStart } },
    update: values,
    create: { companyId, snapshotDate: dayStart, ...values },
  });

  logger.debug({ companyId, date: dayStart.toISOString(), todaySales }, 'KPI snapshot recomputed');
}

/** Recompute today's snapshot. Convenience wrapper called after ingests. */
export async function recomputeTodaySnapshot(companyId: string): Promise<void> {
  await computeSnapshotForDate(companyId, new Date());
}
