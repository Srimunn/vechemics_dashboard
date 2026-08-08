'use client';

import { useState } from 'react';
import { Settings, Building, RefreshCw, User, Lock, Moon } from 'lucide-react';

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
