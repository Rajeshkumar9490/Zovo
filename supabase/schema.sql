-- ============================================================================
-- Zovo AI Platform — Supabase PostgreSQL Database Schema
-- ============================================================================

-- Enable pgcrypto extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'system',
    selected_model TEXT NOT NULL DEFAULT 'gemini-3.7-flash',
    memory_enabled INTEGER NOT NULL DEFAULT 1,
    search_enabled INTEGER NOT NULL DEFAULT 0,
    temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    system_prompt TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT uq_user_settings_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 3. ASSISTANTS TABLE
CREATE TABLE IF NOT EXISTS assistants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- can be 'system' or a user UUID
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3.7-flash',
    suggested_prompts TEXT NOT NULL DEFAULT '[]', -- JSON array string
    avatar TEXT NOT NULL DEFAULT 'bot',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON assistants(user_id);

-- 4. PROMPTS TABLE
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- can be 'system' or a user UUID
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON prompts(is_favorite);

-- 5. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3.7-flash',
    system_prompt TEXT NOT NULL DEFAULT '',
    assistant_id TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(pinned DESC);

-- 6. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'model' | 'system'
    content TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]', -- JSON string of citation objects
    attachments TEXT NOT NULL DEFAULT '[]', -- JSON string of attachment objects
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- 7. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON attachments(conversation_id);

-- 8. KNOWLEDGE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    content TEXT NOT NULL,
    chunks TEXT NOT NULL DEFAULT '[]', -- JSON string array of text chunks
    status TEXT NOT NULL DEFAULT 'ready',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- 9. MEMORIES TABLE
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);

-- ============================================================================
-- INITIAL SEED DATA (System Prompts and Assistants)
-- ============================================================================

INSERT INTO prompts (id, user_id, name, description, content, category, is_favorite, is_system, created_at, updated_at)
VALUES
  (
    'system-prompt-1',
    'system',
    'Code Reviewer & Optimizer',
    'Analyze code for clean architecture, edge cases, and performance.',
    'You are a principal software architect. Review the following code thoroughly for security, algorithmic efficiency, idiomatic TypeScript practices, and potential edge-case failures. Provide clear, actionable recommendations and refactored snippets.',
    'Coding',
    1,
    1,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'system-prompt-2',
    'system',
    'Executive Summary Generator',
    'Distill lengthy text, transcripts, or reports into bulleted takeaways.',
    'Synthesize the following text into a high-impact executive brief. Include: 1) One-sentence thesis, 2) Key decisions & findings (bullet points), 3) Action items with clear owners, 4) Potential risks/blindspots.',
    'Writing',
    1,
    1,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'system-prompt-3',
    'system',
    'Socratic Tutor',
    'Guide deep learning by asking probing questions rather than giving immediate answers.',
    'You are a warm, rigorous mentor. Guide me to understand complex topics through the Socratic method. Break down assumptions, ask thought-provoking questions, and provide feedback as I answer.',
    'Learning',
    0,
    1,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'system-prompt-4',
    'system',
    'Data Analysis & Insights',
    'Extract statistical patterns, trends, and anomalies from raw data.',
    'Analyze the provided dataset or table. Identify key statistical metrics, trends over time, outliers or anomalies, and formulate 3 actionable hypotheses based on the numbers.',
    'Analysis',
    0,
    1,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO assistants (id, user_id, name, description, instructions, model, suggested_prompts, avatar, created_at, updated_at)
VALUES
  (
    'system-assistant-default',
    'system',
    'Zovo General Assistant',
    'A helpful, intelligent companion powered by Gemini 3.7 Flash.',
    'You are Zovo, a modern, highly capable AI assistant built with precision and clarity. Provide thoughtful, well-structured, and accurate responses.',
    'gemini-3.7-flash',
    '["Brainstorm ideas for an AI product", "Help me debug a React component", "Draft an email to stakeholders"]',
    'bot',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'system-assistant-coding',
    'system',
    'Principal Engineer',
    'Expert in TypeScript, system architecture, cloud infrastructure, and security.',
    'You are a staff engineer at a top tech company. Provide clean, secure, performant code with comments explaining design choices. Avoid unnecessary abstractions.',
    'gemini-3.7-flash',
    '["Architect a high-scale SSE streaming server", "Refactor this function to reduce complexity", "Explain event-driven microservices"]',
    'code',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. SUPABASE STORAGE BUCKET CONFIGURATION
-- ============================================================================
-- Creates private bucket 'zovo-attachments' for user attachments & files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'zovo-attachments',
  'zovo-attachments',
  false,
  26214400, -- 25MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- ============================================================================
-- 11. PERMISSIONS & ROLE GRANTS (For Server Backend Access)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Ensure RLS is disabled so the server backend has direct query access
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memories DISABLE ROW LEVEL SECURITY;
