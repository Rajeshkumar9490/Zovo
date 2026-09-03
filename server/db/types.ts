export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar: string;
  created_at: number;
  updated_at: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model: string;
  system_prompt: string;
  assistant_id: string;
  pinned: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  sources: string; // JSON string of sources
  attachments: string; // JSON string of attachments
  created_at: number;
  updated_at: number;
}

export interface AttachmentRow {
  id: string;
  user_id: string;
  conversation_id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  status: string;
  created_at: number;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  size: number;
  content: string;
  chunks: string; // JSON string of chunks
  status: string;
  created_at: number;
  updated_at: number;
}

export interface MemoryRow {
  id: string;
  user_id: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface UserSettingsRow {
  id: string;
  user_id: string;
  theme: string;
  selected_model: string;
  memory_enabled: number;
  search_enabled: number;
  temperature: number;
  system_prompt: string;
  created_at: number;
  updated_at: number;
}

export interface PromptRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  is_favorite: number;
  is_system: number;
  created_at: number;
  updated_at: number;
}

export interface AssistantRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  suggested_prompts: string; // JSON array
  avatar: string;
  created_at: number;
  updated_at: number;
}

export interface IDatabase {
  getUserById(id: string): Promise<UserRow | undefined> | UserRow | undefined;
  getUserByEmail(email: string): Promise<UserRow | undefined> | UserRow | undefined;
  createUser(user: Omit<UserRow, 'created_at' | 'updated_at'>): Promise<UserRow> | UserRow;
  updateUser(
    id: string,
    updates: Partial<Pick<UserRow, 'name' | 'avatar' | 'password_hash'>>
  ): Promise<UserRow | undefined> | UserRow | undefined;

  getConversations(userId: string, includeArchived?: boolean): Promise<ConversationRow[]> | ConversationRow[];
  getConversation(id: string, userId: string): Promise<ConversationRow | undefined> | ConversationRow | undefined;
  createConversation(
    conv: Omit<ConversationRow, 'created_at' | 'updated_at'>
  ): Promise<ConversationRow> | ConversationRow;
  updateConversation(
    id: string,
    userId: string,
    updates: Partial<ConversationRow>
  ): Promise<ConversationRow | undefined> | ConversationRow | undefined;
  deleteConversation(id: string, userId: string): Promise<boolean> | boolean;

  getMessages(conversationId: string): Promise<MessageRow[]> | MessageRow[];
  getMessage(id: string): Promise<MessageRow | undefined> | MessageRow | undefined;
  createMessage(msg: Omit<MessageRow, 'created_at' | 'updated_at'>): Promise<MessageRow> | MessageRow;
  updateMessage(id: string, content: string): Promise<MessageRow | undefined> | MessageRow | undefined;
  deleteMessage(id: string, userId: string): Promise<boolean> | boolean;

  createAttachment(att: Omit<AttachmentRow, 'created_at'>): Promise<AttachmentRow> | AttachmentRow;
  getAttachment(id: string, userId: string): Promise<AttachmentRow | undefined> | AttachmentRow | undefined;
  deleteAttachment(id: string, userId: string): Promise<boolean> | boolean;

  getDocuments(userId: string): Promise<DocumentRow[]> | DocumentRow[];
  createDocument(doc: Omit<DocumentRow, 'created_at' | 'updated_at'>): Promise<DocumentRow> | DocumentRow;
  deleteDocument(id: string, userId: string): Promise<boolean> | boolean;

  getMemories(userId: string): Promise<MemoryRow[]> | MemoryRow[];
  createMemory(userId: string, content: string): Promise<MemoryRow> | MemoryRow;
  deleteMemory(id: string, userId: string): Promise<boolean> | boolean;
  clearMemories(userId: string): Promise<void> | void;

  getUserSettings(userId: string): Promise<UserSettingsRow> | UserSettingsRow;
  updateUserSettings(userId: string, updates: Partial<UserSettingsRow>): Promise<UserSettingsRow> | UserSettingsRow;
  wipeUserData(userId: string): Promise<void> | void;

  getPrompts(userId: string): Promise<PromptRow[]> | PromptRow[];
  createPrompt(prompt: Omit<PromptRow, 'created_at' | 'updated_at'>): Promise<PromptRow> | PromptRow;
  updatePrompt(
    id: string,
    userId: string,
    updates: Partial<PromptRow>
  ): Promise<PromptRow | undefined> | PromptRow | undefined;
  deletePrompt(id: string, userId: string): Promise<boolean> | boolean;

  getAssistants(userId: string): Promise<AssistantRow[]> | AssistantRow[];
  getAssistant(id: string, userId: string): Promise<AssistantRow | undefined> | AssistantRow | undefined;
  createAssistant(assistant: Omit<AssistantRow, 'created_at' | 'updated_at'>): Promise<AssistantRow> | AssistantRow;
  updateAssistant(
    id: string,
    userId: string,
    updates: Partial<AssistantRow>
  ): Promise<AssistantRow | undefined> | AssistantRow | undefined;
  deleteAssistant(id: string, userId: string): Promise<boolean> | boolean;
  clearAssistants(userId: string): Promise<boolean> | boolean;
}
