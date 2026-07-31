import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TALLY_URL: z.string().url().default('http://localhost:9000'),
  BACKEND_URL: z.string().url(),
  SYNC_AGENT_TOKEN: z.string().min(16),
  COMPANY_NAME: z.string().min(1).default('VCHEMICS INDIA SOLUTIONS-2026-2027'),
  FY_START: z.string().regex(/^\d{8}$/, 'FY_START must be YYYYMMDD').default('20260401'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DEV_SAVE_SAMPLES: z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),
  LOCAL_TRIGGER_PORT: z.coerce.number().int().positive().default(4001),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console -- config error before the logger exists
  console.error(
    'Invalid sync-agent configuration:\n' +
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
  process.exit(1);
}

export const config = parsed.data;
