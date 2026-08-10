'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

export interface KpiCardProps {
  label: string;
  value: number;
  format?: (v: number) => string;
  comparisonLabel?: string;
  comparisonValue?: number;
  accentColor?: string; // Optional top border accent color: '#2563EB', '#F59E0B', '#10B981', '#8B5CF6'
  href?: string;
  linkLabel?: string;
}

export function KpiCard({
  label,
  value,
  format = formatCurrency,
  accentColor,
  href,
  linkLabel = 'View Analytics →',
}: KpiCardProps) {
  const topBorderStyle = accentColor ? { borderTop: `3px solid ${accentColor}` } : {};

  const cardContent = (
    <div
      style={topBorderStyle}
      className={cn(
        'group flex flex-col justify-between rounded-[16px] bg-white p-3.5 sm:p-6 transition-all duration-200 border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-[#CBD5E1] min-h-[105px] w-full',
        href && 'cursor-pointer active:scale-[0.98]',
      )}
    >
      <div>
        {/* Header row: Label */}
        <div className="flex items-start justify-between gap-1.5 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] line-clamp-1 leading-snug">
            {label}
          </span>
        </div>

        {/* Big number: 22px on mobile, 32px on desktop */}
        <div className="my-1 text-[22px] sm:text-[32px] font-bold tabular tracking-tight text-[#0F172A] leading-tight">
          {format(value)}
        </div>
      </div>

      {/* Analytics link on desktop */}
      {href && (
        <div className="mt-2.5 hidden sm:block">
          <span className="inline-flex items-center text-[12px] font-medium text-[#2563EB] group-hover:underline">
            {linkLabel}
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block w-full text-left">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
