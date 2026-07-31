/**
 * Shared helpers for turning fast-xml-parser output into clean values.
 *
 * The per-report parsers built on these were rewritten to match the ACTUAL
 * TallyPrime 7.0 XML captured on the Vchemics PC (validated against fixtures in
 * ./samples/fixtures via `npm run test:parsers`). Tally's real exports are flat:
 * repeated sibling tags (STOCKITEMNAME, LEDGERNAME, BSNAME/BSAMT, DSPACCNAME…)
 * collapse into positionally-aligned arrays, so parsers zip arrays by index.
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

/**
 * Recursively gather every value stored under `key`, anywhere in the parsed
 * tree, flattening arrays. This makes parsers robust to the exact wrapper depth
 * (ENVELOPE vs ENVELOPE>BODY>DATA vs …) — we just ask for the tag we want.
 * Does not descend into a matched node looking for the same key again (our
 * Tally tags are never self-nested), which keeps sibling ordering intact.
 */
export function deepCollect(root: unknown, key: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k === key) {
          for (const item of toArray(v)) out.push(item as Record<string, unknown>);
        } else {
          visit(v);
        }
      }
    }
  };
  visit(root);
  return out;
}

/**
 * Parse a Tally quantity string like " 2.00 NOS" / "39.00 NOS" / "-5 kg" into
 * a number + unit. Leading/trailing whitespace tolerated.
 */
export function parseQtyUnit(raw: unknown): { quantity: number; unit: string } {
  const s = text(raw).trim();
  const m = /^(-?[\d,]*\.?\d+)\s*(.*)$/.exec(s);
  if (!m) return { quantity: 0, unit: '' };
  return {
    quantity: Number.parseFloat(m[1]!.replace(/,/g, '')) || 0,
    unit: (m[2] ?? '').trim(),
  };
}

/** Parse a Tally rate string like "1779.66/NOS" into a number + unit. */
export function parseRateUnit(raw: unknown): { rate: number; unit: string } {
  const s = text(raw).trim();
  const [ratePart, unitPart] = s.split('/');
  return {
    rate: Number.parseFloat((ratePart ?? '').replace(/,/g, '')) || 0,
    unit: (unitPart ?? '').trim(),
  };
}
