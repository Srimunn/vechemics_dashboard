'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Calendar, Package, Search, AlertCircle } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val);
}

export default function ProductProfitabilityPage() {
  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayStr = () => new Date().toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/analytics/product-profitability?from=${fromDate}&to=${toDate}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load product profitability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  const filteredProducts = data?.products?.filter((p: any) =>
    p.stockItemName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getMarginBadge = (pct: number, isEstimated: boolean) => {
    if (pct >= 20) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
          {pct.toFixed(1)}% {isEstimated && <span className="text-[10px] text-amber-600 font-normal">(estimated)</span>}
        </span>
      );
    } else if (pct >= 10) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
          {pct.toFixed(1)}% {isEstimated && <span className="text-[10px] text-amber-600 font-normal">(estimated)</span>}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20">
          {pct.toFixed(1)}% {isEstimated && <span className="text-[10px] text-amber-600 font-normal">(estimated)</span>}
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <TrendingUp className="h-7 w-7 text-[#1D4ED8]" />
            Product Profitability
          </h1>
          <p className="text-sm text-[#64748B]">
            Margin and contribution analysis per stock item.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="product-profitability" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      {/* Date Range Bar */}
      <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />

      {/* Summary KPI Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Products Sold</span>
            <p className="mt-2 text-2xl font-bold text-gray-900">{data.summary.totalProducts}</p>
            <p className="mt-1 text-xs text-gray-500">Distinct stock items</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Product Sales</span>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.summary.totalSales)}</p>
            <p className="mt-1 text-xs text-gray-500">Gross revenue</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Stock Cost</span>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.summary.totalCost)}</p>
            <p className="mt-1 text-xs text-gray-500">Weighted cost of goods</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Average Profit Margin</span>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{data.summary.avgMargin.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-gray-500">Overall product margin</p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm font-medium">Loading Product Profitability...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600">
            <AlertCircle className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-medium">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-semibold">No product items found for selected date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 text-right">Total Qty Sold</th>
                  <th className="px-4 py-3 text-right">Avg Sale Rate</th>
                  <th className="px-4 py-3 text-right">Avg Cost Rate</th>
                  <th className="px-4 py-3 text-right">Total Sale Value</th>
                  <th className="px-4 py-3 text-right">Total Profit</th>
                  <th className="px-4 py-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3.5 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>{p.stockItemName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{p.totalQtySold} {p.unit}</td>
                    <td className="px-4 py-3.5 text-right">{formatINR(p.avgSaleRate)}</td>
                    <td className="px-4 py-3.5 text-right text-gray-600">{formatINR(p.avgCostRate)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900">{formatINR(p.totalSaleValue)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-600">{formatINR(p.totalProfit)}</td>
                    <td className="px-4 py-3.5 text-right">{getMarginBadge(p.marginPct, p.isEstimated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
