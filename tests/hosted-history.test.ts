import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';

const originalDirectory = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zovo-hosted-history-'));
process.chdir(scratch);
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-for-hosted-history';
process.env.GROQ_API_KEY = 'synthetic-test';

const { db } = await import('../server/db/index.js');
const { generateToken } = await import('../server/middleware/auth.js');
const { default: chatRouter } = await import('../server/routes/chat.js');
const nativeFetch = globalThis.fetch;
let providerCalls = 0;
let capturedRequest: any;
globalThis.fetch = async (input, init) => {
  if (String(input) !== 'https://api.groq.com/openai/v1/chat/completions') return nativeFetch(input, init);
  providerCalls++;
  capturedRequest = JSON.parse(String(init?.body));
  return new Response(`data: ${JSON.stringify({ model: 'openai/gpt-oss-20b', choices: [{ delta: { content: 'Continued answer' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
};

const app = express();
app.use(express.json());
app.use('/chat', chatRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

async function createUser() {
  const id = crypto.randomUUID();
  return db.createUser({ id, email: `${id}@example.com`, name: 'History', avatar: '', password_hash: 'unused' });
}

async function storedAttachment(userId: string, filename: string, mimeType: string, content: Buffer) {
  const id = crypto.randomUUID();
  const file = path.join(scratch, `${id}-${filename}`);
  fs.writeFileSync(file, content);
  const stored = await db.createAttachment({ id, user_id: userId, conversation_id: '', filename, mime_type: mimeType, size: content.length, storage_path: file, status: 'ready' });
  return { id: stored.id, filename: stored.filename, mimeType: stored.mime_type, size: stored.size };
}

function readablePdf(): Buffer {
  const stream = 'BT /F1 12 Tf 50 750 Td (Release code PDF-842; budget 19200) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

function send(token: string, body: unknown) {
  return fetch(base + '/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('current image attachments are rejected before creating a conversation or persisting messages', async () => {
  const user = await createUser();
  const image = await storedAttachment(user.id, 'current.png', 'image/png', Buffer.from('synthetic-image'));
  const callsBefore = providerCalls;
  const response = await send(generateToken(user), {
    message: 'Describe this image',
    // Client metadata cannot disguise the actual stored image type.
    attachments: [{ ...image, mimeType: 'text/plain' }],
  });
  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.match((await response.json()).error, /text and readable documents/);
  assert.deepEqual(await db.getConversations(user.id), []);
  assert.equal(providerCalls, callsBefore);
});

test('legacy image chats continue with text and PDF evidence while preserving all saved history', async () => {
  const user = await createUser();
  const conversation = await db.createConversation({ id: crypto.randomUUID(), user_id: user.id, title: 'Legacy images', model: 'gemini-3.8-flash', pinned: 0, archived: 0, assistant_id: '', system_prompt: '' });
  const firstImage = await storedAttachment(user.id, 'old.png', 'image/png', Buffer.from('synthetic-old-image'));
  const secondImage = await storedAttachment(user.id, 'another.png', 'image/png', Buffer.from('synthetic-another-image'));
  const text = await storedAttachment(user.id, 'facts.txt', 'text/plain', Buffer.from('Launch code TEXT-731'));
  const pdf = await storedAttachment(user.id, 'facts.pdf', 'application/pdf', readablePdf());
  for (const message of [
    { role: 'user', content: '', attachments: [firstImage] },
    { role: 'assistant', content: 'Earlier image discussion', attachments: [] },
    { role: 'user', content: 'Earlier document facts', attachments: [{ id: secondImage.id }, text] },
  ]) await db.createMessage({ id: crypto.randomUUID(), conversation_id: conversation.id, user_id: user.id, role: message.role, content: message.content, sources: '[]', attachments: JSON.stringify(message.attachments) });
  const savedHistory = structuredClone(await db.getMessages(conversation.id));
  const response = await send(generateToken(user), { conversationId: conversation.id, message: 'Continue using these documents.', attachments: [pdf] });
  assert.equal(response.status, 200);
  const stream = await response.text();
  assert.match(stream, /event: warning\ndata: .*Earlier images were left out/);
  assert.match(stream, /event: complete/);
  assert.doesNotMatch(stream, /event: error/);
  const context = JSON.stringify(capturedRequest.messages);
  assert.match(context, /TEXT-731/);
  assert.match(context, /PDF-842/);
  assert.match(context, /Page 1/);
  assert.doesNotMatch(context, /synthetic-old-image|synthetic-another-image/);
  assert(capturedRequest.messages.every((message: any) => typeof message.content === 'string' && message.content.trim()));
  const stored = await db.getMessages(conversation.id);
  assert.deepEqual(stored.slice(0, savedHistory.length), savedHistory);
  assert.equal(stored.at(-1)?.content, 'Continued answer');
});

test.after(() => {
  globalThis.fetch = nativeFetch;
  server.close();
  process.chdir(originalDirectory);
  fs.rmSync(scratch, { recursive: true, force: true });
});
