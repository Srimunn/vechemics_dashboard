'use client';

import { useState, useEffect } from 'react';
import { Wallet, RefreshCw, IndianRupee, ArrowDownToLine, ArrowUpFromLine, Package, ReceiptText, Building } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function FinancialOverviewPage() {
  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayStr = () => new Date().toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/analytics/financial-overview?from=${fromDate}&to=${toDate}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <Wallet className="h-7 w-7 text-[#1D4ED8]" />
            Financial Overview
          </h1>
          <p className="text-sm text-[#64748B]">Combined Profit &amp; Loss and Balance Sheet summary.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="financial-overview" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />

      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Profit & Loss Summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
              <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><IndianRupee className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Profit &amp; Loss Statement</h2>
                <p className="text-xs text-gray-500">Income, Costs &amp; Net Earnings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Gross Sales Revenue</span>
                <span className="text-base font-bold text-gray-900">{formatINR(data.pnl.grossSales)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Less: Purchase Account Costs</span>
                <span className="text-base font-semibold text-amber-600">{formatINR(data.pnl.grossPurchase)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-emerald-50/50 px-3 rounded-lg">
                <span className="text-sm font-bold text-emerald-800">Gross Profit (c/f)</span>
                <span className="text-base font-extrabold text-emerald-700">{formatINR(data.pnl.grossProfit)}</span>
              </div>
              <div className="flex justify-between items-center py-2 pt-4">
                <span className="text-base font-bold text-gray-900">Nett Profit</span>
                <span className="text-xl font-black text-blue-600">{formatINR(data.pnl.netProfit)}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
              <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600"><Building className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Balance Sheet Summary</h2>
                <p className="text-xs text-gray-500">Assets, Dues &amp; Liabilities</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" /> Bank Accounts Balance
                </span>
                <span className="text-sm font-bold text-gray-900">{formatINR(data.balanceSheet.bankBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" /> Cash in Hand
                </span>
                <span className="text-sm font-bold text-gray-900">{formatINR(data.balanceSheet.cashInHand)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" /> Closing Inventory Valuation
                </span>
                <span className="text-sm font-bold text-gray-900">{formatINR(data.balanceSheet.inventoryValue)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-purple-600" /> Sundry Debtors (Receivables)
                </span>
                <span className="text-sm font-bold text-blue-600">{formatINR(data.balanceSheet.receivables)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-amber-600" /> Sundry Creditors (Payables)
                </span>
                <span className="text-sm font-bold text-amber-600">{formatINR(data.balanceSheet.payables)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-rose-600" /> Duties &amp; Taxes (Net GST)
                </span>
                <span className="text-sm font-bold text-rose-600">{formatINR(data.balanceSheet.gstPayable)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
