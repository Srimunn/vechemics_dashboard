import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * On first boot (empty User table), create the CEO login from
 * INITIAL_CEO_PASSWORD so a fresh Railway deploy is immediately usable without a
 * manual seed step. No-op once any user exists. Rotate/remove the env var after
 * the first successful deploy.
 */
export async function ensureSeedUser(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;

  if (!env.INITIAL_CEO_PASSWORD) {
    logger.warn('No users found and INITIAL_CEO_PASSWORD is unset — skipping CEO seed');
    return;
  }

  const passwordHash = await bcrypt.hash(env.INITIAL_CEO_PASSWORD, 12);
  await prisma.user.create({
    data: { email: 'ceo@vchemics.com', passwordHash, name: 'Velmurugan', role: 'CEO / MD' },
  });
  logger.info('Seeded initial CEO user (ceo@vchemics.com)');
}
