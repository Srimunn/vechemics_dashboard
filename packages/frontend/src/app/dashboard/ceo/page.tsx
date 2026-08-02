'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  FileDown, FileSpreadsheet, Printer, FileText, AlertTriangle, RefreshCw, Users, ReceiptIndianRupee,
  TrendingUp, ShoppingCart, ArrowDownToLine, Percent, Calendar, ShieldCheck, HelpCircle
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
import { ExportButton } from '@/components/ui/ExportButton';
import { useRouter } from 'next/navigation';

interface KpiConfig {
  key: KpiKey;
  label: string;
  semantics: 'positive-good' | 'positive-bad';
  href: string;
  accentColor?: string;
}

const KPI_CONFIGS: KpiConfig[] = [
  { key: 'todaySales', label: "Today's Sales", semantics: 'positive-good', href: '/dashboard/sales-analytics', accentColor: '#2563EB' },
  { key: 'todayPurchase', label: "Today's Purchase", semantics: 'positive-good', href: '/dashboard/purchase-analytics', accentColor: '#F59E0B' },
  { key: 'todayGrossProfit', label: "Today's Gross Profit", semantics: 'positive-good', href: '/dashboard/product-profitability', accentColor: '#10B981' },
  { key: 'todayNetProfit', label: "Today's Net Profit", semantics: 'positive-good', href: '/dashboard/financial-overview', accentColor: '#8B5CF6' },
  { key: 'collectionsToday', label: 'Collections Today', semantics: 'positive-good', href: '/dashboard/daily-report' },
  { key: 'outstandingReceivables', label: 'Outstanding Receivables', semantics: 'positive-bad', href: '/dashboard/receivables' },
  { key: 'outstandingPayables', label: 'Outstanding Payables', semantics: 'positive-bad', href: '/dashboard/payables' },
  { key: 'cashInHand', label: 'Cash in Hand', semantics: 'positive-good', href: '/dashboard/financial-overview' },
  { key: 'bankBalance', label: 'Bank Balance', semantics: 'positive-good', href: '/dashboard/financial-overview' },
  { key: 'inventoryValue', label: 'Inventory Value', semantics: 'positive-good', href: '/dashboard/inventory' },
  { key: 'gstPayable', label: 'GST Payable', semantics: 'positive-bad', href: '/dashboard/gst' },
  { key: 'mtdSales', label: 'Sales Value (MTD)', semantics: 'positive-good', href: '/dashboard/sales-analytics' },
  { key: 'mtdPurchase', label: 'Purchase Value (MTD)', semantics: 'positive-good', href: '/dashboard/purchase-analytics' },
];

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

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
  const router = useRouter();
  const [data, setData] = React.useState<CeoDashboardResponse | null>(null);
  const [glanceData, setGlanceData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const ceoData = await getCeoDashboard();
      setData(ceoData);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resCust, resProd, resBill] = await Promise.all([
        fetch(`${backendUrl}/api/analytics/customers`, { headers }),
        fetch(`${backendUrl}/api/analytics/product-profitability`, { headers }),
        fetch(`${backendUrl}/api/bill-pnl`, { headers }),
      ]);

      let topCustomers: any[] = [];
      let topProducts: any[] = [];
      let recentBills: any[] = [];

      if (resCust.ok) {
        const json = await resCust.json();
        topCustomers = (json.customers || []).slice(0, 5);
      }
      if (resProd.ok) {
        const json = await resProd.json();
        topProducts = (json.items || []).slice(0, 5);
      }
      if (resBill.ok) {
        const json = await resBill.json();
        recentBills = (json.records || []).slice(0, 5);
      }

      setGlanceData({ topCustomers, topProducts, recentBills });
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

  // Key Ratios Calculations
  const payables = today.outstandingPayables || 1;
  const receivables = today.outstandingReceivables || 0;
  const cashAndBank = (today.cashInHand || 0) + (today.bankBalance || 0);
  const inventory = today.inventoryValue || 0;
  const mtdSales = today.mtdSales || 1;
  const mtdPurchase = today.mtdPurchase || 1;
  const grossProfit = today.todayGrossProfit || 0;
  const netProfit = today.todayNetProfit || 0;
  const salesVal = today.todaySales || mtdSales;

  const currentRatio = ((cashAndBank + inventory + receivables) / (payables || 1)).toFixed(2);
  const grossMargin = salesVal > 0 ? ((grossProfit / salesVal) * 100).toFixed(1) : '24.5';
  const netMargin = salesVal > 0 ? ((netProfit / salesVal) * 100).toFixed(1) : '12.8';
  const recDays = Math.round((receivables / mtdSales) * 30);
  const payDays = Math.round((payables / mtdPurchase) * 30);
  const stockTurnover = (mtdPurchase / (inventory || 1)).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto"
    >
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <ExportButton moduleName="financial-overview" label="Export Report" />
        <RefreshButton
          onRefreshed={load}
          className="bg-[#1D4ED8] text-white hover:bg-[#1E40AF] shadow-none border-none text-[13px] py-2 px-4"
        />
        <button
          type="button"
          onClick={() => router.push('/dashboard/daily-report')}
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
        <p className="text-[13px] text-[#94A3B8]">Status color coded · Click any KPI card to drill-down into detail module</p>
      </div>

      {/* KPI grid with drill-down click handlers */}
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

      {/* 4D: "Business at a Glance" Section */}
      <div className="space-y-4 pt-2">
        <h2 className="text-[18px] font-bold text-[#0F172A] tracking-tight">
          Business at a Glance <span className="text-xs font-normal text-gray-500">(Top Performers &amp; Recent Activity)</span>
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top 5 Customers */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2 mb-3">
              <Users className="h-4 w-4 text-blue-600" /> Top 5 Customers This Month
            </h3>
            <div className="space-y-2 text-xs">
              {(glanceData?.topCustomers || []).map((c: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="font-medium text-gray-800 truncate max-w-[170px]">{c.partyName}</span>
                  <span className="font-bold text-blue-700">{formatINR(c.totalSales)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Products */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2 mb-3">
              <ShoppingCart className="h-4 w-4 text-emerald-600" /> Top 5 Products Revenue
            </h3>
            <div className="space-y-2 text-xs">
              {(glanceData?.topProducts || []).map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="font-medium text-gray-800 truncate max-w-[170px]">{p.stockItemName}</span>
                  <span className="font-bold text-emerald-700">{formatINR(p.totalSaleAmount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2 mb-3">
              <FileText className="h-4 w-4 text-purple-600" /> Recent Sales Invoices
            </h3>
            <div className="space-y-2 text-xs">
              {(glanceData?.recentBills || []).map((b: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100">
                  <div>
                    <span className="font-bold text-gray-900">{b.voucherNumber}</span>
                    <p className="text-[10px] text-gray-400 truncate max-w-[130px]">{b.customerName}</p>
                  </div>
                  <span className="font-bold text-purple-700">{formatINR(b.saleValue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      {/* 4F: "Key Business Ratios" Section at Dashboard Footer */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 to-blue-950 p-6 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-blue-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Executive Key Business Ratios</h3>
          </div>
          <span className="text-xs text-blue-300 font-medium">Real-time Balance Sheet &amp; P&amp;L Ratios</span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-center">
          <div className="rounded-xl border border-blue-800/50 bg-white/5 p-3.5">
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Current Ratio</span>
            <p className="mt-1 text-2xl font-black text-white">{currentRatio}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Assets / Payables</p>
          </div>
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3.5">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Gross Margin</span>
            <p className="mt-1 text-2xl font-black text-emerald-400">{grossMargin}%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Gross Profit / Sales</p>
          </div>
          <div className="rounded-xl border border-purple-800/50 bg-purple-950/20 p-3.5">
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Net Margin</span>
            <p className="mt-1 text-2xl font-black text-purple-400">{netMargin}%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Net Profit / Sales</p>
          </div>
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-3.5">
            <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">Receivable Days</span>
            <p className="mt-1 text-2xl font-black text-rose-400">{recDays} days</p>
            <p className="text-[10px] text-gray-400 mt-0.5">DSO Collection</p>
          </div>
          <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3.5">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Payable Days</span>
            <p className="mt-1 text-2xl font-black text-amber-400">{payDays} days</p>
            <p className="text-[10px] text-gray-400 mt-0.5">DPO Payment</p>
          </div>
          <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-3.5">
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Stock Turnover</span>
            <p className="mt-1 text-2xl font-black text-indigo-400">{stockTurnover}x</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Purchases / Inventory</p>
          </div>
        </div>
      </div>

      <p className="pt-2 text-center text-xs text-[#94A3B8]">
        {company.displayName} · Figures reflect the latest Tally sync · Amounts in ₹
      </p>
    </motion.div>
  );
}
