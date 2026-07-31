'use strict';

const t = require('./xml-templates');
const p = require('./parsers');

/**
 * The full set of reports this agent syncs. `jobType` is the backend ingest
 * discriminator; `parse` turns the parsed XML into normalized records.
 *
 * Note: Trial Balance provides per-ledger closing balances, so it is pushed as
 * `ledger-list` (upserted by name — non-destructive).
 */
function buildJobs(config) {
  const co = config.COMPANY_NAME;
  const from = config.FY_START;
  const to = config.TO_DATE;
  return [
    { name: 'balance-sheet', jobType: 'balance-sheet', xml: t.balanceSheet(co, from, to), parse: (x) => p.parseBalanceSheet(x) },
    { name: 'profit-and-loss', jobType: 'profit-and-loss', xml: t.profitAndLoss(co, from, to), parse: (x) => p.parseProfitAndLoss(x) },
    { name: 'trial-balance', jobType: 'ledger-list', xml: t.trialBalance(co, from, to), parse: (x) => p.parseTrialBalance(x) },
    { name: 'stock-summary', jobType: 'stock-summary', xml: t.stockSummary(co, from, to), parse: (x) => p.parseStockItems(x) },
    { name: 'day-book', jobType: 'day-book', xml: t.dayBook(co, from, to), parse: (x) => p.parseVouchers(x) },
    { name: 'voucher-register-sales', jobType: 'voucher-register-sales', xml: t.voucherRegister(co, 'Sales', from, to), parse: (x) => p.parseVouchers(x, 'Sales') },
    { name: 'voucher-register-purchase', jobType: 'voucher-register-purchase', xml: t.voucherRegister(co, 'Purchase', from, to), parse: (x) => p.parseVouchers(x, 'Purchase') },
    { name: 'voucher-register-receipt', jobType: 'voucher-register-receipt', xml: t.voucherRegister(co, 'Receipt', from, to), parse: (x) => p.parseVouchers(x, 'Receipt') },
    { name: 'voucher-register-payment', jobType: 'voucher-register-payment', xml: t.voucherRegister(co, 'Payment', from, to), parse: (x) => p.parseVouchers(x, 'Payment') },
  ];
}

module.exports = { buildJobs };
