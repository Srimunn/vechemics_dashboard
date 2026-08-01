'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Clock, Database, CheckCircle2, AlertTriangle, XCircle, Play } from 'lucide-react';

export default function AuditPage() {
  const [dataSummary, setDataSummary] = useState<any>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resSummary, resLogs] = await Promise.all([
        fetch(`${backendUrl}/api/audit/data-summary`, { headers }),
        fetch(`${backendUrl}/api/audit/sync-logs`, { headers }),
      ]);

      if (resSummary.ok) {
        const json = await resSummary.json();
        setDataSummary(json.summary);
      }
      if (resLogs.ok) {
        const json = await resLogs.json();
        setSyncLogs(json.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleManualSync = async () => {
    try {
      setTriggering(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/sync/trigger`, { method: 'POST', headers });
      if (res.ok) {
        alert('Sync trigger requested! The sync agent will consume it on its next poll.');
        fetchAuditData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Success
        </span>
      );
    } else if (status === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" /> Partial
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
          <XCircle className="h-3.5 w-3.5" /> Failed
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <ShieldCheck className="h-7 w-7 text-[#1D4ED8]" />
            Audit &amp; System Integrity
          </h1>
          <p className="text-sm text-[#64748B]">Tally synchronization status, data freshness, and record counts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152A45] shadow-sm disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            Trigger Manual Sync
          </button>
          <button onClick={fetchAuditData} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Freshness & Record Counters */}
      {dataSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-blue-700">Data Freshness</span>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-blue-900">
              {dataSummary.minutesSinceLastSync !== null ? `${dataSummary.minutesSinceLastSync} mins ago` : 'Never'}
            </p>
            <p className="mt-1 text-xs text-blue-600">Last synced: {dataSummary.lastSyncTime ? new Date(dataSummary.lastSyncTime).toLocaleString() : 'N/A'}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Vouchers</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{dataSummary.vouchersCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Line Items</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{dataSummary.itemsCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Stock Items</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{dataSummary.stockItemsCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase text-gray-500">Outstandings</span>
            <p className="mt-1 text-xl font-bold text-gray-900">{dataSummary.outstandingsCount}</p>
          </div>
        </div>
      )}

      {/* Sync Execution History Log */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Sync Logs (Last 20 Runs)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Started At</th>
                <th className="px-4 py-3">Finished At</th>
                <th className="px-4 py-3">Sync Type</th>
                <th className="px-4 py-3 text-right">Records Synced</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {syncLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">No sync logs recorded yet.</td>
                </tr>
              ) : (
                syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{new Date(log.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{log.finishedAt ? new Date(log.finishedAt).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-gray-600">{log.syncType}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{log.recordsSynced}</td>
                    <td className="px-4 py-3 text-right">{getStatusBadge(log.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
