export type ThemeMode = 'light' | 'dark' | 'system';

export type GeminiModelId = 
  | 'gemini-3.7-flash'
  | 'gemini-3.8-flash'
  | 'gemini-3.6-flash'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3-flash-preview'
  | 'groq/openai/gpt-oss-20b'
  | 'openrouter/free';

export interface ModelOption {
  id: GeminiModelId;
  name: string;
  badge: string;
  description: string;
  isPro?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: number;
}

export interface GroundingSource {
  title?: string;
  uri: string;
  snippet?: string;
  kind?: 'web' | 'document';
  documentId?: string;
  page?: number;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
  storagePath?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: GroundingSource[];
  attachments?: MessageAttachment[];
  createdAt: number;
  updatedAt?: number;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  error?: string;
  actualModel?: string;
  notices?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  model: GeminiModelId;
  systemPrompt?: string;
  assistantId?: string;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview?: string;
  messageCount?: number;
}

export interface KnowledgeDocument {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  status: 'ready' | 'processing' | 'error';
  createdAt: number;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptItem {
  id: string;
  userId: string;
  name: string;
  description: string;
  content: string;
  category: string;
  isFavorite: boolean;
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AssistantItem {
  id: string;
  userId: string;
  name: string;
  description: string;
  instructions: string;
  model: GeminiModelId;
  suggestedPrompts: string[];
  avatar?: string;
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: ThemeMode;
  selectedModel: GeminiModelId;
  memoryEnabled: boolean;
  searchEnabled: boolean;
  temperature: number;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}
