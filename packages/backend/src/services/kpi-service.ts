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

  // --- Sales / Purchase / Collections ---
  const todaySales = salesToday.reduce((s, v) => s + num(v.amount), 0);
  const todayPurchase = purchaseToday.reduce((s, v) => s + num(v.amount), 0);
  const collectionsToday = receiptsToday.reduce((s, v) => s + num(v.amount), 0);
  const mtdSales = salesMtd.reduce((s, v) => s + num(v.amount), 0);
  const mtdPurchase = purchaseMtd.reduce((s, v) => s + num(v.amount), 0);

  // --- Gross profit: sales - COGS (qty * weighted-avg cost) ---
  const avgCostByItem = new Map(stockItems.map((s) => [s.name, num(s.avgCost)]));
  let cogs = 0;
  for (const v of salesToday) {
    for (const it of v.items) {
      cogs += num(it.quantity) * (avgCostByItem.get(it.stockItemName) ?? 0);
    }
  }
  const todayGrossProfit = todaySales - cogs;

  // --- Net profit: gross - pro-rated indirect expenses (MTD/day) ---
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
  const proratedIndirect = mtdIndirect / daysInMonth(date);
  const todayNetProfit = todayGrossProfit - proratedIndirect;

  // --- Balances from ledgers ---
  const cashInHand = ledgers
    .filter((l) => /cash-?in-?hand/i.test(l.parentGroup) || /^cash$/i.test(l.parentGroup))
    .reduce((s, l) => s + num(l.currentBalance), 0);
  const bankBalance = ledgers
    .filter((l) => /bank/i.test(l.parentGroup))
    .reduce((s, l) => s + num(l.currentBalance), 0);

  // --- GST payable: output GST - input GST ---
  // Primary source is Duties & Taxes ledger balances (from ledger-list). The
  // /gst/i test matches the real Tally names "OUTPUT CGST @ 9%" / "OUTPUT SGST
  // @9%" / IGST via the GST substring inside C/S/IGST.
  const gstLedgers = ledgers.filter(
    (l) => /duties.*tax/i.test(l.parentGroup) || /gst/i.test(l.name),
  );
  let gstPayable =
    gstLedgers.filter((l) => /output/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0) -
    gstLedgers.filter((l) => /input/i.test(l.name)).reduce((s, l) => s + Math.abs(num(l.currentBalance)), 0);

  // Fallback: when no GST ledger balances are present, derive from this month's
  // voucher GST entries (OUTPUT vs INPUT), which the confirmed Tally voucher
  // format exposes as ledger entries like "OUTPUT CGST @ 9%".
  if (gstLedgers.length === 0) {
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

  // --- Outstandings & inventory ---
  const outstandingReceivables = outstandings
    .filter((o) => o.type === 'receivable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  const outstandingPayables = outstandings
    .filter((o) => o.type === 'payable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
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
