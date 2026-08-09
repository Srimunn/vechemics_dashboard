'use client';

import { useState, useEffect } from 'react';
import { Bell, RefreshCw, CheckCheck, X, Settings, Inbox, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

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
      console.error('Failed to fetch notifications:', err);
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
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${backendUrl}/api/notifications/${id}/read`, { method: 'POST', headers });
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Quick stats counters
  const totalCount = notifications.length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical').length;
  const warningCount = notifications.filter((n) => n.severity === 'warning').length;
  const infoCount = notifications.filter((n) => n.severity === 'info').length;

  const filtered = notifications.filter((n) => {
    if (filterSeverity === 'all') return true;
    return n.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 shrink-0">
          <AlertCircle className="h-3 w-3" /> Critical
        </span>
      );
    } else if (severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 shrink-0">
          <AlertTriangle className="h-3 w-3" /> Warning
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 shrink-0">
          <Info className="h-3 w-3" /> Info
        </span>
      );
    }
  };

  const getBorderColor = (severity: string) => {
    if (severity === 'critical') return 'border-l-rose-500';
    if (severity === 'warning') return 'border-l-amber-500';
    return 'border-l-blue-500';
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Date grouping
  const getGroupKey = (dateStr: string): 'Today' | 'Yesterday' | 'Earlier this week' | 'Older' => {
    const date = new Date(dateStr);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const t = date.getTime();
    if (t >= startOfToday) return 'Today';
    if (t >= startOfYesterday) return 'Yesterday';
    if (t >= startOfWeek) return 'Earlier this week';
    return 'Older';
  };

  const paginatedNotifications = filtered.slice(0, visibleCount);

  // Group paginated items by date
  const groups: Record<string, any[]> = {
    Today: [],
    Yesterday: [],
    'Earlier this week': [],
    Older: [],
  };

  paginatedNotifications.forEach((item) => {
    const key = getGroupKey(item.createdAt);
    groups[key].push(item);
  });

  const groupKeys = (['Today', 'Yesterday', 'Earlier this week', 'Older'] as const).filter(
    (key) => groups[key].length > 0
  );

  return (
    <div className="space-y-6">
      {/* Top Heading */}
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
          <Bell className="h-7 w-7 text-[#1D4ED8]" />
          Notifications Hub
        </h1>
        <p className="text-sm text-[#64748B]">System alerts, overdue payments, low stock, and margin warnings.</p>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
          {criticalCount} Critical
        </span>
        <span className="text-gray-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
          {warningCount} Warning
        </span>
        <span className="text-gray-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
          {infoCount} Info
        </span>
        <span className="text-gray-300">•</span>
        <span className="inline-flex items-center gap-1.5 text-gray-900 font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700"></span>
          {totalCount > 99 ? '99+ Total' : `${totalCount} Total`}
        </span>
      </div>

      {/* Action Bar (Filters + Action Buttons) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-200 pb-3">
        {/* Filter Tabs with Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { key: 'all', label: 'All', count: totalCount },
            { key: 'critical', label: 'Critical', count: criticalCount },
            { key: 'warning', label: 'Warning', count: warningCount },
            { key: 'info', label: 'Info', count: infoCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilterSeverity(tab.key);
                setVisibleCount(20);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterSeverity === tab.key
                  ? 'bg-[#1D4ED8] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  filterSeverity === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
            Mark All as Read
          </button>
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-sm"
          >
            <Settings className="h-3.5 w-3.5 text-blue-600" />
            ⚙ Notification Settings
          </Link>
        </div>
      </div>

      {/* Notifications List Grouped by Date */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm flex flex-col items-center justify-center gap-3">
          <Inbox className="h-10 w-10 text-gray-300" />
          <div>
            <p className="text-sm font-bold text-gray-800">No notifications found</p>
            <p className="text-xs text-gray-500">You're all caught up! No notifications match the selected filter.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupKeys.map((groupTitle) => (
            <div key={groupTitle} className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                {groupTitle} — {groups[groupTitle].length} {groups[groupTitle].length === 1 ? 'notification' : 'notifications'}
              </h2>

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                {groups[groupTitle].map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 transition-colors cursor-pointer hover:bg-gray-50/80 ${getBorderColor(
                      n.severity
                    )} ${!n.isRead ? 'bg-blue-50/40' : 'bg-white'}`}
                  >
                    {/* Left & Middle: Badge, Title, Message, Timestamp */}
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(n.severity)}
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900">{n.title}</h3>
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Unread"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {formatRelativeTime(n.createdAt)} • {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Right side: View details + Dismiss button */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {n.relatedUrl && (
                        <Link
                          href={n.relatedUrl}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Details →
                        </Link>
                      )}

                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          title="Mark as read / Dismiss"
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {filtered.length > visibleCount && (
            <div className="pt-2 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} notifications — Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
