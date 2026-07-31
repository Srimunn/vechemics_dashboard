/**
 * Offline parser validation against captured Tally XML fixtures.
 * Run: npm run test:parsers  (from packages/sync-agent)
 *
 * Sets dummy env BEFORE importing modules (config.ts validates env at import),
 * then parses each fixture with the SAME sanitize+parse used in production and
 * checks the normalized output. Exits non-zero on any failure.
 */
process.env.BACKEND_URL ??= 'http://localhost:9999';
process.env.SYNC_AGENT_TOKEN ??= 'x'.repeat(32);
process.env.COMPANY_NAME ??= 'VCHEMICS INDIA SOLUTIONS-2026-2027';

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(dir, '..', 'samples', 'fixtures', `${name}.xml`), 'utf8');

const { parseTallyXml } = await import('./tally-client.js');
const { parseVouchers } = await import('./sync-jobs/voucher-parser.js');
const { parseStockItems } = await import('./sync-jobs/stock-summary.js');
const { parseBalanceSheet } = await import('./sync-jobs/balance-sheet.js');
const { parseProfitAndLoss } = await import('./sync-jobs/profit-and-loss.js');

let failures = 0;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- Balance Sheet ---
console.log('\nBalance Sheet');
{
  const rows = parseBalanceSheet(parseTallyXml(fixture('balance-sheet')));
  check('8 groups parsed', rows.length === 8, `got ${rows.length}`);
  const capital = rows.find((r) => r.name === 'Capital Account');
  check('Capital Account = 8766828.82', !!capital && near(capital.currentBalance, 8766828.82), `got ${capital?.currentBalance}`);
  check('P&L A/c group name unescaped', rows.some((r) => r.name === 'Profit & Loss A/c'));
  check('all tagged parentGroup=Balance Sheet', rows.every((r) => r.parentGroup === 'Balance Sheet'));
}

// --- Profit & Loss ---
console.log('\nProfit & Loss');
{
  const rows = parseProfitAndLoss(parseTallyXml(fixture('profit-and-loss')));
  const byName = (n: string) => rows.find((r) => r.name === n)?.currentBalance ?? NaN;
  const sales = byName('Sales Accounts');
  const directIncome = byName('Income (Direct) (Direct Incomes)');
  const costOfSales = byName('Cost of Sales :');
  const purchase = byName('Add: Purchase Accounts');
  const indirect = byName('Expenses (Indirect) (Indirect Expenses)');
  check('8 lines parsed', rows.length === 8, `got ${rows.length}`);
  check('Sales Accounts = 17973479', near(sales, 17973479), `got ${sales}`);
  check('Cost of Sales = -14999846.49 (sign preserved)', near(costOfSales, -14999846.49), `got ${costOfSales}`);
  check('Purchase (from PLSUBAMT) = -15556533.58', near(purchase, -15556533.58), `got ${purchase}`);
  const grossProfit = sales + directIncome + costOfSales;
  const netProfit = grossProfit + indirect;
  check('Gross Profit = Sales + Direct Income + Cost of Sales = 3003572.51', near(grossProfit, 3003572.51), `got ${grossProfit}`);
  check('Net Profit = Gross Profit + Indirect = 2751038.00', near(netProfit, 2751038.0), `got ${netProfit}`);
}

// --- Day Book / Vouchers ---
console.log('\nDay Book / Vouchers');
{
  const vouchers = parseVouchers(parseTallyXml(fixture('day-book')));
  check('2 vouchers parsed', vouchers.length === 2, `got ${vouchers.length}`);
  const sale = vouchers.find((v) => v.voucherType === 'Sales');
  check('sale dedup key from VCHKEY', sale?.tallyGuid === '0001-vchkey', `got ${sale?.tallyGuid}`);
  check('sale date = 2026-06-30', sale?.date.startsWith('2026-06-30') === true, `got ${sale?.date}`);
  check('sale party = Palanisamy', sale?.partyName === 'Palanisamy');
  check('sale has 2 stock items', sale?.items.length === 2, `got ${sale?.items.length}`);
  const it0 = sale?.items[0];
  check('item0 name/qty/rate/amount', !!it0 && it0.stockItemName === 'NITOBOND EP 1 LIT' && near(it0.quantity, 2) && near(it0.rate, 1779.66) && it0.unit === 'NOS' && near(it0.amount, 3559.32),
    JSON.stringify(it0));
  const it1 = sale?.items[1];
  check('item1 qty=4 amount=1694.92', !!it1 && near(it1.quantity, 4) && near(it1.amount, 1694.92), JSON.stringify(it1));
  check('sale has 3 ledger entries', sale?.ledgerEntries.length === 3, `got ${sale?.ledgerEntries.length}`);
  const party = sale?.ledgerEntries.find((e) => e.ledgerName === 'Palanisamy');
  check('party entry 6200 credit (isDebit=false)', !!party && near(party.amount, 6200) && party.isDebit === false, JSON.stringify(party));
  const cgst = sale?.ledgerEntries.find((e) => e.ledgerName.includes('CGST'));
  check('CGST entry 472.88 debit (isDebit=true)', !!cgst && near(cgst.amount, 472.88) && cgst.isDebit === true, JSON.stringify(cgst));
  check('sale invoice total = 6200', !!sale && near(sale.amount, 6200), `got ${sale?.amount}`);
  const receipt = vouchers.find((v) => v.voucherType === 'Receipt');
  check('receipt has 0 items, 2 ledgers, total 6200', !!receipt && receipt.items.length === 0 && receipt.ledgerEntries.length === 2 && near(receipt.amount, 6200));
}

// --- Stock Summary ---
console.log('\nStock Summary');
{
  const items = parseStockItems(parseTallyXml(fixture('stock-summary')));
  check('2 items (empty-stock skipped)', items.length === 2, `got ${items.length}`);
  const b = items.find((i) => i.name.startsWith('BRUSHBOND'));
  check('BRUSHBOND qty=39 value=48000 avgCost=1600', !!b && near(b.closingQty, 39) && near(b.closingValue, 48000) && near(b.avgCost, 1600), JSON.stringify(b));
  check('closingValue is positive (abs of negative DSPCLAMTA)', !!b && b.closingValue > 0);
  check('unit parsed = NOS', b?.unit === 'NOS', `got ${b?.unit}`);
}

console.log(`\n${failures === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
