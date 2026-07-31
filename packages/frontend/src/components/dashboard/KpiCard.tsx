'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDelta, type Delta } from '@/lib/format';
import { TrendSparkline } from './TrendSparkline';

export interface KpiCardProps {
  label: string;
  value: number;
  /** Formatter for the big value; defaults to Indian ₹. */
  format?: (v: number) => string;
  comparisonLabel?: string;
  comparisonValue?: number;
  delta?: Delta;
  /**
   * How to color the delta. 'positive-good' (default): up=green, down=red.
   * 'positive-bad': up=amber warning (e.g. payables/receivables rising).
   */
  deltaSemantics?: 'positive-good' | 'positive-bad';
  sparkline?: number[];
  href?: string;
  linkLabel?: string;
}

function deltaTone(
  direction: 'up' | 'down' | 'flat',
  semantics: 'positive-good' | 'positive-bad',
): 'success' | 'destructive' | 'warning' | 'muted' {
  if (direction === 'flat') return 'muted';
  if (semantics === 'positive-bad') return 'warning';
  return direction === 'up' ? 'success' : 'destructive';
}

const TONE_CLASS: Record<string, string> = {
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  muted: 'bg-muted text-muted-foreground',
};

const SPARK_DIR: Record<string, 'up' | 'down' | 'flat'> = {
  success: 'up',
  destructive: 'down',
  warning: 'up',
  muted: 'flat',
};

export function KpiCard({
  label,
  value,
  format = formatCurrency,
  comparisonLabel,
  comparisonValue,
  delta,
  deltaSemantics = 'positive-good',
  sparkline,
  href,
  linkLabel = 'View Analytics',
}: KpiCardProps) {
  const tone = delta ? deltaTone(delta.direction, deltaSemantics) : 'muted';
  const DeltaIcon =
    delta?.direction === 'up' ? ArrowUpRight : delta?.direction === 'down' ? ArrowDownRight : ArrowRight;

  return (
    <div className="group flex flex-col justify-between rounded-xl border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {delta && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', TONE_CLASS[tone])}>
            <DeltaIcon className="h-3 w-3" />
            {formatDelta(delta.pct)}
          </span>
        )}
      </div>

      <div className="mt-3 text-3xl font-bold tabular tracking-tight text-foreground">
        {format(value)}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {comparisonLabel && comparisonValue !== undefined && (
            <p className="truncate text-xs text-muted-foreground">
              {comparisonLabel}: <span className="tabular">{formatCurrency(comparisonValue)}</span>
            </p>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="w-24 shrink-0">
            <TrendSparkline data={sparkline} direction={SPARK_DIR[tone]} />
          </div>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
        >
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
