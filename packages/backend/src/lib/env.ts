import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate process.env once at startup. Fail fast with a readable error if a
 * required variable is missing or malformed, rather than crashing deep in a
 * request handler later.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SYNC_AGENT_TOKEN: z.string().min(16, 'SYNC_AGENT_TOKEN must be at least 16 chars'),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  INITIAL_CEO_PASSWORD: z.string().min(1).optional(),
  COMPANY_NAME: z.string().min(1).default('VCHEMICS INDIA SOLUTIONS-2026-2027'),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console -- config error before the logger exists
  console.error(
    'Invalid environment configuration:\n' +
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
  process.exit(1);
}

export const env = parsed.data;
