import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ChatProvider, useChat } from './context/ChatContext.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatHeader } from './components/ChatHeader.js';
import { MessageList } from './components/MessageList.js';
import { EmptyState } from './components/EmptyState.js';
import { ChatInput } from './components/ChatInput.js';
import { LandingPage } from './components/LandingPage.js';
import { AuthModal } from './components/AuthModal.js';
import { KnowledgeModal } from './components/KnowledgeModal.js';
import { PromptLibraryModal } from './components/PromptLibraryModal.js';
import { AssistantModal } from './components/AssistantModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { AssistantItem } from './types.js';

function MainApp() {
  const {
    isAuthenticated,
    isLoading,
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
      const timer = setTimeout(() => {
        sendMessage(promptToSend);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, pendingInitialPrompt, sendMessage]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      demoLogin();
    }
  }, [isLoading, isAuthenticated, demoLogin]);

  // If session is loading
  if (isLoading || !isAuthenticated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F6F7FA] dark:bg-[#0A0A0A] text-zinc-700 dark:text-zinc-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-zinc-500">STARTING ZOVO...</span>
        </div>
      </div>
    );
  }

  const handleNewChat = () => {
    createConversation('New Conversation', activeModel);
  };

  const handleSelectAssistant = (assistant: AssistantItem) => {
    createConversation(`Chat with ${assistant.name}`, assistant.model, assistant.id);
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F6F7FA] text-zinc-800 dark:bg-[#0A0A0A] dark:text-zinc-300 font-sans selection:bg-zinc-300 dark:selection:bg-zinc-800 selection:text-zinc-900 dark:selection:text-zinc-100 transition-colors">
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
        onClose={() => setSidebarOpen(false)}
        onOpenKnowledge={() => setKnowledgeModalOpen(true)}
        onOpenPrompts={() => setPromptsModalOpen(true)}
        onOpenAssistants={() => setAssistantsModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full lg:pl-64 relative bg-[#F8F9FC] dark:bg-[#090A0F] transition-colors overflow-hidden">
        {/* Deep ambient backdrop glow in dark mode */}
        <div className="hidden dark:block absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-[#101F48]/40 via-[#090A0F]/60 to-[#090A0F]" />

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
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenKnowledge={() => setKnowledgeModalOpen(true)}
          onOpenPrompts={() => setPromptsModalOpen(true)}
          onOpenAssistants={() => setAssistantsModalOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />

        {/* Content Area: When empty, centered together; when messages exist, standard feed + bottom input */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center px-4 max-w-4xl w-full mx-auto pb-16">
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
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              onSendMessage={sendMessage}
              onRegenerate={regenerateResponse}
              onEditAndResend={editAndResendMessage}
            />

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

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        reason={authModalReason}
      />

      <KnowledgeModal
        isOpen={knowledgeModalOpen}
        onClose={() => setKnowledgeModalOpen(false)}
      />

      <PromptLibraryModal
        isOpen={promptsModalOpen}
        onClose={() => setPromptsModalOpen(false)}
        onUsePrompt={(content) => {
          sendMessage(content);
        }}
      />

      <AssistantModal
        isOpen={assistantsModalOpen}
        onClose={() => setAssistantsModalOpen(false)}
        onSelectAssistant={handleSelectAssistant}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
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
