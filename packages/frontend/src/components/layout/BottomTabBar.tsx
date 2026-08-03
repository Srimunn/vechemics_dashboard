'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BarChart3,
  FileSpreadsheet,
  Bell,
  MoreHorizontal,
  X,
  TrendingUp,
  ShoppingCart,
  ReceiptIndianRupee,
  Package,
  ShieldAlert,
  Users,
  Settings,
  FileText,
  Percent,
  Calendar,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavModule {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const MORE_MODULES: NavModule[] = [
  { name: 'Sales Analytics', href: '/dashboard/sales-analytics', icon: TrendingUp },
  { name: 'Purchase Analytics', href: '/dashboard/purchase-analytics', icon: ShoppingCart },
  { name: 'Receivables (DSO)', href: '/dashboard/receivables', icon: ReceiptIndianRupee },
  { name: 'Payables (DPO)', href: '/dashboard/payables', icon: ReceiptIndianRupee },
  { name: 'Inventory Valuation', href: '/dashboard/inventory', icon: Package },
  { name: 'Financial Overview', href: '/dashboard/financial-overview', icon: Layers },
  { name: 'GST & Tax Compliance', href: '/dashboard/gst', icon: ShieldAlert },
  { name: 'Product Profitability', href: '/dashboard/product-profitability', icon: Percent },
  { name: 'Customer Intelligence', href: '/dashboard/customers', icon: Users },
  { name: 'Daily Business Report', href: '/dashboard/daily-report', icon: FileText },
  { name: 'Settings & Admin', href: '/dashboard/settings', icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard/ceo') {
      return pathname === '/dashboard/ceo' || pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Slide-up "More" Sheet Modal on Mobile */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />

          {/* Bottom Sheet Container */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[85vh] flex-col rounded-t-[24px] bg-white p-5 shadow-2xl transition-transform animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle & Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <MoreHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">All Modules &amp; Reports</h3>
                  <p className="text-xs text-slate-500">Tap any item to navigate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95"
                aria-label="Close sheet"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modules Grid List */}
            <div className="overflow-y-auto pt-2 pb-6 space-y-1">
              {MORE_MODULES.map((mod) => {
                const Icon = mod.icon;
                const active = pathname.startsWith(mod.href);
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-4 py-3.5 transition-colors min-h-[52px]',
                      active
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100',
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl',
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold">{mod.name}</span>
                    </div>
                    {mod.badge && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {mod.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Tab Bar Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-[80px] items-center justify-around border-t border-slate-200 bg-white/95 px-2 pb-4 pt-2 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.06)] lg:hidden"
        aria-label="Mobile Navigation"
      >
        {/* 1. Dashboard */}
        <Link
          href="/dashboard/ceo"
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[48px]',
            isActive('/dashboard/ceo') ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-slate-900',
          )}
        >
          <Home className="h-7 w-7 stroke-[2.2]" />
          <span className="mt-1 text-[11px] font-bold tracking-tight">Dashboard</span>
        </Link>

        {/* 2. Analytics */}
        <Link
          href="/dashboard/bill-pnl"
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[48px]',
            isActive('/dashboard/bill-pnl') ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-slate-900',
          )}
        >
          <BarChart3 className="h-7 w-7 stroke-[2.2]" />
          <span className="mt-1 text-[11px] font-bold tracking-tight">Analytics</span>
        </Link>

        {/* 3. Reports */}
        <Link
          href="/dashboard/reports"
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[48px]',
            isActive('/dashboard/reports') ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-slate-900',
          )}
        >
          <FileSpreadsheet className="h-7 w-7 stroke-[2.2]" />
          <span className="mt-1 text-[11px] font-bold tracking-tight">Reports</span>
        </Link>

        {/* 4. Alerts */}
        <Link
          href="/dashboard/notifications"
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[48px] relative',
            isActive('/dashboard/notifications') ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-slate-900',
          )}
        >
          <Bell className="h-7 w-7 stroke-[2.2]" />
          <span className="mt-1 text-[11px] font-bold tracking-tight">Alerts</span>
        </Link>

        {/* 5. More */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[48px]',
            moreOpen ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-slate-900',
          )}
          aria-label="More Menu"
        >
          <MoreHorizontal className="h-7 w-7 stroke-[2.2]" />
          <span className="mt-1 text-[11px] font-bold tracking-tight">More</span>
        </button>
      </nav>
    </>
  );
}
