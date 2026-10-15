import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ChatProvider, useChat } from './context/ChatContext.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatHeader } from './components/ChatHeader.js';
import { EmptyState } from './components/EmptyState.js';
import { ChatInput } from './components/ChatInput.js';
import { AssistantItem } from './types.js';

const MessageList = lazy(() => import('./components/MessageList.js').then(module => ({default: module.MessageList})));
const LandingPage = lazy(() => import('./components/LandingPage.js').then(module => ({default: module.LandingPage})));
const AuthModal = lazy(() => import('./components/AuthModal.js').then(module => ({default: module.AuthModal})));
const KnowledgeModal = lazy(() => import('./components/KnowledgeModal.js').then(module => ({default: module.KnowledgeModal})));
const PromptLibraryModal = lazy(() => import('./components/PromptLibraryModal.js').then(module => ({default: module.PromptLibraryModal})));
const AssistantModal = lazy(() => import('./components/AssistantModal.js').then(module => ({default: module.AssistantModal})));
const SettingsModal = lazy(() => import('./components/SettingsModal.js').then(module => ({default: module.SettingsModal})));

function MainApp() {
  const {
    isAuthenticated,
    isLoading,
    startupError: sessionError,
    retrySession,
    demoLogin,
    authModalOpen,
    authModalMode,
    authModalReason,
    openAuthModal,
    closeAuthModal,
  } = useAuth();
  const {
    conversations,
    activeConversation,
    messages,
    isStreaming,
    activeModel,
    setActiveModel,
    searchEnabled,
    setSearchEnabled,
    pendingAttachments,
    addPendingAttachment,
    removePendingAttachment,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation,
    toggleArchiveConversation,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    editAndResendMessage,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [promptsModalOpen, setPromptsModalOpen] = useState(false);
  const [assistantsModalOpen, setAssistantsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(null);
  const initialPromptSentRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && pendingInitialPrompt && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      const promptToSend = pendingInitialPrompt;
      setPendingInitialPrompt(null);
      // Small timeout to allow conversation initialization
      void sendMessage(promptToSend);
    }
  }, [isAuthenticated, pendingInitialPrompt, sendMessage]);

  const [startupError, setStartupError] = useState<string | null>(null);
  const startDemo = async (prompt?: string) => {
    setStartupError(null);
    try {
      await demoLogin();
      if (prompt) { initialPromptSentRef.current = false; setPendingInitialPrompt(prompt); }
    } catch {
      setStartupError('Zovo could not start. Please try again or sign in.');
    }
  };

  // If session is loading
  if (isLoading) {
    return (
      <div className="zovo-app h-dvh w-full flex items-center justify-center bg-[var(--zovo-bg)] text-[var(--zovo-text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--zovo-text)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--zovo-muted)]">Starting Zovo…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && sessionError) {
    return <div className="zovo-app min-h-dvh flex items-center justify-center bg-[var(--zovo-bg)] p-6 text-[var(--zovo-text)]">
      <div role="alert" className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Let’s reconnect</h1>
        <p className="text-sm text-zinc-500">{sessionError}</p>
        <button onClick={retrySession} className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium">Try again</button>
      </div>
    </div>;
  }

  if (!isAuthenticated) {
    return <>
      <Suspense fallback={<div className="min-h-dvh bg-[var(--zovo-bg)]" />}><LandingPage onOpenAuth={openAuthModal} onStartDemo={startDemo} /></Suspense>
      {startupError && <div role="alert" className="fixed bottom-16 inset-x-4 mx-auto max-w-lg rounded-xl bg-red-950 text-white p-4 text-center">
        {startupError} <button onClick={() => startDemo()} className="underline ml-2">Retry</button>
      </div>}
      {authModalOpen && <Suspense fallback={null}><AuthModal isOpen onClose={closeAuthModal} initialMode={authModalMode} reason={authModalReason} /></Suspense>}
    </>;
  }

  const handleNewChat = () => {
    createConversation('New Conversation', activeModel);
  };

  const handleSelectAssistant = (assistant: AssistantItem) => {
    createConversation(`Chat with ${assistant.name}`, assistant.model, assistant.id);
  };

  return (
    <div className="zovo-app h-dvh w-full flex overflow-hidden bg-[var(--zovo-bg)] text-[var(--zovo-text)] font-sans transition-colors">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={selectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onTogglePin={togglePinConversation}
        onToggleArchive={toggleArchiveConversation}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(collapsed => !collapsed)}
        onClose={() => setSidebarOpen(false)}
        onOpenKnowledge={() => setKnowledgeModalOpen(true)}
        onOpenPrompts={() => setPromptsModalOpen(true)}
        onOpenAssistants={() => setAssistantsModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Main Chat Workspace */}
      <div className={`zovo-workspace flex-1 flex flex-col min-w-0 h-full relative bg-[var(--zovo-bg)] transition-[padding] duration-200 overflow-hidden ${sidebarCollapsed ? 'lg:pl-0' : 'lg:pl-[280px]'}`}>
        <ChatHeader
          activeConversation={activeConversation}
          messages={messages}
          activeModel={activeModel}
          onSelectModel={setActiveModel}
          searchEnabled={searchEnabled}
          onToggleSearch={setSearchEnabled}
          onTogglePin={() => activeConversation && togglePinConversation(activeConversation.id)}
          onRename={(title) => activeConversation && renameConversation(activeConversation.id, title)}
          onDelete={() => activeConversation && deleteConversation(activeConversation.id)}
          onToggleSidebar={() => { setSidebarOpen(!sidebarOpen); setSidebarCollapsed(false); }}
          sidebarCollapsed={sidebarCollapsed}
          onOpenKnowledge={() => setKnowledgeModalOpen(true)}
          onOpenPrompts={() => setPromptsModalOpen(true)}
          onOpenAssistants={() => setAssistantsModalOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />

        {sessionError && <div role="status" className="relative z-10 mx-4 mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
          {sessionError} <button onClick={retrySession} className="underline ml-2">Retry connection</button>
        </div>}

        {/* Content Area: When empty, centered together; when messages exist, standard feed + bottom input */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center px-4 max-w-[832px] w-full mx-auto pb-12 sm:pb-16">
            <EmptyState onSelectPrompt={sendMessage} />
            <div className="w-full mt-4">
              <ChatInput
                onSendMessage={sendMessage}
                isStreaming={isStreaming}
                onStopGeneration={stopGeneration}
                activeModel={activeModel}
                onSelectModel={setActiveModel}
                searchEnabled={searchEnabled}
                onToggleSearch={setSearchEnabled}
                pendingAttachments={pendingAttachments}
                onAddAttachment={addPendingAttachment}
                onRemoveAttachment={removePendingAttachment}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Message Feed */}
            <Suspense fallback={<div role="status" className="flex-1 p-6 text-sm text-zinc-500">Loading messages…</div>}>
              <MessageList
                messages={messages}
                isStreaming={isStreaming}
                onSendMessage={sendMessage}
                onRegenerate={regenerateResponse}
                onEditAndResend={editAndResendMessage}
              />
            </Suspense>

            {/* Chat Input */}
            <ChatInput
              onSendMessage={sendMessage}
              isStreaming={isStreaming}
              onStopGeneration={stopGeneration}
              activeModel={activeModel}
              onSelectModel={setActiveModel}
              searchEnabled={searchEnabled}
              onToggleSearch={setSearchEnabled}
              pendingAttachments={pendingAttachments}
              onAddAttachment={addPendingAttachment}
              onRemoveAttachment={removePendingAttachment}
            />
          </>
        )}
      </div>

      {/* Load each dialog only when opened. */}
      <Suspense fallback={null}>
        {authModalOpen && <AuthModal
          isOpen={authModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
          reason={authModalReason}
        />}

        {knowledgeModalOpen && <KnowledgeModal
          isOpen={knowledgeModalOpen}
          onClose={() => setKnowledgeModalOpen(false)}
        />}

        {promptsModalOpen && <PromptLibraryModal
          isOpen={promptsModalOpen}
          onClose={() => setPromptsModalOpen(false)}
          onUsePrompt={(content) => {
            sendMessage(content);
          }}
        />}

        {assistantsModalOpen && <AssistantModal
          isOpen={assistantsModalOpen}
          onClose={() => setAssistantsModalOpen(false)}
          onSelectAssistant={handleSelectAssistant}
        />}

        {settingsModalOpen && <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
        />}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <MainApp />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
