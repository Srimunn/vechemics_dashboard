'use client';

import { useState, useEffect } from 'react';
import { Package, RefreshCw, IndianRupee, AlertTriangle, Search } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function InventoryPage() {
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

      const res = await fetch(`${backendUrl}/api/analytics/inventory`, { headers });
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

  const filteredItems = data?.items?.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const lowStockCount = data?.items?.filter((i: any) => i.isLowStock).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <Package className="h-7 w-7 text-[#1D4ED8]" />
            Stock Valuation &amp; Inventory
          </h1>
          <p className="text-sm text-[#64748B]">Closing stock quantities, average rates, and valuation matching Tally.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="inventory" label="Export Excel" />
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Stock Valuation</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><IndianRupee className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.totalValue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Stock Items</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Package className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{data.totalItems}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-amber-700">Low Stock Alerts</span>
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-800">{lowStockCount} items</p>
          </div>
        </div>
      )}

      {/* Stock Items Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Stock Summary Table</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search stock item..."
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
                <th className="px-4 py-3">Stock Item Name</th>
                <th className="px-4 py-3 text-right">Closing Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Avg Cost Rate</th>
                <th className="px-4 py-3 text-right">Closing Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.isLowStock && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Low Stock</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{item.closingQty}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-right">{formatINR(item.avgCost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{formatINR(item.closingValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
