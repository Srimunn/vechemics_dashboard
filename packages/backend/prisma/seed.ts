import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the single Phase-1 CEO user. Password comes from INITIAL_CEO_PASSWORD;
 * remove that env var after the first run. Idempotent — upserts by email.
 */
async function main(): Promise<void> {
  const email = 'ceo@vchemics.com';
  const password = process.env.INITIAL_CEO_PASSWORD;

  if (!password) {
    throw new Error('INITIAL_CEO_PASSWORD is not set; cannot seed the CEO user.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: 'Velmurugan', role: 'CEO / MD' },
    create: { email, passwordHash, name: 'Velmurugan', role: 'CEO / MD' },
  });

  console.log(`Seeded CEO user: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
