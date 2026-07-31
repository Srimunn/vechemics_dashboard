import { syncVoucherRegister } from './voucher-register.js';
import type { SyncContext } from './context.js';

/** Convenience wrapper: Purchase voucher register. */
export function syncPurchaseRegister(ctx: SyncContext): Promise<number> {
  return syncVoucherRegister(ctx, 'Purchase');
}
