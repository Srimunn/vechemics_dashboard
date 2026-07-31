import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient for the process. During `tsx watch` dev reloads we stash
 * it on globalThis so hot restarts don't open a new pool each time.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
