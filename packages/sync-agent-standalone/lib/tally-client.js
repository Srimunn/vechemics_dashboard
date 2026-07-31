'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { config } = require('./config');
const { logger } = require('./logger');

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // keep values as strings; we coerce deliberately
  trimValues: true,
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
// Strip invalid XML control chars (built via RegExp so no literal controls in source).
const CONTROL_CHARS = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]', 'g');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizeTallyXml(raw) {
  return String(raw)
    .replace(CONTROL_CHARS, '')
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

function parseTallyXml(raw) {
  return parser.parse(sanitizeTallyXml(raw));
}

/** POST raw XML to Tally and return the raw response text (with retries). */
async function rawTallyRequest(xml) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(config.TALLY_URL, xml, {
        headers: { 'Content-Type': 'text/xml;charset=utf-16' },
        responseType: 'text',
        timeout: 60000,
        transformResponse: (d) => d,
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      logger.warn({ attempt, detail: err && err.message }, 'Tally request failed; retrying');
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error(`Tally request failed after ${MAX_RETRIES} attempts: ${lastErr && lastErr.message}`);
}

/** Save a raw XML response under ./samples for inspection. */
function saveSample(reportName, raw) {
  try {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(SAMPLES_DIR, `${reportName}-${stamp}.xml`);
    fs.writeFileSync(file, raw, 'utf8');
    return file;
  } catch (err) {
    logger.warn({ err: err && err.message }, 'Failed to save XML sample (continuing)');
    return null;
  }
}

/** POST XML, save the raw sample, and return { raw, parsed }. */
async function callTally(xml, reportName) {
  const raw = await rawTallyRequest(xml);
  const savedTo = saveSample(reportName, raw);
  return { raw, parsed: parseTallyXml(raw), savedTo };
}

module.exports = { rawTallyRequest, callTally, saveSample, parseTallyXml, SAMPLES_DIR };
