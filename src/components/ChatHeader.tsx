import {
  Download,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { Conversation, GeminiModelId, Message } from '../types.js';
import { useTheme } from '../context/ThemeContext.js';
import { ZovoLogo } from './ZovoLogo.js';

interface ChatHeaderProps {
  activeConversation: Conversation | null;
  messages: Message[];
  activeModel: GeminiModelId;
  onSelectModel: (model: GeminiModelId) => void;
  searchEnabled: boolean;
  onToggleSearch: (enabled: boolean) => void;
  onTogglePin: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onToggleSidebar: () => void;
  onOpenKnowledge: () => void;
  onOpenPrompts: () => void;
  onOpenAssistants: () => void;
  onOpenSettings: () => void;
}

export function ChatHeader({
  activeConversation: _,
  messages: __,
  activeModel: ___,
  onSelectModel: ____,
  searchEnabled: _____,
  onToggleSearch: ______,
  onTogglePin: _______,
  onRename: ________,
  onDelete: _________,
  onToggleSidebar,
  onOpenKnowledge: __________,
  onOpenPrompts: ___________,
  onOpenAssistants,
  onOpenSettings: ____________,
}: ChatHeaderProps) {
  const { isDark, setTheme } = useTheme();

  return (
    <header className="h-14 px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none bg-transparent">
      {/* Left: Mobile Sidebar toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          title="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right Floating Pill Toolbar matching exact screenshot */}
      <div className="flex items-center">
        <div className="rounded-full bg-white/90 border border-zinc-200/90 text-zinc-700 dark:bg-[#14151B]/90 dark:border-white/10 dark:text-zinc-300 px-3.5 py-1.5 flex items-center gap-3.5 backdrop-blur-md shadow-md dark:shadow-lg transition-colors">
          {/* Download Project ZIP */}
          <a
            href="/api/download-zip"
            download="zovo-project.zip"
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors p-0.5 cursor-pointer flex items-center justify-center"
            title="Download Project ZIP"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Zovo Brand Emblem / Sparks */}
          <button
            onClick={onOpenAssistants}
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors relative group p-0.5 cursor-pointer flex items-center justify-center"
            title="Zovo Intelligence & Sparks"
          >
            <ZovoLogo className="w-4.5 h-4.5" />
          </button>

          {/* Moon / Sun Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors p-0.5 cursor-pointer"
            title={isDark ? 'Switch to normal light theme' : 'Switch to dark theme'}
          >
            {isDark ? (
              <Moon className="w-4 h-4 text-zinc-300 hover:text-white" />
            ) : (
              <Sun className="w-4 h-4 text-zinc-700 hover:text-zinc-950" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

