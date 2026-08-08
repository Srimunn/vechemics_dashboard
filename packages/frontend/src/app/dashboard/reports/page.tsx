'use client';

import { useState } from 'react';
import {
  FileText, Files, TrendingUp, Building, ArrowDownToLine, ArrowUpFromLine,
  Package, ReceiptText, Calendar, Download, ShoppingCart, Wallet
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
