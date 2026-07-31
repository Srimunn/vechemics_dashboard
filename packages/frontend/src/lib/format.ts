/** Indian number + currency formatting helpers. */

const inGrouping = new Intl.NumberFormat('en-IN');

/** 12345678 -> "1,23,45,678" (Indian grouping), no decimals. */
export function formatIndianNumber(value: number): string {
  return inGrouping.format(Math.round(value));
}

/** ₹ prefixed, Indian-grouped, no decimals: "₹18,46,500". */
export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₹${formatIndianNumber(Math.abs(value))}`;
}

/**
 * Compact Indian currency for tight spaces: ₹1.85 Cr / ₹4.62 L / ₹8,400.
 * (1 Lakh = 1e5, 1 Crore = 1e7.)
 */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return formatCurrency(value);
}

export interface Delta {
  /** Signed percentage change vs. the comparison value. */
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

/** Percentage change from `previous` to `current`. */
export function computeDelta(current: number, previous: number): Delta {
  if (!previous) return { pct: 0, direction: 'flat' };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
  return { pct, direction };
}

/** "+12.4%" / "-3.1%" / "0.0%". */
export function formatDelta(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** Time-of-day greeting. */
export function greeting(date = new Date()): 'Morning' | 'Afternoon' | 'Evening' {
  const h = date.getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
