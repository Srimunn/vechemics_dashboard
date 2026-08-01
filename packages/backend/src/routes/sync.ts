import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { logger } from '../lib/logger.js';
import { syncAuth } from '../middleware/sync-auth.js';
import { requireUser } from '../middleware/auth.js';
import { recomputeTodaySnapshot } from '../services/kpi-service.js';
import { generateNotifications } from '../services/notification-service.js';

export const syncRouter = Router();

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Validation schemas (mirror @vchemics/shared wire types)
// ---------------------------------------------------------------------------

const optionalCoercedNumber = z.union([z.number(), z.string()]).optional().transform((v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
});

const rawLedgerInputSchema = z.object({
  name: z.string().min(1),
  parentGroup: z.string().optional(),
  openingBalance: optionalCoercedNumber,
  currentBalance: optionalCoercedNumber,
  amount: optionalCoercedNumber,
  debit: optionalCoercedNumber,
  credit: optionalCoercedNumber,
  isDebit: z.boolean().optional(),
  gstin: z.string().optional(),
  state: z.string().optional(),
});

const voucherItemSchema = z.object({
  stockItemName: z.string().default(''),
  quantity: z.number().default(0),
  unit: z.string().default(''),
  rate: z.number().default(0),
  amount: z.number().default(0),
  costRate: z.number().optional(),
  costAmount: z.number().optional(),
  profit: z.number().optional(),
  marginPct: z.number().optional(),
  gstRate: z.number().optional(),
  hsnCode: z.string().optional(),
});

const voucherLedgerEntrySchema = z.object({
  ledgerName: z.string().default(''),
  amount: z.number().default(0),
  isDebit: z.boolean().default(false),
});

const voucherSchema = z.object({
  // Optional: synthesized from type+number+date when the agent doesn't send it.
  tallyGuid: z.string().optional(),
  voucherType: z.enum(['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra']),
  voucherNumber: z.string().default(''),
  date: z.string(),
  partyName: z.string().optional(),
  narration: z.string().optional(),
  amount: z.number().default(0),
  isCancelled: z.boolean().default(false),
  items: z.array(voucherItemSchema).default([]),
  ledgerEntries: z.array(voucherLedgerEntrySchema).default([]),
});

const stockItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().default(''),
  hsnCode: z.string().optional(),
  gstRate: z.number().optional(),
  closingQty: z.number().default(0),
  closingValue: z.number().default(0),
  avgCost: z.number().default(0),
});

const outstandingSchema = z.object({
  type: z.enum(['receivable', 'payable']),
  billDate: z.string(),
  billRef: z.string().default(''),
  partyName: z.string().default(''),
  dueDate: z.string().optional(),
  pendingAmount: z.number().default(0),
  overdueDays: z.number().int().default(0),
});

const VOUCHER_JOB_TYPES = [
  'day-book',
  'voucher-register-sales',
  'voucher-register-purchase',
  'voucher-register-receipt',
  'voucher-register-payment',
  'voucher-register-journal',
  'voucher-register-contra',
] as const;

const ingestSchema = z.object({
  syncId: z.string().min(1),
  jobType: z.enum([
    'ledger-list',
    'balance-sheet',
    'profit-and-loss',
    ...VOUCHER_JOB_TYPES,
    'stock-summary',
    'bills-receivable',
    'bills-payable',
    'kpi-direct',
  ]),
  data: z.union([z.array(z.unknown()), z.record(z.unknown())]),
});

// ---------------------------------------------------------------------------
// Per-job-type upsert handlers
// ---------------------------------------------------------------------------

