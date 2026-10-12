import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Conversation, Message, GeminiModelId, MessageAttachment, GroundingSource } from '../types.js';
import { api, getStoredToken } from '../lib/api.js';
import { useAuth } from './AuthContext.js';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  activeModel: GeminiModelId;
  setActiveModel: (model: GeminiModelId) => void;
  searchEnabled: boolean;
  setSearchEnabled: (enabled: boolean) => void;
  pendingAttachments: MessageAttachment[];
  addPendingAttachment: (att: MessageAttachment) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (title?: string, model?: GeminiModelId, assistantId?: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePinConversation: (id: string) => Promise<void>;
  toggleArchiveConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, customAttachments?: MessageAttachment[]) => Promise<void>;
  stopGeneration: () => void;
  regenerateResponse: (assistantMessageId: string) => Promise<void>;
  editAndResendMessage: (userMessageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadConversations: (search?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const [activeModel, setActiveModel] = useState<GeminiModelId>('gemini-3.8-flash');
  const [searchEnabled, setSearchEnabled] = useState<boolean>(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async (search?: string) => {
    if (!isAuthenticated) return;
    setIsLoadingConversations(true);
    try {
      const res = await api.getConversations(search);
      setConversations(res.conversations);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
    }
  }, [isAuthenticated, loadConversations]);

  const selectConversation = async (id: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await api.getConversation(id);
      setActiveConversation(res.conversation);
      setMessages(res.messages);
      setActiveModel(res.conversation.model || 'gemini-3.8-flash');
    } catch (err) {
      console.error('Failed to fetch conversation messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const createConversation = async (title = 'New Conversation', model = activeModel, assistantId?: string) => {
    const res = await api.createConversation({ title, model, assistantId });
    setConversations((prev) => [res.conversation, ...prev]);
    setActiveConversation(res.conversation);
    setMessages([]);
    setActiveModel(res.conversation.model || model);
    return res.conversation;
  };

  const deleteConversation = async (id: string) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversation?.id === id) {
      setActiveConversation(null);
      setMessages([]);
    }
  };

  const renameConversation = async (id: string, title: string) => {
    const res = await api.updateConversation(id, { title });
    setConversations((prev) => prev.map((c) => (c.id === id ? res.conversation : c)));
    if (activeConversation?.id === id) {
      setActiveConversation(res.conversation);
    }
  };

  const togglePinConversation = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const res = await api.updateConversation(id, { pinned: !conv.pinned });
    setConversations((prev) =>
      prev
        .map((c) => (c.id === id ? res.conversation : c))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    );
    if (activeConversation?.id === id) {
      setActiveConversation(res.conversation);
    }
  };

  const toggleArchiveConversation = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const res = await api.updateConversation(id, { archived: !conv.archived });
    setConversations((prev) => prev.map((c) => (c.id === id ? res.conversation : c)));
  };

  const addPendingAttachment = (att: MessageAttachment) => {
    setPendingAttachments((prev) => [...prev, att]);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const clearPendingAttachments = () => {
    setPendingAttachments([]);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  const sendMessage = async (content: string, customAttachments?: MessageAttachment[], beforeMessageId?: string) => {
    if (isStreaming || abortControllerRef.current) return;
    const attachmentsToSend = customAttachments || pendingAttachments;
    if (!content.trim() && attachmentsToSend.length === 0) return;
    clearPendingAttachments();

    // Optimistically add user message
    const tempUserMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: tempUserMsgId,
      conversationId: activeConversation?.id || '',
      userId: 'me',
      role: 'user',
      content: content.trim(),
      attachments: attachmentsToSend,
      createdAt: Date.now(),
      status: 'complete',
    };

    // Optimistically add pending assistant message
    const tempAssistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: tempAssistantMsgId,
      conversationId: activeConversation?.id || '',
      userId: 'gemini',
      role: 'assistant',
      content: '',
      sources: [],
      attachments: [],
      createdAt: Date.now(),
      status: 'streaming',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const deadline = setTimeout(() => controller.abort(new Error('The response timed out. Please retry.')), 100000);

    try {
      const token = getStoredToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId: activeConversation?.id,
          beforeMessageId,
          message: content.trim(),
          model: activeModel,
          enableSearch: searchEnabled,
          assistantId: activeConversation?.assistantId,
          systemPrompt: activeConversation?.systemPrompt,
          attachments: attachmentsToSend.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream available');

      const decoder = new TextDecoder();
      let buffer = '';
      let branchConversationId: string | undefined;
      let accumulatedAssistantText = '';
      let discoveredSources: GroundingSource[] = [];
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event:\s*(.+)$/m);
          const dataMatch = block.match(/^data:\s*(.+)$/m);

          const eventName = eventMatch ? eventMatch[1].trim() : 'message';
          const eventData = dataMatch ? JSON.parse(dataMatch[1]) : {};

          if (eventName === 'conversation') {
            if (eventData.isNew) {
              if (beforeMessageId) branchConversationId = eventData.id;
              const newConv: Conversation = {
                id: eventData.id,
                userId: 'me',
                title: eventData.title,
                model: eventData.model,
                pinned: false,
                archived: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              setActiveConversation(newConv);
              setConversations((prev) => [newConv, ...prev]);
            }
          } else if (eventName === 'userMessage') {
            setMessages(prev => prev.map(m => m.id === tempUserMsgId ? { ...m, id: eventData.id } : m));
          } else if (eventName === 'model') {
            setMessages(prev => prev.map(m => m.id === tempAssistantMsgId ? { ...m, actualModel: eventData.actualModel } : m));
          } else if (eventName === 'warning') {
            setMessages(prev => prev.map(m => m.id === tempAssistantMsgId ? { ...m, notices: [...new Set([...(m.notices || []), eventData.message])] } : m));
          } else if (eventName === 'chunk') {
            accumulatedAssistantText += eventData.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantMsgId
                  ? { ...m, content: accumulatedAssistantText, status: 'streaming' }
                  : m
              )
            );
          } else if (eventName === 'sources') {
            discoveredSources = eventData;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantMsgId
                  ? { ...m, sources: discoveredSources }
                  : m
              )
            );
          } else if (eventName === 'complete') {
            completed = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantMsgId
                  ? {
                      ...m,
                      id: eventData.id || m.id,
                      content: eventData.content || accumulatedAssistantText,
                      sources: eventData.sources || discoveredSources,
                      actualModel: eventData.actualModel,
                      notices: eventData.notices || m.notices,
                      status: 'complete',
                    }
                  : m
              )
            );
          } else if (eventName === 'titleUpdate') {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === eventData.conversationId ? { ...c, title: eventData.title } : c
              )
            );
            setActiveConversation((prev) =>
              prev && prev.id === eventData.conversationId ? { ...prev, title: eventData.title } : prev
            );
          } else if (eventName === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantMsgId
                  ? {
                      ...m,
                      status: 'error',
                      error: eventData.message || 'Error occurred during generation',
                    }
                  : m
              )
            );
          }
        }
      }
      if (!completed) setMessages(prev => prev.map(m => m.id === tempAssistantMsgId && m.status === 'streaming' ? { ...m, status: 'error', error: 'The response ended before it completed. Please retry.' } : m));
      if (branchConversationId && completed) {
        const branch = await api.getConversation(branchConversationId);
        setMessages(branch.messages);
        setActiveConversation(branch.conversation);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === tempAssistantMsgId ? { ...m, status: 'complete', notices: [...(m.notices || []), 'Generation stopped. This partial response is not saved.'] } : m));
      } else {
        console.error('Chat error:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMsgId
              ? {
                  ...m,
                  status: 'error',
                  error: err?.message || 'Zovo could not complete the response. Please try again.',
                }
              : m
          )
        );
      }
    } finally {
      clearTimeout(deadline);
      setIsStreaming(false);
      abortControllerRef.current = null;
      loadConversations();
    }
  };

  const regenerateResponse = async (assistantMessageId: string) => {
    const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (assistantIndex <= 0) return;

    const previousUserMsg = messages[assistantIndex - 1];
    if (previousUserMsg.role !== 'user') return;

    // Remove the previous user message and assistant message, then resend cleanly
    setMessages((prev) => prev.slice(0, assistantIndex - 1));
    await sendMessage(previousUserMsg.content, previousUserMsg.attachments, previousUserMsg.id);
  };

  const editAndResendMessage = async (userMessageId: string, newContent: string) => {
    const userIndex = messages.findIndex((m) => m.id === userMessageId);
    if (userIndex === -1) return;

    const currentMsg = messages[userIndex];
    // Truncate messages after this point
    setMessages((prev) => prev.slice(0, userIndex));
    await sendMessage(newContent, currentMsg.attachments, currentMsg.id);
  };

  const deleteMessage = async (messageId: string) => {
    await api.deleteMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        messages,
        isLoadingConversations,
        isLoadingMessages,
        isStreaming,
        activeModel,
        setActiveModel,
        searchEnabled,
        setSearchEnabled,
        pendingAttachments,
        addPendingAttachment,
        removePendingAttachment,
        clearPendingAttachments,
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
        deleteMessage,
        loadConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
