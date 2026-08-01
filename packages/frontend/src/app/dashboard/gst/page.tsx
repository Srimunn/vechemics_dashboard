'use client';

import { useState, useEffect } from 'react';
import { ReceiptText, RefreshCw, IndianRupee } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export default function GstPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/analytics/gst`, { headers });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <ReceiptText className="h-7 w-7 text-[#1D4ED8]" />
            GST Compliance &amp; Tax Liability
          </h1>
          <p className="text-sm text-[#64748B]">Output GST, Input Tax Credit (ITC), and Net GST Liability.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton moduleName="gst" label="Export Excel" />
        </div>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Output GST Liability (Sales)</span>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatINR(data.summary.totalOutput)}</p>
            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>CGST: {formatINR(data.summary.outputCgst)}</span>
              <span>SGST: {formatINR(data.summary.outputSgst)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-700">Input Tax Credit (Purchases)</span>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatINR(data.summary.totalInput)}</p>
            <div className="mt-2 text-xs text-emerald-600 flex justify-between">
              <span>CGST: {formatINR(data.summary.inputCgst)}</span>
              <span>SGST: {formatINR(data.summary.inputSgst)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase text-rose-700">Net GST Payable</span>
            <p className="mt-2 text-2xl font-bold text-rose-700">{formatINR(data.summary.netGstPayable)}</p>
            <p className="mt-1 text-xs text-rose-600">Net tax after ITC offset</p>
          </div>
        </div>
      )}

      {/* Tax Liability vs ITC Comparison Chart */}
      {data?.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Output GST vs Input Tax Credit</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => [formatINR(Number(value)), 'Amount']} />
                <Legend />
                <Bar dataKey="output" name="Output GST" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="input" name="Input Tax Credit (ITC)" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Breakdown Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly GST Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Output GST</th>
                <th className="px-4 py-3 text-right">Input Tax Credit</th>
                <th className="px-4 py-3 text-right">Net GST Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.monthlyBreakdown?.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(row.output)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatINR(row.input)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatINR(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
