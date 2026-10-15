import { ChevronDown, Menu, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { Conversation, GeminiModelId, Message } from '../types.js';
import { useTheme } from '../context/ThemeContext.js';

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
  sidebarCollapsed?: boolean;
}

export function ChatHeader({ activeConversation, onToggleSidebar, onOpenAssistants, onOpenSettings, sidebarCollapsed = false }: ChatHeaderProps) {
  const { isDark, setTheme } = useTheme();
  const actionClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--zovo-muted)] transition-colors hover:bg-[var(--zovo-hover)] hover:text-[var(--zovo-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zovo-muted)]';

  return (
    <header className="relative z-20 flex h-16 shrink-0 select-none items-center justify-between gap-3 bg-transparent px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          onClick={onToggleSidebar}
          className={`${actionClass} ${sidebarCollapsed ? '' : 'lg:hidden'}`}
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={onOpenAssistants}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[19px] font-medium tracking-tight text-[var(--zovo-text)] transition-colors hover:bg-[var(--zovo-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zovo-muted)]"
          aria-label="Zovo assistants"
          title="Choose an assistant"
        >
          Zovo <ChevronDown className="h-4 w-4 text-[var(--zovo-muted)]" />
        </button>
        <span className="hidden min-w-0 truncate text-sm text-[var(--zovo-muted)] md:block" title={activeConversation?.title}>
          {activeConversation?.title || 'New chat'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={onOpenAssistants} className={actionClass} title="Assistants" aria-label="Open assistants">
          <Sparkles className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={actionClass}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={onOpenSettings} className={actionClass} title="Settings" aria-label="Open settings">
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