async function ingestLedgers(companyId: string, data: unknown[], jobType: string): Promise<number> {
  const rawItems = z.array(rawLedgerInputSchema).parse(data);

  const ledgers = rawItems.map((item) => {
    let currentBalance = 0;
    if (jobType === 'ledger-list') {
      if (item.debit !== undefined || item.credit !== undefined) {
        currentBalance = (item.debit ?? 0) - (item.credit ?? 0);
      } else if (item.amount !== undefined) {
        currentBalance = item.amount;
      } else {
        currentBalance = item.currentBalance ?? 0;
      }
    } else if (jobType === 'balance-sheet' || jobType === 'profit-and-loss') {
      currentBalance = item.amount ?? item.currentBalance ?? 0;
    } else {
      currentBalance = item.currentBalance ?? item.amount ?? 0;
    }

    let parentGroup = item.parentGroup;
    if (jobType === 'balance-sheet') {
      if (!parentGroup || parentGroup === 'Unknown' || parentGroup === 'Balance Sheet') {
        parentGroup = item.name;
      }
    } else if (jobType === 'ledger-list') {
      if (!parentGroup || parentGroup === 'Unknown') {
        parentGroup = item.name;
      }
    } else if (jobType === 'profit-and-loss') {
      if (!parentGroup || parentGroup === 'Unknown') {
        parentGroup = 'Profit & Loss';
      }
    } else {
      if (!parentGroup) {
        parentGroup = 'Unknown';
      }
    }

    const openingBalance = item.openingBalance ?? 0;
    const isDebit = item.isDebit ?? (currentBalance >= 0);

    return {
      name: item.name,
      parentGroup,
      openingBalance,
      currentBalance,
      isDebit,
      gstin: item.gstin ?? null,
      state: item.state ?? null,
    };
  });

  const chunkSize = 100;
  for (let i = 0; i < ledgers.length; i += chunkSize) {
    const chunk = ledgers.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((l) =>
        prisma.ledger.upsert({
          where: { companyId_name: { companyId, name: l.name } },
          update: {
            parentGroup: l.parentGroup,
            openingBalance: l.openingBalance,
            currentBalance: l.currentBalance,
            isDebit: l.isDebit,
            gstin: l.gstin,
            state: l.state,
          },
          create: {
            companyId,
            name: l.name,
            parentGroup: l.parentGroup,
            openingBalance: l.openingBalance,
            currentBalance: l.currentBalance,
            isDebit: l.isDebit,
            gstin: l.gstin,
            state: l.state,
          },
        }),
      ),
    );
  }
  return ledgers.length;
}

/** Accept "YYYYMMDD" (Tally SV format) or any Date-parseable string. */
function parseVoucherDate(s: string): Date | null {
  const t = (s || '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ingest vouchers resiliently: each voucher is validated and upserted on its
 * own, so a single malformed record is skipped (and logged) rather than failing
 * the whole batch. tallyGuid is synthesized when absent; the date accepts
 * Tally's YYYYMMDD as well as ISO; amount is stored as a magnitude.
 */
async function ingestVouchers(companyId: string, data: unknown[]): Promise<number> {
  let ingested = 0;
  let skipped = 0;

  for (const raw of data) {
    const parsedV = voucherSchema.safeParse(raw);
    if (!parsedV.success) {
      skipped++;
      logger.warn({ issues: parsedV.error.issues.slice(0, 3) }, 'Skipping invalid voucher');
      continue;
    }
    const v = parsedV.data;

    const date = parseVoucherDate(v.date);
    if (!date) {
      skipped++;
      logger.warn({ date: v.date, voucherNumber: v.voucherNumber }, 'Skipping voucher: unparseable date');
      continue;
    }

    const tallyGuid =
      v.tallyGuid && v.tallyGuid.length > 0
        ? v.tallyGuid
        : `${v.voucherType}:${v.voucherNumber}:${v.date}`;

    const base = {
      voucherType: v.voucherType,
      voucherNumber: v.voucherNumber,
      date,
      partyName: v.partyName ?? null,
      narration: v.narration ?? null,
      amount: Math.abs(v.amount),
      isCancelled: v.isCancelled,
    };

    try {
      await prisma.voucher.upsert({
        where: { tallyGuid },
        update: {
          ...base,
          items: { deleteMany: {}, create: v.items },
          ledgerEntries: { deleteMany: {}, create: v.ledgerEntries },
        },
        create: {
          companyId,
          tallyGuid,
          ...base,
          items: { create: v.items },
          ledgerEntries: { create: v.ledgerEntries },
        },
      });
      ingested++;
    } catch (err) {
      skipped++;
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), tallyGuid },
        'Voucher upsert failed',
      );
    }
  }

  if (skipped > 0) logger.warn({ ingested, skipped }, 'Voucher ingest finished with skips');
  return ingested;
}

