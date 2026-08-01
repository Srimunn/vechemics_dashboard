'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, RefreshCw, IndianRupee, Truck, FileText, Search } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function PurchaseAnalyticsPage() {
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

      const res = await fetch(`${backendUrl}/api/analytics/purchases`, { headers });
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
  }, []);

  const filteredSuppliers = data?.suppliers?.filter((s: any) =>
    s.partyName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <ShoppingCart className="h-7 w-7 text-[#1D4ED8]" />
            Purchase Analytics
          </h1>
          <p className="text-sm text-[#64748B]">Procurement spend trends and supplier breakdown.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="purchases" label="Export Excel" />
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Purchase Spend</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><IndianRupee className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.totalPurchases)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Purchase Invoices</span>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><FileText className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{data.totalBills}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Active Suppliers</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Truck className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{data.suppliers?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Monthly Purchase Trend Chart */}
      {data?.monthlyTrend && data.monthlyTrend.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Procurement Trend</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" textAnchor="end" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => [formatINR(Number(value)), 'Purchase Spend']} />
                <Bar dataKey="amount" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Supplier Spend Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Supplier Spend Breakdown</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplier..."
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
                <th className="px-4 py-3 text-right">Last Bill Date</th>
                <th className="px-4 py-3 text-right">Total Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSuppliers.map((s: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.partyName}</td>
                  <td className="px-4 py-3 text-right">{s.billCount}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{s.lastBillDate}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatINR(s.totalPurchase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
