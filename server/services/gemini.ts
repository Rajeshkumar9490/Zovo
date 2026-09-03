import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { GeminiModelId, GroundingSource } from '../../src/types.js';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: {
    mimeType: string;
    dataUrl?: string; // base64
    base64?: string;
  }[];
}

export interface StreamChatParams {
  model?: GeminiModelId;
  messages: ChatHistoryMessage[];
  systemInstruction?: string;
  enableSearch?: boolean;
  temperature?: number;
  onChunk: (chunkText: string) => void;
  onSources?: (sources: GroundingSource[]) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts a human-friendly error message from Google Gen AI errors,
 * unpacking any nested stringified JSON error objects.
 */
export function extractCleanErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred while communicating with Gemini.';

  let rawMsg = error.message || String(error);

  // If the message is wrapped in stringified JSON like ApiError: {"error":{"message":"..."}}
  try {
    const jsonStart = rawMsg.indexOf('{');
    if (jsonStart !== -1) {
      const jsonStr = rawMsg.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);

      if (parsed.error?.message) {
        // The inner error.message might itself be a stringified JSON!
        try {
          const innerParsed = JSON.parse(parsed.error.message);
          if (innerParsed.error?.message) {
            rawMsg = innerParsed.error.message;
          }
        } catch {
          rawMsg = parsed.error.message;
        }
      }
    }
  } catch {}

  // Handle common known status codes with clear guidance
  if (error.code === 503 || error.status === 503 || rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
    return 'The model is currently experiencing temporary high demand (503). Retrying shortly...';
  }
  if (error.code === 429 || error.status === 429 || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return 'Rate limit reached. Please wait a moment before sending another message.';
  }
  if (error.code === 401 || rawMsg.includes('API key')) {
    return 'Gemini API key verification issue. Please check the project settings.';
  }

  return rawMsg.replace(/^[a-zA-Z]*Error:\s*/, '').trim();
}

function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code;
  const msg = (error.message || '').toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('temporar') ||
    msg.includes('resource_exhausted') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')
  );
}

function isHighDemandError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code;
  const msg = (error.message || String(error)).toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    status === 'NOT_FOUND' ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('not found') ||
    msg.includes('no longer available')
  );
}

export const ZOVO_CORE_SYSTEM_PROMPT = `You are Zovo, an advanced, highly capable, and versatile AI assistant engineered to deliver intelligent, helpful, and nuanced responses on par with state-of-the-art models like Claude, Gemini, and ChatGPT.

## Core Behavioral Principles

1. Natural, Adaptive, and Conversational:
- Communicate in a natural, engaging, and articulate tone.
- Match the user's intent, complexity, and language. Never respond with rigid, robotic boilerplate or canned templates.
- For simple greetings ("hello", "hi", "hey"): Respond warmly, naturally, and concisely (e.g., "Hello! How can I help you today?") without dumping unrequested checklists, instructions, or disclaimers.
- For direct questions: Provide direct, well-structured, insightful answers immediately.
- For complex inquiries: Offer comprehensive, deeply reasoned explanations with clean hierarchy and markdown formatting.

2. Software Engineering & Technical Mastery:
- Provide production-grade, idiomatic code across languages (TypeScript, JavaScript, Python, Go, Rust, SQL, Bash, etc.).
- Always format code cleanly within markdown code blocks with appropriate syntax highlighting.
- Focus on modern best practices, security, modularity, and error handling.
- When explaining code or fixing bugs, explain the rationale concisely and provide complete, drop-in solutions.

3. Multimodal Analysis (Images, Screenshots, Documents):
- When the user shares images, screenshots, charts, documents, or error logs, analyze them with extreme precision and attention to detail.
- If analyzing technical errors or stack traces: Extract exact error codes, timestamps, endpoints, and symptoms. Distinguish confirmed facts from hypotheses, and recommend clear next steps without hallucinating missing context.
- If analyzing diagrams, UI designs, or documents: Provide insightful, context-aware breakdowns.

4. Writing & Formatting Craft:
- Use clean, tasteful Markdown formatting (headers, bold highlights, bullet points, tables, and code blocks) to make information easily scannable.
- Avoid generic AI clichés, repetitive self-announcements ("As an AI...", "In today's fast-paced world..."), or artificial filler.
- Be proactive, creative, and genuinely helpful.`;

