import type { SyncJobType, VoucherType } from '@vchemics/shared';
import { callTally } from '../tally-client.js';
import { voucherRegister } from '../xml-templates.js';
import { push } from '../uploader.js';
import { logger } from '../logger.js';
import { parseVouchers } from './voucher-parser.js';
import type { SyncContext } from './context.js';

const JOB_TYPE_BY_VOUCHER: Record<VoucherType, SyncJobType> = {
  Sales: 'voucher-register-sales',
  Purchase: 'voucher-register-purchase',
  Receipt: 'voucher-register-receipt',
  Payment: 'voucher-register-payment',
  Journal: 'voucher-register-journal',
  Contra: 'voucher-register-contra',
};

/** Voucher Register for one voucher type. */
export async function syncVoucherRegister(
  ctx: SyncContext,
  voucherType: VoucherType,
): Promise<number> {
  const jobType = JOB_TYPE_BY_VOUCHER[voucherType];
  logger.info({ voucherType, from: ctx.fromDate, to: ctx.toDate }, 'Syncing voucher register');
  const xml = voucherRegister(ctx.company, voucherType, ctx.fromDate, ctx.toDate);
  const parsed = await callTally(xml, jobType);
  const vouchers = parseVouchers(parsed, voucherType);
  logger.info({ voucherType, count: vouchers.length }, 'Parsed vouchers');
  return push(ctx.syncId, jobType, vouchers);
}
