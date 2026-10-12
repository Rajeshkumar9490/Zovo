import { User, Conversation, Message, UserSettings, KnowledgeDocument, PromptItem, AssistantItem, MemoryItem, GeminiModelId } from '../types.js';

const TOKEN_KEY = 'zovo_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async register(email: string, password: string, name: string) {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async demoLogin() {
    return request<{ token: string; user: User }>('/api/auth/demo', {
      method: 'POST',
    });
  },

  async getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Conversations
  async getConversations(search?: string, archived = false) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (archived) params.append('archived', 'true');
    return request<{ conversations: Conversation[] }>(`/api/conversations?${params.toString()}`);
  },

  async createConversation(data: { title?: string; model?: GeminiModelId; systemPrompt?: string; assistantId?: string }) {
    return request<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getConversation(id: string) {
    return request<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`);
  },

  async updateConversation(id: string, data: Partial<Conversation>) {
    return request<{ conversation: Conversation }>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteConversation(id: string) {
    return request<{ success: boolean }>(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  // Messages
  async editMessage(id: string, content: string) {
    return request<{ message: Message }>(`/api/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  async deleteMessage(id: string) {
    return request<{ success: boolean }>(`/api/messages/${id}`, {
      method: 'DELETE',
    });
  },

  // Attachments
  async uploadAttachment(file: File, conversationId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);

    return request<{
      attachment: {
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        dataUrl?: string;
        base64?: string;
        textPreview?: string;
      };
    }>('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Knowledge Base
  async getDocuments() {
    return request<{ documents: KnowledgeDocument[] }>('/api/knowledge');
  },

  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ document: KnowledgeDocument }>('/api/knowledge/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteDocument(id: string) {
    return request<{ success: boolean }>(`/api/knowledge/${id}`, {
      method: 'DELETE',
    });
  },

  // Prompts
  async getPrompts() {
    return request<{ prompts: PromptItem[] }>('/api/prompts');
  },

  async createPrompt(data: { name: string; description?: string; content: string; category?: string; isFavorite?: boolean }) {
    return request<{ prompt: PromptItem }>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePrompt(id: string, data: Partial<PromptItem>) {
    return request<{ prompt: PromptItem }>(`/api/prompts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deletePrompt(id: string) {
    return request<{ success: boolean }>(`/api/prompts/${id}`, {
      method: 'DELETE',
    });
  },

  // Assistants
  async getAssistants() {
    return request<{ assistants: AssistantItem[] }>('/api/assistants');
  },

  async createAssistant(data: {
    name: string;
    description?: string;
    instructions: string;
    model: GeminiModelId;
    suggestedPrompts?: string[];
    avatar?: string;
  }) {
    return request<{ assistant: AssistantItem }>('/api/assistants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAssistant(id: string, data: Partial<AssistantItem>) {
    return request<{ assistant: AssistantItem }>(`/api/assistants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAssistant(id: string) {
    return request<{ success: boolean }>(`/api/assistants/${id}`, {
      method: 'DELETE',
    });
  },

  async clearAllAssistants() {
    return request<{ success: boolean }>('/api/assistants', {
      method: 'DELETE',
    });
  },

  // Settings
  async getSettings() {
    return request<{ settings: UserSettings }>('/api/settings');
  },

  async updateSettings(data: Partial<UserSettings>) {
    return request<{ settings: UserSettings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async wipeData() {
    return request<{ success: boolean }>('/api/settings/wipe-data', {
      method: 'POST',
    });
  },

  // Memories
  async getMemories() {
    return request<{ memories: MemoryItem[] }>('/api/memories');
  },

  async addMemory(content: string) {
    return request<{ memory: MemoryItem }>('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async deleteMemory(id: string) {
    return request<{ success: boolean }>(`/api/memories/${id}`, {
      method: 'DELETE',
    });
  },

  async clearMemories() {
    return request<{ success: boolean }>('/api/memories', {
      method: 'DELETE',
    });
  },

  // Voice
  async transcribeAudio(audioBlob: Blob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-recording.webm');
    return request<{ transcript: string }>('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });
  },
};
