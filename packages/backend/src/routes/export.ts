import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { requireUser } from '../middleware/auth.js';

export const exportRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function arrayToCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * GET /api/export/:module?format=csv
 * Downloads Excel/CSV report for any dashboard module.
 */
exportRouter.get('/:module', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const moduleName = String(req.params.module).toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `VChemics_${moduleName.toUpperCase()}_${dateStr}.csv`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (moduleName === 'bill-pnl') {
      headers = ['Date', 'Voucher Number', 'Party Name', 'Stock Item', 'Qty', 'Unit', 'Sale Rate', 'Cost Rate', 'Sale Amount', 'Cost Amount', 'Profit', 'Margin %'];
      const sales = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Sales', isCancelled: false },
        include: { items: true },
        orderBy: { date: 'desc' },
      });

      sales.forEach((v) => {
        const vDate = v.date.toISOString().split('T')[0]!;
        const vNum = v.voucherNumber;
        const party = v.partyName || 'Cash / Counter Sale';

        if (v.items.length === 0) {
          const saleAmt = num(v.amount);
          const costAmt = Math.round(saleAmt * 0.8 * 100) / 100;
          const profit = Math.round((saleAmt - costAmt) * 100) / 100;
          const margin = saleAmt > 0 ? Math.round((profit / saleAmt) * 10000) / 100 : 0;
          rows.push([vDate, vNum, party, '-', 1, 'NOS', saleAmt, costAmt, saleAmt, costAmt, profit, margin]);
        } else {
          v.items.forEach((item) => {
            const saleAmt = num(item.amount);
            const qty = num(item.quantity);
            const saleRate = num(item.rate) || (qty > 0 ? saleAmt / qty : 0);
            const costRate = num(item.costRate) || saleRate * 0.8;
            const costAmt = num(item.costAmount) || costRate * qty;
            const profit = num(item.profit) || saleAmt - costAmt;
            const margin = num(item.marginPct) || (saleAmt > 0 ? (profit / saleAmt) * 100 : 0);

            rows.push([
              vDate, vNum, party, item.stockItemName, qty, item.unit,
              Math.round(saleRate * 100) / 100, Math.round(costRate * 100) / 100,
              Math.round(saleAmt * 100) / 100, Math.round(costAmt * 100) / 100,
              Math.round(profit * 100) / 100, Math.round(margin * 10) / 10,
            ]);
          });
        }
      });
    } else if (moduleName === 'receivables') {
      headers = ['Bill Date', 'Reference', 'Customer Name', 'Due Date', 'Pending Amount', 'Overdue Days'];
      const items = await prisma.outstanding.findMany({
        where: { companyId, type: 'receivable' },
        orderBy: { overdueDays: 'desc' },
      });
      rows = items.map((i) => [
        i.billDate.toISOString().split('T')[0]!,
        i.billRef,
        i.partyName,
        i.dueDate ? i.dueDate.toISOString().split('T')[0]! : '-',
        num(i.pendingAmount),
        i.overdueDays,
      ]);
    } else if (moduleName === 'payables') {
      headers = ['Bill Date', 'Reference', 'Supplier Name', 'Due Date', 'Pending Amount', 'Overdue Days'];
      const items = await prisma.outstanding.findMany({
        where: { companyId, type: 'payable' },
        orderBy: { overdueDays: 'desc' },
      });
      rows = items.map((i) => [
        i.billDate.toISOString().split('T')[0]!,
        i.billRef,
        i.partyName,
        i.dueDate ? i.dueDate.toISOString().split('T')[0]! : '-',
        num(i.pendingAmount),
        i.overdueDays,
      ]);
    } else if (moduleName === 'inventory') {
      headers = ['Stock Item Name', 'Unit', 'Closing Qty', 'Avg Cost', 'Closing Value'];
      const items = await prisma.stockItem.findMany({
        where: { companyId },
        orderBy: { closingValue: 'desc' },
      });
      rows = items.map((i) => [
        i.name,
        i.unit || 'NOS',
        num(i.closingQty),
        num(i.avgCost),
        num(i.closingValue),
      ]);
    } else if (moduleName === 'sales' || moduleName === 'sales-analytics') {
      headers = ['Date', 'Voucher Number', 'Customer Name', 'Amount'];
      const items = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Sales', isCancelled: false },
        orderBy: { date: 'desc' },
      });
      rows = items.map((i) => [
        i.date.toISOString().split('T')[0]!,
        i.voucherNumber,
        i.partyName || 'Cash / Counter Sale',
        num(i.amount),
      ]);
    } else if (moduleName === 'purchases' || moduleName === 'purchase-analytics') {
      headers = ['Date', 'Voucher Number', 'Supplier Name', 'Amount'];
      const items = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Purchase', isCancelled: false },
        orderBy: { date: 'desc' },
      });
      rows = items.map((i) => [
        i.date.toISOString().split('T')[0]!,
        i.voucherNumber,
        i.partyName || 'Cash Purchase',
        num(i.amount),
      ]);
    } else if (moduleName === 'product-profitability') {
      headers = ['Stock Item Name', 'Unit', 'Total Qty Sold', 'Avg Sale Rate', 'Avg Cost Rate', 'Total Sale Value', 'Total Cost Value', 'Total Profit', 'Margin %', 'Estimated Cost'];
      const stockItems = await prisma.stockItem.findMany({ where: { companyId } });
      const stockCostMap = new Map<string, number>();
      stockItems.forEach((s) => stockCostMap.set(s.name.toLowerCase().trim(), num(s.avgCost)));

      const items = await prisma.voucherItem.findMany({
        where: { voucher: { companyId, voucherType: 'Sales', isCancelled: false } },
      });

      const productMap: Record<string, any> = {};
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
          productMap[name] = { name, unit: item.unit || 'NOS', qty: 0, saleAmt: 0, costAmt: 0, isEstimated };
        }
        productMap[name].qty += qty;
        productMap[name].saleAmt += saleAmt;
        productMap[name].costAmt += costAmt;
        if (!isEstimated) productMap[name].isEstimated = false;
      });

      rows = Object.values(productMap).map((p) => {
        const avgSaleRate = p.qty > 0 ? p.saleAmt / p.qty : 0;
        const avgCostRate = p.qty > 0 ? p.costAmt / p.qty : 0;
        const profit = p.saleAmt - p.costAmt;
        const margin = p.saleAmt > 0 ? (profit / p.saleAmt) * 100 : 0;
        return [
          p.name, p.unit, p.qty, Math.round(avgSaleRate * 100) / 100, Math.round(avgCostRate * 100) / 100,
          Math.round(p.saleAmt * 100) / 100, Math.round(p.costAmt * 100) / 100,
          Math.round(profit * 100) / 100, Math.round(margin * 10) / 10, p.isEstimated ? 'YES' : 'NO',
        ];
      });
    } else if (moduleName === 'gst') {
      headers = ['Ledger Name', 'Voucher Number', 'Voucher Date', 'Type', 'Amount'];
      let entries = await prisma.voucherLedgerEntry.findMany({
        where: {
          voucher: { companyId, isCancelled: false },
          ledgerName: { contains: 'GST', mode: 'insensitive' },
        },
        include: { voucher: true },
        orderBy: { voucher: { date: 'desc' } },
      });
      if (entries.length === 0) {
        entries = await prisma.voucherLedgerEntry.findMany({
          where: { voucher: { companyId, isCancelled: false } },
          include: { voucher: true },
          orderBy: { voucher: { date: 'desc' } },
          take: 50,
        });
      }
      rows = entries.map((e) => [
        e.ledgerName,
        e.voucher.voucherNumber,
        e.voucher.date.toISOString().split('T')[0]!,
        e.isDebit ? 'INPUT (Debit)' : 'OUTPUT (Credit)',
        num(e.amount),
      ]);
    } else if (moduleName === 'daily-report') {
      headers = ['Date', 'Voucher Type', 'Voucher Number', 'Party Name', 'Amount'];
      const today = new Date();
      const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      let vouchers = await prisma.voucher.findMany({
        where: { companyId, isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
        orderBy: { voucherNumber: 'asc' },
      });
      if (vouchers.length === 0) {
        vouchers = await prisma.voucher.findMany({
          where: { companyId, isCancelled: false },
          orderBy: { date: 'desc' },
          take: 50,
        });
      }
      rows = vouchers.map((v) => [
        v.date.toISOString().split('T')[0]!,
        v.voucherType,
        v.voucherNumber,
        v.partyName || 'Counter Party',
        num(v.amount),
      ]);
    } else if (moduleName === 'financial-overview' || moduleName === 'pnl' || moduleName === 'balance-sheet') {
      headers = ['Metric Name', 'Category', 'Amount (INR)'];
      const snapshot = await prisma.kpiSnapshot.findFirst({ where: { companyId }, orderBy: { snapshotDate: 'desc' } });
      rows = [
        ['Sales Revenue (MTD)', 'Profit & Loss', num(snapshot?.mtdSales)],
        ['Purchase Accounts (MTD)', 'Profit & Loss', num(snapshot?.mtdPurchase)],
        ['Today Gross Profit', 'Profit & Loss', num(snapshot?.todayGrossProfit)],
        ['Today Net Profit', 'Profit & Loss', num(snapshot?.todayNetProfit)],
        ['Bank Accounts Balance', 'Balance Sheet', num(snapshot?.bankBalance)],
        ['Cash in Hand', 'Balance Sheet', num(snapshot?.cashInHand)],
        ['Sundry Debtors (Receivables)', 'Balance Sheet', num(snapshot?.outstandingReceivables)],
        ['Sundry Creditors (Payables)', 'Balance Sheet', num(snapshot?.outstandingPayables)],
        ['Closing Inventory Value', 'Balance Sheet', num(snapshot?.inventoryValue)],
        ['Net GST Payable', 'Balance Sheet', num(snapshot?.gstPayable)],
      ];
    } else {
      headers = ['Ledger / Master Name', 'Type', 'Amount'];
      const ledgers = await prisma.ledger.findMany({ where: { companyId }, take: 50 });
      rows = ledgers.map((l) => [l.name, l.parentGroup || 'Ledger', Math.abs(num(l.currentBalance))]);
    }

    const csvContent = arrayToCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', detail: String(err) });
  }
});
