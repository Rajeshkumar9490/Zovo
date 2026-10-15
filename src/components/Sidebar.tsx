import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Archive, BookOpen, BookMarked, ChevronDown, Edit2, LogIn, LogOut, MoreHorizontal,
  PanelLeft, Pin, Search, Settings, Sparkles, SquarePen, Trash2, UserCheck, UserPlus, X,
} from 'lucide-react';
import { Conversation } from '../types.js';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenKnowledge: () => void;
  onOpenPrompts: () => void;
  onOpenAssistants: () => void;
  onOpenSettings: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  conversations, activeConversation, onSelectConversation, onNewChat, onDeleteConversation,
  onRenameConversation, onTogglePin, onToggleArchive, isOpen, onClose, onOpenKnowledge,
  onOpenPrompts, onOpenAssistants, onOpenSettings, isCollapsed = false, onToggleCollapse,
}: SidebarProps) {
  const { user, isGuest, logout, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [conversationMenuTop, setConversationMenuTop] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!accountMenuOpen && !conversationMenuId) return;
    const closeOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
      if (!conversationMenuRef.current?.contains(event.target as Node)) setConversationMenuId(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountMenuOpen(false); setConversationMenuId(null); }
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen, conversationMenuId]);

  useEffect(() => {
    if (!isOpen || window.matchMedia('(min-width: 1024px)').matches) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    asideRef.current?.querySelector<HTMLElement>('button')?.focus();
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = asideRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, [isOpen]);

  const displayedConversations = useMemo(() => conversations.filter(
    conversation => !conversation.archived && conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  ), [conversations, searchQuery]);

  const closeOnMobile = () => { if (window.innerWidth < 1024) onClose(); };
  const openWorkspacePanel = (open: () => void) => { setAccountMenuOpen(false); open(); closeOnMobile(); };
  const saveRename = (id: string) => {
    if (editTitle.trim()) onRenameConversation(id, editTitle.trim());
    setEditingId(null);
  };
  const displayName = !isGuest && user?.name && user.name !== 'Guest' ? user.name : 'Guest';
  const initial = displayName.charAt(0).toUpperCase() || 'G';
  const rowClass = 'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-[var(--zovo-text)] transition-colors hover:bg-[var(--zovo-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--zovo-muted)]';
  const menuItemClass = 'flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-[var(--zovo-text)] hover:bg-[var(--zovo-hover)] focus-visible:outline-2 focus-visible:outline-[var(--zovo-muted)]';

  return (
    <>
      {isOpen && <button type="button" onClick={onClose} aria-label="Close sidebar" className="fixed inset-0 z-30 bg-black/45 lg:hidden" />}
      <aside
        ref={asideRef}
        aria-label="Chat sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[min(280px,calc(100vw-48px))] flex-col border-r border-[var(--zovo-border)] bg-[var(--zovo-sidebar)] text-[var(--zovo-text)] transition-[transform,visibility] duration-200 lg:w-[280px] ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'} ${isCollapsed ? 'lg:invisible lg:-translate-x-full' : 'lg:visible lg:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <span className="text-[20px] font-semibold tracking-tight">Zovo</span>
          <button
            onClick={() => { if (window.innerWidth >= 1024 && onToggleCollapse) onToggleCollapse(); else onClose(); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--zovo-muted)] hover:bg-[var(--zovo-hover)] hover:text-[var(--zovo-text)] focus-visible:outline-2 focus-visible:outline-[var(--zovo-muted)]"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Workspace" className="space-y-0.5 px-3 pb-4">
          <button onClick={() => { onNewChat(); closeOnMobile(); }} className={rowClass}>
            <SquarePen className="h-[18px] w-[18px] shrink-0" /> New chat
          </button>
          <button onClick={() => setSearchOpen(open => !open)} className={rowClass} aria-expanded={searchOpen} aria-controls="sidebar-chat-search">
            <Search className="h-[18px] w-[18px] shrink-0" /> Search chats
          </button>
          {searchOpen && <div id="sidebar-chat-search" className="relative py-1">
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); } }}
              placeholder="Search your chats"
              aria-label="Search your chats"
              className="h-10 w-full rounded-lg border border-[var(--zovo-border)] bg-[var(--zovo-bg)] px-3 pr-9 text-sm text-[var(--zovo-text)] placeholder:text-[var(--zovo-muted)] focus:outline-2 focus:outline-[var(--zovo-muted)]"
            />
            <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} aria-label="Close chat search" className="absolute right-0 top-1 flex h-10 w-9 items-center justify-center text-[var(--zovo-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>}
          <button onClick={() => openWorkspacePanel(onOpenKnowledge)} className={rowClass}>
            <BookOpen className="h-[18px] w-[18px] shrink-0" /> Library
          </button>
        </nav>

        <div onScroll={() => setConversationMenuId(null)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          <button onClick={() => setChatsOpen(open => !open)} aria-expanded={chatsOpen} aria-controls="sidebar-recent-chats" className="mb-2 flex min-h-9 w-full items-center justify-between px-3 text-left text-[13px] text-[var(--zovo-muted)] hover:text-[var(--zovo-text)]">
            Recents <ChevronDown className={`h-3.5 w-3.5 transition-transform ${chatsOpen ? '' : '-rotate-90'}`} />
          </button>
          {chatsOpen && <div id="sidebar-recent-chats" className="space-y-0.5">
            {displayedConversations.length === 0 && <p className="px-3 py-2 text-sm text-[var(--zovo-muted)]">{searchQuery ? 'No matching chats' : 'Your chats will appear here'}</p>}
            {displayedConversations.map(conversation => {
              const current = activeConversation?.id === conversation.id;
              return <div key={conversation.id} className={`group relative flex min-h-10 items-center rounded-lg lg:min-h-9 ${current ? 'bg-[var(--zovo-hover)]' : 'hover:bg-[var(--zovo-hover)]'}`}>
                {editingId === conversation.id ? <input
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') saveRename(conversation.id); if (event.key === 'Escape') setEditingId(null); }}
                  onBlur={() => saveRename(conversation.id)}
                  autoFocus
                  aria-label="Chat title"
                  className="mx-2 h-8 min-w-0 flex-1 rounded border border-[var(--zovo-border)] bg-[var(--zovo-bg)] px-2 text-sm text-[var(--zovo-text)] focus:outline-2 focus:outline-[var(--zovo-muted)]"
                /> : <>
                  <button
                    onClick={() => { onSelectConversation(conversation.id); closeOnMobile(); }}
                    aria-current={current ? 'page' : undefined}
                    title={conversation.title}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-3 pr-1 text-left text-[15px] text-[var(--zovo-text)] focus-visible:outline-2 focus-visible:outline-[var(--zovo-muted)] lg:min-h-9 lg:text-[14px]"
                  >
                    <span className="truncate">{conversation.title}</span>
                    {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-[var(--zovo-muted)]" aria-label="Pinned" />}
                  </button>
                  <div ref={conversationMenuId === conversation.id ? conversationMenuRef : undefined} className="shrink-0">
                    <button
                      onClick={event => {
                        setConversationMenuTop(Math.max(8, Math.min((window.visualViewport?.height || window.innerHeight) - 184, event.currentTarget.getBoundingClientRect().bottom + 4)));
                        setConversationMenuId(previous => previous === conversation.id ? null : conversation.id);
                      }}
                      aria-label={`Actions for ${conversation.title}`}
                      aria-expanded={conversationMenuId === conversation.id}
                      aria-controls={`chat-actions-${conversation.id}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] focus-visible:outline-2 focus-visible:outline-[var(--zovo-muted)] lg:h-9 lg:w-8 ${conversationMenuId === conversation.id ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100'}`}
                    ><MoreHorizontal className="h-[18px] w-[18px]" /></button>
                    {conversationMenuId === conversation.id && <div id={`chat-actions-${conversation.id}`} role="group" aria-label="Chat actions" style={{ top: conversationMenuTop }} className="fixed right-2 z-50 w-48 rounded-xl border border-[var(--zovo-border)] bg-[var(--zovo-surface)] p-1 shadow-xl">
                      <button onClick={() => { setEditTitle(conversation.title); setEditingId(conversation.id); setConversationMenuId(null); }} className={menuItemClass}><Edit2 className="h-4 w-4" /> Rename</button>
                      <button onClick={() => { onTogglePin(conversation.id); setConversationMenuId(null); }} className={menuItemClass}><Pin className="h-4 w-4" /> {conversation.pinned ? 'Unpin chat' : 'Pin chat'}</button>
                      <button onClick={() => { onToggleArchive(conversation.id); setConversationMenuId(null); }} className={menuItemClass}><Archive className="h-4 w-4" /> Archive</button>
                      <button onClick={() => { onDeleteConversation(conversation.id); setConversationMenuId(null); }} className={`${menuItemClass} text-red-400`}><Trash2 className="h-4 w-4" /> Delete</button>
                    </div>}
                  </div>
                </>}
              </div>;
            })}
          </div>}
        </div>

        <div ref={accountMenuRef} className="relative shrink-0 border-t border-[var(--zovo-border)] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {accountMenuOpen && <div role="group" aria-label="Account options" className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-[var(--zovo-border)] bg-[var(--zovo-surface)] p-1.5 shadow-xl">
            <div className="mb-1 border-b border-[var(--zovo-border)] px-3 py-2">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--zovo-muted)]">{isGuest ? 'Guest session' : user?.email}</p>
            </div>
            <button onClick={() => openWorkspacePanel(onOpenSettings)} className={menuItemClass}><Settings className="h-4 w-4" /> Settings</button>
            <button onClick={() => openWorkspacePanel(onOpenPrompts)} className={menuItemClass}><BookMarked className="h-4 w-4" /> Prompt library</button>
            <button onClick={() => openWorkspacePanel(onOpenAssistants)} className={menuItemClass}><Sparkles className="h-4 w-4" /> Assistants</button>
            {isGuest ? <>
              <button onClick={() => { setAccountMenuOpen(false); openAuthModal('login'); closeOnMobile(); }} className={menuItemClass}><LogIn className="h-4 w-4" /> Sign in</button>
              <button onClick={() => { setAccountMenuOpen(false); openAuthModal('register'); closeOnMobile(); }} className={menuItemClass}><UserPlus className="h-4 w-4" /> Create account</button>
            </> : <>
              <button onClick={() => { setAccountMenuOpen(false); openAuthModal('login'); closeOnMobile(); }} className={menuItemClass}><UserCheck className="h-4 w-4" /> Switch account</button>
              <button onClick={() => { setAccountMenuOpen(false); logout(); closeOnMobile(); }} className={menuItemClass}><LogOut className="h-4 w-4" /> Log out</button>
            </>}
          </div>}
          <button onClick={() => setAccountMenuOpen(open => !open)} aria-expanded={accountMenuOpen} aria-label="Account and settings" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[var(--zovo-hover)] focus-visible:outline-2 focus-visible:outline-[var(--zovo-muted)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--zovo-hover)] text-xs font-medium">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              <span className="block text-xs text-[var(--zovo-muted)]">{isGuest ? 'Guest session' : 'Personal account'}</span>
            </span>
            <MoreHorizontal className="h-[18px] w-[18px] text-[var(--zovo-muted)]" />
          </button>
        </div>
      </aside>
    </>
  );
}
