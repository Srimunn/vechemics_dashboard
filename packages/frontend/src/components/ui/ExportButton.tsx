'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Loader2, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonProps {
  moduleName: string;
  label?: string;
  className?: string;
  fromDate?: string;
  toDate?: string;
}

export function ExportButton({ moduleName, label = 'Export', className = '', fromDate, toDate }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      setOpen(false);
      setLoadingFormat(format);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({ format });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`${backendUrl}/api/export/${moduleName}?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        throw new Error(`Export failed: ${res.statusText}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      a.download = `VChemics_${moduleName.toUpperCase().replace(/-/g, '_')}_${dateStr}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to download report export.');
    } finally {
      setLoadingFormat(null);
    }
  };

  const isDownloading = loadingFormat !== null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Desktop Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isDownloading}
        className={`hidden lg:inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#152A45] disabled:opacity-60 min-h-[44px] ${className}`}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          <Download className="h-4 w-4 text-white" />
        )}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/80" />
      </button>

      {/* Mobile Floating Action Button (FAB) (Fix 7) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isDownloading}
        aria-label="Export report"
        className="fixed bottom-[96px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-xl hover:bg-[#1D4ED8] active:scale-95 lg:hidden"
      >
        {isDownloading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <Download className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Dropdown / Bottom Sheet */}
      {open && (
        <>
          {/* Desktop Dropdown */}
          <div className="absolute right-0 top-11 z-50 hidden lg:block w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5">
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <FileText className="h-4 w-4 text-rose-600" />
              <span>PDF (.pdf)</span>
            </button>
          </div>

          {/* Mobile Export Sheet */}
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[24px] bg-white p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Export Report Format</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left font-bold text-slate-800 active:bg-blue-50 min-h-[52px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Excel Spreadsheet (.xlsx)</p>
                  <p className="text-xs text-slate-500 font-normal">Full raw financial data and line items</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left font-bold text-slate-800 active:bg-blue-50 min-h-[52px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">PDF Document (.pdf)</p>
                  <p className="text-xs text-slate-500 font-normal">Formatted print-ready executive report</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
