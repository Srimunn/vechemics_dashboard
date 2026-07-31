'use client';

import * as React from 'react';
import { Menu, Search, Bell, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

const FILTERS: { label: string; value: string }[] = [
  { label: 'Company', value: 'VChemics India Sol...' },
  { label: 'Branch', value: 'All Branches' },
  { label: 'FY', value: 'FY 2026-27' },
  { label: 'Date range', value: 'Today' },
  { label: 'Executive', value: 'All Executives' },
];

function FilterPill({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="hidden items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-[13px] font-medium text-[#334155] transition-colors hover:bg-[#F8FAFC] xl:inline-flex"
    >
      {value}
      <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
    </button>
  );
}

export function TopBar({ userName = 'Velmurugan', userRole = 'CEO / MD' }: { userName?: string; userRole?: string }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  let displayUserName = userName || 'Velmurugan';
  if (displayUserName === 'Ravi Venkatesan' || displayUserName === 'Ravi') {
    displayUserName = 'Velmurugan';
  }
  const displayRole = userRole || 'CEO / MD';

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
          <div className="relative hidden w-[360px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-[#94A3B8]" />
            <input
              className="h-[38px] w-full rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] pl-9 pr-3 text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              placeholder="Search invoices, ledgers, products..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdowns in a row with 12px gap */}
          <div className="hidden items-center gap-[12px] xl:flex">
            {FILTERS.map((f) => (
              <FilterPill key={f.label} value={f.value} />
            ))}
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            className="relative rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-[#64748B]" />
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold text-white">
              4
            </span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2">
            <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
              {initials || 'V'}
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
