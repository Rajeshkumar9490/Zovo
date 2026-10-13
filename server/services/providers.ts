import { GeminiModelId } from '../../src/types.js';
import { StreamChatParams, streamGeminiChat, ZOVO_CORE_SYSTEM_PROMPT } from './gemini.js';
import { extractDocument } from './documents.js';

export const HOSTED_MODELS = ['groq/openai/gpt-oss-20b', 'openrouter/free'] as const;
export function providerConfigured(model: string): boolean {
  if (model === HOSTED_MODELS[0]) return Boolean(process.env.GROQ_API_KEY?.trim());
  if (model === HOSTED_MODELS[1]) return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return model.startsWith('gemini-') && Boolean(process.env.GEMINI_API_KEY?.trim());
}
export function validateHostedRequest(model: string, search?: boolean) {
  if (!(HOSTED_MODELS as readonly string[]).includes(model)) throw new Error('Unknown hosted model.');
  if (!providerConfigured(model)) throw new Error(`${model.startsWith('groq/') ? 'Groq' : 'OpenRouter'} is not configured yet. Ask the app owner to complete provider setup.`);
  if (search) throw new Error('Web search is available in Gemini modes. Turn search off to use this hosted model.');
}

export async function streamChat(params: StreamChatParams): Promise<string> {
  if (!params.model || params.model.startsWith('gemini-')) return streamGeminiChat(params);
  return streamHostedChat(params);
}

export async function streamHostedChat(params: StreamChatParams, request: typeof fetch = fetch): Promise<string> {
  const model = params.model as GeminiModelId;
  validateHostedRequest(model, params.enableSearch);
  const groq = model.startsWith('groq/');
  const provider = groq ? 'Groq' : 'OpenRouter';
  const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(55000)]) : AbortSignal.timeout(55000);
  const messages: {role: string; content: string}[] = [{role: 'system', content: `${ZOVO_CORE_SYSTEM_PROMPT}\n\n${params.systemInstruction || ''}`}];
  for (const item of params.messages.filter(m => m.role !== 'system')) {
    const documents: string[] = [];
    for (const file of item.attachments || []) {
      if (file.textContent) documents.push(`Untrusted attachment ${file.filename || 'document'}:\n${file.textContent}`);
      else if (file.mimeType === 'application/pdf' && (file.base64 || file.dataUrl)) {
        const encoded = file.base64 || file.dataUrl!.split(',').at(-1)!;
        const pages = await extractDocument(Buffer.from(encoded, 'base64'), file.mimeType, file.filename || 'attachment.pdf');
        documents.push(`Untrusted attachment ${file.filename || 'document'}:\n${pages.map(p => `Page ${p.page}: ${p.text}`).join('\n\n')}`);
      } else throw new Error('These hosted modes support text, PDF and Word documents. Use a Gemini mode for images.');
    }
    messages.push({role: item.role, content: [item.content, ...documents].filter(Boolean).join('\n\n')});
  }
  if (signal.aborted) throw signal.reason;
  const apiModel = groq ? 'openai/gpt-oss-20b' : 'openrouter/free';
  const response = await request(groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal,
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${groq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY}`},
    body: JSON.stringify({model: apiModel, messages, stream: true, max_tokens: 4096, temperature: params.temperature ?? 0.7, ...(groq ? {reasoning_effort: 'medium'} : {})}),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new Error(`${provider}'s usage limit was reached. Try another mode or retry later.`);
    if (response.status === 401 || response.status === 403) throw new Error(`${provider} key verification failed. Ask the app owner to check provider setup.`);
    throw new Error(`${provider} is unavailable (${response.status}). Try another mode or retry later.`);
  }
  if (!response.body) throw new Error(`${provider} returned no response stream.`);
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = ''; let answer = ''; let complete = false; let finishReason: string | undefined; let actualModel = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      buffer += decoder.decode(part.value, {stream: true}).replace(/\r/g, '');
      let split: number;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, split); buffer = buffer.slice(split + 2);
        const payload = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
        if (!payload) continue;
        if (payload === '[DONE]') { complete = true; break; }
        const data = JSON.parse(payload);
        if (data.error) throw new Error(`${provider} could not complete this answer. Try another mode or retry later.`);
        if (data.model && data.model !== actualModel) {
          actualModel = data.model;
          params.onModel?.(`${groq ? 'groq' : 'openrouter'}/${data.model}`, false);
        }
        const choice = data.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (typeof choice?.delta?.content === 'string') { answer += choice.delta.content; params.onChunk(choice.delta.content); }
      }
      if (complete) break;
    }
    if (!complete || !finishReason) throw new Error(`${provider}'s response was interrupted. Please retry.`);
    if (finishReason !== 'stop') throw new Error(finishReason === 'length' ? 'The response reached its length limit. Ask for a shorter answer.' : `${provider} could not complete this answer.`);
    if (!answer.trim()) throw new Error(`${provider} returned no answer. Please retry.`);
    if (!actualModel) params.onModel?.(model, false);
    return answer;
  } finally { await reader.cancel().catch(() => {}); }
}
