'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Search, ChevronDown, ChevronRight, Filter, RefreshCw,
  AlertCircle, ArrowUpDown, IndianRupee, Layers, ShoppingBag, Truck, CheckCircle2, RotateCcw
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

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

interface BillOverhead {
  id?: string;
  companyId?: string;
  voucherId?: string;
  transportCost: number;
  labelingCost: number;
  loadingCost: number;
  otherCost: number;
  otherCostLabel?: string | null;
  notes?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  overhead?: BillOverhead | null;
  totalOverhead: number;
  tallyProfit: number;
  tallyMargin: number;
  adjustedProfit: number;
  adjustedMargin: number;
  hasOverhead: boolean;
}

interface BillPnlResponse {
  bills: BillRow[];
  summary: {
    totalSales: number;
    totalCost: number;
    totalProfit: number;
    avgMargin: number;
    totalOverhead?: number;
    trueCostOfGoods?: number;
    tallyProfit?: number;
    trueProfit?: number;
    tallyMargin?: number;
    trueMargin?: number;
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

function OverheadForm({ bill, onSaved }: { bill: BillRow; onSaved: () => void }) {
  const [transport, setTransport] = useState<string>(bill.overhead?.transportCost ? String(bill.overhead.transportCost) : '');
  const [labeling, setLabeling] = useState<string>(bill.overhead?.labelingCost ? String(bill.overhead.labelingCost) : '');
  const [loading, setLoading] = useState<string>(bill.overhead?.loadingCost ? String(bill.overhead.loadingCost) : '');
  const [other, setOther] = useState<string>(bill.overhead?.otherCost ? String(bill.overhead.otherCost) : '');
  const [otherLabel, setOtherLabel] = useState<string>(bill.overhead?.otherCostLabel || '');
  const [notes, setNotes] = useState<string>(bill.overhead?.notes || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setTransport(bill.overhead?.transportCost ? String(bill.overhead.transportCost) : '');
    setLabeling(bill.overhead?.labelingCost ? String(bill.overhead.labelingCost) : '');
    setLoading(bill.overhead?.loadingCost ? String(bill.overhead.loadingCost) : '');
    setOther(bill.overhead?.otherCost ? String(bill.overhead.otherCost) : '');
    setOtherLabel(bill.overhead?.otherCostLabel || '');
    setNotes(bill.overhead?.notes || '');
  }, [bill.overhead]);

  const numTransport = parseFloat(transport) || 0;
  const numLabeling = parseFloat(labeling) || 0;
  const numLoading = parseFloat(loading) || 0;
  const numOther = parseFloat(other) || 0;
  const liveTotalOverhead = numTransport + numLabeling + numLoading + numOther;

  const numTrueCost = bill.costValue + liveTotalOverhead;
  const numTrueProfit = bill.saleValue - numTrueCost;
  const numTrueMargin = bill.saleValue > 0 ? (numTrueProfit / bill.saleValue) * 100 : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setMsg(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/bill-overhead/${bill.id}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          transportCost: numTransport,
          labelingCost: numLabeling,
          loadingCost: numLoading,
          otherCost: numOther,
          otherCostLabel: otherLabel.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg('Saved ✓');
      setTimeout(() => setMsg(null), 3000);
      onSaved();
    } catch (err) {
      console.error('Failed to save overhead:', err);
      setMsg('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      setMsg(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/bill-overhead/${bill.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTransport('');
      setLabeling('');
      setLoading('');
      setOther('');
      setOtherLabel('');
      setNotes('');
      setMsg('Reset ✓');
      setTimeout(() => setMsg(null), 3000);
      onSaved();
    } catch (err) {
      console.error('Failed to reset overhead:', err);
      setMsg('Failed to reset');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
          <Truck className="h-4 w-4 text-blue-600" />
          <span>Additional Costs</span>
        </div>
        <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
          Total Additional Cost: {formatINR(liveTotalOverhead)}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Transport Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Labeling Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={labeling}
              onChange={(e) => setLabeling(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Loading Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={loading}
              onChange={(e) => setLoading(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Other Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Other cost label</label>
            <input
              type="text"
              placeholder="e.g., Clearing charges"
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Optional notes regarding expenses..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save costs
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isResetting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset
            </button>
          </div>

          {msg && (
            <span className={`text-xs font-semibold ${msg.includes('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {msg}
            </span>
          )}
        </div>
      </form>

      {/* Adjusted P&L Breakdown Card */}
      {liveTotalOverhead > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1.5">
          <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
            Adjusted P&amp;L Breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
            <div>
              <span className="block text-gray-400">Sale Value</span>
              <span className="font-medium text-gray-900">{formatINR(bill.saleValue)}</span>
            </div>
            <div>
              <span className="block text-gray-400">Stock Cost</span>
              <span className="font-medium text-gray-900">{formatINR(bill.costValue)}</span>
            </div>
            <div>
              <span className="block text-gray-400">Total True Cost</span>
              <span className="font-medium text-amber-700">{formatINR(numTrueCost)}</span>
            </div>
            <div>
              <span className="block text-gray-400">True Profit</span>
              <span className="font-semibold text-emerald-700">{formatINR(numTrueProfit)}</span>
              <span className="text-[10px] text-gray-400 block">(was {formatINR(bill.profit)})</span>
            </div>
          </div>
          <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200/80 flex items-center justify-between">
            <span>True Margin: <strong className="text-slate-800">{numTrueMargin.toFixed(1)}%</strong> <span className="text-gray-400">(was {bill.marginPct.toFixed(1)}%)</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Overhead Impact Analysis Charts Collapsible Panel Component
 */
function OverheadImpactPanel({ bills }: { bills: BillRow[] }) {
  const [isOpen, setIsOpen] = useState(true);

  // Filter bills that have overhead defined
  const overheadBills = bills.filter((b) => b.hasOverhead);
  if (overheadBills.length === 0) return null;

  // Chart A: Margin by Invoice (Grouped Bar Chart)
  const barChartData = overheadBills.map((b) => {
    const vNum = b.voucherNumber || '';
    const invoiceShort = vNum.length > 4 ? vNum.slice(-4) : vNum || b.id.slice(-4);
    return {
      invoiceFull: vNum,
      invoiceShort,
      customer: b.partyName,
      tallyMargin: Number((b.tallyMargin ?? b.marginPct ?? 0).toFixed(1)),
      trueMargin: Number((b.adjustedMargin ?? b.marginPct ?? 0).toFixed(1)),
    };
  });

  // Chart B: Overhead Cost Breakdown (Donut Pie Chart)
  const totalTransport = overheadBills.reduce((acc, b) => acc + (b.overhead?.transportCost || 0), 0);
  const totalLabeling = overheadBills.reduce((acc, b) => acc + (b.overhead?.labelingCost || 0), 0);
  const totalLoading = overheadBills.reduce((acc, b) => acc + (b.overhead?.loadingCost || 0), 0);
  const totalOther = overheadBills.reduce((acc, b) => acc + (b.overhead?.otherCost || 0), 0);
  const aggregateOverhead = totalTransport + totalLabeling + totalLoading + totalOther;

  const rawPieData = [
    { name: 'Transport', value: totalTransport, color: '#3b82f6' },
    { name: 'Labeling', value: totalLabeling, color: '#22c55e' },
    { name: 'Loading', value: totalLoading, color: '#f59e0b' },
    { name: 'Other', value: totalOther, color: '#a855f7' },
  ];

  // Hide slices that are ₹0
  const pieData = rawPieData.filter((item) => item.value > 0);

  // Summary calculation across bills with overhead
  const N = overheadBills.length;
  const sumSales = overheadBills.reduce((acc, b) => acc + (b.saleValue || 0), 0);
  const sumTallyProfit = overheadBills.reduce((acc, b) => acc + (b.profit || 0), 0);
  const sumTrueProfit = overheadBills.reduce((acc, b) => acc + (b.adjustedProfit ?? b.profit ?? 0), 0);

  const X = sumSales > 0 ? (sumTallyProfit / sumSales) * 100 : 0;
  const Y = sumSales > 0 ? (sumTrueProfit / sumSales) * 100 : 0;
  const Z = Math.max(0, X - Y);

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md text-xs space-y-1">
          <p className="font-bold text-gray-900">Invoice #{data.invoiceFull}</p>
          <p className="text-gray-600 font-medium">{data.customer}</p>
          <div className="pt-1 border-t border-gray-100 flex items-center justify-between gap-3">
            <span className="text-blue-600">Tally Margin: <strong>{data.tallyMargin}%</strong></span>
            <span className="text-indigo-600">True Margin: <strong>{data.trueMargin}%</strong></span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header with Collapsible Toggle */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer select-none border-b border-gray-100 pb-3"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
            <Layers className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Overhead Impact Analysis</h2>
        </div>
        <button type="button" className="text-gray-400 hover:text-gray-600">
          <ChevronDown className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart A: Margin by Invoice */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3.5 space-y-2">
              <h3 className="text-xs font-bold text-gray-700">Margin by Invoice (%)</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="invoiceShort" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                    <Bar dataKey="tallyMargin" name="Tally Margin" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="trueMargin" name="True Margin" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Overhead Cost Breakdown */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3.5 space-y-2 relative">
              <h3 className="text-xs font-bold text-gray-700">Overhead Cost Breakdown</h3>
              <div className="relative" style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${formatINR(value)}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => [formatINR(val), 'Cost']} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text for Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Overhead</span>
                  <span className="text-xs font-bold text-gray-900">{formatINR(aggregateOverhead)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Summary Line */}
          <div className="pt-3 border-t border-gray-100 text-xs text-gray-600 text-center font-medium">
            Tally Margin: <span className="font-bold text-emerald-600">{X.toFixed(1)}%</span> → True Margin: <span className="font-bold text-amber-600">{Y.toFixed(1)}%</span> <span className="text-gray-500">(−{Z.toFixed(1)}% overhead impact across {N} bill{N !== 1 ? 's' : ''})</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillPnlPage() {
  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayStr = () => new Date().toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());

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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let minMargin: number | undefined;
      let maxMargin: number | undefined;
      if (marginFilter === 'high') minMargin = 25;
      else if (marginFilter === 'mid') { minMargin = 15; maxMargin = 25; }
      else if (marginFilter === 'low') maxMargin = 15;

      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        customer: searchCustomer,
        sortBy,
        sortDir,
        from: fromDate,
        to: toDate,
        ...(minMargin !== undefined ? { minMargin: String(minMargin) } : {}),
        ...(maxMargin !== undefined ? { maxMargin: String(maxMargin) } : {}),
      });

      const res = await fetch(`${backendUrl}/api/bill-pnl?${params.toString()}`, { headers, credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Fetch Bill P&L Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Bill-wise P&L data');
    } finally {
      setLoading(false);
    }
  }, [page, searchCustomer, marginFilter, sortBy, sortDir, fromDate, toDate]);

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
    if (pct >= 25) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
          {pct.toFixed(1)}%
        </span>
      );
    } else if (pct >= 15) {
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

  const summary = data?.summary;
  const trueCost = summary?.trueCostOfGoods ?? summary?.totalCost ?? 0;
  const stockCost = summary?.totalCost ?? 0;
  const totalOverheadVal = summary?.totalOverhead ?? 0;
  const trueProfitVal = summary?.trueProfit ?? summary?.totalProfit ?? 0;
  const tallyProfitVal = summary?.tallyProfit ?? summary?.totalProfit ?? 0;
  const trueMarginVal = summary?.trueMargin ?? summary?.avgMargin ?? 0;
  const tallyMarginVal = summary?.tallyMargin ?? summary?.avgMargin ?? 0;

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
            Profitability breakdown for every sales invoice matching Tally with per-invoice overhead cost entry.
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
          <ExportButton moduleName="bill-pnl" label="Export" fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      {/* Date Range Bar */}
      <DateRangePicker initialFrom={fromDate} initialTo={toDate} onApply={(from, to) => { setFromDate(from); setToDate(to); }} />

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 line-clamp-1">Total Sales Value</span>
              <div className="rounded-lg bg-blue-50 p-1.5 sm:p-2 text-blue-600 shrink-0"><IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-bold text-gray-900">{formatINR(summary.totalSales)}</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-500 line-clamp-1">Gross invoiced amount</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 line-clamp-1">Cost of Goods</span>
              <div className="rounded-lg bg-amber-50 p-1.5 sm:p-2 text-amber-600 shrink-0"><ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-bold text-gray-900">{formatINR(trueCost)}</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-500 line-clamp-1">
              Stock: {formatINR(stockCost)} · Overhead: {formatINR(totalOverheadVal)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 line-clamp-1">Total Bill Profit</span>
              <div className="rounded-lg bg-emerald-50 p-1.5 sm:p-2 text-emerald-600 shrink-0"><TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-bold text-emerald-600">{formatINR(trueProfitVal)}</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-500 line-clamp-1">
              Tally: {formatINR(tallyProfitVal)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 line-clamp-1">Average Margin</span>
              <div className="rounded-lg bg-indigo-50 p-1.5 sm:p-2 text-indigo-600 shrink-0"><Layers className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-bold text-indigo-600">{trueMarginVal.toFixed(1)}%</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-500 line-clamp-1">
              Tally: {tallyMarginVal.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Overhead Impact Analysis Charts Section (Collapsible) */}
      {data?.bills && <OverheadImpactPanel bills={data.bills} />}

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
            <option value="high">High Margin (&ge;25%)</option>
            <option value="mid">Medium (15% - 25%)</option>
            <option value="low">Low (&lt;15%)</option>
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
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalOverhead')}>
                    <div className="flex items-center justify-end gap-1">Overhead <ArrowUpDown className="h-3 w-3" /></div>
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
                  const displayProfit = bill.adjustedProfit ?? bill.profit;
                  const displayMargin = bill.adjustedMargin ?? bill.marginPct;

                  return (
                    <tr key={bill.id} className="group hover:bg-blue-50/40 transition-colors">
                      <td colSpan={9} className="p-0">
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
                          <div className="w-36 font-semibold text-blue-600 flex items-center gap-1.5">
                            <span>{bill.voucherNumber}</span>
                            {bill.hasOverhead && (
                              <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-600/20" title="Custom overhead costs included">
                                +OH
                              </span>
                            )}
                          </div>
                          <div className="flex-1 font-medium text-gray-800 truncate px-2">{bill.partyName}</div>
                          <div className="w-28 text-right font-semibold text-gray-900">{formatINR(bill.saleValue)}</div>
                          <div className="w-28 text-right text-gray-600">{formatINR(bill.costValue)}</div>
                          <div className="w-28 text-right text-gray-600 font-medium">
                            {bill.totalOverhead > 0 ? formatINR(bill.totalOverhead) : '—'}
                          </div>
                          <div className="w-28 text-right font-semibold text-emerald-600">{formatINR(displayProfit)}</div>
                          <div className="w-24 text-right">{getMarginBadge(displayMargin)}</div>
                        </div>

                        {/* Expandable Row for Item Breakdown & Overhead Form */}
                        {isExpanded && (
                          <div className="bg-gray-50/80 px-4 sm:px-12 py-4 border-t border-b border-gray-200">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                              Item-level Profit Breakdown ({bill.items.length} item{bill.items.length !== 1 ? 's' : ''})
                            </p>
                            {bill.items.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-1">No individual inventory entries recorded for this invoice.</p>
                            ) : (
                              <div className="overflow-x-auto">
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
                              </div>
                            )}

                            {/* Additional Costs Accountant Form */}
                            <OverheadForm bill={bill} onSaved={fetchBillPnl} />
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
