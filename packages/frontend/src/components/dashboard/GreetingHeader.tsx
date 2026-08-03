'use client';

import { Sparkles, FileText } from 'lucide-react';
import { greeting } from '@/lib/format';
import { LastSyncIndicator } from './LastSyncIndicator';
import { RefreshButton } from './RefreshButton';

export function GreetingHeader({
  name = 'Velmurugan',
  fyLabel = 'FY 2026-27',
  lastSync,
  onRefreshed,
}: {
  name: string;
  fyLabel: string;
  lastSync: { finishedAt: string | null; status?: 'success' | 'partial' | 'failed' } | null;
  onRefreshed?: () => void | Promise<void>;
}) {
  const firstName = name.split(' ')[0] ?? name;

  return (
    <div
      className="mb-4 sm:mb-[28px] rounded-[16px] p-4 sm:px-8 sm:py-[28px] text-white shadow-md"
      style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] sm:text-[12px] font-semibold text-white backdrop-blur-xs">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Executive Intelligence
            </span>
          </div>

          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-white leading-tight">
            Good {greeting()}, {firstName}
          </h1>

          {/* Last sync time */}
          <div className="flex items-center text-[12px] text-white/80 font-medium">
            <LastSyncIndicator
              finishedAt={lastSync?.finishedAt ?? null}
              status={lastSync?.status}
            />
          </div>

          <p className="hidden sm:block text-[14px] font-normal text-white/70">
            Today&apos;s Business Summary · {fyLabel} Executive Performance Cockpit
          </p>
        </div>

        {/* Buttons hidden inside mobile banner (accessible via TopBar/FAB) */}
        <div className="hidden sm:flex flex-wrap items-center gap-3">
          <RefreshButton onRefreshed={onRefreshed} />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[10px] bg-white/15 px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/25 active:scale-95 min-h-[44px]"
          >
            <FileText className="h-4 w-4 text-white" />
            Daily Business Report
          </button>
        </div>
      </div>
    </div>
  );
}
