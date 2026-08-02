'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Loader2, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonProps {
  moduleName: string;
  label?: string;
  className?: string;
}

export function ExportButton({ moduleName, label = 'Export', className = '' }: ExportButtonProps) {
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

      const res = await fetch(`${backendUrl}/api/export/${moduleName}?format=${format}`, {
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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isDownloading}
        className={`inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#152A45] disabled:opacity-60 ${className}`}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          <Download className="h-4 w-4 text-white" />
        )}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/80" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5">
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
      )}
    </div>
  );
}
