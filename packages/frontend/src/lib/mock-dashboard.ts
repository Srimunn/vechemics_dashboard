import type { CeoDashboardResponse, KpiSnapshot } from '@vchemics/shared';

/**
 * Bundled sample dashboard data so the UI renders without a backend (demo /
 * design-preview mode). Used when NEXT_PUBLIC_USE_MOCK === 'true' or as a
 * fallback if the backend is unreachable.
 */

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function snap(offset: number, sales: number): KpiSnapshot {
  const grossProfit = Math.round(sales * 0.225);
  return {
    snapshotDate: daysAgo(offset),
    todaySales: sales,
    todayPurchase: Math.round(sales * 0.7),
    todayGrossProfit: grossProfit,
    todayNetProfit: Math.round(grossProfit - 7000),
    collectionsToday: Math.round(sales * 0.55),
    outstandingReceivables: 4_218_400,
    outstandingPayables: 2_806_900,
    cashInHand: 356_200,
    bankBalance: 6_512_800,
    inventoryValue: 8_804_500,
    gstPayable: 243_600,
    mtdSales: 24_600_000 + (7 - offset) * sales,
    mtdPurchase: 17_200_000,
    ordersBilledToday: 12 + (offset % 7),
    newCustomersToday: offset % 3,
  };
}

const trend: KpiSnapshot[] = [
  snap(6, 1_540_000),
  snap(5, 1_610_000),
  snap(4, 1_486_000),
  snap(3, 1_702_000),
  snap(2, 1_648_000),
  snap(1, 1_642_800),
  snap(0, 1_846_500),
];

export const mockDashboard: CeoDashboardResponse = {
  today: trend[trend.length - 1]!,
  yesterday: trend[trend.length - 2]!,
  trend7d: trend,
  lastSync: { finishedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(), status: 'success' },
  user: { name: 'Velmurugan', role: 'CEO / MD' },
  company: { displayName: 'VChemics India Solutions', fyLabel: 'FY 2026-27' },
};
