import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// Keep fixtures out of the repository's data file.
const original = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zovo-test-'));
process.chdir(scratch);
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-for-regression-suite';
const { app } = await import('../server/app.js');
const { usageLimit } = await import('../server/middleware/limits.js');
const nativeFetch = globalThis.fetch;
let hostedAnswer = 'New answer';
let capturedHosted: any;
process.env.GROQ_API_KEY = 'synthetic-test';
globalThis.fetch = async (input, init) => {
 if (String(input) === 'https://api.groq.com/openai/v1/chat/completions') {
  capturedHosted = JSON.parse(String(init?.body));
  return new Response(`data: ${JSON.stringify({model:'openai/gpt-oss-20b',choices:[{delta:{content:hostedAnswer},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
 }
 return nativeFetch(input, init);
};

const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
async function request(url: string, token?: string, body?: unknown) {
 return fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('guest sessions are isolated and cannot read each other’s conversations', async () => {
 const first = await (await request('/api/auth/demo', undefined, {})).json();
 const second = await (await request('/api/auth/demo', undefined, {})).json();
 assert.notEqual(first.user.id, second.user.id);
 const conv = await (await request('/api/conversations', first.token, { title: 'Private' })).json();
 assert.equal((await request(`/api/conversations/${conv.conversation.id}`, second.token)).status, 404);
 assert.equal((await request('/api/chat', second.token, { conversationId: conv.conversation.id, message: 'Hello' })).status, 404);
});

test('usage counters enforce limits and keep identities separate', async () => {
 const limited = express();
 limited.use((req: any, _res, next) => { req.user = { id: req.headers['x-user'], email: 'test@guest.zovo.ai' }; next(); });
 limited.post('/', usageLimit('regression', 2, 60), (_req, res) => { res.json({ ok: true }); });
 const listener = limited.listen(0, '127.0.0.1');
 await new Promise<void>(resolve => listener.once('listening', resolve));
 const url = `http://127.0.0.1:${(listener.address() as any).port}`;
 try {
  for (let i = 0; i < 2; i++) assert.equal((await fetch(url, { method: 'POST', headers: { 'x-user': 'one' } })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-user': 'one' } })).status, 429);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-user': 'two' } })).status, 200);
 } finally { listener.close(); }
});

test('editing branches persisted history without changing the original', async () => {
 const { db } = await import('../server/db/index.js');
 hostedAnswer = 'New answer';
 const guest = await (await request('/api/auth/demo', undefined, {})).json();
 const original = await db.createConversation({ id: 'branch-test', user_id: guest.user.id, title: 'Original', model: 'gemini-3.7-flash', pinned: 0, archived: 0, assistant_id: '', system_prompt: '' });
 for (const [id, role, content] of [['earlier', 'user', 'Keep this'], ['edit-target', 'user', 'Old question'], ['old-answer', 'assistant', 'Old answer']]) {
  await db.createMessage({ id, role, content, conversation_id: original.id, user_id: guest.user.id, sources: '[]', attachments: '[]' });
 }
 const response = await request('/api/chat', guest.token, { conversationId: original.id, beforeMessageId: 'edit-target', message: 'Edited question' });
 assert.equal(response.status, 200);
 const stream = await response.text();
 const event = JSON.parse(stream.match(/event: conversation\ndata: (.+)/)![1]);
 const history = await db.getMessages(event.id);
 assert.deepEqual(history.map(m => m.content), ['Keep this', 'Edited question', 'New answer']);
 assert.deepEqual((await db.getMessages(original.id)).map(m => m.content), ['Keep this', 'Old question', 'Old answer']);
 assert.match(stream, /event: userMessage/);
});

test('uploaded text reaches the model, saved instructions work, and stream metadata persists', async () => {
 hostedAnswer = 'MANGO-742';
 const guest = await (await request('/api/auth/demo', undefined, {})).json();
 const other = await (await request('/api/auth/demo', undefined, {})).json();
 const file = new FormData();
 file.append('file', new Blob(['Launch code MANGO-742; budget 18400'], {type:'text/plain'}), 'facts.txt');
 const upload = await fetch(base+'/api/attachments/upload', {method:'POST', headers:{Authorization:`Bearer ${guest.token}`}, body:file});
 assert.equal(upload.status,201);
 const { attachment } = await upload.json();
 const conversation = await (await request('/api/conversations', guest.token, {title:'Saved instructions',systemPrompt:'Always preserve the exact launch code.'})).json();
 const response = await request('/api/chat', guest.token, {conversationId:conversation.conversation.id,message:'Read the file',attachments:[{id:attachment.id}]});
 const stream = await response.text();
 assert.match(JSON.stringify(capturedHosted.messages), /MANGO-742/);
 assert.match(capturedHosted.messages[0].content, /Always preserve the exact launch code/);
 assert.match(stream,/event: model/);
 assert.match(stream,/event: complete/);
 assert.equal(capturedHosted.model,'openai/gpt-oss-20b');
 const cross = await request('/api/chat', other.token, {message:'Read it',attachments:[{id:attachment.id}]});
 assert.equal(cross.status,400);
 const emptyPrompt = await request('/api/chat',guest.token,{message:'',attachments:[{id:attachment.id}]});
 assert.equal(emptyPrompt.status,200); await emptyPrompt.text();
 const missing = await request('/api/chat', guest.token, {message:'From my missing document, give the release date.'});
 assert.match(await missing.text(), /No matching uploaded document/);
 const badPassword = await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',name:'Test',password:'x'})});
 assert.equal(badPassword.status,400);
});

test('API catalog and assistant settings accept only the two active hosted models', async () => {
 const models = await (await request('/api/models')).json();
 assert.deepEqual(models.models.map((m: any) => m.id), ['groq/openai/gpt-oss-20b','openrouter/free']);
 const guest = await (await request('/api/auth/demo', undefined, {})).json();
 const settings = await (await request('/api/settings', guest.token)).json();
 assert.equal(settings.settings.selectedModel, 'groq/openai/gpt-oss-20b');
 for (const model of ['groq/openai/gpt-oss-20b', 'openrouter/free']) {
  const res = await request('/api/assistants', guest.token, {name:'Test', instructions:'Answer clearly', model});
  assert.equal(res.status, 201); assert.equal((await res.json()).assistant.model, model);
 }
 assert.equal((await request('/api/chat', guest.token, {message:'hello',model:'gemini-3.8-flash'})).status,400);
 assert.equal((await request('/api/assistants', guest.token, {name:'Test',instructions:'test',model:'gemini-3.8-flash'})).status,400);
});

test.after(() => { globalThis.fetch = nativeFetch; server.close(); process.chdir(original); fs.rmSync(scratch, { recursive: true, force: true }); });
