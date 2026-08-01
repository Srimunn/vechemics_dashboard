import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const analyticsRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

// --- 1. Sales Analytics (`GET /api/analytics/sales`) ---
analyticsRouter.get('/sales', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const salesVouchers = await prisma.voucher.findMany({
      where: { companyId, voucherType: 'Sales', isCancelled: false },
      orderBy: { date: 'asc' },
    });

    // Monthly trend
    const monthlyMap: Record<string, number> = {};
    const customerMap: Record<string, { partyName: string; totalSales: number; billCount: number; lastBillDate: string }> = {};

    salesVouchers.forEach((v) => {
      const monthKey = v.date.toISOString().slice(0, 7); // YYYY-MM
      const amount = num(v.amount);
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amount;

      const party = v.partyName || 'Cash / Counter Sale';
      if (!customerMap[party]) {
        customerMap[party] = { partyName: party, totalSales: 0, billCount: 0, lastBillDate: v.date.toISOString().split('T')[0]! };
      }
      customerMap[party].totalSales += amount;
      customerMap[party].billCount += 1;
      customerMap[party].lastBillDate = v.date.toISOString().split('T')[0]!;
    });

    const monthlyTrend = Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

    const customers = Object.values(customerMap).sort((a, b) => b.totalSales - a.totalSales);
    const topCustomers = customers.slice(0, 10);
    const totalSales = salesVouchers.reduce((s, v) => s + num(v.amount), 0);

    res.json({
      totalSales: Math.round(totalSales * 100) / 100,
      totalBills: salesVouchers.length,
      monthlyTrend,
      topCustomers,
      customers,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales analytics', detail: String(err) });
  }
});

// --- 2. Purchase Analytics (`GET /api/analytics/purchases`) ---
analyticsRouter.get('/purchases', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const purchaseVouchers = await prisma.voucher.findMany({
      where: { companyId, voucherType: 'Purchase', isCancelled: false },
      orderBy: { date: 'asc' },
    });

    const monthlyMap: Record<string, number> = {};
    const supplierMap: Record<string, { partyName: string; totalPurchase: number; billCount: number; lastBillDate: string }> = {};

    purchaseVouchers.forEach((v) => {
      const monthKey = v.date.toISOString().slice(0, 7);
      const amount = num(v.amount);
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amount;

      const party = v.partyName || 'Cash Purchase';
      if (!supplierMap[party]) {
        supplierMap[party] = { partyName: party, totalPurchase: 0, billCount: 0, lastBillDate: v.date.toISOString().split('T')[0]! };
      }
      supplierMap[party].totalPurchase += amount;
      supplierMap[party].billCount += 1;
      supplierMap[party].lastBillDate = v.date.toISOString().split('T')[0]!;
    });

    const monthlyTrend = Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

    const suppliers = Object.values(supplierMap).sort((a, b) => b.totalPurchase - a.totalPurchase);
    const topSuppliers = suppliers.slice(0, 10);
    const totalPurchases = purchaseVouchers.reduce((s, v) => s + num(v.amount), 0);

    res.json({
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalBills: purchaseVouchers.length,
      monthlyTrend,
      topSuppliers,
      suppliers,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchase analytics', detail: String(err) });
  }
});

// --- 3. Receivables & Aging (`GET /api/analytics/receivables`) ---
analyticsRouter.get('/receivables', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const rows = await prisma.outstanding.findMany({
      where: { companyId, type: 'receivable' },
      orderBy: { overdueDays: 'desc' },
    });

    let current = 0; // 0-30 days
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    const items = rows.map((r) => {
      const pending = num(r.pendingAmount);
      const days = r.overdueDays;

      if (days <= 30) current += pending;
      else if (days <= 60) days31to60 += pending;
      else if (days <= 90) days61to90 += pending;
      else days90plus += pending;

      return {
        id: r.id,
        billDate: r.billDate.toISOString().split('T')[0],
        billRef: r.billRef,
        partyName: r.partyName,
        dueDate: r.dueDate ? r.dueDate.toISOString().split('T')[0] : null,
        pendingAmount: Math.round(pending * 100) / 100,
        overdueDays: days,
      };
    });

    const totalOutstanding = items.reduce((s, i) => s + i.pendingAmount, 0);

    res.json({
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalBills: items.length,
      aging: {
        current: Math.round(current * 100) / 100,
        days31to60: Math.round(days31to60 * 100) / 100,
        days61to90: Math.round(days61to90 * 100) / 100,
        days90plus: Math.round(days90plus * 100) / 100,
      },
      items,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receivables', detail: String(err) });
  }
});

