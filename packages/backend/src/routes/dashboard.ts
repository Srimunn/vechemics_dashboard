import { Router, type Request, type Response } from 'express';
import type { CeoDashboardResponse, KpiSnapshot } from '@vchemics/shared';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';

export const dashboardRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

/** Map a Prisma KpiSnapshot row to the shared wire shape (Decimals -> numbers). */
function mapSnapshot(row: {
  snapshotDate: Date;
  todaySales: unknown; todayPurchase: unknown; todayGrossProfit: unknown; todayNetProfit: unknown;
  collectionsToday: unknown; outstandingReceivables: unknown; outstandingPayables: unknown;
  cashInHand: unknown; bankBalance: unknown; inventoryValue: unknown; gstPayable: unknown;
  mtdSales: unknown; mtdPurchase: unknown; ordersBilledToday: number; newCustomersToday: number;
}): KpiSnapshot {
  return {
    snapshotDate: row.snapshotDate.toISOString(),
    todaySales: num(row.todaySales),
    todayPurchase: num(row.todayPurchase),
    todayGrossProfit: num(row.todayGrossProfit),
    todayNetProfit: num(row.todayNetProfit),
    collectionsToday: num(row.collectionsToday),
    outstandingReceivables: num(row.outstandingReceivables),
    outstandingPayables: num(row.outstandingPayables),
    cashInHand: num(row.cashInHand),
    bankBalance: num(row.bankBalance),
    inventoryValue: num(row.inventoryValue),
    gstPayable: num(row.gstPayable),
    mtdSales: num(row.mtdSales),
    mtdPurchase: num(row.mtdPurchase),
    ordersBilledToday: row.ordersBilledToday,
    newCustomersToday: row.newCustomersToday,
  };
}

/**
 * GET /api/dashboard/ceo
 * Today + yesterday (for deltas) + last 7 snapshots (for sparklines) + last
 * sync + user + company. This is the single call the CEO Dashboard page makes.
 */
/**
 * GET /api/dashboard/ceo
 * Accepts optional query parameter ?date=YYYY-MM-DD
 * Today + yesterday (for deltas) + last 7 snapshots (for sparklines) + last
 * sync + user + company. This is the single call the CEO Dashboard page makes.
 */
dashboardRouter.get('/ceo', async (req: Request, res: Response) => {
  const companyId = await ensureCompanyId();
  const dateParam = typeof req.query.date === 'string' ? req.query.date.trim() : null;

  const [company, user, recent, lastSync] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.kpiSnapshot.findMany({
      where: { companyId },
      orderBy: { snapshotDate: 'desc' },
      take: 8, // today + up to 7 prior
    }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);

  const snapshots = recent.map(mapSnapshot);
  let today = snapshots[0] ?? null;
  const yesterday = snapshots[1] ?? null;
  // Oldest-first, up to 7, for sparkline rendering.
  const trend7d = snapshots.slice(0, 7).reverse();

  // If a specific date parameter is provided, calculate exact voucher metrics for that day
  if (dateParam && today) {
    const parsedDate = new Date(dateParam);
    if (!Number.isNaN(parsedDate.getTime())) {
      const dayStart = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));

      const [salesAggr, purchaseAggr, receiptAggr, billedCount] = await Promise.all([
        prisma.voucher.aggregate({
          where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: dayStart, lte: dayEnd } },
          _sum: { amount: true },
        }),
        prisma.voucher.aggregate({
          where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: dayStart, lte: dayEnd } },
          _sum: { amount: true },
        }),
        prisma.voucher.aggregate({
          where: { companyId, voucherType: 'Receipt', isCancelled: false, date: { gte: dayStart, lte: dayEnd } },
          _sum: { amount: true },
        }),
        prisma.voucher.count({
          where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: dayStart, lte: dayEnd } },
        }),
      ]);

      const specificSales = num(salesAggr._sum.amount);
      const specificPurchase = num(purchaseAggr._sum.amount);
      const specificCollections = num(receiptAggr._sum.amount);

      today = {
        ...today,
        snapshotDate: dayStart.toISOString(),
        todaySales: specificSales,
        todayPurchase: specificPurchase,
        collectionsToday: specificCollections,
        ordersBilledToday: billedCount,
      };
    }
  }

  const fyLabel = company
    ? `FY ${company.fyStart.getUTCFullYear()}-${String(company.fyEnd.getUTCFullYear()).slice(2)}`
    : 'FY 2026-27';

  // Feature 2: Last Sync timestamp hierarchy (Company.lastSyncAt > SyncLog > Snapshot)
  let syncFinishedAt: string | null = null;
  if (company?.lastSyncAt) {
    syncFinishedAt = company.lastSyncAt.toISOString();
  } else if (lastSync?.finishedAt) {
    syncFinishedAt = lastSync.finishedAt.toISOString();
  } else if (lastSync?.startedAt) {
    syncFinishedAt = lastSync.startedAt.toISOString();
  } else if (today?.snapshotDate) {
    syncFinishedAt = today.snapshotDate;
  }

  const body: CeoDashboardResponse = {
    today,
    yesterday,
    trend7d,
    lastSync: syncFinishedAt
      ? {
          finishedAt: syncFinishedAt,
          status: (lastSync?.status as 'success' | 'partial' | 'failed') ?? 'success',
        }
      : null,
    user: { name: user?.name ?? 'Velmurugan', role: user?.role ?? 'CEO / MD' },
    company: { displayName: company?.displayName ?? 'VChemics India Solutions', fyLabel },
  };

  res.json(body);
});
