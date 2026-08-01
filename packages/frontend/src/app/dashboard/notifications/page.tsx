'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, RefreshCw, CheckCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/notifications?limit=100`, { headers });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${backendUrl}/api/notifications/read-all`, { method: 'POST', headers });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filterSeverity === 'all') return true;
    return n.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Critical</span>;
    } else if (severity === 'warning') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Warning</span>;
    } else {
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Info</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
            <Bell className="h-7 w-7 text-[#1D4ED8]" />
            Notifications Hub
          </h1>
          <p className="text-sm text-[#64748B]">System alerts, overdue payments, low stock, and margin warnings.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <CheckCheck className="h-4 w-4 text-emerald-600" />
            Mark All as Read
          </button>
          <button onClick={fetchNotifications} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 text-sm">
        {['all', 'critical', 'warning', 'info'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`capitalize px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterSeverity === sev ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No notifications found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((n) => (
              <div key={n.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/20' : ''}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(n.severity)}
                    <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-600"></span>}
                  </div>
                  <p className="text-xs text-gray-600">{n.message}</p>
                  <p className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                </div>

                {n.relatedUrl && (
                  <Link
                    href={n.relatedUrl}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline shrink-0 ml-4"
                  >
                    View Details →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
