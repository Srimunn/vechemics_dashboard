/**
 * Shared helpers for turning fast-xml-parser output into clean values.
 *
 * NOTE: Tally's exact XML shape varies by version and report. These helpers are
 * defensive (tolerate missing nodes, single-vs-array, Dr/Cr suffixes) and the
 * per-report parsers built on them are BEST-EFFORT until validated against real
 * samples captured on the Vchemics PC (see ./samples). Adjust the field-path
 * lookups there once you have real XML.
 */

/** fast-xml-parser yields a single object for one child, an array for many. */
export function toArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Extract text from a node that may be a string, number, or {'#text': ...}. */
export function text(node: unknown): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)['#text'] ?? '');
  }
  return '';
}

/**
 * Parse a Tally amount. Tally exports amounts as strings that may carry a
 * leading '-' (credit in some contexts) or a ' Dr'/' Cr' suffix, plus commas.
 * Returns a signed number; Cr is treated as negative unless `crPositive`.
 */
export function amount(node: unknown, opts: { crPositive?: boolean } = {}): number {
  let s = text(node).trim();
  if (!s) return 0;
  let sign = 1;
  const upper = s.toUpperCase();
  if (upper.endsWith('CR')) {
    sign = opts.crPositive ? 1 : -1;
    s = s.slice(0, -2);
  } else if (upper.endsWith('DR')) {
    sign = opts.crPositive ? -1 : 1;
    s = s.slice(0, -2);
  }
  s = s.replace(/,/g, '').replace(/\s/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? sign * n : 0;
}

/** Absolute magnitude of a Tally amount (sign stripped). */
export function absAmount(node: unknown): number {
  return Math.abs(amount(node));
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a Tally date to an ISO string. Handles "YYYYMMDD" (SV format) and
 * "D-Mon-YYYY" (e.g. "1-Aug-2026"). Returns undefined for unrecognized input.
 */
export function tallyDateToIso(node: unknown): string | undefined {
  const s = text(node).trim();
  if (!s) return undefined;

  // YYYYMMDD
  const m1 = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m1) {
    return new Date(Date.UTC(+m1[1]!, +m1[2]! - 1, +m1[3]!)).toISOString();
  }

  // D-Mon-YYYY  or  DD-Mon-YY
  const m2 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(s);
  if (m2) {
    const day = +m2[1]!;
    const mon = MONTHS[m2[2]!.toLowerCase()];
    let year = +m2[3]!;
    if (year < 100) year += 2000;
    if (mon !== undefined) return new Date(Date.UTC(year, mon, day)).toISOString();
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Read an attribute (e.g. '@_NAME') or fall back to a child text node. */
export function attrOrText(node: Record<string, unknown>, attr: string, child: string): string {
  const a = node[attr];
  if (typeof a === 'string' && a) return a;
  return text(node[child]);
}
