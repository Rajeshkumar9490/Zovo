import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  BookOpen,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  SquarePen,
  Archive,
  BookMarked,
  Sparkles,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  UserCheck,
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
}

export function Sidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onToggleArchive,
  isOpen,
  onClose,
  onOpenKnowledge,
  onOpenPrompts,
  onOpenAssistants,
  onOpenSettings,
}: SidebarProps) {
  const { user, isGuest, logout, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'zovo-beta'>('chat');
  const [chatsOpen, setChatsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [accountMenuOpen]);

  // Sample default conversations if user doesn't have any yet
  const defaultChats: Array<{ id: string; title: string; pinned?: boolean }> = [
    { id: 'sample-1', title: 'Enhancing Personal Projects With AI' },
    { id: 'sample-2', title: 'Setting Up Your Personal Assistant' },
    { id: 'sample-3', title: 'Beginner Home Strength Workout Plan' },
  ];

  const displayedConversations = useMemo(() => {
    if (conversations.length > 0) {
      return conversations.filter(
        (c) => !c.archived && c.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return defaultChats.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) as any[];
  }, [conversations, searchQuery]);

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const displayName = !isGuest && user?.name && user.name !== 'Guest' ? user.name : 'Guest';
  const initial = displayName.charAt(0).toUpperCase() || 'G';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#F0F2F6] text-zinc-800 border-r border-zinc-200/90 dark:bg-[#090A0F] dark:text-zinc-200 dark:border-white/5 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header: macOS Traffic Lights & Panel Toggle */}
        <div className="pt-3 px-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-xs cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-xs cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-xs cursor-pointer" />
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors p-1 rounded-md cursor-pointer"
            title="Toggle sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Top Switcher: Chat / Zovo Beta */}
        <div className="px-3 pt-1 pb-2">
          <div className="p-1 rounded-full bg-zinc-200/80 dark:bg-[#121319] flex items-center justify-between transition-colors">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-[#22242D] dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => {
                setActiveTab('zovo-beta');
                onOpenAssistants();
              }}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'zovo-beta'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-[#22242D] dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <span>Zovo</span>
              <span className="text-[9px] uppercase tracking-wider font-bold text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-950/60 px-1 rounded">
                BETA
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-8.5 pr-3 py-1.5 rounded-full text-xs bg-white border border-zinc-200 text-zinc-900 placeholder-zinc-400 dark:bg-[#121319] dark:border-white/5 dark:text-zinc-200 dark:placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 transition-colors shadow-2xs"
            />
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="px-3 space-y-1 pb-3">
          {/* New Chat Button */}
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200/80 shadow-2xs dark:border-transparent dark:bg-[#121319] dark:hover:bg-[#1A1B24] dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <SquarePen className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
            <span>New chat</span>
          </button>

          {/* Library Button */}
          <button
            onClick={onOpenKnowledge}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-[#121319] text-xs font-medium transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Library</span>
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4">
          {/* Chats Collapsible Section */}
          <div className="space-y-1">
            <button
              onClick={() => setChatsOpen(!chatsOpen)}
              className="w-full flex items-center justify-between text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 py-1 cursor-pointer"
            >
              <span>Chats</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform ${
                  chatsOpen ? 'rotate-0' : '-rotate-90'
                }`}
              />
            </button>

            {chatsOpen && (
              <div className="space-y-0.5">
                {displayedConversations.map((c) => {
                  const isCurrent = activeConversation?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectConversation(c.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-zinc-200/90 text-zinc-900 font-medium dark:bg-[#181922] dark:text-white'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-[#121319]'
                      }`}
                    >
                      {editingId === c.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(c.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => handleSaveRename(c.id)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-1.5 py-0.5 rounded text-xs bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                        />
                      ) : (
                        <span className="truncate pr-2">{c.title}</span>
                      )}

                      {/* Quick action buttons on hover */}
                      {!editingId && (
                        <div
                          className="hidden group-hover:flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditTitle(c.title);
                            }}
                            className="p-0.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded cursor-pointer"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteConversation(c.id)}
                            className="p-0.5 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 rounded cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Account Profile Footer */}
        <div className="p-3 border-t border-zinc-200/80 bg-[#E8EAEF] dark:border-white/5 dark:bg-[#090A0F] transition-colors relative" ref={accountMenuRef}>
          {/* Account Popover Menu */}
          {accountMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 rounded-2xl bg-white dark:bg-[#121319] border border-zinc-200 dark:border-white/10 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{user?.email || 'guest@zovo.ai'}</p>
                <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  isGuest
                    ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                }`}>
                  {isGuest ? 'Guest Session' : 'Active Account'}
                </span>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors text-left cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Settings & Preferences</span>
                </button>

                {isGuest ? (
                  <>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        openAuthModal('login');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors text-left cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Sign In</span>
                    </button>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        openAuthModal('register');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors font-medium text-left cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Sign Up / Create Account</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        openAuthModal('login');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors text-left cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Switch Account</span>
                    </button>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      <span>Log Out</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-zinc-200/70 dark:hover:bg-[#121319] transition-colors cursor-pointer group"
            title="Account & Settings options"
          >
            {/* User Avatar Circle */}
            <div className={`w-7 h-7 rounded-full ${isGuest ? 'bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-[#7C3AED] text-white'} font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs border border-white/20`}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                {isGuest ? 'Guest Session' : 'Active Account'}
              </p>
            </div>
            <Settings className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-200 transition-colors shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
}