// --- 4. Payables & Aging (`GET /api/analytics/payables`) ---
analyticsRouter.get('/payables', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const rows = await prisma.outstanding.findMany({
      where: { companyId, type: 'payable' },
      orderBy: { overdueDays: 'desc' },
    });

    let current = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    const items = rows.map((r) => {
      const pending = num(r.pendingAmount);
      const days = r.overdueDays;

      if (days <= 30) current += pending;
      else if (days <= 60) days31to60 += pending;
      else if (days <= 90) days61to90 += pending;
      else days90plus += pending;

      return {
        id: r.id,
        billDate: r.billDate.toISOString().split('T')[0],
        billRef: r.billRef,
        partyName: r.partyName,
        dueDate: r.dueDate ? r.dueDate.toISOString().split('T')[0] : null,
        pendingAmount: Math.round(pending * 100) / 100,
        overdueDays: days,
      };
    });

    const totalOutstanding = items.reduce((s, i) => s + i.pendingAmount, 0);

    res.json({
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalBills: items.length,
      aging: {
        current: Math.round(current * 100) / 100,
        days31to60: Math.round(days31to60 * 100) / 100,
        days61to90: Math.round(days61to90 * 100) / 100,
        days90plus: Math.round(days90plus * 100) / 100,
      },
      items,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payables', detail: String(err) });
  }
});

// --- 5. Inventory (`GET /api/analytics/inventory`) ---
analyticsRouter.get('/inventory', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const stockItems = await prisma.stockItem.findMany({
      where: { companyId },
      orderBy: { closingValue: 'desc' },
    });

    const items = stockItems.map((s) => {
      const qty = num(s.closingQty);
      const val = num(s.closingValue);
      const avgCost = num(s.avgCost) || (qty > 0 ? val / qty : 0);

      return {
        id: s.id,
        name: s.name,
        unit: s.unit || 'NOS',
        closingQty: qty,
        closingValue: Math.round(val * 100) / 100,
        avgCost: Math.round(avgCost * 100) / 100,
        isLowStock: qty > 0 && qty < 5,
      };
    });

    const totalValue = items.reduce((s, i) => s + i.closingValue, 0);

    res.json({
      totalValue: Math.round(totalValue * 100) / 100,
      totalItems: items.length,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory', detail: String(err) });
  }
});

// --- 6. Customers (`GET /api/analytics/customers`) ---
analyticsRouter.get('/customers', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const [vouchers, outstandings] = await Promise.all([
      prisma.voucher.findMany({ where: { companyId, voucherType: 'Sales', isCancelled: false } }),
      prisma.outstanding.findMany({ where: { companyId, type: 'receivable' } }),
    ]);

    const customerMap: Record<string, { partyName: string; totalSales: number; billCount: number; outstanding: number }> = {};

    vouchers.forEach((v) => {
      const name = v.partyName || 'Cash / Counter Sale';
      if (!customerMap[name]) customerMap[name] = { partyName: name, totalSales: 0, billCount: 0, outstanding: 0 };
      customerMap[name].totalSales += num(v.amount);
      customerMap[name].billCount += 1;
    });

    outstandings.forEach((o) => {
      const name = o.partyName;
      if (!customerMap[name]) customerMap[name] = { partyName: name, totalSales: 0, billCount: 0, outstanding: 0 };
      customerMap[name].outstanding += num(o.pendingAmount);
    });

    const customers = Object.values(customerMap).sort((a, b) => b.totalSales - a.totalSales);

    res.json({
      totalCustomers: customers.length,
      customers,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers', detail: String(err) });
  }
});

// --- 7. Suppliers (`GET /api/analytics/suppliers`) ---
analyticsRouter.get('/suppliers', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const [vouchers, outstandings] = await Promise.all([
      prisma.voucher.findMany({ where: { companyId, voucherType: 'Purchase', isCancelled: false } }),
      prisma.outstanding.findMany({ where: { companyId, type: 'payable' } }),
    ]);

    const supplierMap: Record<string, { partyName: string; totalPurchases: number; billCount: number; outstanding: number }> = {};

    vouchers.forEach((v) => {
      const name = v.partyName || 'Cash Purchase';
      if (!supplierMap[name]) supplierMap[name] = { partyName: name, totalPurchases: 0, billCount: 0, outstanding: 0 };
      supplierMap[name].totalPurchases += num(v.amount);
      supplierMap[name].billCount += 1;
    });

    outstandings.forEach((o) => {
      const name = o.partyName;
      if (!supplierMap[name]) supplierMap[name] = { partyName: name, totalPurchases: 0, billCount: 0, outstanding: 0 };
      supplierMap[name].outstanding += num(o.pendingAmount);
    });

    const suppliers = Object.values(supplierMap).sort((a, b) => b.totalPurchases - a.totalPurchases);

    res.json({
      totalSuppliers: suppliers.length,
      suppliers,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suppliers', detail: String(err) });
  }
});
