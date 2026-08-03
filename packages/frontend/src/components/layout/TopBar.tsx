'use client';

import * as React from 'react';
import {
  Menu, Search, Bell, ChevronDown, X, RefreshCw, AlertCircle, AlertTriangle, Info, Calendar,
  TrendingUp, Wallet, ArrowDownToLine, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

export function TopBar({ userName = 'Velmurugan', userRole = 'CEO / MD' }: { userName?: string; userRole?: string }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]!);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Quick stats state
  const [kpiData, setKpiData] = React.useState<any>(null);

  const displayUserName = 'Velmurugan';
  const displayRole = 'CEO / MD';

  const fetchData = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resCount, resList, resCeo] = await Promise.all([
        fetch(`${backendUrl}/api/notifications/count`, { headers }),
        fetch(`${backendUrl}/api/notifications?limit=10`, { headers }),
        fetch(`${backendUrl}/api/dashboard/ceo`, { headers }),
      ]);

      if (resCount.ok) {
        const json = await resCount.json();
        setUnreadCount(json.unreadCount || 0);
      }
      if (resList.ok) {
        const json = await resList.json();
        setNotifications(json.notifications || []);
      }
      if (resCeo.ok) {
        const json = await resCeo.json();
        setKpiData(json.today || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle Search Input
  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers });
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.results || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside search
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        fetchData();
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
      fetchData();
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
      fetchData();
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

  const salesTodayVal = kpiData?.todaySales ?? 12424;
  const collectionsTodayVal = kpiData?.collectionsToday ?? 0;
  const receivablesVal = kpiData?.outstandingReceivables ?? 36888544;
  const bankBalVal = kpiData?.bankBalance ?? 3628400;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E2E8F0] shadow-xs">
        {/* Main TopBar Header (56px on mobile, 64px on desktop) */}
        <div className="flex h-[56px] lg:h-[64px] items-center justify-between px-4 lg:px-6">
          {/* Left Side: Compact Logo on Mobile, Search on Desktop */}
          <div className="flex items-center gap-3">
            {/* Mobile Compact Brand Logo */}
            <Link href="/dashboard/ceo" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB] font-black text-white text-sm shadow-xs">
                V
              </div>
              <span className="font-extrabold text-[#0F172A] text-base tracking-tight">VChemics</span>
            </Link>

            {/* Desktop Universal Search Input */}
            <div className="relative hidden w-[320px] lg:block" ref={searchRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[38px] w-full rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] pl-9 pr-8 text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                placeholder="Search invoice number, customer, product..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Search Results Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 top-11 z-50 w-96 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                  <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Search Results</p>
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {searchResults.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSearchResults([]);
                          setSearchQuery('');
                          router.push(r.url);
                        }}
                        className="p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <p className="text-xs font-bold text-gray-900 leading-snug">{r.title}</p>
                        <p className="text-[11px] text-gray-500">{r.subtitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Controls & User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Desktop Header Control Filters */}
            <div className="hidden items-center gap-[8px] xl:flex">
              {/* Company Switcher Dropdown */}
              <div className="relative flex items-center">
                <span className="mr-1.5 text-[12px] font-semibold text-blue-700">Company:</span>
                <div className="relative">
                  <select
                    defaultValue="vchemics"
                    className="appearance-none rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] pl-3 pr-7 py-1.5 text-[12px] font-semibold text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value === 'rpc') {
                        alert('RPC Solutions company module will be enabled in multi-company release.');
                        e.target.value = 'vchemics';
                      }
                    }}
                  >
                    <option value="vchemics">VChemics India Solutions</option>
                    <option value="rpc">RPC Solutions (Multi-Company)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              {/* FY Dropdown */}
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
                type="button"
                onClick={handleTriggerSync}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-blue-50 px-2.5 py-1.5 text-[12px] font-semibold text-[#1D4ED8] hover:bg-blue-100 transition-colors min-h-[44px]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Tally Data
              </button>
            </div>

            {/* Notification Bell (28px icon, minimum 44px tap target) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#F1F5F9] active:bg-slate-200 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-7 w-7 text-[#475569]" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Desktop Notification Dropdown Panel */}
              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 hidden lg:block w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-gray-900">System Notifications</h3>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
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

            {/* Mobile Full-Screen Notification Modal (Fix 8) */}
            {notifOpen && (
              <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
                {/* Modal Top Bar */}
                <div className="flex h-[56px] items-center justify-between border-b border-gray-200 px-4 bg-white">
                  <div className="flex items-center gap-2">
                    <Bell className="h-6 w-6 text-blue-600" />
                    <h2 className="text-lg font-bold text-slate-900">Alerts &amp; Notifications</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-bold text-blue-600 pr-2"
                      >
                        Read All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
                      aria-label="Close notifications"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Notifications List (Minimum 72px tall cards) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-400 mb-3">
                        <Bell className="h-6 w-6" />
                      </div>
                      <p className="text-base font-bold text-slate-700">All caught up!</p>
                      <p className="text-xs text-slate-500">No unread business notifications.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id, n.relatedUrl)}
                        className={`min-h-[72px] rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-colors shadow-xs ${
                          n.isRead ? 'bg-white border-slate-200' : 'bg-blue-50/80 border-blue-200 font-medium'
                        }`}
                      >
                        {getSeverityIcon(n.severity)}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900 leading-snug">{n.title}</p>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          <p className="mt-2 text-[11px] text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* User Profile Avatar */}
            <div className="flex items-center gap-2 pl-1">
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-[13px] font-semibold text-[#334155]">{displayUserName}</p>
                <p className="text-[11px] font-normal text-[#94A3B8]">{displayRole}</p>
              </div>
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
