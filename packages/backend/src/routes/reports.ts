import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const reportsRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function parseDateStr(s?: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * GET /api/reports/daily?date=2026-08-01
 * Daily Business Report API.
 */
reportsRouter.get('/daily', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const targetDate = parseDateStr(req.query.date as string);

    const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const vouchers = await prisma.voucher.findMany({
      where: {
        companyId,
        isCancelled: false,
        date: { gte: dayStart, lt: dayEnd },
      },
      include: { items: true, ledgerEntries: true },
      orderBy: { voucherNumber: 'asc' },
    });

    const grouped: Record<string, any[]> = {
      Sales: [],
      Purchase: [],
      Receipt: [],
      Payment: [],
      Journal: [],
      Contra: [],
    };

    let totalSales = 0;
    let totalPurchase = 0;
    let totalCollections = 0;
    let totalPayments = 0;

    vouchers.forEach((v) => {
      const vAmt = num(v.amount);
      const vType = v.voucherType;

      if (vType === 'Sales') totalSales += vAmt;
      else if (vType === 'Purchase') totalPurchase += vAmt;
      else if (vType === 'Receipt') totalCollections += vAmt;
      else if (vType === 'Payment') totalPayments += vAmt;

      if (!grouped[vType]) grouped[vType] = [];
      grouped[vType].push({
        id: v.id,
        voucherNumber: v.voucherNumber,
        partyName: v.partyName || 'Counter Party',
        amount: Math.round(vAmt * 100) / 100,
        narration: v.narration,
        itemsCount: v.items.length,
      });
    });

    res.json({
      date: dayStart.toISOString().split('T')[0],
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalPurchase: Math.round(totalPurchase * 100) / 100,
        totalCollections: Math.round(totalCollections * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        totalVouchers: vouchers.length,
      },
      grouped,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily report', detail: String(err) });
  }
});
