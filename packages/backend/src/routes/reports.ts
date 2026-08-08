import { Router, type Request, type Response } from 'express';
import PDFDocument from 'pdfkit';
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

function formatINR(val: number): string {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(absVal);
  return `${isNegative ? '-' : ''}₹${formatted}`;
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

/**
 * GET /api/reports/monthly-ceo?month=8&year=2026
 * Generates an executive 3-page printable PDF Monthly CEO Business Report.
 */
reportsRouter.get('/monthly-ceo', requireUser, async (req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();

    const monthParam = req.query.month ? parseInt(String(req.query.month), 10) : new Date().getUTCMonth() + 1;
    const yearParam = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getUTCFullYear();

    const month = Math.max(1, Math.min(12, monthParam));
    const year = yearParam > 2000 ? yearParam : new Date().getUTCFullYear();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNameStr = `${monthNames[month - 1]} ${year}`;

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Data queries
    const salesVouchers = await prisma.voucher.findMany({
      where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: startDate, lte: endDate } },
      include: { items: true, overheadCost: true },
    });

    const purchaseVouchers = await prisma.voucher.findMany({
      where: { companyId, voucherType: 'Purchase', isCancelled: false, date: { gte: startDate, lte: endDate } },
    });

    const receiptVouchers = await prisma.voucher.findMany({
      where: { companyId, voucherType: 'Receipt', isCancelled: false, date: { gte: startDate, lte: endDate } },
    });

    const receivables = await prisma.outstanding.findMany({
      where: { companyId, type: 'receivable' },
    });

    const kpiSnapshot = await prisma.kpiSnapshot.findFirst({
      where: { companyId },
      orderBy: { snapshotDate: 'desc' },
    });

    let cashInHand = num(kpiSnapshot?.cashInHand);
    let bankBalance = num(kpiSnapshot?.bankBalance);

    if (!cashInHand && !bankBalance) {
      const ledgers = await prisma.ledger.findMany({ where: { companyId } });
      ledgers.forEach((l) => {
        const grp = l.parentGroup.toLowerCase();
        if (grp.includes('cash')) cashInHand += Math.abs(num(l.currentBalance));
        if (grp.includes('bank')) bankBalance += Math.abs(num(l.currentBalance));
      });
    }

    // Key Math
    const totalSales = salesVouchers.reduce((sum, v) => sum + num(v.amount), 0);
    const totalPurchase = purchaseVouchers.reduce((sum, v) => sum + num(v.amount), 0);
    const totalCollections = receiptVouchers.reduce((sum, v) => sum + num(v.amount), 0);
    const totalOutstandingReceivables = receivables.reduce((sum, r) => sum + num(r.pendingAmount), 0);

    let totalStockCost = 0;
    let totalOverheadCost = 0;

    salesVouchers.forEach((v) => {
      let billSale = num(v.amount);
      let billCost = 0;

      if (v.items.length > 0) {
        v.items.forEach((item) => {
          const qty = num(item.quantity);
          const saleAmt = num(item.amount);
          const saleRate = num(item.rate) || (qty > 0 ? saleAmt / qty : 0);
          const costRate = num(item.costRate) || saleRate * 0.8;
          const costAmt = num(item.costAmount) || costRate * qty;
          billCost += costAmt;
        });
      } else {
        billCost = billSale * 0.8;
      }

      totalStockCost += billCost;

      if (v.overheadCost) {
        const oh = num(v.overheadCost.transportCost) + num(v.overheadCost.labelingCost) + num(v.overheadCost.loadingCost) + num(v.overheadCost.otherCost);
        totalOverheadCost += oh;
      }
    });

    const grossProfit = totalSales - totalStockCost;
    const netProfit = totalSales - (totalStockCost + totalOverheadCost);
    const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    const netMarginPct = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const trueMarginPct = netMarginPct;
    const hasOverheadData = totalOverheadCost > 0 || salesVouchers.some((v) => !!v.overheadCost);

    // Top 10 Customers
    const customerMap = new Map<string, { name: string; sales: number; bills: number }>();
    salesVouchers.forEach((v) => {
      const name = v.partyName?.trim() || 'Cash / Counter Sale';
      const existing = customerMap.get(name) || { name, sales: 0, bills: 0 };
      existing.sales += num(v.amount);
      existing.bills += 1;
      customerMap.set(name, existing);
    });
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Top 10 Products
    const productMap = new Map<string, { name: string; qty: number; sales: number; cost: number }>();
    salesVouchers.forEach((v) => {
      v.items.forEach((item) => {
        const name = item.stockItemName.trim();
        if (!name) return;
        const qty = num(item.quantity);
        const sales = num(item.amount);
        const saleRate = num(item.rate) || (qty > 0 ? sales / qty : 0);
        const costRate = num(item.costRate) || saleRate * 0.8;
        const cost = num(item.costAmount) || costRate * qty;

        const existing = productMap.get(name) || { name, qty: 0, sales: 0, cost: 0 };
        existing.qty += qty;
        existing.sales += sales;
        existing.cost += cost;
        productMap.set(name, existing);
      });
    });

    const topProducts = Array.from(productMap.values())
      .map((p) => {
        const profit = p.sales - p.cost;
        const marginPct = p.sales > 0 ? (profit / p.sales) * 100 : 0;
        return { ...p, profit, marginPct };
      })
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Top 5 Products by True Margin Impact
    const productTrueMap = new Map<string, { name: string; sales: number; stockCost: number; overheadCost: number }>();
    salesVouchers.forEach((v) => {
      const billOverhead = v.overheadCost
        ? num(v.overheadCost.transportCost) + num(v.overheadCost.labelingCost) + num(v.overheadCost.loadingCost) + num(v.overheadCost.otherCost)
        : 0;
      const vTotalSales = num(v.amount) || 1;

      v.items.forEach((item) => {
        const name = item.stockItemName.trim();
        if (!name) return;
        const qty = num(item.quantity);
        const sales = num(item.amount);
        const saleRate = num(item.rate) || (qty > 0 ? sales / qty : 0);
        const costRate = num(item.costRate) || saleRate * 0.8;
        const stockCost = num(item.costAmount) || costRate * qty;
        const allocatedOverhead = billOverhead * (sales / vTotalSales);

        const existing = productTrueMap.get(name) || { name, sales: 0, stockCost: 0, overheadCost: 0 };
        existing.sales += sales;
        existing.stockCost += stockCost;
        existing.overheadCost += allocatedOverhead;
        productTrueMap.set(name, existing);
      });
    });

    const topTrueProducts = Array.from(productTrueMap.values())
      .map((p) => {
        const tallyProfit = p.sales - p.stockCost;
        const tallyMargin = p.sales > 0 ? (tallyProfit / p.sales) * 100 : 0;
        const trueProfit = p.sales - (p.stockCost + p.overheadCost);
        const trueMargin = p.sales > 0 ? (trueProfit / p.sales) * 100 : 0;
        const diff = tallyMargin - trueMargin;
        return { name: p.name, tallyMargin, trueMargin, diff };
      })
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5);

    // Receivables Aging
    const recAgingMap = new Map<string, { partyName: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90Plus: number; total: number }>();
    receivables.forEach((r) => {
      const name = r.partyName.trim();
      const amt = num(r.pendingAmount);
      const days = r.overdueDays;

      const existing = recAgingMap.get(name) || { partyName: name, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90Plus: 0, total: 0 };
      existing.total += amt;
      if (days <= 0) existing.current += amt;
      else if (days <= 30) existing.d1_30 += amt;
      else if (days <= 60) existing.d31_60 += amt;
      else if (days <= 90) existing.d61_90 += amt;
      else existing.d90Plus += amt;

      recAgingMap.set(name, existing);
    });

    const topReceivables = Array.from(recAgingMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      autoFirstPage: true,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));
    });

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 523.28 pt

    // -------------------------------------------------------------
    // PAGE 1 — EXECUTIVE SUMMARY
    // -------------------------------------------------------------
    // Header Banner
    doc.rect(36, 36, pageWidth, 54).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('VCHEMICS INDIA SOLUTIONS', 50, 46);
    doc.fillColor('#93C5FD').fontSize(11).font('Helvetica-Bold').text('MONTHLY CEO BUSINESS REPORT', 50, 66);
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(monthNameStr.toUpperCase(), pageWidth - 100, 56, { align: 'right', width: 120 });

    // KPI Boxes Row (Y = 105)
    const kpiBoxWidth = Math.floor((pageWidth - 27) / 4); // ~124pt
    const kpiBoxY = 105;
    const kpiBoxHeight = 55;

    const kpiData = [
      { label: 'TOTAL SALES', value: formatINR(totalSales), color: '#1E3A5F' },
      { label: 'TOTAL PURCHASE', value: formatINR(totalPurchase), color: '#D97706' },
      { label: 'GROSS PROFIT', value: formatINR(grossProfit), color: '#16A34A' },
      { label: 'NET PROFIT', value: formatINR(netProfit), color: '#7C3AED' },
    ];

    kpiData.forEach((kpi, idx) => {
      const boxX = 36 + idx * (kpiBoxWidth + 9);
      doc.rect(boxX, kpiBoxY, kpiBoxWidth, kpiBoxHeight).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text(kpi.label, boxX + 6, kpiBoxY + 8, { width: kpiBoxWidth - 12 });
      doc.fillColor(kpi.color).fontSize(11).font('Helvetica-Bold').text(kpi.value, boxX + 6, kpiBoxY + 28, { width: kpiBoxWidth - 12 });
    });

    // Profit Margins Row (Y = 175)
    doc.fillColor('#1E3A5F').fontSize(12).font('Helvetica-Bold').text('PROFITABILITY & MARGIN ANALYTICS', 36, 175);
    doc.rect(36, 192, pageWidth, 55).fillAndStroke('#FFFFFF', '#CBD5E1');

    const marginColWidth = Math.floor(pageWidth / 3);
    doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('GROSS MARGIN', 36 + 10, 202);
    doc.fillColor('#16A34A').fontSize(14).font('Helvetica-Bold').text(`${grossMarginPct.toFixed(1)}%`, 36 + 10, 218);

    doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('NET MARGIN', 36 + marginColWidth + 10, 202);
    doc.fillColor('#6366F1').fontSize(14).font('Helvetica-Bold').text(`${netMarginPct.toFixed(1)}%`, 36 + marginColWidth + 10, 218);

    doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('TRUE MARGIN (OVERHEAD ADJ.)', 36 + marginColWidth * 2 + 10, 202);
    doc.fillColor(hasOverheadData ? '#D97706' : '#94A3B8').fontSize(14).font('Helvetica-Bold').text(hasOverheadData ? `${trueMarginPct.toFixed(1)}%` : 'N/A', 36 + marginColWidth * 2 + 10, 218);

    // Collections & Receivables Position (Y = 265)
    doc.fillColor('#1E3A5F').fontSize(12).font('Helvetica-Bold').text('COLLECTIONS & RECEIVABLES SUMMARY', 36, 265);
    const posCardWidth = Math.floor((pageWidth - 12) / 2);

    // Card 1
    doc.rect(36, 282, posCardWidth, 60).fillAndStroke('#F0FDF4', '#BBF7D0');
    doc.fillColor('#166534').fontSize(8.5).font('Helvetica-Bold').text('TOTAL COLLECTIONS (THIS MONTH)', 48, 292);
    doc.fillColor('#15803D').fontSize(15).font('Helvetica-Bold').text(formatINR(totalCollections), 48, 312);

    // Card 2
    doc.rect(36 + posCardWidth + 12, 282, posCardWidth, 60).fillAndStroke('#EFF6FF', '#BFDBFE');
    doc.fillColor('#1E40AF').fontSize(8.5).font('Helvetica-Bold').text('OUTSTANDING RECEIVABLES (MONTH END)', 36 + posCardWidth + 24, 292);
    doc.fillColor('#1D4ED8').fontSize(15).font('Helvetica-Bold').text(formatINR(totalOutstandingReceivables), 36 + posCardWidth + 24, 312);

    // Executive Commentary Box (Y = 360)
    doc.fillColor('#1E3A5F').fontSize(12).font('Helvetica-Bold').text('EXECUTIVE HIGHLIGHTS & INSIGHTS', 36, 360);
    doc.rect(36, 377, pageWidth, 150).fillAndStroke('#F8FAFC', '#E2E8F0');

    const bullets = [
      `Total Revenue generated during ${monthNameStr} reached ${formatINR(totalSales)} across ${salesVouchers.length} sales invoices.`,
      `Total Purchase Spend for the month was recorded at ${formatINR(totalPurchase)}.`,
      `Gross Profit achieved is ${formatINR(grossProfit)} with a Gross Profit Margin of ${grossMarginPct.toFixed(1)}%.`,
      `Net Profit standing is ${formatINR(netProfit)} representing a Net Margin of ${netMarginPct.toFixed(1)}%.`,
      `Total Customer Collections processed during the month totaled ${formatINR(totalCollections)}.`,
      `Outstanding Receivables balance at month end stands at ${formatINR(totalOutstandingReceivables)}.`,
    ];

    let bulletY = 390;
    bullets.forEach((bText) => {
      doc.fillColor('#2563EB').fontSize(10).font('Helvetica-Bold').text('•', 48, bulletY);
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(bText, 60, bulletY, { width: pageWidth - 36 });
      bulletY += 21;
    });

    // -------------------------------------------------------------
    // PAGE 2 — CUSTOMER & PRODUCT ANALYSIS
    // -------------------------------------------------------------
    doc.addPage({ size: 'A4', margin: 36 });

    // Section 1: Top 10 Customers by Revenue
    doc.fillColor('#1E3A5F').fontSize(13).font('Helvetica-Bold').text(`TOP 10 CUSTOMERS BY REVENUE — ${monthNameStr.toUpperCase()}`, 36, 36);

    const [cW0, cW1, cW2, cW3] = [30, 240, 140, 113];
    let custY = 56;

    // Header
    doc.rect(36, custY, pageWidth, 18).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 40, custY + 5, { width: cW0 });
    doc.text('Customer Name', 40 + cW0, custY + 5, { width: cW1 });
    doc.text('Sales Revenue', 40 + cW0 + cW1, custY + 5, { width: cW2, align: 'right' });
    doc.text('Bills Billed', 40 + cW0 + cW1 + cW2, custY + 5, { width: cW3, align: 'center' });
    custY += 18;

    if (topCustomers.length === 0) {
      doc.rect(36, custY, pageWidth, 18).fill('#F8FAFC');
      doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('No sales recorded for this month.', 40, custY + 5);
      custY += 18;
    } else {
      topCustomers.forEach((c, idx) => {
        const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(36, custY, pageWidth, 16).fill(bg);
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica');
        doc.text(String(idx + 1), 40, custY + 4, { width: cW0 });
        doc.text(c.name, 40 + cW0, custY + 4, { width: cW1 - 10, lineBreak: false });
        doc.text(formatINR(c.sales), 40 + cW0 + cW1, custY + 4, { width: cW2, align: 'right' });
        doc.text(String(c.bills), 40 + cW0 + cW1 + cW2, custY + 4, { width: cW3, align: 'center' });
        custY += 16;
      });
    }

    // Section 2: Top 10 Products by Sales Volume
    let prodY = custY + 20;
    doc.fillColor('#1E3A5F').fontSize(13).font('Helvetica-Bold').text('TOP 10 PRODUCTS BY SALES VOLUME', 36, prodY);
    prodY += 20;

    const [pW0, pW1, pW2, pW3, pW4] = [30, 210, 80, 110, 93];
    doc.rect(36, prodY, pageWidth, 18).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 40, prodY + 5, { width: pW0 });
    doc.text('Product Name', 40 + pW0, prodY + 5, { width: pW1 });
    doc.text('Qty Sold', 40 + pW0 + pW1, prodY + 5, { width: pW2, align: 'right' });
    doc.text('Sales Revenue', 40 + pW0 + pW1 + pW2, prodY + 5, { width: pW3, align: 'right' });
    doc.text('Margin %', 40 + pW0 + pW1 + pW2 + pW3, prodY + 5, { width: pW4, align: 'right' });
    prodY += 18;

    if (topProducts.length === 0) {
      doc.rect(36, prodY, pageWidth, 18).fill('#F8FAFC');
      doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('No product items recorded for this month.', 40, prodY + 5);
      prodY += 18;
    } else {
      topProducts.forEach((p, idx) => {
        const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(36, prodY, pageWidth, 16).fill(bg);
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica');
        doc.text(String(idx + 1), 40, prodY + 4, { width: pW0 });
        doc.text(p.name, 40 + pW0, prodY + 4, { width: pW1 - 10, lineBreak: false });
        doc.text(new Intl.NumberFormat('en-IN').format(p.qty), 40 + pW0 + pW1, prodY + 4, { width: pW2, align: 'right' });
        doc.text(formatINR(p.sales), 40 + pW0 + pW1 + pW2, prodY + 4, { width: pW3, align: 'right' });
        doc.text(`${p.marginPct.toFixed(1)}%`, 40 + pW0 + pW1 + pW2 + pW3, prodY + 4, { width: pW4, align: 'right' });
        prodY += 16;
      });
    }

    // Section 3: Top 5 Products by True Margin (if overhead data exists)
    if (hasOverheadData && topTrueProducts.length > 0) {
      let trueY = prodY + 20;
      doc.fillColor('#1E3A5F').fontSize(11).font('Helvetica-Bold').text('TOP 5 PRODUCTS BY TRUE MARGIN IMPACT (OVERHEAD ADJUSTED)', 36, trueY);
      trueY += 18;

      const [tW0, tW1, tW2, tW3] = [210, 100, 100, 113];
      doc.rect(36, trueY, pageWidth, 18).fill('#475569');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('Product Name', 40, trueY + 5, { width: tW0 });
      doc.text('Tally Margin', 40 + tW0, trueY + 5, { width: tW1, align: 'right' });
      doc.text('True Margin', 40 + tW0 + tW1, trueY + 5, { width: tW2, align: 'right' });
      doc.text('Difference', 40 + tW0 + tW1 + tW2, trueY + 5, { width: tW3, align: 'right' });
      trueY += 18;

      topTrueProducts.forEach((tp, idx) => {
        const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(36, trueY, pageWidth, 16).fill(bg);
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica');
        doc.text(tp.name, 40, trueY + 4, { width: tW0 - 10, lineBreak: false });
        doc.text(`${tp.tallyMargin.toFixed(1)}%`, 40 + tW0, trueY + 4, { width: tW1, align: 'right' });
        doc.text(`${tp.trueMargin.toFixed(1)}%`, 40 + tW0 + tW1, trueY + 4, { width: tW2, align: 'right' });
        doc.fillColor('#DC2626').text(`-${tp.diff.toFixed(1)}%`, 40 + tW0 + tW1 + tW2, trueY + 4, { width: tW3, align: 'right' });
        trueY += 16;
      });
    }

    // -------------------------------------------------------------
    // PAGE 3 — RECEIVABLES AGING & CASH POSITION
    // -------------------------------------------------------------
    doc.addPage({ size: 'A4', margin: 36 });

    doc.fillColor('#1E3A5F').fontSize(13).font('Helvetica-Bold').text(`RECEIVABLES AGING SCHEDULE — ${monthNameStr.toUpperCase()}`, 36, 36);

    const [aW0, aW1, aW2, aW3, aW4, aW5] = [173, 70, 70, 70, 70, 70];
    let ageY = 56;

    // Header
    doc.rect(36, ageY, pageWidth, 18).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Customer Name', 40, ageY + 5, { width: aW0 });
    doc.text('Current', 40 + aW0, ageY + 5, { width: aW1, align: 'right' });
    doc.text('1-30 Days', 40 + aW0 + aW1, ageY + 5, { width: aW2, align: 'right' });
    doc.text('31-60 Days', 40 + aW0 + aW1 + aW2, ageY + 5, { width: aW3, align: 'right' });
    doc.text('61-90+ Days', 40 + aW0 + aW1 + aW2 + aW3, ageY + 5, { width: aW4, align: 'right' });
    doc.text('Total Pending', 40 + aW0 + aW1 + aW2 + aW3 + aW4, ageY + 5, { width: aW5, align: 'right' });
    ageY += 18;

    if (topReceivables.length === 0) {
      doc.rect(36, ageY, pageWidth, 18).fill('#F8FAFC');
      doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('No outstanding receivables recorded.', 40, ageY + 5);
      ageY += 18;
    } else {
      let totCurrent = 0, tot1_30 = 0, tot31_60 = 0, tot61_90Plus = 0, totGrand = 0;

      topReceivables.forEach((r, idx) => {
        const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
        const c61_90Plus = r.d61_90 + r.d90Plus;

        totCurrent += r.current;
        tot1_30 += r.d1_30;
        tot31_60 += r.d31_60;
        tot61_90Plus += c61_90Plus;
        totGrand += r.total;

        doc.rect(36, ageY, pageWidth, 16).fill(bg);
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica');
        doc.text(r.partyName, 40, ageY + 4, { width: aW0 - 10, lineBreak: false });
        doc.text(r.current > 0 ? formatINR(r.current) : '-', 40 + aW0, ageY + 4, { width: aW1, align: 'right' });
        doc.text(r.d1_30 > 0 ? formatINR(r.d1_30) : '-', 40 + aW0 + aW1, ageY + 4, { width: aW2, align: 'right' });
        doc.text(r.d31_60 > 0 ? formatINR(r.d31_60) : '-', 40 + aW0 + aW1 + aW2, ageY + 4, { width: aW3, align: 'right' });
        doc.text(c61_90Plus > 0 ? formatINR(c61_90Plus) : '-', 40 + aW0 + aW1 + aW2 + aW3, ageY + 4, { width: aW4, align: 'right' });
        doc.font('Helvetica-Bold').text(formatINR(r.total), 40 + aW0 + aW1 + aW2 + aW3 + aW4, ageY + 4, { width: aW5, align: 'right' });
        ageY += 16;
      });

      // Total Row
      doc.rect(36, ageY, pageWidth, 18).fill('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold');
      doc.text('TOTAL RECEIVABLES', 40, ageY + 5, { width: aW0 });
      doc.text(formatINR(totCurrent), 40 + aW0, ageY + 5, { width: aW1, align: 'right' });
      doc.text(formatINR(tot1_30), 40 + aW0 + aW1, ageY + 5, { width: aW2, align: 'right' });
      doc.text(formatINR(tot31_60), 40 + aW0 + aW1 + aW2, ageY + 5, { width: aW3, align: 'right' });
      doc.text(formatINR(tot61_90Plus), 40 + aW0 + aW1 + aW2 + aW3, ageY + 5, { width: aW4, align: 'right' });
      doc.text(formatINR(totGrand), 40 + aW0 + aW1 + aW2 + aW3 + aW4, ageY + 5, { width: aW5, align: 'right' });
      ageY += 24;
    }

    // Cash & Bank Summary Box (Y = ageY + 20)
    let cashY = Math.max(ageY + 10, 420);
    doc.fillColor('#1E3A5F').fontSize(12).font('Helvetica-Bold').text('CASH & BANK LIQUIDITY POSITION', 36, cashY);
    cashY += 18;

    doc.rect(36, cashY, pageWidth, 80).fillAndStroke('#F8FAFC', '#CBD5E1');

    const liqWidth = Math.floor(pageWidth / 3);

    doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('CASH IN HAND', 48, cashY + 14);
    doc.fillColor('#1E293B').fontSize(14).font('Helvetica-Bold').text(formatINR(cashInHand), 48, cashY + 34);

    doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('BANK BALANCES', 36 + liqWidth + 10, cashY + 14);
    doc.fillColor('#1E293B').fontSize(14).font('Helvetica-Bold').text(formatINR(bankBalance), 36 + liqWidth + 10, cashY + 34);

    doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('TOTAL LIQUID POSITION', 36 + liqWidth * 2 + 10, cashY + 14);
    doc.fillColor('#16A34A').fontSize(14).font('Helvetica-Bold').text(formatINR(cashInHand + bankBalance), 36 + liqWidth * 2 + 10, cashY + 34);

    // Render footers across all pages
    const pages = doc.bufferedPageRange();
    const dateGenStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.page.margins.bottom = 0; // Avoid auto-page spawn

    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 22;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94A3B8')
        .text(`Generated on ${dateGenStr} • VChemics CEO Dashboard`, 36, footerY, { width: 300, align: 'left', lineBreak: false })
        .text(`Page ${i + 1} of ${pages.count}`, doc.page.width - 36 - 150, footerY, { width: 150, align: 'right', lineBreak: false });
    }

    doc.end();

    const pdfBuffer = await pdfPromise;
    const filenameMonth = String(month).padStart(2, '0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="VChemics_Monthly_CEO_Report_${filenameMonth}_${year}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('Monthly CEO Report Error:', err);
    res.status(500).json({ error: 'Failed to generate Monthly CEO Report', detail: String(err) });
  }
});

