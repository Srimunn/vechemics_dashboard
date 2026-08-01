'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  moduleName: string;
  label?: string;
  className?: string;
}

export function ExportButton({ moduleName, label = 'Export Excel', className = '' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${backendUrl}/api/export/${moduleName}?format=csv`, {
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
      a.download = `VChemics_${moduleName.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to download report export.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#152A45] disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      ) : (
        <Download className="h-4 w-4 text-white" />
      )}
      <span>{label}</span>
    </button>
  );
}
