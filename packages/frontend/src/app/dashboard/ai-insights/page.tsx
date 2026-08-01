'use client';

import { useState, useEffect } from 'react';
import { Brain, Sparkles, TrendingUp, Users, Package, AlertCircle } from 'lucide-react';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function AiInsightsPage() {
  const [salesData, setSalesData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [receivablesData, setReceivablesData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [resSales, resProducts, resReceivables] = await Promise.all([
          fetch(`${backendUrl}/api/analytics/sales`, { headers }),
          fetch(`${backendUrl}/api/analytics/product-profitability`, { headers }),
          fetch(`${backendUrl}/api/analytics/receivables`, { headers }),
        ]);

        if (resSales.ok) setSalesData(await resSales.json());
        if (resProducts.ok) setProductData(await resProducts.json());
        if (resReceivables.ok) setReceivablesData(await resReceivables.json());
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const topCustomers = salesData?.topCustomers?.slice(0, 3) || [];
  const topProduct = productData?.products?.[0] || null;
  const oldestReceivable = receivablesData?.items?.[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
          <Brain className="h-7 w-7 text-[#1D4ED8]" />
          Executive Intelligence &amp; Highlights
        </h1>
        <p className="text-sm text-[#64748B]">Key performance highlights and upcoming Phase 4 AI capabilities.</p>
      </div>

      {/* Phase 4 AI Banner */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-blue-900 p-6 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/10 p-2"><Sparkles className="h-6 w-6 text-amber-300" /></div>
          <div>
            <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">Phase 4 Preview</span>
            <h2 className="mt-1 text-xl font-bold">Automated AI Insights Suite</h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-indigo-100 max-w-2xl leading-relaxed">
          Phase 4 will introduce natural language query answering and machine-learning driven predictive alerts directly over your Tally database.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          <div className="rounded-lg bg-white/10 p-2.5">🔍 Anomaly Detection</div>
          <div className="rounded-lg bg-white/10 p-2.5">💳 Payment Pattern AI</div>
          <div className="rounded-lg bg-white/10 p-2.5">📦 Smart Stock Reorders</div>
          <div className="rounded-lg bg-white/10 p-2.5">📈 Margin Alert Engine</div>
          <div className="rounded-lg bg-white/10 p-2.5">💵 Cash Flow Forecast</div>
        </div>
      </div>

      {/* Business Highlights Cards (Real Data) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Current Business Highlights</h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Top 3 Customers */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Top 3 Customers by Sales</h3>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-xs text-gray-400">Loading top customers...</p>
            ) : (
              <div className="space-y-2 text-xs">
                {topCustomers.map((c: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="font-semibold text-gray-800 truncate max-w-[140px]">{idx + 1}. {c.partyName}</span>
                    <span className="font-bold text-blue-600">{formatINR(c.totalSales)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Highest Margin Product */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-gray-900">Highest Revenue Product</h3>
            </div>
            {!topProduct ? (
              <p className="text-xs text-gray-400">Loading top product...</p>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-sm text-gray-900 truncate">{topProduct.stockItemName}</p>
                <div className="flex justify-between text-gray-600 mt-2">
                  <span>Total Sales:</span>
                  <span className="font-bold text-gray-900">{formatINR(topProduct.totalSaleValue)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Margin:</span>
                  <span className="font-bold text-emerald-600">{topProduct.marginPct}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Oldest Unpaid Bill */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-bold text-gray-900">Oldest Unpaid Receivable</h3>
            </div>
            {!oldestReceivable ? (
              <p className="text-xs text-gray-400">Loading oldest bill...</p>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-sm text-gray-900 truncate">{oldestReceivable.partyName}</p>
                <div className="flex justify-between text-gray-600 mt-2">
                  <span>Bill Ref:</span>
                  <span className="font-semibold text-blue-600">{oldestReceivable.billRef}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pending Amount:</span>
                  <span className="font-bold text-rose-600">{formatINR(oldestReceivable.pendingAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Overdue Days:</span>
                  <span className="font-bold text-amber-700">{oldestReceivable.overdueDays} days</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
