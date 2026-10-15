import { useState, useEffect } from 'react';
import { Lock, Mail, User, AlertCircle, Loader2, X, ShieldAlert } from 'lucide-react';
import { ZovoLogo } from './ZovoLogo.js';
import { useAuth } from '../context/AuthContext.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  reason?: string | null;
}

export function AuthModal({ isOpen, onClose, initialMode = 'login', reason }: AuthModalProps) {
  const { login, register, demoLogin, authModalReason } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayReason = reason || authModalReason;

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await demoLogin();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Demo sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[var(--zovo-surface)] rounded-2xl border border-[var(--zovo-border)] shadow-2xl p-6 sm:p-7 space-y-5">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mb-1 flex justify-center">
            <ZovoLogo variant="hero" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--zovo-text)]">
            {mode === 'login' ? 'Sign in to Zovo' : 'Create your Zovo Account'}
          </h2>
          <p className="text-xs text-[var(--zovo-muted)] max-w-xs mx-auto">
            {mode === 'login'
              ? 'Access your full chat history, custom intelligence prompts, and documents'
              : 'Unlock unlimited questions, documents, voice interactions, and models'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 rounded-xl bg-[var(--zovo-surface)] border border-[var(--zovo-border)]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--zovo-text)] text-[var(--zovo-bg)] shadow-xs'
                : 'text-[var(--zovo-muted)] hover:text-[var(--zovo-text)]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[var(--zovo-text)] text-[var(--zovo-bg)] shadow-xs'
                : 'text-[var(--zovo-muted)] hover:text-[var(--zovo-text)]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Limit Warning if triggered by quota */}
        {displayReason && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Guest Quota Limit</span>
              <p className="text-[11.5px] text-amber-200/90 leading-relaxed">
                {displayReason}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-[11.5px] font-medium text-[var(--zovo-text)]">
                Full Name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--zovo-muted)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11.5px] font-medium text-[var(--zovo-text)]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--zovo-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11.5px] font-medium text-[var(--zovo-text)]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--zovo-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={mode === 'register' ? 12 : 1}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-[var(--zovo-bg)] border border-[var(--zovo-border)] text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden focus:border-[var(--zovo-muted)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2 px-4 rounded-xl bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span>{mode === 'login' ? 'Sign In' : 'Create Account & Continue'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center pt-1 border-t border-[var(--zovo-border)]">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-xs text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] transition-colors font-medium"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up for unlimited access"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
