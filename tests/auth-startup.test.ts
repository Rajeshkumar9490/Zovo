import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const originalDirectory = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zovo-startup-test-'));
process.chdir(scratch);
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-for-startup-regressions';

const { db } = await import('../server/db/index.js');
const { SupabaseDatabase } = await import('../server/db/supabase.js');
const { authenticateToken, generateToken } = await import('../server/middleware/auth.js');
const { default: conversationsRouter } = await import('../server/routes/conversations.js');

const app = express();
app.use(express.json());
app.get('/session', authenticateToken, (req: any, res) => res.json({ user: req.user }));
app.use('/conversations', conversationsRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const user = { id: 'startup-user', email: 'startup@example.com', name: 'Startup', avatar: '', password_hash: 'unused', created_at: 1, updated_at: 1 };
const token = generateToken(user);
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const conversation = { id: 'legacy-conversation', user_id: user.id, title: 'Earlier chat', model: 'gemini-3.8-flash', pinned: 0, archived: 0, assistant_id: '', system_prompt: '', created_at: 1, updated_at: 1 };

test('invalid authentication is rejected without querying the database', async t => {
  const lookup = t.mock.method(db, 'getUserById', () => { throw new Error('Unexpected database lookup'); });
  assert.equal((await fetch(base + '/session')).status, 401);
  assert.equal((await fetch(base + '/session', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal(lookup.mock.callCount(), 0);
});

test('a temporary account lookup failure returns retryable 503 without leaking provider details', async t => {
  t.mock.method(db, 'getUserById', async () => { throw new Error('synthetic-provider-secret'); });
  const response = await fetch(base + '/session', { headers });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '5');
  const body = await response.text();
  assert.match(body, /temporarily unavailable/);
  assert.doesNotMatch(body, /synthetic-provider-secret|expired/);
});

test('account existence is checked for every request so deleted users remain unauthorized', async t => {
  let checks = 0;
  t.mock.method(db, 'getUserById', async () => ++checks === 1 ? user : undefined);
  assert.equal((await fetch(base + '/session', { headers })).status, 200);
  assert.equal((await fetch(base + '/session', { headers })).status, 401);
  assert.equal(checks, 2);
});

test('Supabase authentication lookups abort after a bounded deadline instead of returning a missing user', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const requestedDeadlines: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    requestedDeadlines.push(milliseconds);
    return timeout(5);
  });
  let receivedSignal: AbortSignal | undefined;
  const client = createClient('https://supabase.test', 'synthetic-service-key', {
    global: { fetch: (async (_url, init) => {
      receivedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('synthetic-provider-secret', 'AbortError'));
        if (receivedSignal.aborted) abort();
        else receivedSignal.addEventListener('abort', abort, { once: true });
      });
    }) as typeof fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await assert.rejects(new SupabaseDatabase(client).getUserById(user.id), error => {
    assert.match(String(error), /temporarily unavailable/);
    assert.doesNotMatch(String(error), /synthetic-provider-secret/);
    return true;
  });
  assert.deepEqual(requestedDeadlines, [5000]);
  assert.equal(receivedSignal?.aborted, true);
});

test('conversation listing fetches metadata without loading all messages and normalizes legacy models', async t => {
  t.mock.method(db, 'getUserById', async () => user);
  t.mock.method(db, 'getConversations', async () => [conversation]);
  const messages = t.mock.method(db, 'getMessages', () => { throw new Error('Listing must not load message history'); });
  const response = await fetch(base + '/conversations', { headers });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.conversations.length, 1);
  assert.equal(data.conversations[0].title, conversation.title);
  assert.equal(data.conversations[0].model, 'groq/openai/gpt-oss-20b');
  assert.equal(messages.mock.callCount(), 0);
});

test('conversation creation and model updates accept only supported normalized modes', async t => {
  t.mock.method(db, 'getUserById', async () => user);
  let created: any;
  let updated: any;
  t.mock.method(db, 'createConversation', async value => { created = value; return { ...value, created_at: 1, updated_at: 1 }; });
  t.mock.method(db, 'updateConversation', async (_id, _userId, value) => { updated = value; return { ...conversation, ...value }; });
  const create = await fetch(base + '/conversations', { method: 'POST', headers, body: JSON.stringify({ model: 'gemini-3.8-flash' }) });
  assert.equal(create.status, 201);
  assert.equal(created.model, 'groq/openai/gpt-oss-20b');
  assert.equal((await create.json()).conversation.model, 'groq/openai/gpt-oss-20b');
  const update = await fetch(base + '/conversations/legacy-conversation', { method: 'PATCH', headers, body: JSON.stringify({ model: 'openrouter/free' }) });
  assert.equal(update.status, 200);
  assert.equal(updated.model, 'openrouter/free');
  assert.equal((await update.json()).conversation.model, 'openrouter/free');
});

test.after(() => {
  server.close();
  process.chdir(originalDirectory);
  fs.rmSync(scratch, { recursive: true, force: true });
});
