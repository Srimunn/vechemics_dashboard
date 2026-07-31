import type { KpiSnapshot } from '@vchemics/shared';
import type { MonthPoint } from '@/components/dashboard/SalesPurchaseChart';
import type { CashPoint } from '@/components/dashboard/CashFlowChart';

/**
 * The CEO dashboard endpoint ships daily KPI snapshots (last 7 days). The two
 * secondary charts want 12 months and 30 days. Until the backend exposes those
 * series directly (Phase 2), derive plausible, deterministic illustrative data
 * anchored on the latest real numbers so the charts render meaningfully.
 */

const MONTH_LABELS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

function wobble(seed: number, amp: number): number {
  return 1 + amp * Math.sin(seed * 1.3);
}

/** 12 months of sales vs purchase, trending up toward the latest daily figure. */
export function buildMonthlySeries(today: KpiSnapshot | null): MonthPoint[] {
  const baseSales = (today?.todaySales ?? 1_800_000) * 24; // ~monthly from a daily figure
  const basePurchase = (today?.todayPurchase ?? 1_260_000) * 24;
  return MONTH_LABELS.map((month, i) => {
    const growth = 0.75 + (i / MONTH_LABELS.length) * 0.4;
    return {
      month,
      sales: Math.round(baseSales * growth * wobble(i, 0.08)),
      purchase: Math.round(basePurchase * growth * wobble(i + 4, 0.08)),
    };
  });
}

/** 30 days of net cash movement, anchored on collections vs purchase. */
export function buildCashflowSeries(today: KpiSnapshot | null): CashPoint[] {
  const base = (today?.collectionsToday ?? 1_000_000) - (today?.todayPurchase ?? 700_000) * 0.6;
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    return {
      day: String(day),
      value: Math.round(base * (0.6 + wobble(i, 0.5) * 0.7)),
    };
  });
}
