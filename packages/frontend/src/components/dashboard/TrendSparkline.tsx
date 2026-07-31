'use client';

import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

const STROKE: Record<string, string> = {
  up: 'hsl(var(--success))',
  down: 'hsl(var(--destructive))',
  flat: 'hsl(var(--muted-foreground))',
};

/** Tiny 7-point trend line, no axes/labels — matches Stripe-style KPI cards. */
export function TrendSparkline({
  data,
  direction = 'flat',
  height = 32,
}: {
  data: number[];
  direction?: 'up' | 'down' | 'flat';
  height?: number;
}) {
  if (data.length === 0) return <div style={{ height }} />;
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={STROKE[direction]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
