'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Search, ChevronDown, ChevronRight, Filter, RefreshCw,
  AlertCircle, ArrowUpDown, IndianRupee, Layers, ShoppingBag
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';

interface BillItem {
  id: string;
  stockItemName: string;
  quantity: number;
  unit: string;
  saleRate: number;
  costRate: number;
  saleAmount: number;
  costAmount: number;
  profit: number;
  marginPct: number;
}

interface BillRow {
  id: string;
  date: string;
  voucherNumber: string;
  partyName: string;
  saleValue: number;
  costValue: number;
  profit: number;
  marginPct: number;
  items: BillItem[];
}

interface BillPnlResponse {
  bills: BillRow[];
  summary: {
    totalSales: number;
    totalCost: number;
    totalProfit: number;
    avgMargin: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalBills: number;
  };
}

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val);
}

export default function BillPnlPage() {
  const [data, setData] = useState<BillPnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filter state
  const [searchCustomer, setSearchCustomer] = useState('');
  const [marginFilter, setMarginFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchBillPnl = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let minMargin: number | undefined;
      let maxMargin: number | undefined;
      if (marginFilter === 'high') minMargin = 20;
      else if (marginFilter === 'mid') { minMargin = 10; maxMargin = 20; }
      else if (marginFilter === 'low') maxMargin = 10;

      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        customer: searchCustomer,
        sortBy,
        sortDir,
        ...(minMargin !== undefined ? { minMargin: String(minMargin) } : {}),
        ...(maxMargin !== undefined ? { maxMargin: String(maxMargin) } : {}),
      });

      const res = await fetch(`${backendUrl}/api/bill-pnl?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Fetch Bill P&L Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Bill-wise P&L data');
    } finally {
      setLoading(false);
    }
  }, [page, searchCustomer, marginFilter, sortBy, sortDir]);

  useEffect(() => {
    fetchBillPnl();
  }, [fetchBillPnl]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const getMarginBadge = (pct: number) => {
    if (pct >= 20) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
          {pct.toFixed(1)}%
        </span>
      );
    } else if (pct >= 10) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
          {pct.toFixed(1)}%
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20">
          {pct.toFixed(1)}%
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
            Bill-wise Profit &amp; Loss
          </h1>
          <p className="text-sm text-[#64748B]">
            Profitability breakdown for every sales invoice matching Tally exactly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBillPnl}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="bill-pnl" label="Export Excel" />
        </div>
      </div>

      {/* Summary KPI Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Sales Value</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><IndianRupee className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.summary.totalSales)}</p>
            <p className="mt-1 text-xs text-gray-500">Gross invoiced amount</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Cost of Goods</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><ShoppingBag className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.summary.totalCost)}</p>
            <p className="mt-1 text-xs text-gray-500">Weighted average stock cost</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Bill Profit</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{formatINR(data.summary.totalProfit)}</p>
            <p className="mt-1 text-xs text-gray-500">Net margin across bills</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average Margin</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Layers className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-indigo-600">{data.summary.avgMargin.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-gray-500">Overall profit margin</p>
          </div>
        </div>
      )}

      {/* Filter & Controls Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer name..."
            value={searchCustomer}
            onChange={(e) => { setSearchCustomer(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Margin:</span>
          <select
            value={marginFilter}
            onChange={(e: any) => { setMarginFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Margins</option>
            <option value="high">High Margin (&gt;20%)</option>
            <option value="mid">Medium (10% - 20%)</option>
            <option value="low">Low (&lt;10%)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm font-medium">Loading Bill-wise P&amp;L...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600">
            <AlertCircle className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-medium">{error}</p>
          </div>
        ) : !data || data.bills.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-semibold">No sales invoices found</p>
            <p className="mt-1 text-sm text-gray-400">Try adjusting your customer search or margin filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('voucherNumber')}>
                    <div className="flex items-center gap-1">Invoice# <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('partyName')}>
                    <div className="flex items-center gap-1">Customer <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('saleValue')}>
                    <div className="flex items-center justify-end gap-1">Sale Value <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('costValue')}>
                    <div className="flex items-center justify-end gap-1">Cost Value <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('profit')}>
                    <div className="flex items-center justify-end gap-1">Profit <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('marginPct')}>
                    <div className="flex items-center justify-end gap-1">Margin % <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.bills.map((bill) => {
                  const isExpanded = !!expandedRows[bill.id];
                  return (
                    <tr key={bill.id} className="group hover:bg-blue-50/40 transition-colors">
                      <td colSpan={8} className="p-0">
                        <div className="flex items-center px-4 py-3.5">
                          <button
                            onClick={() => toggleRow(bill.id)}
                            className="mr-3 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="w-24 font-medium text-gray-900">{bill.date}</div>
                          <div className="w-40 font-semibold text-blue-600">{bill.voucherNumber}</div>
                          <div className="flex-1 font-medium text-gray-800 truncate px-2">{bill.partyName}</div>
                          <div className="w-32 text-right font-semibold text-gray-900">{formatINR(bill.saleValue)}</div>
                          <div className="w-32 text-right text-gray-600">{formatINR(bill.costValue)}</div>
                          <div className="w-32 text-right font-semibold text-emerald-600">{formatINR(bill.profit)}</div>
                          <div className="w-28 text-right">{getMarginBadge(bill.marginPct)}</div>
                        </div>

                        {/* Expandable Row for Item Breakdown */}
                        {isExpanded && (
                          <div className="bg-gray-50/80 px-12 py-3 border-t border-b border-gray-200">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                              Item-level Profit Breakdown ({bill.items.length} item{bill.items.length !== 1 ? 's' : ''})
                            </p>
                            {bill.items.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-1">No individual inventory entries recorded for this invoice.</p>
                            ) : (
                              <table className="w-full text-xs text-gray-700">
                                <thead>
                                  <tr className="border-b border-gray-300 font-semibold text-gray-500">
                                    <th className="py-1.5 text-left">Item Name</th>
                                    <th className="py-1.5 text-right">Qty</th>
                                    <th className="py-1.5 text-right">Sale Rate</th>
                                    <th className="py-1.5 text-right">Cost Rate</th>
                                    <th className="py-1.5 text-right">Sale Amt</th>
                                    <th className="py-1.5 text-right">Cost Amt</th>
                                    <th className="py-1.5 text-right">Profit</th>
                                    <th className="py-1.5 text-right">Margin%</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {bill.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-100/60">
                                      <td className="py-1.5 font-medium text-gray-900">{item.stockItemName}</td>
                                      <td className="py-1.5 text-right">{item.quantity} {item.unit}</td>
                                      <td className="py-1.5 text-right">{formatINR(item.saleRate)}</td>
                                      <td className="py-1.5 text-right">{formatINR(item.costRate)}</td>
                                      <td className="py-1.5 text-right font-medium">{formatINR(item.saleAmount)}</td>
                                      <td className="py-1.5 text-right text-gray-600">{formatINR(item.costAmount)}</td>
                                      <td className="py-1.5 text-right font-semibold text-emerald-600">{formatINR(item.profit)}</td>
                                      <td className="py-1.5 text-right">{item.marginPct.toFixed(1)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
            <span className="text-xs text-gray-500">
              Showing page <strong>{data.pagination.page}</strong> of <strong>{data.pagination.totalPages}</strong> ({data.pagination.totalBills} bills)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
