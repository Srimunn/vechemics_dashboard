import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';
import { generateNotifications } from '../services/notification-service.js';

export const notificationsRouter = Router();

/**
 * GET /api/notifications/count
 * Return unread count.
 */
notificationsRouter.get('/count', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const unreadCount = await prisma.notification.count({
      where: { companyId, isRead: false },
    });
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count', detail: String(err) });
  }
});

/**
 * GET /api/notifications
 * List notifications.
 */
notificationsRouter.get('/', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    const where: any = { companyId };
    if (unreadOnly) where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications', detail: String(err) });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark notification as read.
 */
notificationsRouter.post('/:id/read', requireUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read', detail: String(err) });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read.
 */
notificationsRouter.post('/read-all', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    await prisma.notification.updateMany({
      where: { companyId, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read', detail: String(err) });
  }
});

/**
 * POST /api/notifications/generate
 * Trigger notification generation.
 */
notificationsRouter.post('/generate', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const countCreated = await generateNotifications(companyId);
    res.json({ ok: true, countCreated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate notifications', detail: String(err) });
  }
});
