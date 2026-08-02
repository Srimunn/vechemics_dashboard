import { Router, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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

function parseDateParam(val: unknown, defaultDate: Date): Date {
  if (!val) return defaultDate;
  const str = String(val).trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(str);
  if (m) {
    return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  }
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m2) {
    return new Date(Date.UTC(+m2[1]!, +m2[2]! - 1, +m2[3]!));
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? defaultDate : d;
}

function formatDateDisplay(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day}-${mon}-${yr}`;
}

/** Build native Microsoft Excel (.xlsx) buffer using exceljs */
async function buildExcelWorkbook(
  title: string,
  companyName: string,
  periodStr: string,
  headers: string[],
  rows: (string | number)[][],
  currencyColIndices: number[] = [],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = title.slice(0, 31).replace(/[:\\/?*\[\]]/g, '');
  const worksheet = workbook.addWorksheet(sheetName || 'Report');

  // Header Row 1: Company Name
  const companyRow = worksheet.addRow([companyName]);
  companyRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A5F' } };
  worksheet.mergeCells(1, 1, 1, Math.max(headers.length, 4));

  // Header Row 2: Report Title & Period
  const titleRow = worksheet.addRow([`${title} — ${periodStr}`]);
  titleRow.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF475569' } };
  worksheet.mergeCells(2, 1, 2, Math.max(headers.length, 4));

  // Blank row
  worksheet.addRow([]);

  // Column Headers Row (Row 4)
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Rows
  rows.forEach((r) => {
    const row = worksheet.addRow(r);
    row.font = { name: 'Calibri', size: 10 };
    r.forEach((val, idx) => {
      const cell = row.getCell(idx + 1);
      if (typeof val === 'number') {
        if (currencyColIndices.includes(idx)) {
          cell.numFmt = '₹#,##0.00';
        } else {
          cell.numFmt = '#,##0.00';
        }
      }
    });
  });

  // Auto-width columns
  worksheet.columns.forEach((column, colIdx) => {
    let maxLen = headers[colIdx] ? headers[colIdx].length : 10;
    rows.forEach((r) => {
      const cellVal = r[colIdx];
      if (cellVal !== null && cellVal !== undefined) {
        maxLen = Math.max(maxLen, String(cellVal).length);
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 12), 45);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Build printable PDF document buffer using pdfkit (strict height check, zero empty pages) */
function buildPdfDocument(
  title: string,
  companyName: string,
  periodStr: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
      autoFirstPage: true,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Company Letterhead (Centered at top)
    doc
      .fontSize(16)
      .fillColor('#1E3A5F')
      .text(companyName, { align: 'center' })
      .moveDown(0.2);

    doc
      .fontSize(12)
      .fillColor('#2563EB')
      .text(title, { align: 'center' })
      .moveDown(0.2);

    doc
      .fontSize(9)
      .fillColor('#64748B')
      .text(periodStr, { align: 'center' })
      .moveDown(0.8);

    // Table settings
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right; // ~781 pt
    const colCount = Math.max(headers.length, 1);
    const colWidth = Math.floor(pageWidth / colCount);

    let startX = doc.page.margins.left;
    let startY = doc.y;

    const renderHeader = (yPos: number) => {
      doc.rect(startX, yPos, pageWidth, 20).fill('#1E3A5F');
      doc.fillColor('#FFFFFF').fontSize(8);
      headers.forEach((h, i) => {
        doc.text(h, startX + i * colWidth + 2, yPos + 5, {
          width: colWidth - 4,
          align: i === 0 ? 'left' : 'center',
          lineBreak: false,
        });
      });
    };

    renderHeader(startY);
    startY += 20;

    // Data Rows
    doc.fillColor('#1E293B').fontSize(7.5);

    rows.forEach((row, rowIdx) => {
      // Calculate row height based on contents
      let rowHeight = 16;
      row.forEach((val) => {
        const textStr = val === null || val === undefined ? '' : String(val);
        const h = doc.heightOfString(textStr, { width: colWidth - 4 });
        if (h + 6 > rowHeight) rowHeight = Math.ceil(h + 6);
      });

      // Strict overflow check before rendering row
      if (startY + rowHeight > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        startY = doc.page.margins.top;
        renderHeader(startY);
        startY += 20;
        doc.fillColor('#1E293B').fontSize(7.5);
      }

      if (rowIdx % 2 === 1) {
        doc.rect(startX, startY, pageWidth, rowHeight).fill('#F8FAFC');
        doc.fillColor('#1E293B');
      }

      row.forEach((val, colIdx) => {
        const textStr = val === null || val === undefined ? '' : String(val);
        const isNumeric = typeof val === 'number';
        doc.text(textStr, startX + colIdx * colWidth + 2, startY + 3, {
          width: colWidth - 4,
          align: isNumeric ? 'right' : colIdx === 0 ? 'left' : 'center',
        });
      });

      doc.moveTo(startX, startY + rowHeight).lineTo(startX + pageWidth, startY + rowHeight).strokeColor('#E2E8F0').stroke();
      startY += rowHeight;
    });

    // Page Numbers and Footer (rendered strictly over populated pages)
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 25;
      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('Generated from VChemics CEO Dashboard', doc.page.margins.left, footerY, { align: 'left', lineBreak: false })
        .text(`Page ${i + 1} of ${pages.count}`, doc.page.margins.left, footerY, { align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

/**
 * GET /api/export/:module?format=xlsx|pdf|csv&from=YYYYMMDD&to=YYYYMMDD
 * Downloads Excel (.xlsx), PDF (.pdf), or CSV report for any dashboard module.
 */
exportRouter.get('/:module', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const companyName = company?.displayName || 'VCHEMICS INDIA SOLUTIONS';

    const moduleName = String(req.params.module).toLowerCase();
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0]!;

    const defaultFrom = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const defaultTo = new Date();

    const fromDate = parseDateParam(req.query.from, defaultFrom);
    const toDate = parseDateParam(req.query.to, defaultTo);
    toDate.setUTCHours(23, 59, 59, 999);

    const periodStr = `Report Period: ${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`;

    let reportTitle = moduleName.toUpperCase().replace(/-/g, ' ');
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let currencyColIndices: number[] = [];

    if (moduleName === 'bill-pnl') {
      reportTitle = 'Bill-wise Profit & Loss';
      headers = ['Date', 'Invoice#', 'Customer Name', 'Stock Item', 'Qty', 'Unit', 'Sale Rate', 'Cost Rate', 'Sale Value', 'Cost Value', 'Profit', 'Margin %'];
      currencyColIndices = [6, 7, 8, 9, 10];

      const sales = await prisma.voucher.findMany({
        where: {
          companyId,
          voucherType: 'Sales',
          isCancelled: false,
          date: { gte: fromDate, lte: toDate },
        },
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
              vDate, vNum, party, item.stockItemName, qty, item.unit || 'NOS',
              Math.round(saleRate * 100) / 100, Math.round(costRate * 100) / 100,
              Math.round(saleAmt * 100) / 100, Math.round(costAmt * 100) / 100,
              Math.round(profit * 100) / 100, Math.round(margin * 10) / 10,
            ]);
          });
        }
      });
    } else if (moduleName === 'product-profitability') {
      reportTitle = 'Product Profitability Report';
      headers = ['Stock Item Name', 'Unit', 'Total Qty Sold', 'Avg Sale Rate', 'Avg Cost Rate', 'Total Sale Value', 'Total Cost Value', 'Total Profit', 'Margin %', 'Estimated Cost'];
      currencyColIndices = [3, 4, 5, 6, 7];

      const stockItems = await prisma.stockItem.findMany({ where: { companyId } });
      const stockCostMap = new Map<string, number>();
      stockItems.forEach((s) => stockCostMap.set(s.name.toLowerCase().trim(), num(s.avgCost)));

      const items = await prisma.voucherItem.findMany({
        where: { voucher: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: fromDate, lte: toDate } } },
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
    } else if (moduleName === 'sales' || moduleName === 'sales-analytics') {
      reportTitle = 'Sales Analytics Register';
      headers = ['Date', 'Voucher Number', 'Customer Name', 'Amount'];
      currencyColIndices = [3];

      const items = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: fromDate, lte: toDate } },
        orderBy: { date: 'desc' },
      });
      rows = items.map((i) => [
        i.date.toISOString().split('T')[0]!,
        i.voucherNumber,
        i.partyName || 'Cash / Counter Sale',
        num(i.amount),
      ]);
    } else if (moduleName === 'purchases' || moduleName === 'purchase-analytics') {
      reportTitle = 'Purchase Analytics Register';
      headers = ['Date', 'Voucher Number', 'Supplier Name', 'Amount'];
      currencyColIndices = [3];

      const items = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: fromDate, lte: toDate } },
        orderBy: { date: 'desc' },
      });
      rows = items.map((i) => [
        i.date.toISOString().split('T')[0]!,
        i.voucherNumber,
        i.partyName || 'Cash Purchase',
        num(i.amount),
      ]);
    } else if (moduleName === 'receivables') {
      reportTitle = 'Bills Receivable & Aging Schedule';
      headers = ['Bill Date', 'Bill Ref', 'Customer Name', 'Due Date', 'Pending Amount', 'Overdue Days', 'Aging Bucket'];
      currencyColIndices = [4];

      const items = await prisma.outstanding.findMany({
        where: { companyId, type: 'receivable' },
        orderBy: { overdueDays: 'desc' },
      });
      rows = items.map((i) => {
        const days = i.overdueDays;
        const bucket = days <= 30 ? '0-30 Days' : days <= 60 ? '31-60 Days' : days <= 90 ? '61-90 Days' : '90+ Days';
        return [
          i.billDate.toISOString().split('T')[0]!,
          i.billRef,
          i.partyName,
          i.dueDate ? i.dueDate.toISOString().split('T')[0]! : '-',
          num(i.pendingAmount),
          days,
          bucket,
        ];
      });
    } else if (moduleName === 'payables') {
      reportTitle = 'Bills Payable & Aging Schedule';
      headers = ['Bill Date', 'Bill Ref', 'Supplier Name', 'Due Date', 'Pending Amount', 'Overdue Days', 'Aging Bucket'];
      currencyColIndices = [4];

      const items = await prisma.outstanding.findMany({
        where: { companyId, type: 'payable' },
        orderBy: { overdueDays: 'desc' },
      });
      rows = items.map((i) => {
        const days = i.overdueDays;
        const bucket = days <= 30 ? '0-30 Days' : days <= 60 ? '31-60 Days' : days <= 90 ? '61-90 Days' : '90+ Days';
        return [
          i.billDate.toISOString().split('T')[0]!,
          i.billRef,
          i.partyName,
          i.dueDate ? i.dueDate.toISOString().split('T')[0]! : '-',
          num(i.pendingAmount),
          days,
          bucket,
        ];
      });
    } else if (moduleName === 'inventory') {
      reportTitle = 'Stock Inventory Valuation Report';
      headers = ['Stock Item Name', 'Unit', 'Closing Qty', 'Avg Cost Rate', 'Closing Value'];
      currencyColIndices = [3, 4];

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
    } else if (moduleName === 'customers') {
      reportTitle = 'Customer Performance & Master Report';
      headers = ['Customer Name', 'GSTIN', 'State', 'Outstanding Receivable', 'Total Sales Revenue'];
      currencyColIndices = [3, 4];

      const salesVouchers = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: fromDate, lte: toDate } },
      });
      const customerSalesMap = new Map<string, number>();
      salesVouchers.forEach((v) => {
        const name = v.partyName?.trim();
        if (!name) return;
        customerSalesMap.set(name, (customerSalesMap.get(name) || 0) + num(v.amount));
      });

      const receivables = await prisma.outstanding.findMany({
        where: { companyId, type: 'receivable' },
      });
      const customerRecMap = new Map<string, number>();
      receivables.forEach((r) => {
        const name = r.partyName.trim();
        if (!name) return;
        customerRecMap.set(name, (customerRecMap.get(name) || 0) + num(r.pendingAmount));
      });

      const partyNames = new Set([...customerSalesMap.keys(), ...customerRecMap.keys()]);
      rows = Array.from(partyNames).map((name) => [
        name,
        '-',
        'Tamil Nadu',
        customerRecMap.get(name) || 0,
        customerSalesMap.get(name) || 0,
      ]);
    } else if (moduleName === 'suppliers') {
      reportTitle = 'Supplier Spend & Master Report';
      headers = ['Supplier Name', 'GSTIN', 'State', 'Outstanding Payable', 'Total Purchase Spend'];
      currencyColIndices = [3, 4];

      const purchaseVouchers = await prisma.voucher.findMany({
        where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: fromDate, lte: toDate } },
      });
      const supplierSpendMap = new Map<string, number>();
      purchaseVouchers.forEach((v) => {
        const name = v.partyName?.trim();
        if (!name) return;
        supplierSpendMap.set(name, (supplierSpendMap.get(name) || 0) + num(v.amount));
      });

      const payables = await prisma.outstanding.findMany({
        where: { companyId, type: 'payable' },
      });
      const supplierPayMap = new Map<string, number>();
      payables.forEach((p) => {
        const name = p.partyName.trim();
        if (!name) return;
        supplierPayMap.set(name, (supplierPayMap.get(name) || 0) + num(p.pendingAmount));
      });

      const partyNames = new Set([...supplierSpendMap.keys(), ...supplierPayMap.keys()]);
      rows = Array.from(partyNames).map((name) => [
        name,
        '-',
        'Tamil Nadu',
        supplierPayMap.get(name) || 0,
        supplierSpendMap.get(name) || 0,
      ]);
    } else if (moduleName === 'gst') {
      reportTitle = 'GST Output & Input Summary';
      headers = ['Ledger Name', 'Voucher Number', 'Voucher Date', 'GST Type', 'Amount'];
      currencyColIndices = [4];

      let entries = await prisma.voucherLedgerEntry.findMany({
        where: {
          voucher: { companyId, isCancelled: false, date: { gte: fromDate, lte: toDate } },
          ledgerName: { contains: 'GST', mode: 'insensitive' },
        },
        include: { voucher: true },
        orderBy: { voucher: { date: 'desc' } },
      });
      if (entries.length === 0) {
        entries = await prisma.voucherLedgerEntry.findMany({
          where: { voucher: { companyId, isCancelled: false, date: { gte: fromDate, lte: toDate } } },
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
      reportTitle = 'Daily Business Activity Report';
      headers = ['Date', 'Voucher Type', 'Voucher Number', 'Party Name', 'Amount'];
      currencyColIndices = [4];

      let vouchers = await prisma.voucher.findMany({
        where: { companyId, isCancelled: false, date: { gte: fromDate, lte: toDate } },
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
      reportTitle = 'Executive Financial Overview';
      headers = ['Metric Name', 'Financial Statement', 'Amount (INR)'];
      currencyColIndices = [2];

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
      reportTitle = 'Master Records Report';
      headers = ['Ledger / Master Name', 'Group / Type', 'Current Balance'];
      currencyColIndices = [2];

      const ledgers = await prisma.ledger.findMany({ where: { companyId }, take: 100 });
      rows = ledgers.map((l) => [l.name, l.parentGroup || 'Ledger', Math.abs(num(l.currentBalance))]);
    }

    const safeFilenamePrefix = `VChemics_${moduleName.toUpperCase().replace(/-/g, '_')}_${dateStr}`;

    if (format === 'pdf') {
      const buffer = await buildPdfDocument(reportTitle, companyName, periodStr, headers, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilenamePrefix}.pdf"`);
      res.status(200).send(buffer);
    } else if (format === 'csv') {
      const csvContent = arrayToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilenamePrefix}.csv"`);
      res.status(200).send(csvContent);
    } else {
      // Default: format=xlsx (Native Excel)
      const buffer = await buildExcelWorkbook(reportTitle, companyName, periodStr, headers, rows, currencyColIndices);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilenamePrefix}.xlsx"`);
      res.status(200).send(buffer);
    }
  } catch (err) {
    res.status(500).json({ error: 'Export failed', detail: String(err) });
  }
});
