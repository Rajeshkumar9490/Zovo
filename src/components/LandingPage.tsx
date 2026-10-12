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
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-300 flex flex-col justify-between selection:bg-zinc-800 selection:text-white">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800/80 px-4 sm:px-8 w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ZovoLogo variant="tile" />
          <span className="font-semibold text-base tracking-tight text-zinc-100">Zovo</span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#141414] border border-zinc-800 text-zinc-400 font-medium hidden sm:inline-block">
            Zovo Intelligence
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#141414] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onOpenAuth('login')}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => onStartDemo()}
            className="px-3.5 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-950 rounded-lg hover:bg-white transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Launch App</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 max-w-3xl mx-auto w-full text-center">
        {/* Hero Typography */}
        <div className="space-y-3 mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-zinc-100 leading-tight">
            How can Zovo help?
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-lg mx-auto font-normal">
            Turn screenshots, logs, and documents into clear answers.
          </p>
        </div>

        {/* Chat Composer Preview */}
        <div className="w-full max-w-2xl">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl bg-[#141414] border border-zinc-800 focus-within:border-zinc-700 transition-all p-3 sm:p-4 text-left shadow-lg space-y-3"
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Zovo anything..."
              rows={2}
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none leading-relaxed"
              aria-label="Ask Zovo anything"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => onStartDemo()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-[#1A1A1A] hover:bg-[#222222] border border-zinc-800/80 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-400" />
                <span>Attach</span>
              </button>

              <button
                type="submit"
                aria-label="Send message"
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white transition-opacity flex items-center justify-center disabled:opacity-40"
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
            className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Start chatting</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onOpenAuth('login')}
            className="px-4 py-2 rounded-xl bg-[#141414] text-zinc-300 text-xs font-medium hover:text-white hover:bg-[#1C1C1C] transition-colors border border-zinc-800"
          >
            Sign in
          </button>
        </div>

        {/* Subtle Single-Line Capability Statement */}
        <div className="mt-8 text-xs text-zinc-500 font-medium tracking-wide">
          <span>Chat</span>
          <span className="mx-2 text-zinc-600">•</span>
          <span>Research</span>
          <span className="mx-2 text-zinc-600">•</span>
          <span>Analyze files</span>
          <span className="mx-2 text-zinc-600">•</span>
          <span>Understand images</span>
          <span className="mx-2 text-zinc-600">•</span>
          <span>Voice</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-zinc-800/60 px-4 flex items-center justify-center text-center text-xs text-zinc-500 font-normal">
        <p>Zovo &bull; Zovo Intelligence</p>
      </footer>
    </div>
  );
}
