import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { logger } from '../lib/logger.js';
import { syncAuth } from '../middleware/sync-auth.js';
import { requireUser } from '../middleware/auth.js';
import { recomputeTodaySnapshot } from '../services/kpi-service.js';

export const syncRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas (mirror @vchemics/shared wire types)
// ---------------------------------------------------------------------------

const ledgerSchema = z.object({
  name: z.string().min(1),
  parentGroup: z.string().default('Unknown'),
  openingBalance: z.number().default(0),
  currentBalance: z.number().default(0),
  isDebit: z.boolean().default(true),
  gstin: z.string().optional(),
  state: z.string().optional(),
});

const voucherItemSchema = z.object({
  stockItemName: z.string().default(''),
  quantity: z.number().default(0),
  unit: z.string().default(''),
  rate: z.number().default(0),
  amount: z.number().default(0),
  gstRate: z.number().optional(),
  hsnCode: z.string().optional(),
});

const voucherLedgerEntrySchema = z.object({
  ledgerName: z.string().default(''),
  amount: z.number().default(0),
  isDebit: z.boolean().default(false),
});

const voucherSchema = z.object({
  tallyGuid: z.string().min(1),
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
  ]),
  data: z.array(z.unknown()),
});

// ---------------------------------------------------------------------------
// Per-job-type upsert handlers
// ---------------------------------------------------------------------------

async function ingestLedgers(companyId: string, data: unknown[]): Promise<number> {
  const ledgers = z.array(ledgerSchema).parse(data);
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
            gstin: l.gstin ?? null,
            state: l.state ?? null,
          },
          create: {
            companyId,
            name: l.name,
            parentGroup: l.parentGroup,
            openingBalance: l.openingBalance,
            currentBalance: l.currentBalance,
            isDebit: l.isDebit,
            gstin: l.gstin ?? null,
            state: l.state ?? null,
          },
        }),
      ),
    );
  }
  return ledgers.length;
}

async function ingestVouchers(companyId: string, data: unknown[]): Promise<number> {
  const vouchers = z.array(voucherSchema).parse(data);
  // Upsert one at a time so we can replace child rows atomically per voucher.
  for (const v of vouchers) {
    const base = {
      voucherType: v.voucherType,
      voucherNumber: v.voucherNumber,
      date: new Date(v.date),
      partyName: v.partyName ?? null,
      narration: v.narration ?? null,
      amount: v.amount,
      isCancelled: v.isCancelled,
    };
    await prisma.voucher.upsert({
      where: { tallyGuid: v.tallyGuid },
      update: {
        ...base,
        items: { deleteMany: {}, create: v.items },
        ledgerEntries: { deleteMany: {}, create: v.ledgerEntries },
      },
      create: {
        companyId,
        tallyGuid: v.tallyGuid,
        ...base,
        items: { create: v.items },
        ledgerEntries: { create: v.ledgerEntries },
      },
    });
  }
  return vouchers.length;
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

    if (jobType === 'ledger-list' || jobType === 'balance-sheet' || jobType === 'profit-and-loss') {
      ingested = await ingestLedgers(companyId, data);
    } else if ((VOUCHER_JOB_TYPES as readonly string[]).includes(jobType)) {
      ingested = await ingestVouchers(companyId, data);
    } else if (jobType === 'stock-summary') {
      ingested = await ingestStock(companyId, data);
    } else if (jobType === 'bills-receivable') {
      ingested = await ingestOutstandings(companyId, data, 'receivable');
    } else if (jobType === 'bills-payable') {
      ingested = await ingestOutstandings(companyId, data, 'payable');
    }

    // Refresh today's KPI snapshot so the dashboard reflects the new data.
    await recomputeTodaySnapshot(companyId);

    logger.info({ syncId, jobType, ingested }, 'Ingested');
    res.json({ ok: true, jobType, ingested });
  } catch (err) {
    logger.error({ err, syncId, jobType }, 'Ingest failed');
    res.status(500).json({ error: 'Ingest failed' });
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

  await prisma.syncTrigger.update({
    where: { id: pending.id },
    data: { consumedAt: new Date() },
  });

  res.json({ trigger: pending });
});
