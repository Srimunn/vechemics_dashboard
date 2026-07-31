import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, FileText, TrendingUp, Wallet, LineChart, ShoppingCart,
  Package, ArrowDownToLine, ArrowUpFromLine, Truck, Users, ReceiptText,
  ShieldCheck, Files, Brain, Settings,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Phase the module is planned for; CEO dashboard is live now. */
  phase?: string;
  description?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { title: 'CEO Dashboard', href: '/dashboard/ceo', icon: LayoutDashboard },
      {
        title: 'Daily Business Report', href: '/dashboard/daily-report', icon: FileText,
        phase: 'Phase 2', description: 'A single end-of-day snapshot of sales, collections, and cash movements to review each evening.',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        title: 'Product Profitability', href: '/dashboard/product-profitability', icon: TrendingUp,
        phase: 'Phase 3', description: 'Margin and contribution analysis per product and grade, using bill-wise cost of goods sold.',
      },
      {
        title: 'Financial Overview', href: '/dashboard/financial-overview', icon: Wallet,
        phase: 'Phase 2', description: 'P&L, balance sheet, and cash-flow summaries with period comparisons.',
      },
      {
        title: 'Sales Analytics', href: '/dashboard/sales-analytics', icon: LineChart,
        phase: 'Phase 2', description: 'Detailed sales analytics with drill-downs by customer, product, executive, and region.',
      },
      {
        title: 'Purchase Analytics', href: '/dashboard/purchase-analytics', icon: ShoppingCart,
        phase: 'Phase 2', description: 'Supplier spend, purchase price trends, and order analysis.',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        title: 'Inventory', href: '/dashboard/inventory', icon: Package,
        phase: 'Phase 2', description: 'Stock levels, valuation, ageing, and reorder insights across all items.',
      },
      {
        title: 'Receivables', href: '/dashboard/receivables', icon: ArrowDownToLine,
        phase: 'Phase 2', description: 'Outstanding customer bills with ageing buckets and collection priorities.',
      },
      {
        title: 'Payables', href: '/dashboard/payables', icon: ArrowUpFromLine,
        phase: 'Phase 2', description: 'Supplier dues, due-date calendar, and payment planning.',
      },
      {
        title: 'Suppliers', href: '/dashboard/suppliers', icon: Truck,
        phase: 'Phase 2', description: 'Supplier master with spend history and outstanding balances.',
      },
      {
        title: 'Customers', href: '/dashboard/customers', icon: Users,
        phase: 'Phase 2', description: 'Customer master with sales history, credit limits, and balances.',
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        title: 'GST', href: '/dashboard/gst', icon: ReceiptText,
        phase: 'Phase 2', description: 'Output/input GST summaries, liability, and return-ready figures.',
      },
      {
        title: 'Audit', href: '/dashboard/audit', icon: ShieldCheck,
        phase: 'Phase 3', description: 'Exception reports and voucher-level audit trails.',
      },
      {
        title: 'Reports', href: '/dashboard/reports', icon: Files,
        phase: 'Phase 2', description: 'Exportable standard financial and operational reports.',
      },
    ],
  },
  {
    label: 'AI',
    items: [
      {
        title: 'AI Insights', href: '/dashboard/ai-insights', icon: Brain,
        phase: 'Phase 4', description: 'Natural-language answers and proactive alerts across your Tally data.',
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  title: 'Settings', href: '/dashboard/settings', icon: Settings,
  phase: 'Phase 2', description: 'Company profile, users, sync configuration, and preferences.',
};

/** Flat lookup for a route's metadata (used by Coming Soon pages). */
export function findNavItem(href: string): NavItem | undefined {
  for (const section of NAV_SECTIONS) {
    const hit = section.items.find((i) => i.href === href);
    if (hit) return hit;
  }
  return SETTINGS_ITEM.href === href ? SETTINGS_ITEM : undefined;
}
