'use client';

import { Files, Download, Calendar } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';

const REPORT_HUBS = [
  {
    id: 'pnl',
    name: 'Profit & Loss Statement',
    description: 'Detailed revenue, cost of goods sold, direct/indirect expenses, and net profit report.',
    moduleName: 'financial-overview',
  },
  {
    id: 'balance-sheet',
    name: 'Balance Sheet Summary',
    description: 'Capital account, current assets, bank accounts, debtors, creditors, and duties.',
    moduleName: 'financial-overview',
  },
  {
    id: 'bill-pnl',
    name: 'Bill-wise Profit & Loss',
    description: 'Invoice-by-invoice sales profit and margin percentage breakdown with item details.',
    moduleName: 'bill-pnl',
  },
  {
    id: 'sales',
    name: 'Sales Register',
    description: 'Complete list of all sales vouchers with date, customer name, and invoice amounts.',
    moduleName: 'sales',
  },
  {
    id: 'purchases',
    name: 'Purchase Register',
    description: 'Complete list of all purchase vouchers with date, supplier name, and spend amounts.',
    moduleName: 'purchases',
  },
  {
    id: 'receivables',
    name: 'Outstanding Receivables',
    description: 'Pending customer bills with overdue days, due dates, and aging analysis.',
    moduleName: 'receivables',
  },
  {
    id: 'payables',
    name: 'Outstanding Payables',
    description: 'Pending supplier dues with overdue days, due dates, and payment schedules.',
    moduleName: 'payables',
  },
  {
    id: 'inventory',
    name: 'Stock Summary & Valuation',
    description: 'Closing stock item quantities, unit rates, total stock valuation, and low stock alerts.',
    moduleName: 'inventory',
  },
  {
    id: 'gst',
    name: 'GST Compliance Summary',
    description: 'Output GST, Input Tax Credit (ITC), and monthly net tax liability breakdown.',
    moduleName: 'gst',
  },
  {
    id: 'daily-report',
    name: 'Daily Business Snapshot',
    description: 'Single end-of-day summary of daily sales, purchases, collections, and payments.',
    moduleName: 'daily-report',
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
          <Files className="h-7 w-7 text-[#1D4ED8]" />
          Financial &amp; Operational Reports Hub
        </h1>
        <p className="text-sm text-[#64748B]">Download standard financial, compliance, and inventory reports matching Tally.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {REPORT_HUBS.map((report) => (
          <div key={report.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">{report.name}</h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">Excel .CSV</span>
              </div>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">{report.description}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">Official Tally Export</span>
              <ExportButton moduleName={report.moduleName} label="Download Excel" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
