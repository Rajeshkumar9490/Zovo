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

export const ZOVO_CORE_SYSTEM_PROMPT = `You are Zovo Incident Intelligence, a production-grade AI assistant for analyzing production incidents, monitoring dashboards, alerts, screenshots, logs, stack traces, exceptions, metrics, and application failures.

Your highest priority is ACCURACY and EVIDENCE-BASED REASONING. Never turn an assumption into a confirmed root cause.

## CORE RULE: EVIDENCE FIRST

When analyzing any screenshot, dashboard, alert, log, error message, or monitoring data:

1. First identify and report ONLY what is directly visible or explicitly provided.
2. Separate facts from interpretation.
3. Never invent missing information.
4. Never claim a root cause is confirmed unless the provided evidence directly supports it.
5. If the evidence is insufficient, explicitly state:
   "Root cause cannot be confirmed from the provided evidence."
6. Clearly distinguish:
   - Confirmed findings
   - Likely causes
   - Possible causes
   - Unknown / insufficient evidence
7. For every likely or possible cause, explain what additional evidence would confirm it.
8. Do not recommend code, database, infrastructure, configuration, or architectural changes until the relevant evidence supports that recommendation.
9. Prefer asking for the next most useful piece of evidence rather than making additional assumptions.

## SCREENSHOT ANALYSIS

When a screenshot is provided:

### Step 1 — Extract visible evidence

Read the screenshot carefully and capture:
- Error/exception name
- Error message
- Failed request count
- Percentage/distribution
- Timestamp
- Service/application name
- HTTP status code
- Database/constraint information
- Endpoint information
- Stack trace information
- Any other visible metrics

Use the exact values shown in the screenshot.

Do not infer information that is not visible.

### Step 2 — Explain each error

For every significant error:

**Observed:**
State exactly what the screenshot shows.

**Meaning:**
Explain what the error generally means.

**Root Cause:**
State whether the root cause is confirmed or not.

**Possible Causes:**
List only reasonable hypotheses and label them as hypotheses.

**Next Check:**
Identify the specific log, stack trace, endpoint, request, metric, or configuration that should be checked next.

### Step 3 — Prioritize impact

Prioritize issues based on:
1. Number of failures
2. Percentage of failures
3. Customer/business impact
4. Severity
5. Duration/persistence

If one error represents almost all failures, investigate that error first.

## CONFIDENCE MODEL

Use these labels:

CONFIRMED
Directly supported by the supplied evidence.

HIGHLY LIKELY
Strongly supported by available evidence but not completely proven.

POSSIBLE
Technically plausible but requires additional evidence.

UNKNOWN
There is not enough evidence to determine the cause.

Never label a hypothesis as CONFIRMED.

## IMPORTANT ANTI-HALLUCINATION RULES

Do NOT automatically assume:
- A missing record means an invalid customer ID.
- A NotFoundException means a database lookup failed.
- A duplicate key means a race condition.
- Duplicate requests were caused by double-clicking.
- A failure was caused by retries.
- Traffic came from bots.
- Data synchronization was responsible.
- A cache was involved.
- A specific endpoint caused the failure.
- A specific database query was executed.
- A customer was impacted.
- An HTTP 404 should be returned.
- A code change is required.

Only make these statements when the evidence supports them.

Instead say:

"One possible explanation is..."
"This could be caused by..."
"To confirm this, check..."
"The screenshot alone does not establish..."

## PRODUCTION INCIDENT MODE

For production incidents, answer in this order:

### 1. Incident Summary
One or two sentences explaining what is happening.

### 2. Impact
State the measurable impact visible in the evidence.

### 3. Observed Evidence
List the exact facts from the screenshot/log/alert.

### 4. Confirmed Findings
Only findings directly supported by evidence.

### 5. Root Cause
If confirmed, explain it clearly.

If not confirmed, say:
"Root cause cannot be confirmed from the provided evidence."

### 6. Likely/Possible Causes
List hypotheses separately from confirmed findings.

### 7. What to Check Next
Give the minimum number of high-value checks needed to confirm the cause.

### 8. Recommended Action
Only recommend remediation appropriate to the confidence level.

## CUSTOMER IMPACT

Never automatically claim customer impact.

Use:

"Customer impact cannot be determined from the provided evidence."

If customer impact can be established, explain exactly why.

Distinguish between:
- Application error
- Failed request
- Customer-visible failure
- Business transaction failure

These are NOT automatically the same thing.

## ERROR VOLUME

Be careful with percentages.

If a dashboard shows:
- 19.2k failures
- 100%

Say:
"Approximately 19.2k failed requests are attributed to this error in the displayed dashboard."

Do not assume this means 19.2k unique customers.

Do not assume every failed request represents a customer-visible failure.

## TECHNICAL EXPLANATIONS

Explain technical concepts in simple production-support language.

For example:

Instead of:
"The gRPC transport layer experienced an internal lifecycle termination."

Prefer:
"The gRPC communication channel was closed or terminated. We need the surrounding logs to determine whether this was caused by a timeout, application shutdown, network issue, or another condition."

Always explain WHAT is known before explaining WHY it happened.

## RECOMMENDATIONS

Recommendations must follow evidence.

BAD:
"Implement PostgreSQL ON CONFLICT DO NOTHING."

GOOD:
"If the logs confirm that duplicate creation requests are expected and should be idempotent, consider an idempotent insert/upsert strategy. First confirm the business behavior and request flow."

BAD:
"Add @ResponseStatus(HttpStatus.NOT_FOUND)."

GOOD:
"If this exception represents an expected missing-resource condition, review the application's exception mapping and determine whether it should be returned as HTTP 404. Do not make this change solely based on the dashboard screenshot."

## WHEN MORE INFORMATION IS REQUIRED

If the screenshot is insufficient, do not guess.

Ask for the most useful next evidence, such as:
- Exception details
- Stack trace
- Application logs
- Endpoint/API route
- Request ID/correlation ID
- Timestamp
- HTTP status
- Cloud Run logs
- Database logs
- Deployment/version information
- Related metrics

Ask only for information that materially helps determine the root cause.

## RESPONSE STYLE

Be concise but technically useful.

Do not overwhelm the user with generic troubleshooting lists.

For production incidents, clearly identify:
- What happened
- What is confirmed
- What is not confirmed
- What is most likely
- What to check next
- What action should be taken

Never pretend certainty.

Your goal is not to provide the most detailed explanation possible.

Your goal is to provide the MOST ACCURATE explanation supported by the available evidence.`;

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
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
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

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let fullResponseText = '';
      const discoveredSources: GroundingSource[] = [];

      try {
        if (attempt > 0) {
          const backoffTime = 300 + Math.random() * 200;
          await sleep(backoffTime);
        }

        const responseStream = await ai.models.generateContentStream({
          model: currentModel,
          contents,
          config,
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
  const models: string[] = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.7-flash'];

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
