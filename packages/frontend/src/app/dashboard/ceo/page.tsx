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
import { SalesPurchaseChart } from '@/components/dashboard/SalesPurchaseChart';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';

interface KpiConfig {
  key: KpiKey;
  label: string;
  semantics: 'positive-good' | 'positive-bad';
  href?: string;
}

const KPI_CONFIGS: KpiConfig[] = [
  { key: 'todaySales', label: "Today's Sales", semantics: 'positive-good', href: '/dashboard/sales-analytics' },
  { key: 'todayPurchase', label: "Today's Purchase", semantics: 'positive-good', href: '/dashboard/purchase-analytics' },
  { key: 'todayGrossProfit', label: "Today's Gross Profit", semantics: 'positive-good', href: '/dashboard/product-profitability' },
  { key: 'todayNetProfit', label: "Today's Net Profit", semantics: 'positive-good', href: '/dashboard/financial-overview' },
  { key: 'collectionsToday', label: 'Collections Today', semantics: 'positive-good', href: '/dashboard/receivables' },
  { key: 'outstandingReceivables', label: 'Outstanding Receivables', semantics: 'positive-bad', href: '/dashboard/receivables' },
  { key: 'outstandingPayables', label: 'Outstanding Payables', semantics: 'positive-bad', href: '/dashboard/payables' },
  { key: 'cashInHand', label: 'Cash in Hand', semantics: 'positive-good', href: '/dashboard/financial-overview' },
  { key: 'bankBalance', label: 'Bank Balance', semantics: 'positive-good', href: '/dashboard/financial-overview' },
  { key: 'inventoryValue', label: 'Inventory Value', semantics: 'positive-good', href: '/dashboard/inventory' },
  { key: 'gstPayable', label: 'GST Payable', semantics: 'positive-bad', href: '/dashboard/gst' },
  { key: 'mtdSales', label: 'Sales Value (MTD)', semantics: 'positive-good', href: '/dashboard/sales-analytics' },
  { key: 'mtdPurchase', label: 'Purchase Value (MTD)', semantics: 'positive-good', href: '/dashboard/purchase-analytics' },
];

function CeoSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
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
        <Card className="max-w-md text-center">
          <CardContent className="p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Couldn&apos;t reach the backend</h2>
            <p className="mt-1 text-sm text-muted-foreground">Retrying automatically won&apos;t hurt — try again.</p>
            <Button variant="primary" className="mt-5" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return <CeoSkeleton />;

  const { today, yesterday, trend7d, lastSync, user, company } = data;

  // Empty state: connected, but no snapshot yet.
  if (!today) {
    return (
      <div className="p-4 md:p-8">
        <GreetingHeader name={user.name} fyLabel={company.fyLabel} lastSync={lastSync} onRefreshed={load} />
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">No data yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 p-4 md:p-8"
    >
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm"><FileDown className="h-4 w-4" /> Export PDF</Button>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
        <Button variant="outline" size="sm"><Printer className="h-4 w-4" /> Print</Button>
        <Button variant="outline" size="sm"><FileText className="h-4 w-4" /> Daily Business Report</Button>
      </div>

      {/* Executive Intelligence banner */}
      <GreetingHeader name={user.name} fyLabel={company.fyLabel} lastSync={lastSync} onRefreshed={load} />

      {/* Section heading */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Business Health Indicators <span className="text-muted-foreground">(13 Key Metrics)</span></h2>
        <p className="text-xs text-muted-foreground">Status color coded · Click a card for details</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CONFIGS.map((cfg) => {
          const value = today[cfg.key];
          const prev = yesterday ? yesterday[cfg.key] : undefined;
          const delta = prev !== undefined ? computeDelta(value, prev) : undefined;
          const sparkline = trend7d.map((s) => s[cfg.key]);
          return (
            <KpiCard
              key={cfg.key}
              label={cfg.label}
              value={value}
              delta={delta}
              deltaSemantics={cfg.semantics}
              comparisonLabel="Yesterday"
              comparisonValue={prev}
              sparkline={sparkline}
              href={cfg.href}
            />
          );
        })}
      </div>

      {/* Secondary charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Sales vs Purchase — Last 12 Months</h3>
            <SalesPurchaseChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Cash Flow Trend — Last 30 Days</h3>
            <CashFlowChart data={cashflow} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom mini cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New Customers This Month</p>
              <p className="text-2xl font-bold tabular">{formatIndianNumber(today.newCustomersToday)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
              <ReceiptIndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orders Billed Today</p>
              <p className="text-2xl font-bold tabular">{formatIndianNumber(today.ordersBilledToday)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="pt-2 text-center text-xs text-muted-foreground/70">
        {company.displayName} · Figures reflect the latest Tally sync · Amounts in ₹
      </p>
    </motion.div>
  );
}
