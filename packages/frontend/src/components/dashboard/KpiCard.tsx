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
   * 'positive-bad': up=warning (e.g. payables/receivables rising).
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
  success: 'bg-[#DCFCE7] text-[#16A34A]',
  destructive: 'bg-[#FEE2E2] text-[#DC2626]',
  warning: 'bg-[#FEE2E2] text-[#DC2626]',
  muted: 'bg-[#F1F5F9] text-[#64748B]',
};

const SPARK_DIR: Record<string, 'up' | 'down' | 'flat'> = {
  success: 'up',
  destructive: 'down',
  warning: 'down',
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
    <div className="group flex flex-col justify-between rounded-[14px] bg-[#FFFFFF] p-6 transition-all duration-200 border border-[rgba(0,0,0,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-[rgba(37,99,235,0.15)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-[10px] py-[4px] text-[12px] font-semibold',
              TONE_CLASS[tone],
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {formatDelta(delta.pct)}
          </span>
        )}
      </div>

      <div className="mt-3 text-[30px] font-bold tabular tracking-tight text-[#0F172A]">
        {format(value)}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {comparisonLabel && comparisonValue !== undefined && (
            <p className="truncate text-[13px] text-[#94A3B8]">
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
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100"
        >
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
