export const AVAILABLE_MODEL_IDS = ['groq/openai/gpt-oss-20b', 'openrouter/free'] as const;
export type AvailableModelId = typeof AVAILABLE_MODEL_IDS[number];
export const DEFAULT_MODEL_ID: AvailableModelId = AVAILABLE_MODEL_IDS[0];

export interface ModelConfig {
  id: AvailableModelId;
  displayName: string;
  tagline: string;
  description: string;
  badge: string;
  isPro?: boolean;
  isDefault?: boolean;
}

/** Zovo names are presentation labels; API requests retain the real provider IDs. */
export const ZOVO_MODELS: readonly ModelConfig[] = [
  {
    id: DEFAULT_MODEL_ID,
    displayName: 'Zovo Fast',
    tagline: 'Quick answers, coding & documents',
    description: 'Powered by Groq GPT-OSS 20B. Supports text and readable documents. Free-plan quotas apply.',
    badge: 'Default',
    isDefault: true,
  },
  {
    id: 'openrouter/free',
    displayName: 'Zovo Flex',
    tagline: 'Flexible free models for everyday work',
    description: 'Powered by OpenRouter free models. Supports text and readable documents. Model availability and quotas vary.',
    badge: 'Free',
  },
];

export const SELECTABLE_MODELS = ZOVO_MODELS;

export function isAvailableModel(modelId: unknown): modelId is AvailableModelId {
  return typeof modelId === 'string' && (AVAILABLE_MODEL_IDS as readonly string[]).includes(modelId);
}

/** Old saved chats/settings continue using the default instead of a retired model. */
export function normalizeModelId(modelId?: string | null): AvailableModelId {
  return isAvailableModel(modelId) ? modelId : DEFAULT_MODEL_ID;
}

export function getModelDisplayName(modelId?: string): string {
  if (modelId?.startsWith('openrouter/')) return 'Zovo Flex';
  if (modelId?.startsWith('groq/')) return 'Zovo Fast';
  // Preserve a truthful label for historical answers generated before the change.
  if (modelId?.startsWith('gemini-')) return 'Zovo Legacy';
  return getModelConfig(modelId).displayName;
}

export function getModelConfig(modelId?: string): ModelConfig {
  return ZOVO_MODELS.find(m => m.id === normalizeModelId(modelId))!;
}
