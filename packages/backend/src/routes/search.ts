import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const searchRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/search?q=query
 * Universal search across Invoices, Customers, Suppliers, and Inventory items.
 */
searchRouter.get('/', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const query = String(req.query.q || '').trim();

    if (!query || query.length < 2) {
      res.json({ results: [] });
      return;
    }

    const [vouchers, stockItems, outstandings] = await Promise.all([
      prisma.voucher.findMany({
        where: {
          companyId,
          isCancelled: false,
          OR: [
            { voucherNumber: { contains: query, mode: 'insensitive' } },
            { partyName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { date: 'desc' },
      }),
      prisma.stockItem.findMany({
        where: {
          companyId,
          name: { contains: query, mode: 'insensitive' },
        },
        take: 5,
        orderBy: { closingValue: 'desc' },
      }),
      prisma.outstanding.findMany({
        where: {
          companyId,
          OR: [
            { partyName: { contains: query, mode: 'insensitive' } },
            { billRef: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { overdueDays: 'desc' },
      }),
    ]);

    const results: any[] = [];

    // Map Vouchers
    vouchers.forEach((v) => {
      results.push({
        id: `v-${v.id}`,
        type: 'invoice',
        title: `${v.voucherType} Invoice: ${v.voucherNumber}`,
        subtitle: `${v.partyName || 'Counter Party'} • ₹${num(v.amount).toLocaleString('en-IN')}`,
        url: v.voucherType === 'Sales' ? '/dashboard/bill-pnl' : '/dashboard/purchase-analytics',
      });
    });

    // Map Stock Items
    stockItems.forEach((s) => {
      results.push({
        id: `s-${s.id}`,
        type: 'inventory',
        title: `Product: ${s.name}`,
        subtitle: `Closing Qty: ${num(s.closingQty)} ${s.unit || 'NOS'} • Valuation: ₹${num(s.closingValue).toLocaleString('en-IN')}`,
        url: '/dashboard/inventory',
      });
    });

    // Map Customers / Suppliers
    outstandings.forEach((o) => {
      const isCustomer = o.type === 'receivable';
      results.push({
        id: `o-${o.id}`,
        type: isCustomer ? 'customer' : 'supplier',
        title: `${isCustomer ? 'Customer' : 'Supplier'}: ${o.partyName}`,
        subtitle: `Ref: ${o.billRef} • Pending: ₹${num(o.pendingAmount).toLocaleString('en-IN')} (${o.overdueDays}d overdue)`,
        url: isCustomer ? '/dashboard/receivables' : '/dashboard/payables',
      });
    });

    res.json({ results: results.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: String(err) });
  }
});
