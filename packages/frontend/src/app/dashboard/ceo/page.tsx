'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  FileDown, FileSpreadsheet, Printer, FileText, AlertTriangle, RefreshCw, Users, ReceiptIndianRupee,
} from 'lucide-react';
import type { CeoDashboardResponse, KpiKey } from '@vchemics/shared';
import { getCeoDashboard } from '@/lib/api';
import { computeDelta, formatCurrency, formatIndianNumber } from '@/lib/format';
import { buildMonthlySeries, buildCashflowSeries } from '@/lib/dashboard-derive';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { RefreshButton } from '@/components/dashboard/RefreshButton';
import { SalesPurchaseChart } from '@/components/dashboard/SalesPurchaseChart';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';

interface KpiConfig {
  key: KpiKey;
  label: string;
  semantics: 'positive-good' | 'positive-bad';
  href?: string;
  accentColor?: string;
}

const KPI_CONFIGS: KpiConfig[] = [
  { key: 'todaySales', label: "Today's Sales", semantics: 'positive-good', href: '/dashboard/sales-analytics', accentColor: '#2563EB' },
  { key: 'todayPurchase', label: "Today's Purchase", semantics: 'positive-good', href: '/dashboard/purchase-analytics', accentColor: '#F59E0B' },
  { key: 'todayGrossProfit', label: "Today's Gross Profit", semantics: 'positive-good', href: '/dashboard/product-profitability', accentColor: '#10B981' },
  { key: 'todayNetProfit', label: "Today's Net Profit", semantics: 'positive-good', href: '/dashboard/financial-overview', accentColor: '#8B5CF6' },
  { key: 'collectionsToday', label: 'Collections Today', semantics: 'positive-good', href: '/dashboard/receivables' },
  { key: 'outstandingReceivables', label: 'Outstanding Receivables', semantics: 'positive-bad' },
  { key: 'outstandingPayables', label: 'Outstanding Payables', semantics: 'positive-bad' },
  { key: 'cashInHand', label: 'Cash in Hand', semantics: 'positive-good' },
  { key: 'bankBalance', label: 'Bank Balance', semantics: 'positive-good' },
  { key: 'inventoryValue', label: 'Inventory Value', semantics: 'positive-good' },
  { key: 'gstPayable', label: 'GST Payable', semantics: 'positive-bad' },
  { key: 'mtdSales', label: 'Sales Value (MTD)', semantics: 'positive-good' },
  { key: 'mtdPurchase', label: 'Purchase Value (MTD)', semantics: 'positive-good' },
];

function CeoSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 13 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function CeoDashboardPage() {
  const [data, setData] = React.useState<CeoDashboardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await getCeoDashboard());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <CeoSkeleton />;

  if (error && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="max-w-md text-center rounded-[14px] border border-[#E2E8F0] bg-white shadow-sm">
          <CardContent className="p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#0F172A]">Couldn&apos;t reach the backend</h2>
            <p className="mt-1 text-sm text-[#64748B]">Retrying automatically won&apos;t hurt — try again.</p>
            <Button variant="primary" className="mt-5 bg-[#1D4ED8] hover:bg-[#1E40AF]" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return <CeoSkeleton />;

  const { today, yesterday, lastSync, user, company } = data;

  // Empty state
  if (!today) {
    return (
      <div className="p-4 md:p-8">
        <GreetingHeader name={user.name} fyLabel={company.fyLabel} lastSync={lastSync} onRefreshed={load} />
        <Card className="mt-6 rounded-[14px] border border-[#E2E8F0] bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A]">No data yet</h2>
            <p className="max-w-sm text-sm text-[#64748B]">
              The sync agent hasn&apos;t sent data yet. Click &quot;Refresh Tally Data&quot; or wait for the next scheduled sync.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthly = buildMonthlySeries(today);
  const cashflow = buildCashflowSeries(today);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto"
    >
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
        >
          <FileDown className="h-4 w-4 text-[#64748B]" /> Export PDF
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
        >
          <FileSpreadsheet className="h-4 w-4 text-[#64748B]" /> Export Excel
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
        >
          <Printer className="h-4 w-4 text-[#64748B]" /> Print
        </button>
        <RefreshButton
          onRefreshed={load}
          className="bg-[#1D4ED8] text-white hover:bg-[#1E40AF] shadow-none border-none text-[13px] py-2 px-4"
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
        >
          <FileText className="h-4 w-4 text-[#64748B]" /> Daily Business Report
        </button>
      </div>

      {/* Executive Intelligence banner */}
      <GreetingHeader name={user.name} fyLabel={company.fyLabel} lastSync={lastSync} onRefreshed={load} />

      {/* Section heading */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[20px] font-bold text-[#0F172A] tracking-tight">
          Business Health Indicators <span className="text-[20px] font-normal text-[#94A3B8]">(13 Key Metrics)</span>
        </h2>
        <p className="text-[13px] text-[#94A3B8]">Status color coded · Click a card for details</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CONFIGS.map((cfg) => {
          const value = today[cfg.key];
          const prev = yesterday ? yesterday[cfg.key] : undefined;
          const delta = prev !== undefined ? computeDelta(value, prev) : undefined;
          return (
            <KpiCard
              key={cfg.key}
              label={cfg.label}
              value={value}
              delta={delta}
              deltaSemantics={cfg.semantics}
              comparisonLabel="Yesterday"
              comparisonValue={prev}
              accentColor={cfg.accentColor}
              href={cfg.href}
            />
          );
        })}
      </div>

      {/* Secondary charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-[14px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="p-0">
            <h3 className="mb-4 text-[16px] font-semibold text-[#0F172A]">Sales vs Purchase — Last 12 Months</h3>
            <SalesPurchaseChart data={monthly} />
          </CardContent>
        </Card>
        <Card className="rounded-[14px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="p-0">
            <h3 className="mb-4 text-[16px] font-semibold text-[#0F172A]">Cash Flow Trend — Last 30 Days</h3>
            <CashFlowChart data={cashflow} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom mini cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="rounded-[14px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="flex items-center gap-4 p-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">New Customers This Month</p>
              <p className="text-[32px] font-bold text-[#0F172A] tabular leading-none mt-1">{formatIndianNumber(today.newCustomersToday)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[14px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="flex items-center gap-4 p-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <ReceiptIndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Orders Billed Today</p>
              <p className="text-[32px] font-bold text-[#0F172A] tabular leading-none mt-1">{formatIndianNumber(today.ordersBilledToday)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="pt-2 text-center text-xs text-[#94A3B8]">
        {company.displayName} · Figures reflect the latest Tally sync · Amounts in ₹
      </p>
    </motion.div>
  );
}
