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
dashboardRouter.get('/ceo', async (_req: Request, res: Response) => {
  const companyId = await ensureCompanyId();

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
  const today = snapshots[0] ?? null;
  const yesterday = snapshots[1] ?? null;
  // Oldest-first, up to 7, for sparkline rendering.
  const trend7d = snapshots.slice(0, 7).reverse();

  const fyLabel = company
    ? `FY ${company.fyStart.getUTCFullYear()}-${String(company.fyEnd.getUTCFullYear()).slice(2)}`
    : 'FY 2026-27';

  const body: CeoDashboardResponse = {
    today,
    yesterday,
    trend7d,
    lastSync: lastSync
      ? {
          finishedAt: (lastSync.finishedAt ?? lastSync.startedAt).toISOString(),
          status: lastSync.status as 'success' | 'partial' | 'failed',
        }
      : null,
    user: { name: user?.name ?? 'Velmurugan', role: user?.role ?? 'CEO / MD' },
    company: { displayName: company?.displayName ?? 'VChemics India Solutions', fyLabel },
  };

  res.json(body);
});
