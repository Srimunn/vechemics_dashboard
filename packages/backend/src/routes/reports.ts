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
  const t = s.trim();
  if (/^\d{8}$/.test(t)) {
    const y = parseInt(t.slice(0, 4), 10);
    const m = parseInt(t.slice(4, 6), 10) - 1;
    const d = parseInt(t.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * GET /api/reports/daily?date=2026-08-01 or ?from=2026-08-01&to=2026-08-02
 * Daily / Date-Range Business Report API.
 */
reportsRouter.get('/daily', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();

    const fromStr = (req.query.from as string) || (req.query.date as string);
    const toStr = (req.query.to as string) || (req.query.date as string);

    const startDate = parseDateStr(fromStr);
    const endDate = parseDateStr(toStr);

    const dayStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const dayEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1));

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
      fromDate: dayStart.toISOString().split('T')[0],
      toDate: endDate.toISOString().split('T')[0],
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
