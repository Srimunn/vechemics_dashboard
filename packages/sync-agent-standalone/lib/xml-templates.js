'use strict';

/**
 * Tally XML request builders. Every report uses the "Export Data" envelope with
 * SVCURRENTCOMPANY set to the exact company name. Dates are YYYYMMDD.
 */

const XML_FORMAT = '$$SysName:XML';

function testConnection() {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Accounts</ID>
  </HEADER>
</ENVELOPE>`;
}

function exportDataReport(reportName, company, fromDate, toDate, extraStaticVars) {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${reportName}</REPORTNAME>
        <STATICVARIABLES>
          <SVFROMDATE>${fromDate}</SVFROMDATE>
          <SVTODATE>${toDate}</SVTODATE>
${extraStaticVars || ''}          <SVEXPORTFORMAT>${XML_FORMAT}</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function dayBook(company, fromDate, toDate) {
  return exportDataReport('Day Book', company, fromDate, toDate);
}

function voucherRegister(company, voucherType, fromDate, toDate) {
  return exportDataReport(
    'Voucher Register', company, fromDate, toDate,
    `          <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>\n`,
  );
}

function stockSummary(company, fromDate, toDate) {
  return exportDataReport('Stock Summary', company, fromDate, toDate);
}

function balanceSheet(company, fromDate, toDate) {
  return exportDataReport('Balance Sheet', company, fromDate, toDate);
}

function profitAndLoss(company, fromDate, toDate) {
  return exportDataReport('Profit and Loss', company, fromDate, toDate);
}

function trialBalance(company, fromDate, toDate) {
  return exportDataReport('Trial Balance', company, fromDate, toDate);
}

module.exports = {
  testConnection, dayBook, voucherRegister, stockSummary, balanceSheet, profitAndLoss, trialBalance,
};
