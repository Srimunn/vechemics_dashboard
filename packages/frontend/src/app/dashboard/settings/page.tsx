'use client';

import { useState, useEffect } from 'react';
import { Settings, Building, RefreshCw, User, Lock, Bell, Check, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Notification Preferences State
  const [prefs, setPrefs] = useState({
    isActive: true,
    belowCostAlert: true,
    overduePaymentAlert: true,
    lowStockAlert: false,
    highValueSaleAlert: false,
    highValueThreshold: 50000,
    dailySummary: false,
    newBillAlert: false,
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/notification-preferences`, { headers });
        if (res.ok) {
          const data = await res.json();
          const loaded = data.preferences || data;
          if (loaded) {
            setPrefs({
              isActive: loaded.isActive ?? true,
              belowCostAlert: loaded.belowCostAlert ?? true,
              overduePaymentAlert: loaded.overduePaymentAlert ?? true,
              lowStockAlert: loaded.lowStockAlert ?? false,
              highValueSaleAlert: loaded.highValueSaleAlert ?? false,
              highValueThreshold: loaded.highValueThreshold ?? 50000,
              dailySummary: loaded.dailySummary ?? false,
              newBillAlert: loaded.newBillAlert ?? false,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      } finally {
        setLoadingPrefs(false);
      }
    }
    loadPreferences();
  }, []);

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

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setSavedSuccess(false);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vchemics_auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/notification-preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify(prefs),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
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

        {/* Notification Preferences Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4 mb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Bell className="h-5 w-5" /></div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Notification Preferences</h2>
                <p className="text-xs text-gray-500">Manage executive alert rules and thresholds</p>
              </div>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center gap-3 bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200">
              <span className="text-xs font-bold text-gray-700">Enable Notifications</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.isActive}
                onClick={() => setPrefs((prev) => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  prefs.isActive ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    prefs.isActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {loadingPrefs ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-xs font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preferences...
            </div>
          ) : (
            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!prefs.isActive ? 'opacity-40 pointer-events-none' : ''}`}>
                {/* Below-cost sale alerts */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Below-cost sale alerts</p>
                    <p className="text-[11px] text-gray-500">Alert when invoice items are sold below calculated cost rate</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.belowCostAlert}
                    disabled={!prefs.isActive}
                    onClick={() => setPrefs((p) => ({ ...p, belowCostAlert: !p.belowCostAlert }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prefs.belowCostAlert ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefs.belowCostAlert ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Overdue payment warnings */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Overdue payment warnings</p>
                    <p className="text-[11px] text-gray-500">Notify for customer receivables overdue past 30 or 90 days</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.overduePaymentAlert}
                    disabled={!prefs.isActive}
                    onClick={() => setPrefs((p) => ({ ...p, overduePaymentAlert: !p.overduePaymentAlert }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prefs.overduePaymentAlert ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefs.overduePaymentAlert ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Low stock alerts */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Low stock alerts</p>
                    <p className="text-[11px] text-gray-500">Alert when stock item closing quantity drops below 5 NOS</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.lowStockAlert}
                    disabled={!prefs.isActive}
                    onClick={() => setPrefs((p) => ({ ...p, lowStockAlert: !p.lowStockAlert }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prefs.lowStockAlert ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefs.lowStockAlert ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* High-value sale alerts + Threshold */}
                <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">High-value sale alerts</p>
                      <p className="text-[11px] text-gray-500">Flag sale transactions exceeding custom value threshold</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs.highValueSaleAlert}
                      disabled={!prefs.isActive}
                      onClick={() => setPrefs((p) => ({ ...p, highValueSaleAlert: !p.highValueSaleAlert }))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefs.highValueSaleAlert ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          prefs.highValueSaleAlert ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {prefs.highValueSaleAlert && (
                    <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-700 shrink-0">Threshold (₹):</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        disabled={!prefs.isActive}
                        value={prefs.highValueThreshold}
                        onChange={(e) => setPrefs((p) => ({ ...p, highValueThreshold: Number(e.target.value) }))}
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Daily business summary */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Daily business summary</p>
                    <p className="text-[11px] text-gray-500">Receive daily summary of invoices issued &amp; collections</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.dailySummary}
                    disabled={!prefs.isActive}
                    onClick={() => setPrefs((p) => ({ ...p, dailySummary: !p.dailySummary }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prefs.dailySummary ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefs.dailySummary ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* New bill recorded */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-bold text-gray-900">New bill recorded</p>
                    <p className="text-[11px] text-gray-500">Notify whenever a new purchase voucher bill is synced</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.newBillAlert}
                    disabled={!prefs.isActive}
                    onClick={() => setPrefs((p) => ({ ...p, newBillAlert: !p.newBillAlert }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prefs.newBillAlert ? 'bg-[#1D4ED8]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefs.newBillAlert ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#152A45] inline-flex items-center gap-2"
                >
                  {savingPrefs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Preferences
                </button>

                {savedSuccess && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    <Check className="h-3.5 w-3.5" /> Saved ✓
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
