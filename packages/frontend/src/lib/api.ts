import type { CeoDashboardResponse } from '@vchemics/shared';
import { mockDashboard } from './mock-dashboard';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/**
 * Fetch the CEO dashboard payload. In mock/demo mode (NEXT_PUBLIC_USE_MOCK), or
 * if the backend is unreachable, returns bundled sample data so the UI always
 * renders. Throwing is reserved for genuinely unexpected states.
 */
export async function getCeoDashboard(date?: string): Promise<CeoDashboardResponse> {
  if (USE_MOCK) return mockDashboard;

  try {
    const url = date ? `${BACKEND}/api/dashboard/ceo?date=${encodeURIComponent(date)}` : `${BACKEND}/api/dashboard/ceo`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
    return (await res.json()) as CeoDashboardResponse;
  } catch (err) {
    console.warn('[getCeoDashboard] Backend request failed, falling back to mock dashboard data:', err);
    return mockDashboard;
  }
}

/** Trigger an on-demand Tally sync (inserts a refresh flag the agent polls). */
export async function triggerSync(): Promise<void> {
  if (USE_MOCK) {
    // Simulate latency so the button's loading state is visible in demo mode.
    await new Promise((r) => setTimeout(r, 900));
    return;
  }
  const res = await fetch(`${BACKEND}/api/sync/trigger`, { method: 'POST' });
  if (!res.ok) throw new Error(`Trigger failed: ${res.status}`);
}
