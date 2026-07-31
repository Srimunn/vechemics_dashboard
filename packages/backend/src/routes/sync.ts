import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';
import { logger } from '../lib/logger.js';
import { syncAuth } from '../middleware/sync-auth.js';
import { requireUser } from '../middleware/auth.js';

export const syncRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
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

/**
 * Envelope validator. For Step 3 only `ledger-list` is fully handled; other job
 * types are accepted (data validated loosely) and no-op until their handlers
 * land in a later step. `jobType` still must be a known value.
 */
const ingestSchema = z.object({
  syncId: z.string().min(1),
  jobType: z.enum([
    'ledger-list',
    'balance-sheet',
    'day-book',
    'voucher-register-sales',
    'voucher-register-purchase',
    'voucher-register-receipt',
    'voucher-register-payment',
    'voucher-register-journal',
    'voucher-register-contra',
    'stock-summary',
    'bills-receivable',
    'bills-payable',
  ]),
  data: z.array(z.unknown()),
});

// ---------------------------------------------------------------------------
// POST /api/sync/ingest  (sync agent -> backend)
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
    if (jobType === 'ledger-list') {
      const ledgers = z.array(ledgerSchema).parse(data);
      let upserted = 0;

      // Chunk to keep transactions bounded when the chart of accounts is large.
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
        upserted += chunk.length;
      }

      logger.info({ syncId, jobType, upserted }, 'Ingested ledger list');
      res.json({ ok: true, jobType, ingested: upserted });
      return;
    }

    // Handlers for the remaining job types arrive in a later step.
    logger.warn({ syncId, jobType, count: data.length }, 'Ingest handler not yet implemented');
    res.status(202).json({
      ok: true,
      jobType,
      ingested: 0,
      note: 'Handler not yet implemented; payload accepted but not persisted.',
    });
  } catch (err) {
    logger.error({ err, syncId, jobType }, 'Ingest failed');
    res.status(500).json({ error: 'Ingest failed' });
  }
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
  // Claim the oldest unconsumed trigger and mark it consumed in one step.
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
