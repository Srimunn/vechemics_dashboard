import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const notificationPreferencesRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/notification-preferences
 * Returns current notification preferences for the company (or defaults if none saved yet).
 */
notificationPreferencesRouter.get('/', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const pref = await prisma.notificationPreference.findUnique({
      where: { companyId },
    });

    if (pref) {
      res.json({
        ...pref,
        highValueThreshold: num(pref.highValueThreshold),
      });
    } else {
      res.json({
        belowCostAlert: true,
        overduePaymentAlert: true,
        lowStockAlert: false,
        highValueSaleAlert: false,
        highValueThreshold: 50000,
        dailySummary: false,
        newBillAlert: false,
        isActive: true,
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification preferences', detail: String(err) });
  }
});

/**
 * POST /api/notification-preferences
 * Upsert preferences with toggle values.
 */
notificationPreferencesRouter.post('/', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const {
      belowCostAlert,
      overduePaymentAlert,
      lowStockAlert,
      highValueSaleAlert,
      highValueThreshold,
      dailySummary,
      newBillAlert,
      isActive,
    } = req.body;

    const thresholdVal = highValueThreshold !== undefined ? Math.max(1000, num(highValueThreshold)) : 50000;

    const updated = await prisma.notificationPreference.upsert({
      where: { companyId },
      create: {
        companyId,
        belowCostAlert: belowCostAlert !== undefined ? Boolean(belowCostAlert) : true,
        overduePaymentAlert: overduePaymentAlert !== undefined ? Boolean(overduePaymentAlert) : true,
        lowStockAlert: lowStockAlert !== undefined ? Boolean(lowStockAlert) : false,
        highValueSaleAlert: highValueSaleAlert !== undefined ? Boolean(highValueSaleAlert) : false,
        highValueThreshold: thresholdVal,
        dailySummary: dailySummary !== undefined ? Boolean(dailySummary) : false,
        newBillAlert: newBillAlert !== undefined ? Boolean(newBillAlert) : false,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      update: {
        belowCostAlert: belowCostAlert !== undefined ? Boolean(belowCostAlert) : undefined,
        overduePaymentAlert: overduePaymentAlert !== undefined ? Boolean(overduePaymentAlert) : undefined,
        lowStockAlert: lowStockAlert !== undefined ? Boolean(lowStockAlert) : undefined,
        highValueSaleAlert: highValueSaleAlert !== undefined ? Boolean(highValueSaleAlert) : undefined,
        highValueThreshold: thresholdVal,
        dailySummary: dailySummary !== undefined ? Boolean(dailySummary) : undefined,
        newBillAlert: newBillAlert !== undefined ? Boolean(newBillAlert) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    res.json({
      ok: true,
      preferences: {
        ...updated,
        highValueThreshold: num(updated.highValueThreshold),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notification preferences', detail: String(err) });
  }
});
