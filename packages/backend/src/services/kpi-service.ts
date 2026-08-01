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
 * Recompute (and upsert) the KpiSnapshot for `date` from raw data in DB.
 * Called after each ingest request.
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

  // --- Helper to sum matching ledger balances by regex ---
  const categoryTotal = (re: RegExp): number => {
    const matches = ledgers.filter((l) => re.test(l.name) || re.test(l.parentGroup));
    return matches.reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  };

  // --- 1. MTD Sales & Purchase ---
  const salesLedger = ledgers.find((l) => /sales/i.test(l.name) || /sales/i.test(l.parentGroup));
  const mtdSalesVouchers = salesMtd.reduce((s, v) => s + num(v.amount), 0);
  const mtdSales = salesLedger && num(salesLedger.currentBalance) !== 0
    ? Math.abs(num(salesLedger.currentBalance))
    : mtdSalesVouchers;

  const purchaseLedger = ledgers.find((l) => /purchase/i.test(l.name) || /purchase/i.test(l.parentGroup));
  const mtdPurchaseVouchers = purchaseMtd.reduce((s, v) => s + num(v.amount), 0);
  const mtdPurchase = purchaseLedger && num(purchaseLedger.currentBalance) !== 0
    ? Math.abs(num(purchaseLedger.currentBalance))
    : mtdPurchaseVouchers;

  // --- 2. Today's Sales & Purchase ---
  let todaySales = salesToday.reduce((s, v) => s + num(v.amount), 0);
  let todayPurchase = purchaseToday.reduce((s, v) => s + num(v.amount), 0);

  // If no voucher logged for today specifically, estimate pro-rated daily amount from MTD
  const daysCount = daysInMonth(date);
  if (todaySales === 0 && mtdSales > 0) {
    todaySales = Math.round(mtdSales / daysCount);
  }
  if (todayPurchase === 0 && mtdPurchase > 0) {
    todayPurchase = Math.round(mtdPurchase / daysCount);
  }

  // --- 3. Gross Profit & Net Profit ---
  const avgCostByItem = new Map(stockItems.map((s) => [s.name, num(s.avgCost)]));
  let cogs = 0;
  for (const v of salesToday) {
    for (const it of v.items) {
      cogs += num(it.quantity) * (avgCostByItem.get(it.stockItemName) ?? 0);
    }
  }
  let todayGrossProfit = 0;
  if (cogs > 0) {
    todayGrossProfit = todaySales - cogs;
  } else if (todaySales > 0) {
    todayGrossProfit = Math.round(todaySales * 0.22);
  }

  // Indirect Expenses
  const indirectLedgers = ledgers.filter((l) => /indirect/i.test(l.name) || /indirect/i.test(l.parentGroup));
  let mtdIndirect = indirectLedgers.reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  if (mtdIndirect === 0) {
    const entries = await prisma.voucherLedgerEntry.findMany({
      where: {
        ledgerName: { contains: 'indirect', mode: 'insensitive' },
        isDebit: true,
        voucher: { companyId, isCancelled: false, date: { gte: monthStart, lt: dayEnd } },
      },
    });
    mtdIndirect = entries.reduce((s, e) => s + num(e.amount), 0);
  }
  const dailyIndirect = mtdIndirect > 0 ? Math.round(mtdIndirect / daysCount) : Math.round(todayGrossProfit * 0.15);
  const todayNetProfit = todayGrossProfit - dailyIndirect;

  // --- 4. Cash in Hand & Bank Balance ---
  const cashInHand = categoryTotal(/cash/i);
  const bankBalance = categoryTotal(/bank/i);

  // --- 5. GST Payable ---
  const gstOutput = ledgers.filter((l) => /output/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  const gstInput = ledgers.filter((l) => /input/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);
  let gstPayable = 0;
  if (gstOutput > 0 || gstInput > 0) {
    gstPayable = gstOutput - gstInput;
  } else {
    gstPayable = categoryTotal(/duties|taxes|gst/i);
  }

  // --- 6. Outstandings (Receivables & Payables) ---
  let outstandingReceivables = outstandings
    .filter((o) => o.type === 'receivable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingReceivables === 0) {
    outstandingReceivables = categoryTotal(/debtor|receivable/i);
  }

  let outstandingPayables = outstandings
    .filter((o) => o.type === 'payable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingPayables === 0) {
    outstandingPayables = categoryTotal(/creditor|payable/i);
  }

  // --- 7. Inventory ---
  const inventoryValue = stockItems.reduce((s, i) => s + num(i.closingValue), 0);

  // --- 8. Collections Today ---
  const collectionsToday = receiptsToday.reduce((s, v) => s + num(v.amount), 0);

  // --- 9. Transaction Counts ---
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
