import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const notificationPreferencesRouter = Router();

const DEFAULT_PREFERENCES = {
  belowCostAlert: true,
  overduePaymentAlert: true,
  lowStockAlert: false,
  highValueSaleAlert: false,
  highValueThreshold: 50000,
  dailySummary: false,
  newBillAlert: false,
  isActive: true,
};

/**
 * GET /api/notification-preferences
 * Returns notification preferences for the company.
 */
notificationPreferencesRouter.get('/', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const prefs = await prisma.notificationPreference.findUnique({
      where: { companyId },
    });

    if (!prefs) {
      res.json({
        ...DEFAULT_PREFERENCES,
        preferences: DEFAULT_PREFERENCES,
      });
      return;
    }

    const formatted = {
      id: prefs.id,
      companyId: prefs.companyId,
      belowCostAlert: prefs.belowCostAlert,
      overduePaymentAlert: prefs.overduePaymentAlert,
      lowStockAlert: prefs.lowStockAlert,
      highValueSaleAlert: prefs.highValueSaleAlert,
      highValueThreshold: Number(prefs.highValueThreshold),
      dailySummary: prefs.dailySummary,
      newBillAlert: prefs.newBillAlert,
      isActive: prefs.isActive,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };

    res.json({
      ...formatted,
      preferences: formatted,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification preferences', detail: String(err) });
  }
});

/**
 * POST /api/notification-preferences
 * Upsert notification preferences for the company.
 */
notificationPreferencesRouter.post('/', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const body = req.body || {};

    const belowCostAlert = body.belowCostAlert !== undefined ? Boolean(body.belowCostAlert) : DEFAULT_PREFERENCES.belowCostAlert;
    const overduePaymentAlert = body.overduePaymentAlert !== undefined ? Boolean(body.overduePaymentAlert) : DEFAULT_PREFERENCES.overduePaymentAlert;
    const lowStockAlert = body.lowStockAlert !== undefined ? Boolean(body.lowStockAlert) : DEFAULT_PREFERENCES.lowStockAlert;
    const highValueSaleAlert = body.highValueSaleAlert !== undefined ? Boolean(body.highValueSaleAlert) : DEFAULT_PREFERENCES.highValueSaleAlert;
    const highValueThreshold = body.highValueThreshold !== undefined ? Number(body.highValueThreshold) : DEFAULT_PREFERENCES.highValueThreshold;
    const dailySummary = body.dailySummary !== undefined ? Boolean(body.dailySummary) : DEFAULT_PREFERENCES.dailySummary;
    const newBillAlert = body.newBillAlert !== undefined ? Boolean(body.newBillAlert) : DEFAULT_PREFERENCES.newBillAlert;
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : DEFAULT_PREFERENCES.isActive;

    const prefs = await prisma.notificationPreference.upsert({
      where: { companyId },
      update: {
        belowCostAlert,
        overduePaymentAlert,
        lowStockAlert,
        highValueSaleAlert,
        highValueThreshold,
        dailySummary,
        newBillAlert,
        isActive,
      },
      create: {
        companyId,
        belowCostAlert,
        overduePaymentAlert,
        lowStockAlert,
        highValueSaleAlert,
        highValueThreshold,
        dailySummary,
        newBillAlert,
        isActive,
      },
    });

    const formatted = {
      id: prefs.id,
      companyId: prefs.companyId,
      belowCostAlert: prefs.belowCostAlert,
      overduePaymentAlert: prefs.overduePaymentAlert,
      lowStockAlert: prefs.lowStockAlert,
      highValueSaleAlert: prefs.highValueSaleAlert,
      highValueThreshold: Number(prefs.highValueThreshold),
      dailySummary: prefs.dailySummary,
      newBillAlert: prefs.newBillAlert,
      isActive: prefs.isActive,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };

    res.json({
      ok: true,
      ...formatted,
      preferences: formatted,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notification preferences', detail: String(err) });
  }
});
