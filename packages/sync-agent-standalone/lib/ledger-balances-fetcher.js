'use strict';

/**
 * TDL Collection fetcher for All Ledgers with latin1 decoding.
 * Extracts exact Bank Balance, Cash in Hand, GST Payable, and all ~337 ledgers.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { config } = require('./config');
const { push } = require('./uploader');

function buildAllLedgersXml(companyName) {
  return `<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>AllLedgers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="AllLedgers" ISMODIFY="No">
      <TYPE>Ledger</TYPE>
      <FETCH>NAME, PARENT, CLOSINGBALANCE</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;
}

function parseAmount(valStr) {
  if (!valStr) return 0;
  let s = String(valStr).trim();
  let sign = 1;
  const upper = s.toUpperCase();
  if (upper.endsWith('CR')) {
    sign = -1;
    s = s.slice(0, -2);
  } else if (upper.endsWith('DR')) {
    sign = 1;
    s = s.slice(0, -2);
  }
  s = s.replace(/,/g, '').replace(/\s/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? sign * n : 0;
}

function unescapeXml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseAllLedgersXml(latin1Xml) {
  const ledgers = [];
  const blocks = latin1Xml.split(/<LEDGER[\s>]/i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    
    // Extract NAME attribute or child tag
    let name = '';
    const attrNameMatch = block.match(/NAME="([^"]+)"/i);
    if (attrNameMatch) {
      name = unescapeXml(attrNameMatch[1]);
    } else {
      const tagNameMatch = block.match(/<NAME>([^<]+)<\/NAME>/i);
      if (tagNameMatch) name = unescapeXml(tagNameMatch[1]);
    }
    if (!name) continue;

    // Extract PARENT child tag
    let parentGroup = 'Unknown';
    const parentMatch = block.match(/<PARENT>([^<]+)<\/PARENT>/i);
    if (parentMatch) {
      parentGroup = unescapeXml(parentMatch[1]);
    }

    // Extract CLOSINGBALANCE tag with attribute <CLOSINGBALANCE TYPE="Amount">value</CLOSINGBALANCE>
    let closingBalance = 0;
    const cbMatch = block.match(/<CLOSINGBALANCE[^>]*>([^<]+)<\/CLOSINGBALANCE>/i);
    if (cbMatch) {
      closingBalance = parseAmount(cbMatch[1]);
    }

    ledgers.push({ name, parentGroup, closingBalance });
  }

  // Calculate totals
  let bankAccountsSum = 0;
  let bankOdSum = 0;
  let cashSum = 0;
  let dutiesSum = 0;

  for (const l of ledgers) {
    const parentLower = l.parentGroup.toLowerCase();
    if (parentLower === 'bank accounts') {
      bankAccountsSum += l.closingBalance;
    } else if (parentLower === 'bank od a/c' || parentLower === 'bank od' || parentLower.includes('bank od')) {
      bankOdSum += l.closingBalance;
    } else if (parentLower === 'cash-in-hand' || parentLower === 'cash in hand') {
      cashSum += l.closingBalance;
    } else if (parentLower.includes('duties')) {
      dutiesSum += l.closingBalance;
    }
  }

  const bankBalance = bankAccountsSum + bankOdSum;
  const cashInHand = Math.abs(cashSum);
  const gstPayable = Math.abs(dutiesSum);

  return { bankBalance, cashInHand, gstPayable, ledgers };
}

async function callTallyLatin1(xml) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.TALLY_URL);
    const client = url.protocol === 'https:' ? https : http;
    const bodyBuf = Buffer.from(xml, 'utf8');

    const req = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': bodyBuf.length,
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const latin1Text = rawBuffer.toString('latin1');
          resolve(latin1Text);
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tally request timed out'));
    });
    req.write(bodyBuf);
    req.end();
  });
}

async function fetchAndPushLedgerBalances(syncId) {
  console.log('[ledger-balances] Fetching AllLedgers via TDL Collection (latin1)...');
  const xml = buildAllLedgersXml(config.COMPANY_NAME);
  const latin1Xml = await callTallyLatin1(xml);
  const parsed = parseAllLedgersXml(latin1Xml);

  console.log(`[ledger-balances] Parsed ${parsed.ledgers.length} ledgers from Tally:`);
  console.log(`  - Bank Balance : ₹${parsed.bankBalance}`);
  console.log(`  - Cash in Hand : ₹${parsed.cashInHand}`);
  console.log(`  - GST Payable  : ₹${parsed.gstPayable}`);

  const sent = await push(syncId, 'ledger-balances', {
    bankBalance: parsed.bankBalance,
    cashInHand: parsed.cashInHand,
    gstPayable: parsed.gstPayable,
    ledgers: parsed.ledgers,
  });

  console.log(`[ledger-balances] Pushed ${parsed.ledgers.length} ledger balances to backend`);
  return parsed;
}

module.exports = {
  buildAllLedgersXml,
  parseAllLedgersXml,
  callTallyLatin1,
  fetchAndPushLedgerBalances,
};
