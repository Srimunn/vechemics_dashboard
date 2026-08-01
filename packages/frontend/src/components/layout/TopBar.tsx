'use client';

import * as React from 'react';
import { Menu, Search, Bell, ChevronDown, X, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Info, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

export function TopBar({ userName = 'Velmurugan', userRole = 'CEO / MD' }: { userName?: string; userRole?: string }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]!);

  const displayUserName = 'Velmurugan';
  const displayRole = 'CEO / MD';

  const fetchNotifications = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resCount, resList] = await Promise.all([
        fetch(`${backendUrl}/api/notifications/count`, { headers }),
        fetch(`${backendUrl}/api/notifications?limit=10`, { headers }),
      ]);

      if (resCount.ok) {
        const json = await resCount.json();
        setUnreadCount(json.unreadCount || 0);
      }
      if (resList.ok) {
        const json = await resList.json();
        setNotifications(json.notifications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSync = async () => {
    try {
      setRefreshing(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/sync/trigger`, { method: 'POST', headers });
      if (res.ok) {
        alert('Tally Sync Triggered! Standalone sync agent will fetch data on next poll.');
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAsRead = async (id: string, url?: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${backendUrl}/api/notifications/${id}/read`, { method: 'POST', headers });
      fetchNotifications();
      if (url) {
        setNotifOpen(false);
        router.push(url);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />;
    return <Info className="h-4 w-4 text-blue-600 shrink-0" />;
  };

  const initials = displayUserName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-[#E2E8F0] bg-[#FFFFFF] px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9] lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search Input */}
          <div className="relative hidden w-[300px] lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-[#94A3B8]" />
            <input
              className="h-[38px] w-full rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] pl-9 pr-3 text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              placeholder="Search invoices, ledgers, products..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Header Control Filters */}
          <div className="hidden items-center gap-[8px] xl:flex">
            {/* Company Dropdown (Read-Only) */}
            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] font-medium text-[#334155]">
              <span className="font-semibold text-blue-700">Company:</span> VChemics India Solutions
            </div>

            {/* FY Dropdown (Read-Only) */}
            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] font-medium text-[#334155]">
              <span className="font-semibold text-emerald-700">FY:</span> 2026-27
            </div>

            {/* Date Picker Filter */}
            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-[12px] font-medium text-[#334155]">
              <Calendar className="h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs focus:outline-none"
              />
            </div>

            {/* Manual Sync Trigger Button */}
            <button
              onClick={handleTriggerSync}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-blue-50 px-2.5 py-1.5 text-[12px] font-semibold text-[#1D4ED8] hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Tally Data
            </button>
          </div>

          {/* Notification Bell Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-[#64748B]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">System Notifications</h3>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs text-gray-400">No active notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id, n.relatedUrl)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          n.isRead ? 'bg-gray-50 border-gray-100' : 'bg-blue-50/50 border-blue-100 font-medium'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {getSeverityIcon(n.severity)}
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 leading-tight">{n.title}</p>
                            <p className="mt-1 text-gray-600 text-[11px] leading-relaxed">{n.message}</p>
                            <p className="mt-1 text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 text-center">
                  <Link
                    href="/dashboard/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View All Notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2">
            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-[13px] font-semibold text-[#334155]">{displayUserName}</p>
              <p className="text-[11px] font-normal text-[#94A3B8]">{displayRole}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className={cn('absolute left-0 top-0 h-full w-64 border-r border-[#E2E8F0] bg-[#FFFFFF] shadow-xl')}>
            <button
              type="button"
              className="absolute right-2 top-3 rounded-md p-2 text-[#64748B] hover:bg-[#F1F5F9]"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
