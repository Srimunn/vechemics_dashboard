import type { Request, Response, NextFunction } from 'express';

/**
 * Placeholder user-session guard for endpoints the CEO triggers from the
 * frontend (e.g. POST /api/sync/trigger).
 *
 * NextAuth is wired up in a later step (frontend + auth routes); until then this
 * passes through so the trigger flow can be exercised end-to-end. Replace the
 * body with a real session check before deploying to production.
 *
 * TODO(auth): verify the NextAuth session cookie / JWT here.
 */
export function requireUser(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
