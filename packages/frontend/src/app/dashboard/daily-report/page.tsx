'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Printer, IndianRupee } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val);
}

export default function DailyReportPage() {
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

      const res = await fetch(`${backendUrl}/api/reports/daily?from=${fromDate}&to=${toDate}`, { headers });
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
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Non-printable Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <FileText className="h-7 w-7 text-[#1D4ED8]" />
            Daily Business Report
          </h1>
          <p className="text-sm text-[#64748B]">Single end-of-day snapshot of sales, purchases, and cash flows.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <ExportButton moduleName="daily-report" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="print:hidden">
        <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />
      </div>

      {/* Printable Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">VChemics India Solutions</h1>
        <h2 className="text-lg font-semibold text-gray-700">Daily Business Report — {fromDate} to {toDate}</h2>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Sales Value</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{formatINR(data.summary.totalSales)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Purchase Value</span>
            <p className="mt-1 text-xl font-bold text-amber-600">{formatINR(data.summary.totalPurchase)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Collections (Receipts)</span>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatINR(data.summary.totalCollections)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Payments Out</span>
            <p className="mt-1 text-xl font-bold text-rose-600">{formatINR(data.summary.totalPayments)}</p>
          </div>
        </div>
      )}

      {/* Voucher Sections */}
      {data?.grouped && (
        <div className="space-y-6">
          {['Sales', 'Purchase', 'Receipt', 'Payment'].map((vType) => {
            const list = data.grouped[vType] || [];
            if (list.length === 0) return null;
            const typeTotal = list.reduce((s: number, v: any) => s + v.amount, 0);

            return (
              <div key={vType} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:p-2 print:shadow-none">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-900">{vType} Vouchers ({list.length})</h3>
                  <span className="text-sm font-bold text-blue-600">Total: {formatINR(typeTotal)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 uppercase text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2">Voucher Number</th>
                        <th className="px-3 py-2">Party Name</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {list.map((v: any) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2 font-semibold text-gray-900">{v.voucherNumber}</td>
                          <td className="px-3 py-2 font-medium">{v.partyName}</td>
                          <td className="px-3 py-2 text-right font-bold">{formatINR(v.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
