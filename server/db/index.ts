import 'dotenv/config';
import fs from 'fs';
import path from 'path';
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
import { getSupabaseClient, SupabaseDatabase } from './supabase.js';

export * from './types.js';

interface DatabaseSchema {
  users: UserRow[];
  conversations: ConversationRow[];
  messages: MessageRow[];
  attachments: AttachmentRow[];
  documents: DocumentRow[];
  memories: MemoryRow[];
  userSettings: UserSettingsRow[];
  prompts: PromptRow[];
  assistants: AssistantRow[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'zovo.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export class LocalDatabase implements IDatabase {
  private data: DatabaseSchema = {
    users: [],
    conversations: [],
    messages: [],
    attachments: [],
    documents: [],
    memories: [],
    userSettings: [],
    prompts: [],
    assistants: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          attachments: parsed.attachments || [],
          documents: parsed.documents || [],
          memories: parsed.memories || [],
          userSettings: parsed.userSettings || parsed.user_settings || [],
          prompts: parsed.prompts || [],
          assistants: parsed.assistants || [],
        };
      } else {
        this.seedDefaults();
        this.save();
      }
    } catch (err) {
      console.error('Error initializing database:', err);
      this.seedDefaults();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  private seedDefaults() {
    if (this.data.prompts.length === 0) {
      const now = Date.now();
      this.data.prompts = [
        {
          id: 'system-prompt-1',
          user_id: 'system',
          name: 'Production Incident Analysis',
          description: 'Analyze production incidents, screenshots, dashboards, and error logs with strict evidence-first reasoning.',
          content: 'Analyze this incident following strict evidence-first rules. 1) Identify visible facts, 2) Separate confirmed findings from hypotheses, 3) State if root cause cannot be confirmed from the evidence, 4) List what to check next.',
          category: 'Incident Analysis',
          is_favorite: 1,
          is_system: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'system-prompt-2',
          user_id: 'system',
          name: 'Dashboard Screenshot Extractor',
          description: 'Extract visible metrics, failed request counts, error percentages, and timestamps from monitoring screenshots.',
          content: 'Examine this monitoring screenshot carefully. Extract only directly visible metrics, exact error messages, failed request counts, timestamps, and impacted services without inferring unshown data.',
          category: 'Monitoring',
          is_favorite: 1,
          is_system: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'system-prompt-3',
          user_id: 'system',
          name: 'Code Reviewer & Optimizer',
          description: 'Analyze code for clean architecture, edge cases, and performance.',
          content: 'You are a principal software architect. Review the following code thoroughly for security, algorithmic efficiency, idiomatic TypeScript practices, and potential edge-case failures. Provide clear, actionable recommendations and refactored snippets.',
          category: 'Coding',
          is_favorite: 1,
          is_system: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'system-prompt-4',
          user_id: 'system',
          name: 'Executive Summary Generator',
          description: 'Distill lengthy text, transcripts, or incident postmortems into bulleted takeaways.',
          content: 'Synthesize the following incident text into a high-impact executive brief. Include: 1) One-sentence summary, 2) Measurable impact, 3) Confirmed findings, 4) Action items with clear owners, 5) Remediation steps.',
          category: 'Writing',
          is_favorite: 0,
          is_system: 1,
          created_at: now,
          updated_at: now,
        },
      ];
    }

    // Assistants list can be intentionally empty or customized by user
    if (!this.data.assistants) {
      this.data.assistants = [];
    }
  }

  // --- Users ---
  getUserById(id: string): UserRow | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): UserRow | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: Omit<UserRow, 'created_at' | 'updated_at'>): UserRow {
    const now = Date.now();
    const newUser: UserRow = {
      ...user,
      created_at: now,
      updated_at: now,
    };
    this.data.users.push(newUser);

    const defaultSettings: UserSettingsRow = {
      id: crypto.randomUUID(),
      user_id: newUser.id,
      theme: 'system',
      selected_model: 'gemini-3.8-flash',
      memory_enabled: 1,
      search_enabled: 0,
      temperature: 0.7,
      system_prompt: '',
      created_at: now,
      updated_at: now,
    };
    this.data.userSettings.push(defaultSettings);

    this.save();
    return newUser;
  }

  updateUser(id: string, updates: Partial<Pick<UserRow, 'name' | 'avatar' | 'password_hash'>>): UserRow | undefined {
    const user = this.getUserById(id);
    if (!user) return undefined;

    if (updates.name !== undefined) user.name = updates.name;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    if (updates.password_hash !== undefined) user.password_hash = updates.password_hash;
    user.updated_at = Date.now();

    this.save();
    return user;
  }

  // --- Conversations ---
  getConversations(userId: string, includeArchived = false): ConversationRow[] {
    return this.data.conversations
      .filter((c) => c.user_id === userId && (includeArchived ? true : c.archived === 0))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        return b.updated_at - a.updated_at;
      });
  }

  getConversation(id: string, userId: string): ConversationRow | undefined {
    return this.data.conversations.find((c) => c.id === id && c.user_id === userId);
  }

  createConversation(conv: Omit<ConversationRow, 'created_at' | 'updated_at'>): ConversationRow {
    const now = Date.now();
    const newConv: ConversationRow = {
      ...conv,
      created_at: now,
      updated_at: now,
    };
    this.data.conversations.push(newConv);
    this.save();
    return newConv;
  }

  updateConversation(id: string, userId: string, updates: Partial<ConversationRow>): ConversationRow | undefined {
    const conv = this.getConversation(id, userId);
    if (!conv) return undefined;

    if (updates.title !== undefined) conv.title = updates.title;
    if (updates.model !== undefined) conv.model = updates.model;
    if (updates.system_prompt !== undefined) conv.system_prompt = updates.system_prompt;
    if (updates.assistant_id !== undefined) conv.assistant_id = updates.assistant_id;
    if (updates.pinned !== undefined) conv.pinned = updates.pinned;
    if (updates.archived !== undefined) conv.archived = updates.archived;
    conv.updated_at = Date.now();

    this.save();
    return conv;
  }

  deleteConversation(id: string, userId: string): boolean {
    const idx = this.data.conversations.findIndex((c) => c.id === id && c.user_id === userId);
    if (idx === -1) return false;

    this.data.conversations.splice(idx, 1);
    this.data.messages = this.data.messages.filter((m) => m.conversation_id !== id);
    this.data.attachments = this.data.attachments.filter((a) => a.conversation_id !== id);

    this.save();
    return true;
  }

  // --- Messages ---
  getMessages(conversationId: string): MessageRow[] {
    return this.data.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => a.created_at - b.created_at);
  }

  getMessage(id: string): MessageRow | undefined {
    return this.data.messages.find((m) => m.id === id);
  }

  createMessage(msg: Omit<MessageRow, 'created_at' | 'updated_at'>): MessageRow {
    const now = Date.now();
    const newMsg: MessageRow = {
      ...msg,
      created_at: now,
      updated_at: now,
    };
    this.data.messages.push(newMsg);

    const conv = this.data.conversations.find((c) => c.id === msg.conversation_id);
    if (conv) {
      conv.updated_at = now;
    }

    this.save();
    return newMsg;
  }

  updateMessage(id: string, content: string): MessageRow | undefined {
    const msg = this.getMessage(id);
    if (!msg) return undefined;
    msg.content = content;
    msg.updated_at = Date.now();
    this.save();
    return msg;
  }

  deleteMessage(id: string, userId: string): boolean {
    const idx = this.data.messages.findIndex((m) => m.id === id && m.user_id === userId);
    if (idx === -1) return false;
    this.data.messages.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Attachments ---
  createAttachment(att: Omit<AttachmentRow, 'created_at'>): AttachmentRow {
    const newAtt: AttachmentRow = {
      ...att,
      created_at: Date.now(),
    };
    this.data.attachments.push(newAtt);
    this.save();
    return newAtt;
  }

  getAttachment(id: string, userId: string): AttachmentRow | undefined {
    return this.data.attachments.find((a) => a.id === id && a.user_id === userId);
  }

  deleteAttachment(id: string, userId: string): boolean {
    const idx = this.data.attachments.findIndex((a) => a.id === id && a.user_id === userId);
    if (idx === -1) return false;
    this.data.attachments.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Knowledge Documents ---
  getDocuments(userId: string): DocumentRow[] {
    return this.data.documents
      .filter((d) => d.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  createDocument(doc: Omit<DocumentRow, 'created_at' | 'updated_at'>): DocumentRow {
    const now = Date.now();
    const newDoc: DocumentRow = {
      ...doc,
      created_at: now,
      updated_at: now,
    };
    this.data.documents.push(newDoc);
    this.save();
    return newDoc;
  }

  deleteDocument(id: string, userId: string): boolean {
    const idx = this.data.documents.findIndex((d) => d.id === id && d.user_id === userId);
    if (idx === -1) return false;
    this.data.documents.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Memories ---
  getMemories(userId: string): MemoryRow[] {
    return this.data.memories
      .filter((m) => m.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  createMemory(userId: string, content: string): MemoryRow {
    const now = Date.now();
    const newMem: MemoryRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      content,
      created_at: now,
      updated_at: now,
    };
    this.data.memories.push(newMem);
    this.save();
    return newMem;
  }

  deleteMemory(id: string, userId: string): boolean {
    const idx = this.data.memories.findIndex((m) => m.id === id && m.user_id === userId);
    if (idx === -1) return false;
    this.data.memories.splice(idx, 1);
    this.save();
    return true;
  }

  clearMemories(userId: string): void {
    this.data.memories = this.data.memories.filter((m) => m.user_id !== userId);
    this.save();
  }

  // --- User Settings ---
  getUserSettings(userId: string): UserSettingsRow {
    let settings = this.data.userSettings.find((s) => s.user_id === userId);
    if (!settings) {
      const now = Date.now();
      settings = {
        id: crypto.randomUUID(),
        user_id: userId,
        theme: 'system',
        selected_model: 'gemini-3.8-flash',
        memory_enabled: 1,
        search_enabled: 0,
        temperature: 0.7,
        system_prompt: '',
        created_at: now,
        updated_at: now,
      };
      this.data.userSettings.push(settings);
      this.save();
    }
    return settings;
  }

  updateUserSettings(userId: string, updates: Partial<UserSettingsRow>): UserSettingsRow {
    const settings = this.getUserSettings(userId);
    if (updates.theme !== undefined) settings.theme = updates.theme;
    if (updates.selected_model !== undefined) settings.selected_model = updates.selected_model;
    if (updates.memory_enabled !== undefined) settings.memory_enabled = updates.memory_enabled;
    if (updates.search_enabled !== undefined) settings.search_enabled = updates.search_enabled;
    if (updates.temperature !== undefined) settings.temperature = updates.temperature;
    if (updates.system_prompt !== undefined) settings.system_prompt = updates.system_prompt;
    settings.updated_at = Date.now();
    this.save();
    return settings;
  }

  wipeUserData(userId: string): void {
    this.data.conversations = this.data.conversations.filter((c) => c.user_id !== userId);
    this.data.messages = this.data.messages.filter((m) => m.user_id !== userId);
    this.data.attachments = this.data.attachments.filter((a) => a.user_id !== userId);
    this.data.documents = this.data.documents.filter((d) => d.user_id !== userId);
    this.data.memories = this.data.memories.filter((m) => m.user_id !== userId);
    this.data.prompts = this.data.prompts.filter((p) => p.user_id !== userId || p.is_system === 1);
    this.data.assistants = this.data.assistants.filter((a) => a.user_id !== userId || a.user_id === 'system');
    this.save();
  }

  // --- Prompts ---
  getPrompts(userId: string): PromptRow[] {
    return this.data.prompts
      .filter((p) => p.user_id === userId || p.is_system === 1)
      .sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return b.is_favorite - a.is_favorite;
        return b.created_at - a.created_at;
      });
  }

  createPrompt(prompt: Omit<PromptRow, 'created_at' | 'updated_at'>): PromptRow {
    const now = Date.now();
    const newPrompt: PromptRow = {
      ...prompt,
      created_at: now,
      updated_at: now,
    };
    this.data.prompts.push(newPrompt);
    this.save();
    return newPrompt;
  }

  updatePrompt(id: string, userId: string, updates: Partial<PromptRow>): PromptRow | undefined {
    const prompt = this.data.prompts.find((p) => p.id === id && (p.user_id === userId || p.user_id === 'system'));
    if (!prompt || prompt.is_system === 1) return undefined;

    if (updates.name !== undefined) prompt.name = updates.name;
    if (updates.description !== undefined) prompt.description = updates.description;
    if (updates.content !== undefined) prompt.content = updates.content;
    if (updates.category !== undefined) prompt.category = updates.category;
    if (updates.is_favorite !== undefined) prompt.is_favorite = updates.is_favorite;
    prompt.updated_at = Date.now();
    this.save();
    return prompt;
  }

  deletePrompt(id: string, userId: string): boolean {
    const idx = this.data.prompts.findIndex((p) => p.id === id && p.user_id === userId && p.is_system !== 1);
    if (idx === -1) return false;
    this.data.prompts.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Assistants ---
  getAssistants(userId: string): AssistantRow[] {
    return this.data.assistants
      .filter((a) => a.user_id === userId || a.user_id === 'system')
      .sort((a, b) => b.created_at - a.created_at);
  }

  getAssistant(id: string, userId: string): AssistantRow | undefined {
    return this.data.assistants.find((a) => a.id === id && (a.user_id === userId || a.user_id === 'system'));
  }

  createAssistant(assistant: Omit<AssistantRow, 'created_at' | 'updated_at'>): AssistantRow {
    const now = Date.now();
    const newAssistant: AssistantRow = {
      ...assistant,
      created_at: now,
      updated_at: now,
    };
    this.data.assistants.push(newAssistant);
    this.save();
    return newAssistant;
  }

  updateAssistant(id: string, userId: string, updates: Partial<AssistantRow>): AssistantRow | undefined {
    const assistant = this.data.assistants.find((a) => a.id === id && a.user_id === userId);
    if (!assistant) return undefined;

    if (updates.name !== undefined) assistant.name = updates.name;
    if (updates.description !== undefined) assistant.description = updates.description;
    if (updates.instructions !== undefined) assistant.instructions = updates.instructions;
    if (updates.model !== undefined) assistant.model = updates.model;
    if (updates.suggested_prompts !== undefined) assistant.suggested_prompts = updates.suggested_prompts;
    if (updates.avatar !== undefined) assistant.avatar = updates.avatar;
    assistant.updated_at = Date.now();
    this.save();
    return assistant;
  }

  deleteAssistant(id: string, userId: string): boolean {
    const idx = this.data.assistants.findIndex(
      (a) => a.id === id && (a.user_id === userId || a.user_id === 'system')
    );
    if (idx === -1) return false;
    this.data.assistants.splice(idx, 1);
    this.save();
    return true;
  }

  clearAssistants(userId: string): boolean {
    this.data.assistants = this.data.assistants.filter(
      (a) => a.user_id !== userId && a.user_id !== 'system'
    );
    this.save();
    return true;
  }
}

// Instantiate database with Supabase if configured, or local fallback
let databaseInstance: IDatabase;

const supabase = getSupabaseClient();
if (supabase) {
  databaseInstance = new SupabaseDatabase(supabase);
} else {
  if (process.env.VERCEL) throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.');
  databaseInstance = new LocalDatabase();
}

export const db = databaseInstance;
export { UPLOADS_DIR };
