'use strict';

require('dotenv').config();

/** Format a Date as YYYYMMDD (Tally's SV date format). */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

const config = {
  TALLY_URL: process.env.TALLY_URL || 'http://localhost:9000',
  BACKEND_URL: process.env.BACKEND_URL || '',
  SYNC_AGENT_TOKEN: process.env.SYNC_AGENT_TOKEN || '',
  COMPANY_NAME: process.env.COMPANY_NAME || 'VCHEMICS INDIA SOLUTIONS-2026-2027',
  FY_START: process.env.FY_START || '20260401',
  TO_DATE: process.env.TO_DATE || ymd(new Date()),
};

/**
 * Validate the config needed for pushing to the backend. `test-tally.js` only
 * needs TALLY_URL, so pass { requireBackend:false } there.
 */
function validate({ requireBackend = true } = {}) {
  const missing = [];
  if (!config.TALLY_URL) missing.push('TALLY_URL');
  if (requireBackend && !config.BACKEND_URL) missing.push('BACKEND_URL');
  if (requireBackend && !config.SYNC_AGENT_TOKEN) missing.push('SYNC_AGENT_TOKEN');
  if (missing.length) {
    console.error(
      `\nMissing required settings in .env: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill them in.\n`,
    );
    process.exit(1);
  }
}

module.exports = { config, validate, ymd };
