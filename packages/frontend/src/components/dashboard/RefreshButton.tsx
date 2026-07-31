'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { triggerSync } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * "Refresh Tally Data" — inserts a sync trigger the agent will pick up, then
 * invokes onRefreshed so the page can refetch. Shows a spinning state.
 */
export function RefreshButton({
  onRefreshed,
  variant = 'primary',
  className,
  ...props
}: { onRefreshed?: () => void | Promise<void> } & ButtonProps) {
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
    <Button variant={variant} onClick={handleClick} disabled={busy} className={cn(className)} {...props}>
      <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
      {busy ? 'Refreshing…' : 'Refresh Tally Data'}
    </Button>
  );
}
