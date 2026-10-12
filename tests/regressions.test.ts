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
 const { getGeminiClient } = await import('../server/services/gemini.js');
 process.env.GEMINI_API_KEY = 'test-placeholder';
 const ai = getGeminiClient();
 (ai.models as any).generateContentStream = async function* () { yield { text: 'New answer' }; };
 (ai.models as any).generateContent = async () => ({ text: 'Branched conversation' });
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
 const { getGeminiClient } = await import('../server/services/gemini.js');
 const ai = getGeminiClient();
 let captured: any;
 (ai.models as any).generateContentStream = async function* (params: any) { captured = params; yield { text: 'MANGO-742', candidates: [{finishReason:'STOP'}] }; };
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
 assert.match(JSON.stringify(captured.contents), /MANGO-742/);
 assert.match(captured.config.systemInstruction, /Always preserve the exact launch code/);
 assert.match(stream,/event: model/);
 assert.match(stream,/event: complete/);
 assert.equal(captured.config.thinkingConfig.thinkingLevel,'MEDIUM');
 const cross = await request('/api/chat', other.token, {message:'Read it',attachments:[{id:attachment.id}]});
 assert.equal(cross.status,400);
 const emptyPrompt = await request('/api/chat',guest.token,{message:'',attachments:[{id:attachment.id}]});
 assert.equal(emptyPrompt.status,200); await emptyPrompt.text();
 const badPassword = await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',name:'Test',password:'x'})});
 assert.equal(badPassword.status,400);
});

test.after(() => { server.close(); process.chdir(original); fs.rmSync(scratch, { recursive: true, force: true }); });
