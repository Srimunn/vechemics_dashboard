import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Populates realistic MOCK data so the CEO Dashboard renders without a live
 * Tally connection: the company, the CEO user, ~10 days of daily KPI snapshots
 * (with a gentle upward trend + daily noise), and a recent successful sync log.
 *
 * Idempotent. Clear it later with: npm run db:seed:mock -- --clear
 */

function startOfDayUTC(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

// Deterministic-ish daily wobble in [1-amp, 1+amp].
function wobble(seed: number, amp = 0.08): number {
  return 1 + amp * Math.sin(seed * 1.7);
}

async function main(): Promise<void> {
  const clear = process.argv.includes('--clear');

  const company = await prisma.company.upsert({
    where: { tallyName: 'VCHEMICS INDIA SOLUTIONS-2026-2027' },
    update: {},
    create: {
      tallyName: 'VCHEMICS INDIA SOLUTIONS-2026-2027',
      displayName: 'VChemics India Solutions',
      fyStart: new Date('2026-04-01T00:00:00.000Z'),
      fyEnd: new Date('2027-03-31T00:00:00.000Z'),
    },
  });

  if (clear) {
    await prisma.kpiSnapshot.deleteMany({ where: { companyId: company.id } });
    await prisma.syncLog.deleteMany({});
    console.log('Cleared mock KPI snapshots and sync logs.');
    return;
  }

  // CEO user (so login + dashboard user block work).
  const password = process.env.INITIAL_CEO_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: 'ceo@vchemics.com' },
    update: { name: 'Velmurugan', role: 'CEO / MD' },
    create: { email: 'ceo@vchemics.com', passwordHash, name: 'Velmurugan', role: 'CEO / MD' },
  });

  const DAYS = 10;
  let mtdSales = 0;
  let mtdPurchase = 0;

  // Build oldest -> newest so MTD accumulates correctly.
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = startOfDayUTC(i);
    const seed = DAYS - i;
    const trend = 1 + (seed / DAYS) * 0.15; // gentle growth over the window

    const todaySales = Math.round(1_650_000 * trend * wobble(seed));
    const todayPurchase = Math.round(1_180_000 * trend * wobble(seed + 3));
    const todayGrossProfit = Math.round(todaySales * 0.225 * wobble(seed + 1, 0.05));
    const collectionsToday = Math.round(todaySales * 0.55 * wobble(seed + 2, 0.2));

    // Reset MTD when we cross into a new month within the window.
    if (date.getUTCDate() === 1) {
      mtdSales = 0;
      mtdPurchase = 0;
    }
    mtdSales += todaySales;
    mtdPurchase += todayPurchase;

    const indirectPerDay = 210_000 / 30;
    const todayNetProfit = Math.round(todayGrossProfit - indirectPerDay);

    await prisma.kpiSnapshot.upsert({
      where: { companyId_snapshotDate: { companyId: company.id, snapshotDate: date } },
      update: {},
      create: {
        companyId: company.id,
        snapshotDate: date,
        todaySales,
        todayPurchase,
        todayGrossProfit,
        todayNetProfit,
        collectionsToday,
        outstandingReceivables: Math.round(4_200_000 * wobble(seed, 0.04)),
        outstandingPayables: Math.round(2_800_000 * wobble(seed + 5, 0.04)),
        cashInHand: Math.round(350_000 * wobble(seed, 0.15)),
        bankBalance: Math.round(6_500_000 * wobble(seed, 0.03)),
        inventoryValue: Math.round(8_800_000 * wobble(seed, 0.02)),
        gstPayable: Math.round(240_000 * wobble(seed + 2, 0.1)),
        mtdSales,
        mtdPurchase,
        ordersBilledToday: 12 + (seed % 9),
        newCustomersToday: seed % 3,
      },
    });
  }

  await prisma.syncLog.create({
    data: {
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
      finishedAt: new Date(Date.now() - 2 * 60 * 1000),
      syncType: 'full',
      status: 'success',
      recordsSynced: 1287,
    },
  });

  console.log(`Seeded ${DAYS} days of mock KPI snapshots + CEO user + sync log.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
