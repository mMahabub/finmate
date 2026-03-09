'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useToastContext } from '@/components/ui/ToastContainer';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { CURRENCIES } from '@/lib/constants';
import { CurrencyCode } from '@/types/expense';
import { useCurrencyContext } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (!password) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Weak', color: '#ef4444', width: '33%' };
  if (score <= 3) return { label: 'Medium', color: '#f59e0b', width: '66%' };
  return { label: 'Strong', color: '#22c55e', width: '100%' };
}

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { addToast } = useToastContext();
  const { currency, setCurrency: setGlobalCurrency } = useCurrencyContext();

  // Profile state
  const [name, setName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
    setSelectedCurrency(currency);
  }, [user, currency]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      addToast('Name cannot be empty', 'error');
      return;
    }
    setProfileLoading(true);
    try {
      const data = await apiFetch<{ user: { name: string } }>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      updateUser({ name: data.user.name });

      // Update currency globally (persists to localStorage + updates all components)
      setGlobalCurrency(selectedCurrency);

      addToast('Profile updated successfully', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to update profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('Please fill in all password fields', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }
    setPasswordLoading(true);
    try {
      await apiFetch('/api/user/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Password changed successfully', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to change password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== 'DELETE') {
      addToast('Please type DELETE to confirm', 'error');
      return;
    }
    if (!deletePassword) {
      addToast('Please enter your password', 'error');
      return;
    }
    setDeleteLoading(true);
    try {
      await apiFetch('/api/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
      });
      addToast('Account deleted', 'success');
      setShowDeleteModal(false);
      logout();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to delete account', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  const strength = getPasswordStrength(newPassword);

  if (!user) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage your account and preferences
        </p>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="text-lg font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="glass-input w-full opacity-60 cursor-not-allowed"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
              className="glass-input w-full"
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol}  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              All amounts across the app will display in this currency
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSaveProfile}
            disabled={profileLoading}
            className="btn-primary inline-flex items-center gap-2"
          >
            {profileLoading && (
              <svg width={16} height={16} className="animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Changes
          </motion.button>
        </div>
      </motion.div>

      {/* AI Assistant Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI Assistant
          </h2>
        </div>

        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          FinMate AI uses Google Gemini to provide personalized financial advice. Without an API key, you&apos;ll still get
          smart insights from your spending data.
        </p>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Gemini API Key
          </label>
          <div className="glass-input w-full px-4 py-3 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Configured via server environment variable</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Add <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>GEMINI_API_KEY=your_key</code> to
            your <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>.env.local</code> file.
            Get a free key at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
              style={{ color: 'var(--accent-primary)' }}
            >
              Google AI Studio
            </a>
          </p>
        </div>
      </motion.div>

      {/* Change Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="text-lg font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
          Change Password
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="glass-input w-full"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="glass-input w-full"
              placeholder="Enter new password (min 8 chars)"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Password strength</span>
                  <span className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--card-border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: strength.width }}
                    style={{ background: strength.color }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input w-full"
              placeholder="Confirm new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleChangePassword}
            disabled={passwordLoading}
            className="btn-primary inline-flex items-center gap-2"
          >
            {passwordLoading && (
              <svg width={16} height={16} className="animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Change Password
          </motion.button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-6 space-y-4"
        style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}
      >
        <h2 className="text-lg font-heading font-semibold" style={{ color: '#ef4444' }}>
          Danger Zone
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Once you delete your account, all your data (expenses, budgets, settings) will be permanently removed.
          This action cannot be undone.
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2.5 text-sm font-medium text-white rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
          }}
        >
          Delete Account
        </motion.button>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This will permanently delete your account and all associated data. This action <strong>cannot</strong> be undone.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Type <span className="font-mono font-bold" style={{ color: '#ef4444' }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="glass-input w-full"
              placeholder="DELETE"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Enter your password
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="glass-input w-full"
              placeholder="Your password"
            />
          </div>

          <div className="flex items-center gap-3 justify-end pt-2">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
                setDeletePassword('');
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDeleteAccount}
              disabled={deleteLoading || deleteConfirmation !== 'DELETE' || !deletePassword}
              className="px-4 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete My Account'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
