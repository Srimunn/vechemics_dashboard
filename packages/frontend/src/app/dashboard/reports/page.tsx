'use client';

import { useState } from 'react';
import {
  FileText, Files, TrendingUp, Building, ArrowDownToLine, ArrowUpFromLine,
  Package, ReceiptText, Calendar, Download, ShoppingCart, Wallet, RefreshCw
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

interface ReportCardProps {
  title: string;
  description: string;
  moduleName: string;
  icon: any;
  fromDate: string;
  toDate: string;
}

function MonthlyCeoReportCard() {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [loading, setLoading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setLoading(true);
      const [yStr, mStr] = selectedMonth.split('-');
      const month = parseInt(mStr || '1', 10);
      const year = parseInt(yStr || '2026', 10);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/reports/monthly-ceo?month=${month}&year=${year}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VChemics_Monthly_CEO_Report_${String(month).padStart(2, '0')}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download Monthly CEO Report PDF:', err);
      alert('Failed to download Monthly CEO Report PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-lg space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3 text-blue-400 shrink-0">
            <FileText className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-300 uppercase border border-blue-400/30">
                Executive Audit Ready
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Monthly CEO Executive Report (PDF)</h2>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              Comprehensive 3-page business report including P&amp;L summary, top customer &amp; product margin breakdown, receivables aging schedule, and liquid cash position.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/10 shrink-0">
          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">
              Select Month &amp; Year
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-blue-400/30 bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-semibold text-xs px-5 py-2.5 shadow-md disabled:opacity-50 transition-colors mt-auto"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{loading ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, description, moduleName, icon: Icon, fromDate, toDate }: ReportCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 transition-all">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-blue-50 p-2 text-[#1D4ED8] shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-gray-900 leading-tight">{title}</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{description}</p>
      </div>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400">PDF &amp; Excel ready</span>
        <ExportButton moduleName={moduleName} label="Export" fromDate={fromDate} toDate={toDate} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayStr = () => new Date().toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());

  const handleDateApply = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
          <Files className="h-7 w-7 text-[#1D4ED8]" />
          Report Generation Center
        </h1>
        <p className="text-sm text-[#64748B]">Generate, customize, and download audit-ready Excel (.xlsx) and printable PDF reports.</p>
      </div>

      {/* Prominent Monthly CEO Report Card */}
      <MonthlyCeoReportCard />

      {/* Date Range Selector Bar */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Global Report Period Filter
        </label>
        <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={handleDateApply} />
      </div>

      {/* Report Categories */}
      <div className="space-y-8">
        {/* Financial Reports Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <Wallet className="h-5 w-5 text-blue-700" />
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider text-xs">Financial Reports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Profit & Loss Statement"
              description="Complete Profit & Loss statement summarizing revenue, cost of sales, and net earnings."
              moduleName="financial-overview"
              icon={TrendingUp}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Balance Sheet"
              description="Statement of assets, liabilities, bank balances, and equity positions."
              moduleName="financial-overview"
              icon={Building}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Bill-wise Profit & Loss"
              description="Itemized profitability breakdown for every sales invoice matching Tally exactly."
              moduleName="bill-pnl"
              icon={FileText}
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>
        </div>

        {/* Operations Reports Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <ShoppingCart className="h-5 w-5 text-emerald-700" />
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider text-xs">Operations Reports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              title="Sales Register"
              description="All sales transactions with customer names, invoice numbers, and billed amounts."
              moduleName="sales"
              icon={TrendingUp}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Purchase Register"
              description="All purchase transactions with supplier details, invoice references, and spend."
              moduleName="purchases"
              icon={ShoppingCart}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Outstanding Receivables"
              description="Pending customer receivables schedule complete with aging buckets (0-30 to 90+ days)."
              moduleName="receivables"
              icon={ArrowDownToLine}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Outstanding Payables"
              description="Pending supplier dues schedule with payment due dates and aging breakdown."
              moduleName="payables"
              icon={ArrowUpFromLine}
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>
        </div>

        {/* Inventory & Tax Reports Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <Package className="h-5 w-5 text-indigo-700" />
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider text-xs">Inventory &amp; Tax Reports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Stock Summary & Valuation"
              description="Closing stock balances, unit quantities, weighted average costs, and closing valuation."
              moduleName="inventory"
              icon={Package}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="GST Output & Input Summary"
              description="Output tax liability, input tax credit entries, and net GST payable calculation."
              moduleName="gst"
              icon={ReceiptText}
              fromDate={fromDate}
              toDate={toDate}
            />
            <ReportCard
              title="Daily Business Activity Report"
              description="End-of-day business summary covering sales, collections, and cash movements."
              moduleName="daily-report"
              icon={Calendar}
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
