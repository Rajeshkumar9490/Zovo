import { GeminiModelId } from '../types.js';

export interface ModelConfig {
  id: GeminiModelId;
  displayName: string;
  tagline: string;
  description: string;
  badge: string;
  isPro?: boolean;
  isDefault?: boolean;
}

/**
 * Centralized Zovo Model Definitions
 * 
 * Maps underlying Google Gemini API model IDs to user-facing Zovo display names.
 * The underlying API model IDs are preserved for all backend/API communication.
 */
export const ZOVO_MODELS: readonly ModelConfig[] = [
  {
    id: 'gemini-3.7-flash',
    displayName: 'Zovo Instant',
    tagline: 'Fast, intelligent, next-gen reasoning',
    description: 'High-speed intelligence balanced for instant responses, general knowledge, coding, and creative work.',
    badge: 'Default',
    isDefault: true,
  },
  {
    id: 'gemini-3.6-flash',
    displayName: 'Zovo Fast',
    tagline: 'High-throughput rapid tasks',
    description: 'Optimized for high-throughput responses, quick summaries, and rapid workflows.',
    badge: 'Speed',
  },
  {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Zovo Reasoning',
    tagline: 'Deep reasoning, complex logic & math',
    description: 'Specialized for complex multi-step reasoning, advanced mathematical deductions, and deep analysis.',
    badge: 'Reasoning',
  },
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Zovo Lite',
    tagline: 'Ultra lightweight & low latency',
    description: 'Lightweight and ultra-responsive for brief inquiries and low-latency interaction.',
    badge: 'Lite',
  },
] as const;

/**
 * Available selectable models in the UI dropdowns
 */
export const SELECTABLE_MODELS: readonly ModelConfig[] = ZOVO_MODELS;

/**
 * Returns the cosmetic display name for a given Gemini Model ID
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'Zovo Instant';
  const found = ZOVO_MODELS.find((m) => m.id === modelId);
  if (found) return found.displayName;
  if (modelId === 'gemini-3-flash-preview') return 'Zovo Flash';
  return 'Zovo Instant';
}

/**
 * Returns the model configuration object for a given Gemini Model ID
 */
export function getModelConfig(modelId?: string): ModelConfig {
  const found = ZOVO_MODELS.find((m) => m.id === modelId);
  return found || ZOVO_MODELS[0];
}
