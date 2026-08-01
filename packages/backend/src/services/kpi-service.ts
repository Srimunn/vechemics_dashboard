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
  // Ledger rows arrive from statement exports, distinguished by parentGroup:
  //   'Trial Balance' -> one row per account group; `name` IS the group name
  //   'Profit & Loss' -> one row per P&L line (signed as Tally exports them)
  //   'Balance Sheet' -> top-level group totals
  //   anything else   -> real individual ledgers (from a List of Ledgers sync)
  const STATEMENT_GROUPS = new Set(['Trial Balance', 'Balance Sheet', 'Profit & Loss']);
  const plLedgers = ledgers.filter((l) => l.parentGroup === 'Profit & Loss');

  // Sum a balance category, preferring real per-ledger rows (matched on their
  // parentGroup), else Trial Balance group rows (matched on their name).
  const categoryTotal = (re: RegExp): number => {
    const real = ledgers.filter((l) => !STATEMENT_GROUPS.has(l.parentGroup) && re.test(l.parentGroup));
    if (real.length > 0) return real.reduce((s, l) => s + num(l.currentBalance), 0);
    const tb = ledgers.filter((l) => l.parentGroup === 'Trial Balance' && re.test(l.name));
    return tb.reduce((s, l) => s + num(l.currentBalance), 0);
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
  let mtdSales = salesMtd.reduce((s, v) => s + num(v.amount), 0);
  let mtdPurchase = purchaseMtd.reduce((s, v) => s + num(v.amount), 0);

  // --- Gross / Net profit ------------------------------------------------
  // Default: voucher-derived (sales - COGS). When P&L data is present, use it
  // as the authoritative source (per spec): Gross = Sales + Direct Income +
  // Cost of Sales (signs preserved, cost is negative); Net = Gross + Indirect
  // Expenses (indirect is negative). MTD sales/purchase also come from P&L.
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
    const plSales = plValue(/^sales account/i);
    const plDirectIncome = plValue(/income \(direct\)|direct income/i);
    const plCostOfSales = plValue(/cost of sales/i);
    const plPurchase = plValue(/purchase account/i);
    const plIndirect = plValue(/indirect exp|expenses \(indirect\)/i);
    todayGrossProfit = plSales + plDirectIncome + plCostOfSales;
    todayNetProfit = todayGrossProfit + plIndirect;
    mtdSales = Math.abs(plSales);
    mtdPurchase = Math.abs(plPurchase);
  } else {
    // No P&L: pro-rate indirect expenses from this month's voucher entries.
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

  // --- Balances (Trial Balance groups, or real ledgers). Shown as magnitudes.
  const cashInHand = Math.abs(categoryTotal(/cash.?in.?hand|^cash accounts?$/i));
  const bankBalance = Math.abs(categoryTotal(/bank/i));

  // --- GST payable: output - input ledgers, else the Duties & Taxes net -----
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

  // --- Outstandings (bills reports, else Trial Balance groups) & inventory --
  let outstandingReceivables = outstandings
    .filter((o) => o.type === 'receivable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingReceivables === 0) {
    outstandingReceivables = Math.abs(categoryTotal(/sundry debtor|account.?receivable|receivable/i));
  }
  let outstandingPayables = outstandings
    .filter((o) => o.type === 'payable')
    .reduce((s, o) => s + num(o.pendingAmount), 0);
  if (outstandingPayables === 0) {
    outstandingPayables = Math.abs(categoryTotal(/sundry creditor|account.?payable|payable/i));
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
