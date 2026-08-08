import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, FileText, TrendingUp, Wallet, LineChart, ShoppingCart,
  Package, ArrowDownToLine, ArrowUpFromLine, Truck, Users, ReceiptText,
  ShieldCheck, Files, Settings, Bell,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  phase?: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const TOP_NAV_ITEMS: NavItem[] = [
  { title: 'CEO Dashboard', href: '/dashboard/ceo', icon: LayoutDashboard },
  { title: 'Bill-wise P&L', href: '/dashboard/bill-pnl', icon: TrendingUp },
  { title: 'Daily Business Report', href: '/dashboard/daily-report', icon: FileText },
];

export const DROPDOWN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { title: 'Product Profitability', href: '/dashboard/product-profitability', icon: TrendingUp },
      { title: 'Financial Overview', href: '/dashboard/financial-overview', icon: Wallet },
      { title: 'Sales Analytics', href: '/dashboard/sales-analytics', icon: LineChart },
      { title: 'Purchase Analytics', href: '/dashboard/purchase-analytics', icon: ShoppingCart },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Inventory', href: '/dashboard/inventory', icon: Package },
      { title: 'Receivables', href: '/dashboard/receivables', icon: ArrowDownToLine },
      { title: 'Payables', href: '/dashboard/payables', icon: ArrowUpFromLine },
      { title: 'Suppliers', href: '/dashboard/suppliers', icon: Truck },
      { title: 'Customers', href: '/dashboard/customers', icon: Users },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { title: 'GST', href: '/dashboard/gst', icon: ReceiptText },
      { title: 'Audit', href: '/dashboard/audit', icon: ShieldCheck },
      { title: 'Reports', href: '/dashboard/reports', icon: Files },
    ],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { title: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export const SETTINGS_ITEM: NavItem = BOTTOM_NAV_ITEMS[1]!;

/** Flat list of all nav items for quick lookup */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...TOP_NAV_ITEMS,
  ...DROPDOWN_NAV_GROUPS.flatMap((g) => g.items),
  ...BOTTOM_NAV_ITEMS,
];

export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.href === href);
}
