'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TOP_NAV_ITEMS,
  DROPDOWN_NAV_GROUPS,
  BOTTOM_NAV_ITEMS,
  NavItem,
} from '@/lib/nav';

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // All groups default to EXPANDED (pure React state, zero localStorage)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Analytics: true,
    Operations: true,
    Compliance: true,
  });

  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Unread notifications count fetch (guarded with typeof window check)
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/notifications/count`, { headers, credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setUnreadCount(json.unreadCount || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchUnread();
  }, []);

  // Auto-expand parent dropdown if active route is inside it
  useEffect(() => {
    DROPDOWN_NAV_GROUPS.forEach((group) => {
      const hasActiveChild = group.items.some((item) => item.href === pathname);
      if (hasActiveChild) {
        setExpandedGroups((prev) => (prev[group.label] ? prev : { ...prev, [group.label]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const renderItem = (item: NavItem, isIndented = false) => {
    const active = pathname === item.href;
    const isNotifications = item.href === '/dashboard/notifications';
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center justify-between rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-all duration-150 my-0.5',
          isIndented ? 'pl-4 text-[#475569]' : 'text-[#475569]',
          active
            ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border-l-[3px] border-[#1D4ED8]'
            : 'hover:bg-[#F1F5F9] hover:text-[#1E293B]',
        )}
      >
        <div className="flex items-center truncate min-w-0">
          <Icon className={cn('mr-2.5 h-[17px] w-[17px] shrink-0', active ? 'text-[#1D4ED8]' : 'text-[#64748B]')} />
          <span className="truncate">{item.title}</span>
        </div>

        {isNotifications && unreadCount > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#FFFFFF] text-[#475569] select-none">
      {/* Company header */}
      <div className="flex items-center gap-3 bg-[#1E3A5F] px-4 py-4 text-white shrink-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-snug text-white">VChemics India Solutions</p>
          <p className="truncate text-xs font-normal text-white/70">CEO Dashboard</p>
        </div>
      </div>

      {/* Main scrollable nav list */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Top Section: Direct links */}
        <div className="space-y-0.5">
          {TOP_NAV_ITEMS.map((item) => renderItem(item))}
        </div>

        {/* Collapsible Dropdown Groups */}
        {DROPDOWN_NAV_GROUPS.map((group) => {
          const isExpanded = !!expandedGroups[group.label];
          const hasActiveChild = group.items.some((item) => item.href === pathname);

          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors rounded-md text-left',
                  hasActiveChild ? 'text-blue-700 font-extrabold' : 'text-[#94A3B8] hover:text-slate-700'
                )}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
              </button>

              {/* Collapsible Container with max-height transition */}
              <div
                className={cn(
                  'space-y-0.5 overflow-hidden transition-all duration-200',
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                )}
              >
                {group.items.map((item) => renderItem(item, true))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Pinned Bottom Section (separated by subtle divider) */}
      <div className="border-t border-[#E2E8F0] px-3 pt-2 pb-3 shrink-0 bg-white">
        <div className="space-y-0.5 mb-2">
          {BOTTOM_NAV_ITEMS.map((item) => renderItem(item))}
        </div>

        <div className="flex items-center px-3 pt-2 text-[11px] text-[#94A3B8] border-t border-slate-100">
          <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="truncate">Tally sync • TallyPrime Release 7.0 • XML API</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#E2E8F0] bg-[#FFFFFF] lg:block">
      <SidebarContent />
    </aside>
  );
}
