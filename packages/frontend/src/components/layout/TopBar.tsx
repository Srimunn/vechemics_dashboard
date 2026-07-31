'use client';

import * as React from 'react';
import { Menu, Search, Bell, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

const FILTERS: { label: string; value: string }[] = [
  { label: 'Company', value: 'VChemics India Sol…' },
  { label: 'Branch', value: 'All Branches' },
  { label: 'FY', value: 'FY 2026-27' },
  { label: 'Date range', value: 'Today' },
  { label: 'Executive', value: 'All Executives' },
];

function FilterPill({ value }: { value: string }) {
  // Non-functional in Phase 1 — shown for polish (spec section 6).
  return (
    <button
      type="button"
      className="hidden items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent xl:inline-flex"
    >
      {value}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}

export function TopBar({ userName, userRole }: { userName: string; userRole: string }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-6">
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search (non-functional in Phase 1) */}
        <div className="relative hidden max-w-sm flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search invoices, ledgers, products…"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1.5 xl:flex">
            {FILTERS.map((f) => (
              <FilterPill key={f.label} value={f.value} />
            ))}
          </div>

          <button
            type="button"
            className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              4
            </span>
          </button>

          <div className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className={cn('absolute left-0 top-0 h-full w-64 border-r bg-card shadow-xl')}>
            <button
              type="button"
              className="absolute right-2 top-3 rounded-md p-2 text-muted-foreground hover:bg-accent"
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
