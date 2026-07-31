import { syncVoucherRegister } from './voucher-register.js';
import type { SyncContext } from './context.js';

/** Convenience wrapper: Sales voucher register. */
export function syncSalesRegister(ctx: SyncContext): Promise<number> {
  return syncVoucherRegister(ctx, 'Sales');
}
