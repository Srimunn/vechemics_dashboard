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
    } else {
      headers = ['Message'];
      rows = [['Export data ready']];
    }

    const csvContent = arrayToCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', detail: String(err) });
  }
});
