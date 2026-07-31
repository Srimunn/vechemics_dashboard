'use client';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { greeting } from '@/lib/format';
import { LastSyncIndicator } from './LastSyncIndicator';
import { RefreshButton } from './RefreshButton';

export function GreetingHeader({
  name,
  fyLabel,
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
    <div className="rounded-xl border bg-accent/60 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">
              <Sparkles className="h-3 w-3" />
              Executive Intelligence
            </Badge>
            <LastSyncIndicator
              finishedAt={lastSync?.finishedAt ?? null}
              status={lastSync?.status}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Good {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Today&apos;s Business Summary · {fyLabel} Executive Performance Cockpit
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton onRefreshed={onRefreshed} />
        </div>
      </div>
    </div>
  );
}
