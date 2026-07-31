'use strict';

/**
 * Tests connectivity to TallyPrime and captures a raw XML sample for every
 * report into ./samples. Does NOT push anything to the backend.
 *
 *   node test-tally.js
 */

const { config, validate } = require('./lib/config');
const { testConnection } = require('./lib/xml-templates');
const { rawTallyRequest, callTally } = require('./lib/tally-client');
const { buildJobs } = require('./lib/reports');

validate({ requireBackend: false });

function topKeys(parsed) {
  const root = parsed && parsed.ENVELOPE ? parsed.ENVELOPE : parsed;
  return root && typeof root === 'object' ? Object.keys(root).join(', ') : '(none)';
}

async function main() {
  console.log('VChemics Tally connection test');
  console.log('------------------------------');
  console.log(`Tally URL : ${config.TALLY_URL}`);
  console.log(`Company   : ${config.COMPANY_NAME}`);
  console.log(`Date range: ${config.FY_START} -> ${config.TO_DATE}\n`);

  // 1. Basic connectivity.
  try {
    const raw = await rawTallyRequest(testConnection());
    const ok = /RESPONSE|ENVELOPE|COMPANY|LEDGER/i.test(raw);
    console.log(`[connection] Tally responded (${raw.length} bytes) ${ok ? 'OK' : '(unexpected body)'}`);
  } catch (err) {
    console.error(`[connection] FAILED: ${err.message}`);
    console.error('Is TallyPrime open with the company loaded and the XML server enabled on this port?');
    process.exit(1);
  }

  // 2. Capture a sample for each report.
  const jobs = buildJobs(config);
  for (const job of jobs) {
    try {
      const { raw, parsed, savedTo } = await callTally(job.xml, job.name);
      let count = 0;
      try { count = job.parse(parsed).length; } catch (_) { count = -1; }
      console.log(
        `[${job.name}] ${raw.length} bytes | parsed ${count} record(s) | keys: ${topKeys(parsed)}`,
      );
      if (savedTo) console.log(`    saved -> ${savedTo}`);
    } catch (err) {
      console.error(`[${job.name}] FAILED: ${err.message}`);
    }
  }

  console.log('\nDone. Raw XML samples are in ./samples for inspection.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
