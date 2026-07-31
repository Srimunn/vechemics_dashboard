/** Shared inputs every sync job needs. */
export interface SyncContext {
  syncId: string;
  company: string;
  /** YYYYMMDD */
  fromDate: string;
  /** YYYYMMDD */
  toDate: string;
}
