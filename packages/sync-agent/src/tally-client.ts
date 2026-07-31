import axios, { AxiosError } from 'axios';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { config } from './config.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, '..', 'samples');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // keep everything as strings; we coerce deliberately
  trimValues: true,
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Tally frequently emits XML with bare ampersands and stray control characters
 * that break strict parsers. Sanitize the most common offenders before parsing.
 */
function sanitizeTallyXml(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex -- strip invalid XML control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

/** POST raw XML to Tally and return the raw response text (with retries). */
export async function rawTallyRequest(xml: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post<string>(config.TALLY_URL, xml, {
        headers: { 'Content-Type': 'text/xml;charset=utf-16' },
        responseType: 'text',
        timeout: 60_000,
        transformResponse: (d: string) => d, // don't let axios JSON-parse
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      const detail = err instanceof AxiosError ? err.message : String(err);
      logger.warn({ attempt, detail }, 'Tally request failed; retrying');
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error(
    `Tally request failed after ${MAX_RETRIES} attempts: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/** Persist a raw XML response under ./samples for offline parser development. */
export async function saveSample(reportName: string, raw: string): Promise<void> {
  if (!config.DEV_SAVE_SAMPLES) return;
  try {
    await mkdir(SAMPLES_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeFile(join(SAMPLES_DIR, `${reportName}-${stamp}.xml`), raw, 'utf8');
  } catch (err) {
    logger.warn({ err }, 'Failed to save XML sample (continuing)');
  }
}

/** Sanitize + parse a raw Tally XML string into an object tree. */
export function parseTallyXml(raw: string): unknown {
  return parser.parse(sanitizeTallyXml(raw));
}

/**
 * POST XML to Tally, optionally save the raw sample, and return the parsed
 * object tree. Callers navigate the tree in their own parser module.
 */
export async function callTally(xml: string, reportName: string): Promise<unknown> {
  const raw = await rawTallyRequest(xml);
  await saveSample(reportName, raw);
  return parseTallyXml(raw);
}
