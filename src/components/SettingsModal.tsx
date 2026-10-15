import { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User,
  Sliders,
  Moon,
  Sun,
  Laptop,
  Loader2,
  CheckCircle2,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { UserSettings, GeminiModelId } from '../types.js';
import { ZOVO_MODELS } from '../lib/models.js';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { api } from '../lib/api.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, isGuest, updateProfile, logout, openAuthModal } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'model' | 'profile'>('model');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsRes = await api.getSettings();
      setSettings(settingsRes.settings);
      setName(user?.name || '');
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccessMsg('Profile updated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.updateSettings(updates);
      setSettings(res.settings);
      setSuccessMsg('Settings saved');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      alert(err?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white dark:bg-[var(--zovo-surface)] rounded-2xl border border-zinc-200 dark:border-[var(--zovo-border)] shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden text-zinc-800 dark:text-[var(--zovo-text)] transition-colors">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-[var(--zovo-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] flex items-center justify-center text-zinc-700 dark:text-[var(--zovo-text)]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">Settings</h2>
              <p className="text-xs text-zinc-500 dark:text-[var(--zovo-muted)]">
                Manage your AI model, appearance, and account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-[var(--zovo-muted)] hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-[var(--zovo-border)] px-5 gap-2 bg-zinc-50 dark:bg-[var(--zovo-surface)]">
          <button
            onClick={() => setActiveTab('model')}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'model'
                ? 'border-blue-600 dark:border-zinc-100 text-blue-600 dark:text-[var(--zovo-text)] font-semibold'
                : 'border-transparent text-zinc-500 dark:text-[var(--zovo-muted)] hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>AI Model & Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 dark:border-zinc-100 text-blue-600 dark:text-[var(--zovo-text)] font-semibold'
                : 'border-transparent text-zinc-500 dark:text-[var(--zovo-muted)] hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account & Preferences</span>
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span>Loading settings...</span>
            </div>
          ) : activeTab === 'model' && settings ? (
            <div className="space-y-5">
              {/* Default Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                  Default AI Model
                </label>
                <select
                  value={settings.selectedModel}
                  onChange={(e) =>
                    handleUpdateSettings({ selectedModel: e.target.value as GeminiModelId })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-900 dark:text-[var(--zovo-text)] focus:outline-hidden cursor-pointer"
                >
                  {ZOVO_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.tagline})
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                    Temperature ({settings.temperature})
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {settings.temperature < 0.3
                      ? 'Deterministic & Precise'
                      : settings.temperature > 0.7
                      ? 'Creative & Exploratory'
                      : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) =>
                    handleUpdateSettings({ temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-blue-600 dark:accent-zinc-100"
                />
              </div>

              {/* Global Custom Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                  Global Custom Instructions (System Prompt)
                </label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  onBlur={() => handleUpdateSettings({ systemPrompt: settings.systemPrompt })}
                  placeholder="e.g. Always respond concisely in bullet points..."
                  rows={3}
                  className="w-full p-3 text-xs rounded-lg bg-zinc-50 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-900 dark:text-[var(--zovo-text)] focus:outline-hidden resize-y font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Appearance Theme Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                  Color Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-[var(--zovo-border)] dark:bg-[var(--zovo-surface)] dark:text-[var(--zovo-muted)] dark:hover:text-zinc-200'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-[var(--zovo-border)] dark:bg-[var(--zovo-surface)] dark:text-[var(--zovo-muted)] dark:hover:text-zinc-200'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      theme === 'system'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-[var(--zovo-border)] dark:bg-[var(--zovo-surface)] dark:text-[var(--zovo-muted)] dark:hover:text-zinc-200'
                    }`}
                  >
                    <Laptop className="w-4 h-4" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              {/* Account / Auth Management Banner */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-[var(--zovo-border)] bg-zinc-50 dark:bg-[var(--zovo-surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                      {user?.name || 'Guest User'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isGuest
                        ? 'bg-zinc-200 text-zinc-700 dark:bg-[var(--zovo-surface)] dark:text-[var(--zovo-text)]'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/40 dark:border-purple-800/40'
                    }`}>
                      {isGuest ? 'Guest Session' : 'Logged In Account'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {user?.email || 'guest@zovo.ai'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isGuest ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openAuthModal('login');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-[var(--zovo-surface)] dark:hover:bg-zinc-700 dark:text-[var(--zovo-text)] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openAuthModal('register');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Sign Up</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Profile details */}
              <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2 border-t border-zinc-200 dark:border-[var(--zovo-border)]">
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-[var(--zovo-text)]">
                  Account Details
                </h4>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 dark:text-[var(--zovo-muted)]">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || 'guest@zovo.ai'}
                    disabled
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-100 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 dark:text-[var(--zovo-muted)]">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-900 dark:text-[var(--zovo-text)] focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 dark:text-[var(--zovo-muted)]">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-900 dark:text-[var(--zovo-text)] focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 dark:text-[var(--zovo-muted)]">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[var(--zovo-surface)] border border-zinc-200 dark:border-[var(--zovo-border)] text-zinc-900 dark:text-[var(--zovo-text)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-[var(--zovo-border)] flex justify-end bg-zinc-50 dark:bg-[var(--zovo-surface)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