export async function streamGeminiChat({
  model = 'gemini-3.7-flash',
  messages,
  systemInstruction,
  enableSearch = false,
  temperature = 0.7,
  onChunk,
  onSources,
}: StreamChatParams): Promise<string> {
  const ai = getGeminiClient();

  // Determine candidate models in priority fallback order
  const modelFallbackOrder: string[] = [
    model,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
  ];
  // Deduplicate candidate models
  const candidateModels = Array.from(new Set(modelFallbackOrder));

  // Format and coalesce contents for generateContentStream (ensuring valid alternating user/model turns)
  const rawContents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const parts: any[] = [];

      // Add multimodal attachments if present on user messages
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          let base64Data = att.base64;
          if (!base64Data && att.dataUrl) {
            const split = att.dataUrl.split(',');
            base64Data = split.length > 1 ? split[1] : split[0];
          }
          if (base64Data) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64Data,
              },
            });
          }
        }
      }

      if (m.content && m.content.trim()) {
        parts.push({ text: m.content.trim() });
      }

      return {
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts,
      };
    })
    .filter((item) => item.parts.length > 0);

  // Coalesce consecutive turns of the same role to prevent turn-desynchronization in Gemini API
  const contents: { role: 'user' | 'model'; parts: any[] }[] = [];
  for (const item of rawContents) {
    if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
      contents[contents.length - 1].parts.push(...item.parts);
    } else {
      contents.push({ role: item.role, parts: [...item.parts] });
    }
  }

  // Combine core system prompt with any optional contextual additions (RAG, memories, custom assistant instructions)
  const finalSystemInstruction = systemInstruction
    ? `${ZOVO_CORE_SYSTEM_PROMPT}\n\n[Context & Specialized User Directives]:\n${systemInstruction}`
    : ZOVO_CORE_SYSTEM_PROMPT;

  const config: any = {
    systemInstruction: finalSystemInstruction,
    temperature: typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.7,
  };

  if (enableSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  let lastError: any = null;

  // Try candidate models in order
  for (const currentModel of candidateModels) {
    const isPrimary = currentModel === model;
    const maxRetries = isPrimary ? 1 : 0;

    // Fast-path: For non-reasoning models (like gemini-3.7-flash), turn off thinking delay (budget 0) for immediate 1st-token delivery
    const modelConfig: any = { ...config };
    if (currentModel !== 'gemini-3.1-pro-preview') {
      modelConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let fullResponseText = '';
      const discoveredSources: GroundingSource[] = [];

      try {
        if (attempt > 0) {
          const backoffTime = 200 + Math.random() * 150;
          await sleep(backoffTime);
        }

        const responseStream = await ai.models.generateContentStream({
          model: currentModel,
          contents,
          config: modelConfig,
        });

        for await (const chunk of responseStream) {
          const c = chunk as GenerateContentResponse;
          const chunkText = c.text;
          if (chunkText) {
            fullResponseText += chunkText;
            onChunk(chunkText);
          }

          // Check for grounding metadata
          const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks && Array.isArray(groundingChunks)) {
            for (const gChunk of groundingChunks) {
              if (gChunk.web?.uri) {
                const exists = discoveredSources.some((s) => s.uri === gChunk.web.uri);
                if (!exists) {
                  discoveredSources.push({
                    uri: gChunk.web.uri,
                    title: gChunk.web.title || new URL(gChunk.web.uri).hostname,
                    snippet: (gChunk.web as any).snippet,
                  });
                }
              }
            }
          }
        }

        if (onSources && discoveredSources.length > 0) {
          onSources(discoveredSources);
        }

        return fullResponseText;
      } catch (error: any) {
        lastError = error;

        // If search grounding was enabled and threw quota/rate error, disable search tools and retry
        if (config.tools && config.tools.length > 0) {
          console.warn('Search grounding quota reached, retrying with standard knowledge base & Gemini reasoning...');
          delete config.tools;
          continue;
        }

        // If high demand 503 or resource exhausted, immediately jump to next fallback model
        if (isHighDemandError(error)) {
          console.warn(`Model ${currentModel} error (${error.status || error.code}), immediately switching to fallback model...`);
          break;
        }

        // If not transient, break immediately to next model
        if (!isTransientError(error)) {
          break;
        }
      }
    }
  }

  // If all models failed, throw formatted clean message
  const cleanMsg = extractCleanErrorMessage(lastError);
  throw new Error(cleanMsg);
}

export async function generateConversationTitle(firstMessage: string): Promise<string> {
  const models: string[] = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];

  for (const model of models) {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: `Generate a concise, 3 to 6 word title summarizing this message. Do NOT use quotes, brackets, punctuation, or generic filler: "${firstMessage.slice(0, 300)}"`,
      });
      const title = response.text?.trim().replace(/^["']|["']$/g, '');
      if (title && title.length < 50) return title;
    } catch {
      // Continue to next fallback model
    }
  }

  return 'New Conversation';
}
