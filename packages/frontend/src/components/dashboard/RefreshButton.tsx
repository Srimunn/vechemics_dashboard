'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerSync } from '@/lib/api';
import { cn } from '@/lib/utils';

export function RefreshButton({
  onRefreshed,
  className,
}: {
  onRefreshed?: () => void | Promise<void>;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await triggerSync();
      await onRefreshed?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 rounded-[10px] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#1E3A5F] shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.22)] active:scale-95 disabled:opacity-75',
        className,
      )}
    >
      <RefreshCw className={cn('h-4 w-4 text-[#1E3A5F]', busy && 'animate-spin')} />
      {busy ? 'Refreshing...' : 'Refresh Tally Data'}
    </button>
  );
}