async function ingestStock(companyId: string, data: unknown[]): Promise<number> {
  const items = z.array(stockItemSchema).parse(data);
  const chunkSize = 100;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((s) =>
        prisma.stockItem.upsert({
          where: { companyId_name: { companyId, name: s.name } },
          update: {
            unit: s.unit,
            hsnCode: s.hsnCode ?? null,
            gstRate: s.gstRate ?? null,
            closingQty: s.closingQty,
            closingValue: s.closingValue,
            avgCost: s.avgCost,
          },
          create: {
            companyId,
            name: s.name,
            unit: s.unit,
            hsnCode: s.hsnCode ?? null,
            gstRate: s.gstRate ?? null,
            closingQty: s.closingQty,
            closingValue: s.closingValue,
            avgCost: s.avgCost,
          },
        }),
      ),
    );
  }
  return items.length;
}

/**
 * Bills reports are full snapshots. Outstanding has no natural unique key, so we
 * replace all rows of this type for the company, then insert fresh.
 * NOTE: assumes the whole bills set arrives in one ingest request (uploader
 * batches at 500; typical bills lists are well under that).
 */
async function ingestOutstandings(
  companyId: string,
  data: unknown[],
  type: 'receivable' | 'payable',
): Promise<number> {
  const rows = z.array(outstandingSchema).parse(data);
  await prisma.$transaction([
    prisma.outstanding.deleteMany({ where: { companyId, type } }),
    prisma.outstanding.createMany({
      data: rows.map((o) => ({
        companyId,
        type,
        billDate: new Date(o.billDate),
        billRef: o.billRef,
        partyName: o.partyName,
        dueDate: o.dueDate ? new Date(o.dueDate) : null,
        pendingAmount: o.pendingAmount,
        overdueDays: o.overdueDays,
      })),
    }),
  ]);
  return rows.length;
}

const kpiDirectSchema = z.object({
  snapshotDate: z.string().optional(),
  todaySales: optionalCoercedNumber.transform((v) => v ?? 0),
  todayPurchase: optionalCoercedNumber.transform((v) => v ?? 0),
  todayGrossProfit: optionalCoercedNumber.transform((v) => v ?? 0),
  todayNetProfit: optionalCoercedNumber.transform((v) => v ?? 0),
  collectionsToday: optionalCoercedNumber.transform((v) => v ?? 0),
  outstandingReceivables: optionalCoercedNumber.transform((v) => v ?? 0),
  outstandingPayables: optionalCoercedNumber.transform((v) => v ?? 0),
  cashInHand: optionalCoercedNumber.transform((v) => v ?? 0),
  bankBalance: optionalCoercedNumber.transform((v) => v ?? 0),
  inventoryValue: optionalCoercedNumber.transform((v) => v ?? 0),
  gstPayable: optionalCoercedNumber.transform((v) => v ?? 0),
  mtdSales: optionalCoercedNumber.transform((v) => v ?? 0),
  mtdPurchase: optionalCoercedNumber.transform((v) => v ?? 0),
  ordersBilledToday: optionalCoercedNumber.transform((v) => v ?? 0),
  newCustomersToday: optionalCoercedNumber.transform((v) => v ?? 0),
});

