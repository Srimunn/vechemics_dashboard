/**
 * Shared domain + wire types for the VChemics dashboard.
 *
 * Conventions:
 * - Monetary/quantity values are `number` (JSON has no Decimal; the backend stores
 *   them as Prisma `Decimal`). Keep the same precision the DB columns imply.
 * - Dates crossing the wire are ISO-8601 `string`s (e.g. "2026-08-01T00:00:00.000Z").
 *   The sync agent serializes; the backend parses into `DateTime`.
 */

// ---------------------------------------------------------------------------
// Enumerations (string unions — no runtime enum objects)
// ---------------------------------------------------------------------------

export type VoucherType =
  | 'Sales'
  | 'Purchase'
  | 'Receipt'
  | 'Payment'
  | 'Journal'
  | 'Contra';

export type OutstandingType = 'receivable' | 'payable';

export type SyncType = 'incremental' | 'full' | 'manual';

export type SyncStatus = 'success' | 'partial' | 'failed';

/** Identifies which Tally report a sync payload came from. */
export type SyncJobType =
  | 'ledger-list'
  | 'day-book'
  | 'voucher-register-sales'
  | 'voucher-register-purchase'
  | 'voucher-register-receipt'
  | 'voucher-register-payment'
  | 'voucher-register-journal'
  | 'voucher-register-contra'
  | 'stock-summary'
  | 'bills-receivable'
  | 'bills-payable'
  | 'balance-sheet'
  | 'profit-and-loss';

// ---------------------------------------------------------------------------
// Normalized domain shapes (produced by the sync agent, stored by the backend).
// These are the "clean JSON" the agent uploads; the backend attaches DB ids.
// ---------------------------------------------------------------------------

export interface VoucherItem {
  stockItemName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  /** e.g. 18 for 18% GST; undefined when Tally didn't report a rate. */
  gstRate?: number;
  hsnCode?: string;
}

export interface VoucherLedgerEntry {
  ledgerName: string;
  amount: number;
  isDebit: boolean;
}

export interface Voucher {
  /** Tally's GUID — the dedup key. */
  tallyGuid: string;
  voucherType: VoucherType;
  voucherNumber: string;
  /** ISO date string. */
  date: string;
  partyName?: string;
  narration?: string;
  amount: number;
  isCancelled: boolean;
  items: VoucherItem[];
  ledgerEntries: VoucherLedgerEntry[];
}

export interface Ledger {
  name: string;
  /** Parent group, e.g. "Sundry Debtors", "Bank Accounts", "Cash-in-Hand". */
  parentGroup: string;
  openingBalance: number;
  currentBalance: number;
  isDebit: boolean;
  gstin?: string;
  state?: string;
}

export interface StockItem {
  name: string;
  unit: string;
  hsnCode?: string;
  gstRate?: number;
  closingQty: number;
  closingValue: number;
  /** Weighted-average cost per unit (Tally default). */
  avgCost: number;
}

export interface Outstanding {
  type: OutstandingType;
  /** ISO date string. */
  billDate: string;
  billRef: string;
  partyName: string;
  /** ISO date string; undefined when Tally has no due date. */
  dueDate?: string;
  pendingAmount: number;
  overdueDays: number;
}

// ---------------------------------------------------------------------------
// KPI snapshot — one per company per day. Powers the CEO Dashboard.
// ---------------------------------------------------------------------------

export interface KpiSnapshot {
  /** ISO date string for the day this snapshot represents. */
  snapshotDate: string;
  todaySales: number;
  todayPurchase: number;
  todayGrossProfit: number;
  todayNetProfit: number;
  collectionsToday: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  cashInHand: number;
  bankBalance: number;
  inventoryValue: number;
  gstPayable: number;
  mtdSales: number;
  mtdPurchase: number;
  ordersBilledToday: number;
  newCustomersToday: number;
}

/** The 13 headline KPI keys shown as cards (subset of KpiSnapshot). */
export type KpiKey =
  | 'todaySales'
  | 'todayPurchase'
  | 'todayGrossProfit'
  | 'todayNetProfit'
  | 'collectionsToday'
  | 'outstandingReceivables'
  | 'outstandingPayables'
  | 'cashInHand'
  | 'bankBalance'
  | 'inventoryValue'
  | 'gstPayable'
  | 'mtdSales'
  | 'mtdPurchase';

// ---------------------------------------------------------------------------
// Sync wire protocol (sync agent -> backend /api/sync/ingest)
// ---------------------------------------------------------------------------

/**
 * Envelope the sync agent POSTs to the backend. `jobType` discriminates the
 * shape of `data`, so consumers can narrow without casting.
 */
export type SyncJobPayload =
  | { syncId: string; jobType: 'ledger-list'; data: Ledger[] }
  | { syncId: string; jobType: 'balance-sheet'; data: Ledger[] }
  | { syncId: string; jobType: 'profit-and-loss'; data: Ledger[] }
  | {
      syncId: string;
      jobType:
        | 'day-book'
        | 'voucher-register-sales'
        | 'voucher-register-purchase'
        | 'voucher-register-receipt'
        | 'voucher-register-payment'
        | 'voucher-register-journal'
        | 'voucher-register-contra';
      data: Voucher[];
    }
  | { syncId: string; jobType: 'stock-summary'; data: StockItem[] }
  | { syncId: string; jobType: 'bills-receivable'; data: Outstanding[] }
  | { syncId: string; jobType: 'bills-payable'; data: Outstanding[] };

export interface SyncLog {
  startedAt: string;
  finishedAt?: string;
  syncType: SyncType;
  status: SyncStatus;
  recordsSynced: number;
  errorMessage?: string;
}

/** Pending-trigger poll response (sync agent <- backend). */
export interface PendingTrigger {
  id: string;
  requestedAt: string;
}

// ---------------------------------------------------------------------------
// Dashboard API (frontend <- backend GET /api/dashboard/ceo)
// ---------------------------------------------------------------------------

export interface CeoDashboardResponse {
  today: KpiSnapshot | null;
  yesterday: KpiSnapshot | null;
  /** Up to 7 most-recent daily snapshots, oldest first — for sparklines. */
  trend7d: KpiSnapshot[];
  lastSync: {
    finishedAt: string | null;
    status: SyncStatus;
  } | null;
  user: {
    name: string;
    role: string;
  };
  company: {
    displayName: string;
    fyLabel: string;
  };
}
