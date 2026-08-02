'use client';

import React, { useState } from 'react';
import { Calendar as CalendarIcon, Filter, Check } from 'lucide-react';

interface DateRangePickerProps {
  initialFrom?: string;
  initialTo?: string;
  onApply: (from: string, to: string) => void;
  className?: string;
}

function getStartOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function DateRangePicker({
  initialFrom = getStartOfMonth(),
  initialTo = getTodayStr(),
  onApply,
  className = '',
}: DateRangePickerProps) {
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [activePreset, setActivePreset] = useState<string>('this_month');

  const setPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = getTodayStr();

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
      onApply(todayStr, todayStr);
    } else if (preset === 'this_week') {
      const day = now.getDay() || 7; // Get current day of week, Sunday = 7
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const from = monday.toISOString().split('T')[0]!;
      setFromDate(from);
      setToDate(todayStr);
      onApply(from, todayStr);
    } else if (preset === 'this_month') {
      const from = getStartOfMonth();
      setFromDate(from);
      setToDate(todayStr);
      onApply(from, todayStr);
    } else if (preset === 'this_quarter') {
      const currentMonth = now.getMonth();
      const qStartMonth = Math.floor(currentMonth / 3) * 3;
      const qStart = new Date(now.getFullYear(), qStartMonth, 1).toISOString().split('T')[0]!;
      setFromDate(qStart);
      setToDate(todayStr);
      onApply(qStart, todayStr);
    } else if (preset === 'this_fy') {
      let fyStartYear = now.getFullYear();
      if (now.getMonth() < 3) fyStartYear -= 1; // FY starts April 1
      const fyStart = `${fyStartYear}-04-01`;
      setFromDate(fyStart);
      setToDate(todayStr);
      onApply(fyStart, todayStr);
    } else if (preset === 'last_month') {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const from = firstOfLastMonth.toISOString().split('T')[0]!;
      const to = lastOfLastMonth.toISOString().split('T')[0]!;
      setFromDate(from);
      setToDate(to);
      onApply(from, to);
    } else if (preset === 'last_quarter') {
      const currentMonth = now.getMonth();
      let qStartMonth = Math.floor(currentMonth / 3) * 3 - 3;
      let yr = now.getFullYear();
      if (qStartMonth < 0) {
        qStartMonth += 12;
        yr -= 1;
      }
      const from = new Date(yr, qStartMonth, 1).toISOString().split('T')[0]!;
      const to = new Date(yr, qStartMonth + 3, 0).toISOString().split('T')[0]!;
      setFromDate(from);
      setToDate(to);
      onApply(from, to);
    }
  };

  const handleCustomApply = () => {
    setActivePreset('custom');
    onApply(fromDate, toDate);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-xs ${className}`}>
      {/* Date Pickers */}
      <div className="flex items-center gap-2 text-xs">
        <CalendarIcon className="h-4 w-4 text-[#1D4ED8] shrink-0" />
        <span className="font-semibold text-gray-600">From:</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
        />
        <span className="font-semibold text-gray-600">To:</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCustomApply}
          className="inline-flex items-center gap-1 rounded-md bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800 transition-colors shadow-xs"
        >
          <Check className="h-3 w-3" /> Apply
        </button>
      </div>

      {/* Vertical Divider */}
      <div className="hidden h-5 w-px bg-gray-200 sm:block mx-1" />

      {/* Preset Pills */}
      <div className="flex flex-wrap items-center gap-1">
        {[
          { id: 'today', label: 'Today' },
          { id: 'this_week', label: 'This Week' },
          { id: 'this_month', label: 'This Month' },
          { id: 'this_quarter', label: 'This Quarter' },
          { id: 'this_fy', label: 'This FY' },
          { id: 'last_month', label: 'Last Month' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              activePreset === p.id
                ? 'bg-blue-100 text-[#1D4ED8] ring-1 ring-blue-500/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
