import test from 'node:test';
import assert from 'node:assert/strict';
import { providerConfigured, streamHostedChat } from '../server/services/providers.js';

function streamResponse(chunks: string[]) {
  return new Response(new ReadableStream({start(c) {for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk)); c.close();}}));
}
const oldKey = process.env.OPENROUTER_API_KEY;
test('hosted modes reject missing keys and unsupported search before transmitting', async () => {
  delete process.env.OPENROUTER_API_KEY;
  let calls = 0; const request = (async () => { calls++; return new Response(); }) as typeof fetch;
  assert.equal(providerConfigured('openrouter/free'), false);
  await assert.rejects(streamHostedChat({model: 'openrouter/free', messages: [], onChunk() {}}, request), /not configured/);
  process.env.OPENROUTER_API_KEY = 'synthetic-test';
  await assert.rejects(streamHostedChat({model: 'openrouter/free', enableSearch: true, messages: [], onChunk() {}}, request), /Turn search off/);
  assert.equal(calls, 0);
});
test('OpenRouter sends only free routing and parses split SSE while reporting actual model', async () => {
  process.env.OPENROUTER_API_KEY = 'synthetic-test';
  const output: string[] = []; const models: string[] = [];
  const request = (async (url: any, init: any) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(init.body); assert.equal(body.model, 'openrouter/free');
    assert.equal(body.models, undefined); assert.equal(body.plugins, undefined);
    assert.match(body.messages[1].content, /MANGO-742/);
    return streamResponse(['data: {"model":"example/model:free","choices":[{"delta":{"content":"Hel', 'lo 🌍"}}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n']);
  }) as typeof fetch;
  const answer = await streamHostedChat({model: 'openrouter/free', messages: [{role: 'user', content: 'Read this', attachments: [{mimeType: 'text/plain', textContent: 'MANGO-742'}]}], onChunk: c => output.push(c), onModel: m => models.push(m)}, request);
  assert.equal(answer, 'Hello 🌍'); assert.equal(output.join(''), answer); assert.deepEqual(models, ['openrouter/example/model:free']);
});
test('interrupted or length-limited hosted responses never count as completed answers', async () => {
  for (const tail of ['', 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n']) {
    await assert.rejects(streamHostedChat({model: 'openrouter/free', messages: [], onChunk() {}}, (async () => streamResponse(['data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'+tail])) as typeof fetch), /interrupted|length limit/);
  }
});
test('hosted provider errors do not expose returned credentials or switch to a paid model', async () => {
  let count = 0;
  await assert.rejects(streamHostedChat({model: 'openrouter/free', messages: [], onChunk() {}}, (async () => {count++; return new Response('secret-provider-debug', {status: 429});}) as typeof fetch), /usage limit/);
  assert.equal(count, 1);
  await assert.rejects(streamHostedChat({model: 'openrouter/free', messages: [{role: 'user', content: 'Describe', attachments: [{mimeType: 'image/png', base64: 'AA=='}]}], onChunk() {}}, (async () => {count++; return new Response();}) as typeof fetch), /Upload a readable document instead of an image/);
  assert.equal(count, 1);
});
test.after(() => {if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey;});

test('Groq uses its selected model and preserves zero temperature and provider cancellation', async () => {
  const previous = process.env.GROQ_API_KEY; process.env.GROQ_API_KEY = 'synthetic-test';
  try {
    const controller = new AbortController();
    let actual = '';
    const request = (async (url: any, init: any) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(JSON.parse(init.body).model, 'openai/gpt-oss-20b');
      assert.equal(JSON.parse(init.body).temperature, 0);
      assert.equal(init.signal.aborted, false);
      return streamResponse(['data: {"model":"openai/gpt-oss-20b","choices":[{"delta":{"content":"4"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n']);
    }) as typeof fetch;
    assert.equal(await streamHostedChat({model: 'groq/openai/gpt-oss-20b', messages: [{role:'user', content:'2+2'}], temperature:0, signal:controller.signal, onChunk() {}, onModel:m => {actual=m;}}, request), '4');
    assert.equal(actual, 'groq/openai/gpt-oss-20b');
    controller.abort(new Error('Stopped by user'));
    await assert.rejects(streamHostedChat({model:'groq/openai/gpt-oss-20b', messages:[], signal:controller.signal, onChunk() {}}, request), /Stopped by user/);
  } finally {if(previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY=previous;}
});
