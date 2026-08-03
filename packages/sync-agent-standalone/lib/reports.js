'use strict';

const t = require('./xml-templates');
const p = require('./parsers');

function buildJobs(config) {
  const co = config.COMPANY_NAME;
  const from = config.FY_START;
  const to = config.TO_DATE;
  return [
    { name: 'balance-sheet', jobType: 'balance-sheet', xml: t.balanceSheet(co, from, to), parse: (parsed, raw) => p.parseBalanceSheet(parsed, raw) },
    { name: 'profit-and-loss', jobType: 'profit-and-loss', xml: t.profitAndLoss(co, from, to), parse: (parsed, raw) => p.parseProfitAndLoss(parsed, raw) },
    { name: 'trial-balance', jobType: 'ledger-list', xml: t.trialBalance(co, from, to), parse: (x) => p.parseTrialBalance(x) },
    { name: 'stock-summary', jobType: 'stock-summary', xml: t.stockSummary(co, from, to), parse: (x) => p.parseStockItems(x) },
    { name: 'day-book', jobType: 'day-book', xml: t.dayBook(co, from, to), parse: (x) => p.parseVouchers(x) },
    { name: 'voucher-register-sales', jobType: 'voucher-register-sales', xml: t.voucherRegister(co, 'Sales', from, to), parse: (x) => p.parseVouchers(x, 'Sales') },
    { name: 'voucher-register-purchase', jobType: 'voucher-register-purchase', xml: t.voucherRegister(co, 'Purchase', from, to), parse: (x) => p.parseVouchers(x, 'Purchase') },
    { name: 'voucher-register-receipt', jobType: 'voucher-register-receipt', xml: t.voucherRegister(co, 'Receipt', from, to), parse: (x) => p.parseVouchers(x, 'Receipt') },
    { name: 'voucher-register-payment', jobType: 'voucher-register-payment', xml: t.voucherRegister(co, 'Payment', from, to), parse: (x) => p.parseVouchers(x, 'Payment') },
    { name: 'bills-receivable', jobType: 'bills-receivable', xml: t.billsReceivable(co, from, to), parse: (x) => p.parseOutstandings(x, 'receivable') },
    { name: 'bills-payable', jobType: 'bills-payable', xml: t.billsPayable(co, from, to), parse: (x) => p.parseOutstandings(x, 'payable') },
    { name: 'cash-book', jobType: 'cash-book', xml: t.cashBook(co, 'Cash', from, to), parse: (parsed, raw) => ({ raw, parsed }) },
  ];
}

module.exports = { buildJobs };
