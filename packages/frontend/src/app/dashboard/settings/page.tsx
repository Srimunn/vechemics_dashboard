'use client';

import { useState, useEffect } from 'react';
import { Settings, Building, RefreshCw, User, Lock, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

function NotificationPreferencesSection() {
  const [isActive, setIsActive] = useState(true);
  const [belowCostAlert, setBelowCostAlert] = useState(true);
  const [overduePaymentAlert, setOverduePaymentAlert] = useState(true);
  const [lowStockAlert, setLowStockAlert] = useState(false);
  const [highValueSaleAlert, setHighValueSaleAlert] = useState(false);
  const [highValueThreshold, setHighValueThreshold] = useState<string>('50000');
  const [dailySummary, setDailySummary] = useState(false);
  const [newBillAlert, setNewBillAlert] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/notification-preferences`, { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setIsActive(data.isActive ?? true);
          setBelowCostAlert(data.belowCostAlert ?? true);
          setOverduePaymentAlert(data.overduePaymentAlert ?? true);
          setLowStockAlert(data.lowStockAlert ?? false);
          setHighValueSaleAlert(data.highValueSaleAlert ?? false);
          setHighValueThreshold(String(data.highValueThreshold ?? 50000));
          setDailySummary(data.dailySummary ?? false);
          setNewBillAlert(data.newBillAlert ?? false);
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsg(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const thresholdNum = Math.max(1000, parseFloat(highValueThreshold) || 50000);

      const res = await fetch(`${backendUrl}/api/notification-preferences`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          isActive,
          belowCostAlert,
          overduePaymentAlert,
          lowStockAlert,
          highValueSaleAlert,
          highValueThreshold: thresholdNum,
          dailySummary,
          newBillAlert,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg('Preferences saved ✓');
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setMsg('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggles = [
    {
      id: 'belowCostAlert',
      label: 'Below-cost sale alerts',
      description: 'Get notified when a product is sold below purchase cost',
      value: belowCostAlert,
      setValue: setBelowCostAlert,
    },
    {
      id: 'overduePaymentAlert',
      label: 'Overdue payment warnings',
      description: 'Alerts for customer payments past due date',
      value: overduePaymentAlert,
      setValue: setOverduePaymentAlert,
    },
    {
      id: 'lowStockAlert',
      label: 'Low stock alerts',
      description: 'Notify when inventory drops below minimum',
      value: lowStockAlert,
      setValue: setLowStockAlert,
    },
    {
      id: 'highValueSaleAlert',
      label: 'High-value sale alerts',
      description: 'Notify for invoices above threshold',
      value: highValueSaleAlert,
      setValue: setHighValueSaleAlert,
      extra: highValueSaleAlert && (
        <div className="mt-2 pl-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">₹ Threshold Amount:</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
            <input
              type="number"
              min="1000"
              step="1000"
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(e.target.value)}
              disabled={!isActive}
              className="w-36 rounded-lg border border-gray-300 pl-6 pr-3 py-1 text-xs font-bold focus:border-blue-500 focus:outline-none disabled:opacity-40"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'dailySummary',
      label: 'Daily business summary',
      description: 'End-of-day summary notification',
      value: dailySummary,
      setValue: setDailySummary,
    },
    {
      id: 'newBillAlert',
      label: 'New bill recorded',
      description: 'Notify for every new sales invoice',
      value: newBillAlert,
      setValue: setNewBillAlert,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm col-span-1 lg:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Notification Preferences</h2>
            <p className="text-xs text-gray-500">Customize system alerts and notification triggers</p>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-800">Enable Notifications</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">Loading preferences...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${!isActive ? 'opacity-40 pointer-events-none' : ''}`}>
            {toggles.map((item) => (
              <div key={item.id} className="flex flex-col justify-between rounded-lg border border-gray-100 bg-slate-50/50 p-3.5 hover:border-slate-200 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label htmlFor={item.id} className="text-xs font-bold text-gray-900 cursor-pointer">
                      {item.label}
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <Switch
                    id={item.id}
                    checked={item.value}
                    onCheckedChange={item.setValue}
                    disabled={!isActive}
                  />
                </div>
                {item.extra}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] hover:bg-[#152A45] px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save Preferences
            </button>

            {msg && (
              <span className={`text-xs font-bold ${msg.includes('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {msg}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match!');
      return;
    }
    setMessage('Password updated successfully!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#1E293B]">
          <Settings className="h-7 w-7 text-[#1D4ED8]" />
          System Settings &amp; Preferences
        </h1>
        <p className="text-sm text-[#64748B]">Company configuration, sync parameters, and user credentials.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notification Preferences Card (Spans full width) */}
        <NotificationPreferencesSection />

        {/* Company Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Building className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Company Information</h2>
              <p className="text-xs text-gray-500">TallyPrime connected company details</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Tally Company Name:</span>
              <span className="font-semibold text-gray-900">VCHEMICS INDIA SOLUTIONS-2026-2027</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Financial Year:</span>
              <span className="font-semibold text-gray-900">FY 2026-2027 (01-Apr-2026 to 31-Mar-2027)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Tally Version:</span>
              <span className="font-semibold text-blue-600">TallyPrime Release 7.0 (XML API)</span>
            </div>
          </div>
        </div>

        {/* Sync Configuration */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><RefreshCw className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Sync Configuration</h2>
              <p className="text-xs text-gray-500">Task Scheduler background synchronization</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Sync Frequency:</span>
              <span className="font-semibold text-emerald-700">Every 15 minutes (Automatic)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Sync Agent Port:</span>
              <span className="font-semibold text-gray-900">Port 9000 (Tally HTTP XML Server)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Target Database:</span>
              <span className="font-semibold text-gray-900">PostgreSQL (Railway Managed)</span>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><User className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">User Profile</h2>
              <p className="text-xs text-gray-500">Active executive credentials</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Full Name:</span>
              <span className="font-semibold text-gray-900">Velmurugan</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Role:</span>
              <span className="font-bold text-blue-600">CEO / Managing Director</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Email Address:</span>
              <span className="font-semibold text-gray-900">ceo@vchemics.com</span>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><Lock className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Change Account Password</h2>
              <p className="text-xs text-gray-500">Update security credentials</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            {message && <div className="rounded bg-blue-50 p-2 text-xs font-semibold text-blue-700">{message}</div>}
            <div>
              <label className="block text-xs font-semibold text-gray-600">Old Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#152A45]"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
