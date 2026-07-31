import { prisma } from './prisma.js';
import { env } from './env.js';

/**
 * Ensure the single Phase-1 Company row exists and return its id. Ledgers,
 * vouchers, stock, etc. all hang off this. FY dates default to the Indian
 * financial year that the configured company name implies (2026-04-01 →
 * 2027-03-31); adjust here if the company name changes.
 */
export async function ensureCompanyId(): Promise<string> {
  const company = await prisma.company.upsert({
    where: { tallyName: env.COMPANY_NAME },
    update: {},
    create: {
      tallyName: env.COMPANY_NAME,
      displayName: 'VChemics India Solutions',
      fyStart: new Date('2026-04-01T00:00:00.000Z'),
      fyEnd: new Date('2027-03-31T00:00:00.000Z'),
    },
    select: { id: true },
  });
  return company.id;
}
