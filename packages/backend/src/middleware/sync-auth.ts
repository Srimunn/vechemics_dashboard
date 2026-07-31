import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../lib/env.js';

/**
 * Guards sync-agent-only endpoints. The agent presents the shared secret in the
 * `X-Sync-Token` header; we compare in constant time to avoid leaking length /
 * content via timing.
 */
export function syncAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.get('x-sync-token') ?? '';
  const expected = env.SYNC_AGENT_TOKEN;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Invalid or missing sync token' });
    return;
  }
  next();
}
