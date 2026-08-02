'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDelta, type Delta } from '@/lib/format';

export interface KpiCardProps {
  label: string;
  value: number;
  format?: (v: number) => string;
  comparisonLabel?: string;
  comparisonValue?: number;
  delta?: Delta;
  deltaSemantics?: 'positive-good' | 'positive-bad';
  accentColor?: string; // Optional top border accent color: '#2563EB', '#F59E0B', '#10B981', '#8B5CF6'
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

export function KpiCard({
  label,
  value,
  format = formatCurrency,
  comparisonLabel,
  comparisonValue,
  delta,
  deltaSemantics = 'positive-good',
  accentColor,
  href,
  linkLabel = 'View Analytics →',
}: KpiCardProps) {
  const tone = delta ? deltaTone(delta.direction, deltaSemantics) : 'muted';
  const DeltaIcon =
    delta?.direction === 'up' ? ArrowUpRight : delta?.direction === 'down' ? ArrowDownRight : ArrowRight;

  const topBorderStyle = accentColor ? { borderTop: `3px solid ${accentColor}` } : {};

  return (
    <div
      style={topBorderStyle}
      className="group flex flex-col justify-between rounded-[14px] bg-[#FFFFFF] p-6 transition-all duration-200 border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-[#CBD5E1]"
    >
      <div>
        {/* Header row: Label & Delta pill */}
        <div className="flex items-start justify-between gap-2 mb-3">
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
              <DeltaIcon className="h-3 w-3 shrink-0" />
              {formatDelta(delta.pct)}
            </span>
          )}
        </div>

        {/* Big number */}
        <div className="mb-2 text-[32px] font-bold tabular tracking-tight text-[#0F172A] leading-none">
          {format(value)}
        </div>

        {/* Yesterday comparison */}
        {comparisonLabel && comparisonValue !== undefined && (
          <p className="text-[13px] text-[#94A3B8]">
            {comparisonLabel}: <span className="font-medium text-[#64748B] tabular">{format(comparisonValue)}</span>
          </p>
        )}
      </div>

      {/* Analytics link */}
      {href && (
        <div className="mt-4">
          <Link
            href={href}
            className="inline-flex items-center text-[13px] font-medium text-[#2563EB] hover:underline"
          >
            {linkLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
