'use client';

import { useState, useEffect } from 'react';
import { Truck, RefreshCw, IndianRupee, Search } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function SuppliersPage() {
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

      const res = await fetch(`${backendUrl}/api/analytics/suppliers?from=${fromDate}&to=${toDate}`, { headers });
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

  const filtered = data?.suppliers?.filter((s: any) =>
    s.partyName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <Truck className="h-7 w-7 text-[#1D4ED8]" />
            Supplier Directory
          </h1>
          <p className="text-sm text-[#64748B]">Supplier procurement history and pending dues.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="suppliers" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">All Suppliers ({data?.totalSuppliers || 0})</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplier name..."
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
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3 text-right">Purchase Bills</th>
                <th className="px-4 py-3 text-right">Total Procurement Spend</th>
                <th className="px-4 py-3 text-right">Outstanding Dues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((s: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.partyName}</td>
                  <td className="px-4 py-3 text-right">{s.billCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatINR(s.totalPurchases)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-600">
                    {s.outstanding > 0 ? formatINR(s.outstanding) : '₹0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
