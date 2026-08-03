import type { VoucherType } from '@vchemics/shared';

/**
 * Tally XML request builders. Dates are YYYYMMDD strings (Tally's SV date
 * format). Every template targets a single company via SVCURRENTCOMPANY.
 *
 * These mirror the templates in the Phase 1 spec section 8. Report/collection
 * names must match Tally exactly, so keep them verbatim.
 */

const XML_FORMAT = '$$SysName:XML';

/** Minimal connectivity probe — lists accounts. */
export function testConnection(): string {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Accounts</ID>
  </HEADER>
</ENVELOPE>`;
}

/** Chart of accounts with balances (Collection request). */
export function listOfLedgers(company: string): string {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>${XML_FORMAT}</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Ledgers" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name, Parent, OpeningBalance, ClosingBalance, PartyGSTIN, LedgerStateName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function exportDataReport(
  reportName: string,
  company: string,
  fromDate: string,
  toDate: string,
  extraStaticVars = '',
): string {
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
${extraStaticVars}          <SVEXPORTFORMAT>${XML_FORMAT}</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function dayBook(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Day Book', company, fromDate, toDate);
}

export function voucherRegister(
  company: string,
  voucherType: VoucherType,
  fromDate: string,
  toDate: string,
): string {
  return exportDataReport(
    'Voucher Register',
    company,
    fromDate,
    toDate,
    `          <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>\n`,
  );
}

export function stockSummary(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Stock Summary', company, fromDate, toDate);
}

export function balanceSheet(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Balance Sheet', company, fromDate, toDate);
}

export function profitAndLoss(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Profit and Loss', company, fromDate, toDate);
}

export function billsReceivable(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Bills Receivable', company, fromDate, toDate);
}

export function billsPayable(company: string, fromDate: string, toDate: string): string {
  return exportDataReport('Bills Payable', company, fromDate, toDate);
}

export function cashBook(company: string, ledgerName = 'Cash', fromDate: string, toDate: string): string {
  return exportDataReport(
    'Cash Book',
    company,
    fromDate,
    toDate,
    `          <LEDGERNAME>${ledgerName}</LEDGERNAME>\n`,
  );
}