async function ingestKpiDirect(companyId: string, data: unknown): Promise<number> {
  const rawObj = Array.isArray(data) ? data[0] : data;
  const parsed = kpiDirectSchema.parse(rawObj ?? {});

  const targetDate = parsed.snapshotDate ? new Date(parsed.snapshotDate) : new Date();
  const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

  const values = {
    todaySales: parsed.todaySales,
    todayPurchase: parsed.todayPurchase,
    todayGrossProfit: parsed.todayGrossProfit,
    todayNetProfit: parsed.todayNetProfit,
    collectionsToday: parsed.collectionsToday,
    outstandingReceivables: parsed.outstandingReceivables,
    outstandingPayables: parsed.outstandingPayables,
    cashInHand: parsed.cashInHand,
    bankBalance: parsed.bankBalance,
    inventoryValue: parsed.inventoryValue,
    gstPayable: parsed.gstPayable,
    mtdSales: parsed.mtdSales,
    mtdPurchase: parsed.mtdPurchase,
    ordersBilledToday: parsed.ordersBilledToday,
    newCustomersToday: parsed.newCustomersToday,
  };

  await prisma.kpiSnapshot.upsert({
    where: { companyId_snapshotDate: { companyId, snapshotDate: dayStart } },
    update: values,
    create: { companyId, snapshotDate: dayStart, ...values },
  });

  return 1;
}

// ---------------------------------------------------------------------------
// POST /api/sync/ingest
// ---------------------------------------------------------------------------

syncRouter.post('/ingest', syncAuth, async (req: Request, res: Response) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const { syncId, jobType, data } = parsed.data;
  const companyId = await ensureCompanyId();

  try {
    let ingested = 0;
    const items = Array.isArray(data) ? data : [data];

    if (jobType === 'kpi-direct') {
      ingested = await ingestKpiDirect(companyId, data);
    } else if (jobType === 'ledger-list' || jobType === 'balance-sheet' || jobType === 'profit-and-loss') {
      ingested = await ingestLedgers(companyId, items, jobType);
    } else if ((VOUCHER_JOB_TYPES as readonly string[]).includes(jobType)) {
      ingested = await ingestVouchers(companyId, items);
    } else if (jobType === 'stock-summary') {
      ingested = await ingestStock(companyId, items);
    } else if (jobType === 'bills-receivable') {
      ingested = await ingestOutstandings(companyId, items, 'receivable');
    } else if (jobType === 'bills-payable') {
      ingested = await ingestOutstandings(companyId, items, 'payable');
    }

    if (jobType !== 'kpi-direct') {
      // Refresh today's KPI snapshot so the dashboard reflects the new data.
      await recomputeTodaySnapshot(companyId);
    }

    logger.info({ syncId, jobType, ingested }, 'Ingested');
    res.json({ ok: true, jobType, ingested });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ err, syncId, jobType }, 'Ingest failed');
    res.status(500).json({ error: 'Ingest failed', jobType, detail });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sync/log  (sync agent reports a finished run)
// ---------------------------------------------------------------------------

const syncLogSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  syncType: z.enum(['incremental', 'full', 'manual']),
  status: z.enum(['success', 'partial', 'failed']),
  recordsSynced: z.number().int().default(0),
  errorMessage: z.string().optional(),
});

syncRouter.post('/log', syncAuth, async (req: Request, res: Response) => {
  const parsed = syncLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid sync log', issues: parsed.error.issues });
    return;
  }
  const l = parsed.data;
  const created = await prisma.syncLog.create({
    data: {
      startedAt: new Date(l.startedAt),
      finishedAt: l.finishedAt ? new Date(l.finishedAt) : null,
      syncType: l.syncType,
      status: l.status,
      recordsSynced: l.recordsSynced,
      errorMessage: l.errorMessage ?? null,
    },
    select: { id: true },
  });
  res.status(201).json({ ok: true, id: created.id });
});

// ---------------------------------------------------------------------------
// POST /api/sync/trigger  (frontend -> backend): request an on-demand sync
// ---------------------------------------------------------------------------

