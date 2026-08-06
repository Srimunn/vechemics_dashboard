import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const billPnlRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function parseQueryDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const t = s.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * GET /api/bill-pnl
 * Bill-wise Profit & Loss report for all Sales vouchers.
 */
billPnlRouter.get('/', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '20'), 10)));
    const fromDate = parseQueryDate(req.query.from as string);
    const toDate = parseQueryDate(req.query.to as string);
    const customer = (req.query.customer as string || '').trim();
    const minMargin = req.query.minMargin !== undefined ? parseFloat(String(req.query.minMargin)) : undefined;
    const maxMargin = req.query.maxMargin !== undefined ? parseFloat(String(req.query.maxMargin)) : undefined;
    const sortBy = (req.query.sortBy as string || 'date').trim();
    const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Build Prisma filter
    const where: any = {
      companyId,
      voucherType: 'Sales',
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = fromDate;
      if (toDate) {
        const toInclusive = new Date(toDate);
        toInclusive.setUTCDate(toInclusive.getUTCDate() + 1);
        where.date.lt = toInclusive;
      }
    }

    if (customer) {
      where.partyName = { contains: customer, mode: 'insensitive' };
    }

    // Fetch all sales vouchers matching criteria to compute item cost/profit details
    const salesVouchers = await prisma.voucher.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    });

    const voucherIds = salesVouchers.map((v) => v.id);
    const overheads = await prisma.billOverheadCost.findMany({
      where: { voucherId: { in: voucherIds } },
    }).catch((err) => {
      console.warn('BillOverheadCost query skipped (table missing or DB syncing):', err);
      return [];
    });
    const overheadMap = new Map(overheads.map((o) => [o.voucherId, o]));

    // Compute bill-level metrics
    const bills = salesVouchers.map((v) => {
      const items = v.items.map((i) => {
        const saleAmount = num(i.amount);
        const qty = num(i.quantity);
        const saleRate = num(i.rate) || (qty > 0 ? saleAmount / qty : 0);
        const costRate = num(i.costRate) || saleRate * 0.8;
        const costAmount = num(i.costAmount) || costRate * qty;
        const profit = num(i.profit) || saleAmount - costAmount;
        const marginPct = num(i.marginPct) || (saleAmount > 0 ? (profit / saleAmount) * 100 : 0);

        return {
          id: i.id,
          stockItemName: i.stockItemName,
          quantity: qty,
          unit: i.unit,
          saleRate: Math.round(saleRate * 100) / 100,
          costRate: Math.round(costRate * 100) / 100,
          saleAmount: Math.round(saleAmount * 100) / 100,
          costAmount: Math.round(costAmount * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          marginPct: Math.round(marginPct * 100) / 100,
        };
      });

      const saleValue = num(v.amount);
      const costValue = items.reduce((s, i) => s + i.costAmount, 0) || saleValue * 0.8;
      const profit = saleValue - costValue;
      const marginPct = saleValue > 0 ? (profit / saleValue) * 100 : 0;

      const rawOverhead = overheadMap.get(v.id) || null;
      const transportCost = rawOverhead ? num(rawOverhead.transportCost) : 0;
      const labelingCost = rawOverhead ? num(rawOverhead.labelingCost) : 0;
      const loadingCost = rawOverhead ? num(rawOverhead.loadingCost) : 0;
      const otherCost = rawOverhead ? num(rawOverhead.otherCost) : 0;
      const totalOverhead = Math.round((transportCost + labelingCost + loadingCost + otherCost) * 100) / 100;

      const tallyProfit = Math.round(profit * 100) / 100;
      const tallyMargin = Math.round(marginPct * 100) / 100;
      const adjustedProfit = Math.round((profit - totalOverhead) * 100) / 100;
      const adjustedMargin = saleValue > 0 ? Math.round((((profit - totalOverhead) / saleValue) * 100) * 100) / 100 : 0;
      const hasOverhead = rawOverhead !== null && totalOverhead > 0;

      const overhead = rawOverhead
        ? {
            id: rawOverhead.id,
            companyId: rawOverhead.companyId,
            voucherId: rawOverhead.voucherId,
            transportCost,
            labelingCost,
            loadingCost,
            otherCost,
            otherCostLabel: rawOverhead.otherCostLabel,
            notes: rawOverhead.notes,
            updatedBy: rawOverhead.updatedBy,
            createdAt: rawOverhead.createdAt,
            updatedAt: rawOverhead.updatedAt,
          }
        : null;

      return {
        id: v.id,
        date: v.date.toISOString().split('T')[0],
        voucherNumber: v.voucherNumber,
        partyName: v.partyName || 'Cash / Counter Sale',
        saleValue: Math.round(saleValue * 100) / 100,
        costValue: Math.round(costValue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        marginPct: Math.round(marginPct * 100) / 100,
        items,
        overhead,
        totalOverhead,
        tallyProfit,
        tallyMargin,
        adjustedProfit,
        adjustedMargin,
        hasOverhead,
      };
    });

    // Apply margin filters if provided
    let filteredBills = bills;
    if (minMargin !== undefined) {
      filteredBills = filteredBills.filter((b) => b.marginPct >= minMargin);
    }
    if (maxMargin !== undefined) {
      filteredBills = filteredBills.filter((b) => b.marginPct <= maxMargin);
    }

    // Sort bills
    filteredBills.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? a.date;
      let valB = b[sortBy] ?? b.date;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    // Compute summary totals across all matching bills
    const totalSales = filteredBills.reduce((s, b) => s + b.saleValue, 0);
    const totalCost = filteredBills.reduce((s, b) => s + b.costValue, 0);
    const totalProfit = totalSales - totalCost;
    const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    const totalOverheadSum = filteredBills.reduce((s, b) => s + b.totalOverhead, 0);
    const trueCostOfGoods = totalCost + totalOverheadSum;
    const tallyProfitSum = totalProfit;
    const trueProfit = tallyProfitSum - totalOverheadSum;
    const tallyMarginAvg = avgMargin;
    const trueMargin = totalSales > 0 ? (trueProfit / totalSales) * 100 : 0;

    // Apply pagination
    const totalBills = filteredBills.length;
    const totalPages = Math.ceil(totalBills / pageSize) || 1;
    const paginatedBills = filteredBills.slice((page - 1) * pageSize, page * pageSize);

    res.json({
      bills: paginatedBills,
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgMargin: Math.round(avgMargin * 10) / 10,
        totalOverhead: Math.round(totalOverheadSum * 100) / 100,
        trueCostOfGoods: Math.round(trueCostOfGoods * 100) / 100,
        tallyProfit: Math.round(tallyProfitSum * 100) / 100,
        trueProfit: Math.round(trueProfit * 100) / 100,
        tallyMargin: Math.round(tallyMarginAvg * 10) / 10,
        trueMargin: Math.round(trueMargin * 10) / 10,
      },
      pagination: {
        page,
        pageSize,
        totalPages,
        totalBills,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to fetch Bill-wise P&L', detail });
  }
});
