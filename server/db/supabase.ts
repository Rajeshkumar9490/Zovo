import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  UserRow,
  ConversationRow,
  MessageRow,
  AttachmentRow,
  DocumentRow,
  MemoryRow,
  UserSettingsRow,
  PromptRow,
  AssistantRow,
  IDatabase,
} from './types.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export class SupabaseDatabase implements IDatabase {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  // --- Users ---
  async getUserById(id: string): Promise<UserRow | undefined> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();

    // An unavailable database must not look like a deleted account to auth.
    if (error) throw new Error('Account verification is temporarily unavailable.');
    if (!data) return undefined;
    return data as UserRow;
  }

  async getUserByEmail(email: string): Promise<UserRow | undefined> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error || !data) return undefined;
    return data as UserRow;
  }

  async createUser(user: Omit<UserRow, 'created_at' | 'updated_at'>): Promise<UserRow> {
    const now = Date.now();
    const newUser: UserRow = {
      ...user,
      created_at: now,
      updated_at: now,
    };

    const { error: userError } = await this.client.from('users').insert(newUser);
    if (userError) {
      throw new Error(`Failed to create user in Supabase: ${userError.message}`);
    }

    // Default settings
    const defaultSettings: UserSettingsRow = {
      id: crypto.randomUUID(),
      user_id: newUser.id,
      theme: 'system',
      selected_model: 'groq/openai/gpt-oss-20b',
      memory_enabled: 1,
      search_enabled: 0,
      temperature: 0.7,
      system_prompt: '',
      created_at: now,
      updated_at: now,
    };

    await this.client.from('user_settings').insert(defaultSettings);

    return newUser;
  }

  async updateUser(
    id: string,
    updates: Partial<Pick<UserRow, 'name' | 'avatar' | 'password_hash'>>
  ): Promise<UserRow | undefined> {
    const now = Date.now();
    const payload: any = { ...updates, updated_at: now };

    const { data, error } = await this.client
      .from('users')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return data as UserRow;
  }

  // --- Conversations ---
  async getConversations(userId: string, includeArchived = false): Promise<ConversationRow[]> {
    let query = this.client
      .from('conversations')
      .select('*')
      .eq('user_id', userId);

    if (!includeArchived) {
      query = query.eq('archived', 0);
    }

    const { data, error } = await query
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return data as ConversationRow[];
  }

  async getConversation(id: string, userId: string): Promise<ConversationRow | undefined> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return undefined;
    return data as ConversationRow;
  }

  async createConversation(
    conv: Omit<ConversationRow, 'created_at' | 'updated_at'>
  ): Promise<ConversationRow> {
    const now = Date.now();
    const newConv: ConversationRow = {
      ...conv,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('conversations').insert(newConv);
    if (error) throw new Error(`Supabase createConversation error: ${error.message}`);
    return newConv;
  }

  async updateConversation(
    id: string,
    userId: string,
    updates: Partial<ConversationRow>
  ): Promise<ConversationRow | undefined> {
    const payload: any = { ...updates, updated_at: Date.now() };

    const { data, error } = await this.client
      .from('conversations')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return data as ConversationRow;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  // --- Messages ---
  async getMessages(conversationId: string): Promise<MessageRow[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data as MessageRow[];
  }

  async getMessage(id: string): Promise<MessageRow | undefined> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return undefined;
    return data as MessageRow;
  }

  async createMessage(msg: Omit<MessageRow, 'created_at' | 'updated_at'>): Promise<MessageRow> {
    const now = Date.now();
    const newMsg: MessageRow = {
      ...msg,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('messages').insert(newMsg);
    if (error) throw new Error(`Supabase createMessage error: ${error.message}`);

    // Update conversation updated_at
    await this.client
      .from('conversations')
      .update({ updated_at: now })
      .eq('id', msg.conversation_id);

    return newMsg;
  }

  async updateMessage(id: string, content: string): Promise<MessageRow | undefined> {
    const now = Date.now();
    const { data, error } = await this.client
      .from('messages')
      .update({ content, updated_at: now })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return data as MessageRow;
  }

  async deleteMessage(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  // --- Attachments ---
  async createAttachment(att: Omit<AttachmentRow, 'created_at'>): Promise<AttachmentRow> {
    const newAtt: AttachmentRow = {
      ...att,
      created_at: Date.now(),
    };

    const { error } = await this.client.from('attachments').insert(newAtt);
    if (error) throw new Error(`Supabase createAttachment error: ${error.message}`);
    return newAtt;
  }

  async getAttachment(id: string, userId: string): Promise<AttachmentRow | undefined> {
    const { data, error } = await this.client
      .from('attachments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return undefined;
    return data as AttachmentRow;
  }

  async deleteAttachment(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('attachments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  // --- Documents ---
  async getDocuments(userId: string): Promise<DocumentRow[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as DocumentRow[];
  }

  async createDocument(doc: Omit<DocumentRow, 'created_at' | 'updated_at'>): Promise<DocumentRow> {
    const now = Date.now();
    const newDoc: DocumentRow = {
      ...doc,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('documents').insert(newDoc);
    if (error) throw new Error(`Supabase createDocument error: ${error.message}`);
    return newDoc;
  }

  async deleteDocument(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  // --- Memories ---
  async getMemories(userId: string): Promise<MemoryRow[]> {
    const { data, error } = await this.client
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as MemoryRow[];
  }

  async createMemory(userId: string, content: string): Promise<MemoryRow> {
    const now = Date.now();
    const newMem: MemoryRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      content,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('memories').insert(newMem);
    if (error) throw new Error(`Supabase createMemory error: ${error.message}`);
    return newMem;
  }

  async deleteMemory(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  async clearMemories(userId: string): Promise<void> {
    await this.client.from('memories').delete().eq('user_id', userId);
  }

  // --- User Settings ---
  async getUserSettings(userId: string): Promise<UserSettingsRow> {
    const { data, error } = await this.client
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data as UserSettingsRow;
    }

    // Initialize if not present
    const now = Date.now();
    const newSettings: UserSettingsRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      theme: 'system',
      selected_model: 'groq/openai/gpt-oss-20b',
      memory_enabled: 1,
      search_enabled: 0,
      temperature: 0.7,
      system_prompt: '',
      created_at: now,
      updated_at: now,
    };

    await this.client.from('user_settings').insert(newSettings);
    return newSettings;
  }

  async updateUserSettings(
    userId: string,
    updates: Partial<UserSettingsRow>
  ): Promise<UserSettingsRow> {
    const existing = await this.getUserSettings(userId);
    const payload = {
      ...updates,
      updated_at: Date.now(),
    };

    const { data, error } = await this.client
      .from('user_settings')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error || !data) return existing;
    return data as UserSettingsRow;
  }

  async wipeUserData(userId: string): Promise<void> {
    // User conversations and documents cascade via foreign keys or manual delete
    await Promise.all([
      this.client.from('conversations').delete().eq('user_id', userId),
      this.client.from('documents').delete().eq('user_id', userId),
      this.client.from('memories').delete().eq('user_id', userId),
      this.client.from('attachments').delete().eq('user_id', userId),
      this.client.from('prompts').delete().eq('user_id', userId).neq('is_system', 1),
      this.client.from('assistants').delete().eq('user_id', userId).neq('user_id', 'system'),
    ]);
  }

  // --- Prompts ---
  async getPrompts(userId: string): Promise<PromptRow[]> {
    const { data, error } = await this.client
      .from('prompts')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.1`)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as PromptRow[];
  }

  async createPrompt(prompt: Omit<PromptRow, 'created_at' | 'updated_at'>): Promise<PromptRow> {
    const now = Date.now();
    const newPrompt: PromptRow = {
      ...prompt,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('prompts').insert(newPrompt);
    if (error) throw new Error(`Supabase createPrompt error: ${error.message}`);
    return newPrompt;
  }

  async updatePrompt(
    id: string,
    userId: string,
    updates: Partial<PromptRow>
  ): Promise<PromptRow | undefined> {
    const payload = { ...updates, updated_at: Date.now() };

    const { data, error } = await this.client
      .from('prompts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .neq('is_system', 1)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return data as PromptRow;
  }

  async deletePrompt(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('prompts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .neq('is_system', 1);

    return !error;
  }

  // --- Assistants ---
  async getAssistants(userId: string): Promise<AssistantRow[]> {
    const { data, error } = await this.client
      .from('assistants')
      .select('*')
      .or(`user_id.eq.${userId},user_id.eq.system`)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as AssistantRow[];
  }

  async getAssistant(id: string, userId: string): Promise<AssistantRow | undefined> {
    const { data, error } = await this.client
      .from('assistants')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${userId},user_id.eq.system`)
      .maybeSingle();

    if (error || !data) return undefined;
    return data as AssistantRow;
  }

  async createAssistant(
    assistant: Omit<AssistantRow, 'created_at' | 'updated_at'>
  ): Promise<AssistantRow> {
    const now = Date.now();
    const newAssistant: AssistantRow = {
      ...assistant,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.client.from('assistants').insert(newAssistant);
    if (error) throw new Error(`Supabase createAssistant error: ${error.message}`);
    return newAssistant;
  }

  async updateAssistant(
    id: string,
    userId: string,
    updates: Partial<AssistantRow>
  ): Promise<AssistantRow | undefined> {
    const payload = { ...updates, updated_at: Date.now() };

    const { data, error } = await this.client
      .from('assistants')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return data as AssistantRow;
  }

  async deleteAssistant(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('assistants')
      .delete()
      .eq('id', id)
      .or(`user_id.eq.${userId},user_id.eq.system`);

    return !error;
  }

  async clearAssistants(userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('assistants')
      .delete()
      .or(`user_id.eq.${userId},user_id.eq.system`);

    return !error;
  }
}