syncRouter.post('/trigger', requireUser, async (_req: Request, res: Response) => {
  const trigger = await prisma.syncTrigger.create({
    data: { syncType: 'manual' },
    select: { id: true, requestedAt: true },
  });
  logger.info({ triggerId: trigger.id }, 'Manual sync trigger requested');
  res.status(201).json({ ok: true, trigger });
});

// ---------------------------------------------------------------------------
// GET /api/sync/pending-trigger  (sync agent polls): claim a pending trigger
// ---------------------------------------------------------------------------

syncRouter.get('/pending-trigger', syncAuth, async (_req: Request, res: Response) => {
  const pending = await prisma.syncTrigger.findFirst({
    where: { consumedAt: null },
    orderBy: { requestedAt: 'asc' },
    select: { id: true, requestedAt: true },
  });

  if (!pending) {
    res.json({ trigger: null });
    return;
  }

  res.json({ trigger: pending });
});

// ---------------------------------------------------------------------------
// POST /api/sync/recalculate-costs  (recalculate all item costs & margins)
// ---------------------------------------------------------------------------

syncRouter.post('/recalculate-costs', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();

    // 1. Calculate weighted average cost from Purchase vouchers
    const purchaseItems = await prisma.voucherItem.findMany({
      where: { voucher: { companyId, voucherType: 'Purchase', isCancelled: false } },
    });

    const totalsMap = new Map<string, { totalAmount: number; totalQty: number }>();
    purchaseItems.forEach((item) => {
      const key = item.stockItemName.trim().toLowerCase();
      if (!key) return;
      const curr = totalsMap.get(key) || { totalAmount: 0, totalQty: 0 };
      curr.totalAmount += num(item.amount);
      curr.totalQty += num(item.quantity);
      totalsMap.set(key, curr);
    });

    // 2. Update StockItem.avgCost
    const stockItems = await prisma.stockItem.findMany({ where: { companyId } });
    const avgCostMap = new Map<string, number>();

    for (const item of stockItems) {
      const key = item.name.trim().toLowerCase();
      const purchase = totalsMap.get(key);
      let avgCost = num(item.avgCost);
      if (purchase && purchase.totalQty > 0) {
        avgCost = purchase.totalAmount / purchase.totalQty;
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { avgCost },
        });
      }
      avgCostMap.set(key, avgCost);
    }

    // 3. Update Sales VoucherItems
    const salesItems = await prisma.voucherItem.findMany({
      where: { voucher: { companyId, voucherType: 'Sales', isCancelled: false } },
    });

    let updatedCount = 0;
    for (const item of salesItems) {
      const key = item.stockItemName.trim().toLowerCase();
      const saleAmount = num(item.amount);
      const qty = num(item.quantity);
      const saleRate = num(item.rate) || (qty > 0 ? saleAmount / qty : 0);

      const dbCost = avgCostMap.get(key) || 0;
      const isEstimated = dbCost === 0;
      const costRate = isEstimated ? saleRate * 0.8 : dbCost;
      const costAmount = costRate * qty;
      const profit = saleAmount - costAmount;
      const marginPct = saleAmount > 0 ? (profit / saleAmount) * 100 : 0;

      await prisma.voucherItem.update({
        where: { id: item.id },
        data: {
          costRate,
          costAmount,
          profit,
          marginPct,
        },
      });
      updatedCount++;
    }

    res.json({ ok: true, updatedCount });
  } catch (err) {
    res.status(500).json({ error: 'Recalculation failed', detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sync/refresh-kpi  (delete today's snapshot and recompute)
// ---------------------------------------------------------------------------

syncRouter.post('/refresh-kpi', requireUser, async (_req: Request, res: Response) => {
  try {
    const companyId = await ensureCompanyId();
    const today = new Date();
    const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    await prisma.kpiSnapshot.deleteMany({
      where: { companyId, snapshotDate: dayStart },
    });

    await recomputeTodaySnapshot(companyId);
    await generateNotifications(companyId);
    res.json({ ok: true, message: 'KPI snapshot refreshed and notifications generated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh KPI', detail: String(err) });
  }
});
