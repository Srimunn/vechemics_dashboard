import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureCompanyId } from '../lib/company.js';

const router = Router();

// GET — batch fetch overheads for visible vouchers
router.get('/api/bill-overhead', async (req, res) => {
  try {
    const { companyId, voucherIds } = req.query;
    const targetCompanyId = (companyId as string) || (await ensureCompanyId());

    const where: any = { companyId: targetCompanyId };
    if (voucherIds) {
      where.voucherId = { in: (voucherIds as string).split(',') };
    }

    const overheads = await prisma.billOverheadCost.findMany({ where });
    res.json(overheads);
  } catch (err) {
    console.error('Error fetching overheads:', err);
    res.status(500).json({ error: 'Failed to fetch overhead costs' });
  }
});

// POST — upsert overhead for one voucher
router.post('/api/bill-overhead/:voucherId', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const {
      transportCost = 0,
      labelingCost = 0,
      loadingCost = 0,
      otherCost = 0,
      otherCostLabel,
      notes
    } = req.body;

    const companyId = (req.body.companyId as string) || (await ensureCompanyId());

    if (!voucherId) {
      return res.status(400).json({ error: 'voucherId required' });
    }

    const overhead = await prisma.billOverheadCost.upsert({
      where: {
        companyId_voucherId: { companyId, voucherId }
      },
      update: {
        transportCost,
        labelingCost,
        loadingCost,
        otherCost,
        otherCostLabel: otherCostLabel || null,
        notes: notes || null,
        updatedAt: new Date()
      },
      create: {
        companyId,
        voucherId,
        transportCost,
        labelingCost,
        loadingCost,
        otherCost,
        otherCostLabel: otherCostLabel || null,
        notes: notes || null
      }
    });

    res.json(overhead);
  } catch (err) {
    console.error('Error saving overhead:', err);
    res.status(500).json({ error: 'Failed to save overhead costs' });
  }
});

// DELETE — remove overhead for one voucher (reset to Tally-only)
router.delete('/api/bill-overhead/:voucherId', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const companyId = (req.query.companyId as string) || (await ensureCompanyId());

    if (!voucherId) {
      return res.status(400).json({ error: 'voucherId required' });
    }

    await prisma.billOverheadCost.deleteMany({
      where: { companyId, voucherId }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting overhead:', err);
    res.status(500).json({ error: 'Failed to delete overhead costs' });
  }
});

export default router;
