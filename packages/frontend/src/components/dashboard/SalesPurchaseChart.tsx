'use client';

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { formatCompactCurrency } from '@/lib/format';

export interface MonthPoint {
  month: string;
  sales: number;
  purchase: number;
}

export function SalesPurchaseChart({ data }: { data: MonthPoint[] }) {
  // Show last 6 months on mobile (< 768px), all 12 on tablet/desktop
  const displayData = data.length > 6 ? data.slice(-6) : data;

  return (
    <div className="h-[200px] sm:h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: '#64748B' }}
            tickFormatter={(v: number) => formatCompactCurrency(v).replace('₹', '')}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: 13,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(v: number, name: string) => [formatCompactCurrency(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar dataKey="sales" name="Sales" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="purchase" name="Purchase" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
