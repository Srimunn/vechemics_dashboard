import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = Number((x as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function formatINR(val: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
}

/**
 * Generate deduped system notifications after sync/ingest.
 * Filters notifications based on Company NotificationPreference settings.
 */
export async function generateNotifications(companyId: string): Promise<number> {
  let countCreated = 0;

  try {
    // 0. Fetch notification preferences for company
    const prefRow = await prisma.notificationPreference.findUnique({
      where: { companyId },
    });

    const prefs = {
      isActive: prefRow ? prefRow.isActive : true,
      belowCostAlert: prefRow ? prefRow.belowCostAlert : true,
      overduePaymentAlert: prefRow ? prefRow.overduePaymentAlert : true,
      lowStockAlert: prefRow ? prefRow.lowStockAlert : false,
      highValueSaleAlert: prefRow ? prefRow.highValueSaleAlert : false,
      highValueThreshold: prefRow ? num(prefRow.highValueThreshold) : 50000,
      dailySummary: prefRow ? prefRow.dailySummary : false,
      newBillAlert: prefRow ? prefRow.newBillAlert : false,
    };

    // Master toggle check: if isActive is false, skip creating all notifications
    if (!prefs.isActive) {
      logger.info({ companyId }, 'Notification preferences master toggle is OFF; skipping notification generation');
      return 0;
    }

    // Helper to check if a specific notification type is enabled by user preferences
    const isNotificationTypeEnabled = (type: string, amount?: number): boolean => {
      const lower = type.toLowerCase();
      if (lower.includes('below_cost') || lower.includes('below-cost') || lower.includes('negative_margin')) {
        return prefs.belowCostAlert;
      }
      if (lower.includes('overdue') || lower.includes('payment_due')) {
        return prefs.overduePaymentAlert;
      }
      if (lower.includes('low_stock')) {
        return prefs.lowStockAlert;
      }
      if (lower.includes('high_value_sale') || lower.includes('high_value')) {
        return prefs.highValueSaleAlert && (amount === undefined || amount >= prefs.highValueThreshold);
      }
      if (lower.includes('daily_summary') || lower.includes('daily')) {
        return prefs.dailySummary;
      }
      if (lower.includes('new_bill') || lower.includes('new-bill')) {
        return prefs.newBillAlert;
      }
      return true;
    };

    // Helper to safely create notification if enabled and not already created with same relatedId
    const notify = async (data: {
      type: string;
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
      relatedId?: string;
      relatedUrl?: string;
      amount?: number;
    }) => {
      if (!isNotificationTypeEnabled(data.type, data.amount)) {
        return;
      }

      const existing = await prisma.notification.findFirst({
        where: {
          companyId,
          type: data.type,
          relatedId: data.relatedId || null,
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            companyId,
            type: data.type,
            title: data.title,
            message: data.message,
            severity: data.severity,
            relatedId: data.relatedId || null,
            relatedUrl: data.relatedUrl || null,
          },
        });
        countCreated++;
      }
    };

    const now = new Date();

    // 1. Overdue Receivables (>30 days warning, >90 days critical)
    if (prefs.overduePaymentAlert) {
      const overdueReceivables = await prisma.outstanding.findMany({
        where: {
          companyId,
          type: 'receivable',
          overdueDays: { gt: 30 },
        },
      });

      for (const item of overdueReceivables) {
        const isCritical = num(item.overdueDays) > 90;
        await notify({
          type: 'overdue_receivable',
          title: `Overdue Payment: ${item.partyName}`,
          message: `${formatINR(num(item.pendingAmount))} outstanding for ${item.overdueDays} days (Bill: ${item.billRef})`,
          severity: isCritical ? 'critical' : 'warning',
          relatedId: item.id,
          relatedUrl: '/dashboard/receivables',
        });
      }

      // 2. Payment Due Soon (payables due in next 7 days)
      const payables = await prisma.outstanding.findMany({
        where: {
          companyId,
          type: 'payable',
        },
      });

      const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const p of payables) {
        if (p.dueDate && p.dueDate >= now && p.dueDate <= next7Days) {
          const daysLeft = Math.ceil((p.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          await notify({
            type: 'payment_due',
            title: `Payment Due Soon: ${p.partyName}`,
            message: `${formatINR(num(p.pendingAmount))} due on ${p.dueDate.toISOString().split('T')[0]} (${daysLeft} days left)`,
            severity: 'warning',
            relatedId: p.id,
            relatedUrl: '/dashboard/payables',
          });
        }
      }
    }

    // 3. GST Filing Reminder (if today is between 15th and 20th of month)
    const dayOfMonth = now.getDate();
    if (dayOfMonth >= 15 && dayOfMonth <= 20) {
      const snapshot = await prisma.kpiSnapshot.findFirst({
        where: { companyId },
        orderBy: { snapshotDate: 'desc' },
      });
      const gstPayable = num(snapshot?.gstPayable);
      await notify({
        type: 'gst_reminder',
        title: 'GST Return Filing Reminder',
        message: `GSTR-3B due by 20th. Estimated Net GST Payable: ${formatINR(gstPayable)}`,
        severity: 'warning',
        relatedId: `gst-${now.getFullYear()}-${now.getMonth() + 1}`,
        relatedUrl: '/dashboard/gst',
      });
    }

    // 4. Low Stock Alert (closingQty > 0 AND closingQty < 5)
    if (prefs.lowStockAlert) {
      const lowStockItems = await prisma.stockItem.findMany({
        where: {
          companyId,
          closingQty: { gt: 0, lt: 5 },
        },
      });

      for (const item of lowStockItems) {
        await notify({
          type: 'low_stock',
          title: `Low Stock Alert: ${item.name}`,
          message: `Only ${num(item.closingQty)} ${item.unit || 'NOS'} remaining in inventory`,
          severity: 'info',
          relatedId: item.id,
          relatedUrl: '/dashboard/inventory',
        });
      }
    }

    // 5. Below-Cost Sale Alert (sale below cost)
    if (prefs.belowCostAlert) {
      const negativeMarginItems = await prisma.voucherItem.findMany({
        where: {
          voucher: { companyId, voucherType: 'Sales', isCancelled: false },
          profit: { lt: 0 },
        },
        include: { voucher: true },
        take: 10,
      });

      for (const item of negativeMarginItems) {
        const saleRate = num(item.rate);
        const costRate = num(item.costRate);
        const marginPct = num(item.marginPct).toFixed(1);

        await notify({
          type: 'below_cost',
          title: `Below-Cost Sale: Invoice ${item.voucher.voucherNumber}`,
          message: `${item.stockItemName} sold at ${formatINR(saleRate)} vs cost ${formatINR(costRate)} (${marginPct}%)`,
          severity: 'critical',
          relatedId: item.id,
          relatedUrl: '/dashboard/bill-pnl',
        });
      }
    }

    // 6. High Value Sale Alert (sale with amount >= threshold)
    if (prefs.highValueSaleAlert) {
      const highValueSales = await prisma.voucher.findMany({
        where: {
          companyId,
          voucherType: 'Sales',
          isCancelled: false,
          amount: { gte: prefs.highValueThreshold },
        },
        take: 10,
        orderBy: { date: 'desc' },
      });

      for (const sale of highValueSales) {
        const amt = num(sale.amount);
        await notify({
          type: 'high_value_sale',
          title: `High-Value Sale: ${sale.partyName || 'Customer'}`,
          message: `High-value invoice ${sale.voucherNumber} recorded for ${formatINR(amt)}`,
          severity: 'info',
          relatedId: sale.id,
          relatedUrl: '/dashboard/bill-pnl',
          amount: amt,
        });
      }
    }

    // 7. Daily Sales Summary
    if (prefs.dailySummary) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const [todaySalesVouchers, todayReceiptVouchers] = await Promise.all([
        prisma.voucher.findMany({
          where: { companyId, voucherType: 'Sales', isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.voucher.findMany({
          where: { companyId, voucherType: 'Receipt', isCancelled: false, date: { gte: dayStart, lt: dayEnd } },
        }),
      ]);

      if (todaySalesVouchers.length > 0 || todayReceiptVouchers.length > 0) {
        const salesTotal = todaySalesVouchers.reduce((s, v) => s + num(v.amount), 0);
        const collectionsTotal = todayReceiptVouchers.reduce((s, v) => s + num(v.amount), 0);

        await notify({
          type: 'daily_summary',
          title: `Today's Business Summary`,
          message: `${todaySalesVouchers.length} invoices issued, ${formatINR(salesTotal)} sales, ${formatINR(collectionsTotal)} collected today`,
          severity: 'info',
          relatedId: `daily-${dayStart.toISOString().split('T')[0]}`,
          relatedUrl: '/dashboard/daily-report',
        });
      }
    }

    // 8. New Bill Recorded Alert
    if (prefs.newBillAlert) {
      const newBills = await prisma.voucher.findMany({
        where: {
          companyId,
          voucherType: 'Purchase',
          isCancelled: false,
        },
        take: 10,
        orderBy: { date: 'desc' },
      });

      for (const bill of newBills) {
        await notify({
          type: 'new_bill',
          title: `New Bill Recorded: ${bill.partyName || 'Supplier'}`,
          message: `Purchase bill ${bill.voucherNumber} recorded for ${formatINR(num(bill.amount))}`,
          severity: 'info',
          relatedId: bill.id,
          relatedUrl: '/dashboard/payables',
        });
      }
    }

    logger.info({ companyId, countCreated }, 'Notification generation complete');
  } catch (err) {
    logger.error({ err }, 'Notification generation failed');
  }

  return countCreated;
}
