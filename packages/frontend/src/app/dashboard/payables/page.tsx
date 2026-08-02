'use client';

import { useState, useEffect } from 'react';
import { ArrowUpFromLine, RefreshCw, IndianRupee, Search } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function PayablesPage() {
  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayStr = () => new Date().toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/analytics/payables?from=${fromDate}&to=${toDate}`, { headers });
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

  const filteredItems = data?.items?.filter((i: any) =>
    i.partyName.toLowerCase().includes(search.toLowerCase()) ||
    i.billRef.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getAgingBadge = (days: number) => {
    if (days <= 30) {
      return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">0-30 Days</span>;
    } else if (days <= 60) {
      return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">31-60 Days</span>;
    } else if (days <= 90) {
      return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">61-90 Days</span>;
    } else {
      return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">90+ Days</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <ArrowUpFromLine className="h-7 w-7 text-[#1D4ED8]" />
            Bills Payable &amp; Aging
          </h1>
          <p className="text-sm text-[#64748B]">Pending supplier payments and dues aging schedule.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="payables" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />

      {/* Aging Summary Cards */}
      {data?.aging && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Dues Payable</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{formatINR(data.totalOutstanding)}</p>
            <p className="text-xs text-gray-400">{data.totalBills} pending bills</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-700">0 - 30 Days</span>
            <p className="mt-1 text-xl font-bold text-emerald-800">{formatINR(data.aging.current)}</p>
            <p className="text-xs text-emerald-600">Current dues</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-amber-700">31 - 60 Days</span>
            <p className="mt-1 text-xl font-bold text-amber-800">{formatINR(data.aging.days31to60)}</p>
            <p className="text-xs text-amber-600">Due soon</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-orange-700">61 - 90 Days</span>
            <p className="mt-1 text-xl font-bold text-orange-800">{formatINR(data.aging.days61to90)}</p>
            <p className="text-xs text-orange-600">Past due</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-rose-700">90+ Days Overdue</span>
            <p className="mt-1 text-xl font-bold text-rose-800">{formatINR(data.aging.days90plus)}</p>
            <p className="text-xs text-rose-600">Urgent settlement needed</p>
          </div>
        </div>
      )}

      {/* Supplier Payables Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Pending Supplier Bills</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplier or bill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Bill Date</th>
                <th className="px-4 py-3">Bill Ref / Invoice</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3 text-right">Pending Amount</th>
                <th className="px-4 py-3 text-right">Overdue Days</th>
                <th className="px-4 py-3 text-right">Aging Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{item.billDate}</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">{item.billRef}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.partyName}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatINR(item.pendingAmount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.overdueDays} days</td>
                  <td className="px-4 py-3 text-right">{getAgingBadge(item.overdueDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
