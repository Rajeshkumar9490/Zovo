import { useState, FormEvent, KeyboardEvent } from 'react';
import { ArrowRight, ArrowUp, Plus, Sun, Moon } from 'lucide-react';
import { ZovoLogo } from './ZovoLogo.js';
import { useTheme } from '../context/ThemeContext.js';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onStartDemo: (initialPrompt?: string) => void;
}

export function LandingPage({ onOpenAuth, onStartDemo }: LandingPageProps) {
  const { isDark, setTheme } = useTheme();
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    onStartDemo(inputValue.trim() || undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--zovo-bg)] text-[var(--zovo-text)] flex flex-col justify-between selection:bg-[var(--zovo-surface)] selection:text-white">
      {/* Header */}
      <header className="h-16 border-b border-[var(--zovo-border)] px-4 sm:px-8 w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ZovoLogo variant="tile" />
          <span className="font-semibold text-base tracking-tight text-[var(--zovo-text)]">Zovo</span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--zovo-surface)] border border-[var(--zovo-border)] text-[var(--zovo-muted)] font-medium hidden sm:inline-block">
            Zovo Intelligence
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onOpenAuth('login')}
            className="px-3 py-1.5 text-xs font-medium text-[var(--zovo-text)] hover:text-[var(--zovo-text)] transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => onStartDemo()}
            className="px-3.5 py-1.5 text-xs font-medium bg-[var(--zovo-text)] text-[var(--zovo-bg)] rounded-lg hover:bg-[var(--zovo-text)] transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Launch App</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 max-w-[832px] mx-auto w-full text-center">
        {/* Hero Typography */}
        <div className="space-y-3 mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[var(--zovo-text)] leading-tight">
            How can Zovo help?
          </h1>
          <p className="text-sm sm:text-base text-[var(--zovo-muted)] max-w-lg mx-auto font-normal">
            Clear answers, writing, coding, and readable documents.
          </p>
        </div>

        {/* Chat Composer Preview */}
        <div className="w-full max-w-[800px]">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-[28px] bg-[var(--zovo-composer)] border border-[var(--zovo-border)] focus-within:border-[var(--zovo-muted)] transition-all p-3 sm:p-4 text-left shadow-lg space-y-3"
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Zovo anything..."
              rows={2}
              className="w-full bg-transparent text-sm text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-hidden resize-none leading-relaxed"
              aria-label="Ask Zovo anything"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => onStartDemo()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] bg-[var(--zovo-surface)] hover:bg-[var(--zovo-hover)] border border-[var(--zovo-border)] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--zovo-muted)]" />
                <span>Attach</span>
              </button>

              <button
                type="submit"
                aria-label="Send message"
                className="w-8 h-8 rounded-full bg-[var(--zovo-text)] text-[var(--zovo-bg)] hover:bg-[var(--zovo-text)] transition-opacity flex items-center justify-center disabled:opacity-40"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => onStartDemo(inputValue.trim() || undefined)}
            className="px-4 py-2 rounded-xl bg-[var(--zovo-text)] text-[var(--zovo-bg)] text-xs font-semibold hover:bg-[var(--zovo-text)] transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Start chatting</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onOpenAuth('login')}
            className="px-4 py-2 rounded-xl bg-[var(--zovo-surface)] text-[var(--zovo-text)] text-xs font-medium hover:text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] transition-colors border border-[var(--zovo-border)]"
          >
            Sign in
          </button>
        </div>

        {/* Subtle Single-Line Capability Statement */}
        <div className="mt-8 text-xs text-[var(--zovo-muted)] font-medium tracking-wide">
          <span>Chat</span>
          <span className="mx-2 text-[var(--zovo-muted)]">•</span>
          <span>Write</span>
          <span className="mx-2 text-[var(--zovo-muted)]">•</span>
          <span>Code</span>
          <span className="mx-2 text-[var(--zovo-muted)]">•</span>
          <span>Analyze documents</span>
          <span className="mx-2 text-[var(--zovo-muted)]">•</span>
          <span>Voice</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-[var(--zovo-border)] px-4 flex items-center justify-center text-center text-xs text-[var(--zovo-muted)] font-normal">
        <p>Zovo &bull; Zovo Intelligence</p>
      </footer>
    </div>
  );
}
