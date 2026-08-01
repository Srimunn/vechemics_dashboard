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

// --- 8. Product Profitability (`GET /api/analytics/product-profitability`) ---
analyticsRouter.get('/product-profitability', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const stockItems = await prisma.stockItem.findMany({ where: { companyId } });
    const stockCostMap = new Map<string, number>();
    stockItems.forEach((s) => {
      stockCostMap.set(s.name.toLowerCase().trim(), num(s.avgCost));
    });

    const items = await prisma.voucherItem.findMany({
      where: {
        voucher: { companyId, voucherType: 'Sales', isCancelled: false },
      },
    });

    const productMap: Record<string, {
      stockItemName: string;
      totalQtySold: number;
      unit: string;
      totalSaleValue: number;
      totalCostValue: number;
      isEstimated: boolean;
    }> = {};

    items.forEach((item) => {
      const name = item.stockItemName.trim();
      if (!name) return;

      const qty = num(item.quantity);
      const saleAmt = num(item.amount);
      const saleRate = num(item.rate) || (qty > 0 ? saleAmt / qty : 0);
      const dbCost = stockCostMap.get(name.toLowerCase());
      const isEstimated = !dbCost || dbCost === 0;
      const costRate = num(item.costRate) || (isEstimated ? saleRate * 0.8 : dbCost);
      const costAmt = num(item.costAmount) || costRate * qty;

      if (!productMap[name]) {
        productMap[name] = {
          stockItemName: name,
          totalQtySold: 0,
          unit: item.unit || 'NOS',
          totalSaleValue: 0,
          totalCostValue: 0,
          isEstimated,
        };
      }

      productMap[name].totalQtySold += qty;
      productMap[name].totalSaleValue += saleAmt;
      productMap[name].totalCostValue += costAmt;
      if (!isEstimated) productMap[name].isEstimated = false;
    });

    const products = Object.values(productMap).map((p) => {
      const avgSaleRate = p.totalQtySold > 0 ? p.totalSaleValue / p.totalQtySold : 0;
      const avgCostRate = p.totalQtySold > 0 ? p.totalCostValue / p.totalQtySold : 0;
      const totalProfit = p.totalSaleValue - p.totalCostValue;
      const marginPct = p.totalSaleValue > 0 ? (totalProfit / p.totalSaleValue) * 100 : 0;

      return {
        stockItemName: p.stockItemName,
        totalQtySold: Math.round(p.totalQtySold * 100) / 100,
        unit: p.unit,
        totalSaleValue: Math.round(p.totalSaleValue * 100) / 100,
        totalCostValue: Math.round(p.totalCostValue * 100) / 100,
        avgSaleRate: Math.round(avgSaleRate * 100) / 100,
        avgCostRate: Math.round(avgCostRate * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        marginPct: Math.round(marginPct * 10) / 10,
        isEstimated: p.isEstimated,
      };
    }).sort((a, b) => b.totalSaleValue - a.totalSaleValue);

    const totalSales = products.reduce((s, p) => s + p.totalSaleValue, 0);
    const totalCost = products.reduce((s, p) => s + p.totalCostValue, 0);
    const totalProfit = totalSales - totalCost;
    const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    res.json({
      summary: {
        totalProducts: products.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgMargin: Math.round(avgMargin * 10) / 10,
      },
      products,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product profitability', detail: String(err) });
  }
});

// --- 9. Financial Overview (`GET /api/analytics/financial-overview`) ---
analyticsRouter.get('/financial-overview', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const [snapshot, ledgers] = await Promise.all([
      prisma.kpiSnapshot.findFirst({ where: { companyId }, orderBy: { snapshotDate: 'desc' } }),
      prisma.ledger.findMany({ where: { companyId } }),
    ]);

    const salesLedger = ledgers.find((l) => /sales/i.test(l.name))?.currentBalance || snapshot?.mtdSales || 0;
    const purchaseLedger = ledgers.find((l) => /purchase/i.test(l.name))?.currentBalance || snapshot?.mtdPurchase || 0;

    res.json({
      pnl: {
        grossSales: Math.abs(num(salesLedger)),
        grossPurchase: Math.abs(num(purchaseLedger)),
        grossProfit: num(snapshot?.todayGrossProfit) * 30 || Math.abs(num(salesLedger)) * 0.2,
        netProfit: num(snapshot?.todayNetProfit) * 30 || Math.abs(num(salesLedger)) * 0.18,
      },
      balanceSheet: {
        bankBalance: num(snapshot?.bankBalance),
        cashInHand: num(snapshot?.cashInHand),
        receivables: num(snapshot?.outstandingReceivables),
        payables: num(snapshot?.outstandingPayables),
        inventoryValue: num(snapshot?.inventoryValue),
        gstPayable: num(snapshot?.gstPayable),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch financial overview', detail: String(err) });
  }
});

// --- 10. GST Summary (`GET /api/analytics/gst`) ---
analyticsRouter.get('/gst', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const gstEntries = await prisma.voucherLedgerEntry.findMany({
      where: {
        voucher: { companyId, isCancelled: false },
        ledgerName: { contains: 'GST', mode: 'insensitive' },
      },
      include: { voucher: true },
    });

    let outputCgst = 0;
    let outputSgst = 0;
    let outputIgst = 0;
    let inputCgst = 0;
    let inputSgst = 0;
    let inputIgst = 0;

    const monthlyMap: Record<string, { month: string; output: number; input: number; net: number }> = {};

    gstEntries.forEach((e) => {
      const name = e.ledgerName.toUpperCase();
      const amt = num(e.amount);
      const isOutput = name.includes('OUTPUT') || (!e.isDebit && e.voucher.voucherType === 'Sales');
      const isInput = name.includes('INPUT') || (e.isDebit && e.voucher.voucherType === 'Purchase');

      if (name.includes('CGST')) {
        if (isOutput) outputCgst += amt;
        else if (isInput) inputCgst += amt;
      } else if (name.includes('SGST')) {
        if (isOutput) outputSgst += amt;
        else if (isInput) inputSgst += amt;
      } else if (name.includes('IGST')) {
        if (isOutput) outputIgst += amt;
        else if (isInput) inputIgst += amt;
      } else {
        if (isOutput) outputCgst += amt / 2;
        else if (isInput) inputCgst += amt / 2;
      }

      const monthKey = e.voucher.date.toISOString().slice(0, 7);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, output: 0, input: 0, net: 0 };
      }
      if (isOutput) monthlyMap[monthKey].output += amt;
      if (isInput) monthlyMap[monthKey].input += amt;
    });

    const monthlyBreakdown = Object.values(monthlyMap).map((m) => ({
      month: m.month,
      output: Math.round(m.output * 100) / 100,
      input: Math.round(m.input * 100) / 100,
      net: Math.round((m.output - m.input) * 100) / 100,
    })).sort((a, b) => a.month.localeCompare(b.month));

    const totalOutput = outputCgst + outputSgst + outputIgst;
    const totalInput = inputCgst + inputSgst + inputIgst;
    const netGstPayable = Math.max(0, totalOutput - totalInput);

    res.json({
      summary: {
        outputCgst: Math.round(outputCgst * 100) / 100,
        outputSgst: Math.round(outputSgst * 100) / 100,
        outputIgst: Math.round(outputIgst * 100) / 100,
        inputCgst: Math.round(inputCgst * 100) / 100,
        inputSgst: Math.round(inputSgst * 100) / 100,
        inputIgst: Math.round(inputIgst * 100) / 100,
        totalOutput: Math.round(totalOutput * 100) / 100,
        totalInput: Math.round(totalInput * 100) / 100,
        netGstPayable: Math.round(netGstPayable * 100) / 100,
      },
      monthlyBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GST analytics', detail: String(err) });
  }
});
