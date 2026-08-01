import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const auditRouter = Router();

/**
 * GET /api/audit/sync-logs
 * Last 20 sync execution logs.
 */
auditRouter.get('/sync-logs', requireUser, async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sync logs', detail: String(err) });
  }
});

/**
 * GET /api/audit/data-summary
 * Summary record counts and data freshness details.
 */
auditRouter.get('/data-summary', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();

    const [vouchersCount, itemsCount, ledgersCount, stockItemsCount, outstandingsCount, lastSyncLog] = await Promise.all([
      prisma.voucher.count({ where: { companyId } }),
      prisma.voucherItem.count({ where: { voucher: { companyId } } }),
      prisma.ledger.count({ where: { companyId } }),
      prisma.stockItem.count({ where: { companyId } }),
      prisma.outstanding.count({ where: { companyId } }),
      prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } }),
    ]);

    const lastSyncTime = lastSyncLog ? (lastSyncLog.finishedAt || lastSyncLog.startedAt) : null;
    const minutesSinceLastSync = lastSyncTime
      ? Math.floor((new Date().getTime() - new Date(lastSyncTime).getTime()) / 60000)
      : null;

    res.json({
      summary: {
        vouchersCount,
        itemsCount,
        ledgersCount,
        stockItemsCount,
        outstandingsCount,
        lastSyncTime: lastSyncTime ? lastSyncTime.toISOString() : null,
        minutesSinceLastSync,
        lastSyncStatus: lastSyncLog ? lastSyncLog.status : 'never',
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data summary', detail: String(err) });
  }
});
