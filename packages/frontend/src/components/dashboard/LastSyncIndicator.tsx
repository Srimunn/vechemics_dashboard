'use client';

import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function LastSyncIndicator({
  finishedAt,
  status,
}: {
  finishedAt: string | null;
  status?: 'success' | 'partial' | 'failed';
}) {
  const label = finishedAt
    ? `Last Sync: ${formatDistanceToNow(new Date(finishedAt), { addSuffix: true })}`
    : 'Not synced yet';

  const dot =
    status === 'failed'
      ? 'bg-destructive'
      : status === 'partial'
        ? 'bg-warning'
        : 'bg-success';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}
