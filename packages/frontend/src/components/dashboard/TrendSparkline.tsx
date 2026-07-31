'use client';

import * as React from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

const STROKE_COLORS: Record<string, string> = {
  up: '#16A34A',
  down: '#DC2626',
  flat: '#94A3B8',
};

/** Tiny 7-point smooth trend line — matches Stripe/Vercel executive KPI cards. */
export function TrendSparkline({
  data,
  direction = 'flat',
  height = 36,
}: {
  data: number[];
  direction?: 'up' | 'down' | 'flat';
  height?: number;
}) {
  if (!data || data.length === 0) return <div style={{ height }} />;
  const chartData = data.map((v, i) => ({ i, value: v }));

  const strokeColor = STROKE_COLORS[direction] ?? STROKE_COLORS.flat;

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={600}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
