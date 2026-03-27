/**
 * AI model definitions for the Scribe / Novel Builder.
 * Reuses the same shape as DMAIModel from dm-models.ts.
 */

import { isClaudeEverywhereEnabled, isGPTEverywhereEnabled } from '@/lib/api-keys';

const CLAUDE_EVERYWHERE_MODEL_ID = 'anthropic/claude-sonnet-4-5';
const GPT_EVERYWHERE_MODEL_ID = 'openai-direct/gpt-5';

export interface ScribeModel {
  id: string;
  label: string;
  provider: 'lovable' | 'anthropic' | 'openai-direct' | 'perplexity';
  description: string;
}

export const SCRIBE_MODELS: ScribeModel[] = [
  { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'lovable', description: 'Best narrative quality (default)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'lovable', description: 'Strong reasoning + big context' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'lovable', description: 'Faster, slightly less nuanced' },
  { id: 'openai/gpt-5', label: 'GPT-5', provider: 'lovable', description: 'High accuracy, slower' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'lovable', description: 'Good balance of cost/quality' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'anthropic', description: 'Excellent narrative (own key)' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude 4.5 Sonnet', provider: 'anthropic', description: 'Strong creative writing (own key)' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude 4.6 Sonnet', provider: 'anthropic', description: 'Best creative writing (own key)' },
  { id: 'openai-direct/gpt-5', label: 'GPT-5 (own key)', provider: 'openai-direct', description: 'Full GPT-5 via your OpenAI key' },
  { id: 'openai-direct/gpt-4o', label: 'GPT-4o (own key)', provider: 'openai-direct', description: 'Fast multimodal (own key)' },
  { id: 'openai-direct/gpt-4o-mini', label: 'GPT-4o Mini (own key)', provider: 'openai-direct', description: 'Cheapest & fastest (own key)' },
  { id: 'openai-direct/gpt-4-turbo', label: 'GPT-4 Turbo (own key)', provider: 'openai-direct', description: 'Large context (own key)' },
  { id: 'openai-direct/o1', label: 'o1 (own key)', provider: 'openai-direct', description: 'Advanced reasoning (own key)' },
  { id: 'openai-direct/o1-mini', label: 'o1 Mini (own key)', provider: 'openai-direct', description: 'Fast reasoning (own key)' },
  { id: 'perplexity/sonar', label: 'Sonar (own key)', provider: 'perplexity', description: 'Fast search-grounded AI (own key)' },
  { id: 'perplexity/sonar-pro', label: 'Sonar Pro (own key)', provider: 'perplexity', description: 'Best search-grounded quality (own key)' },
  { id: 'perplexity/sonar-reasoning', label: 'Sonar Reasoning (own key)', provider: 'perplexity', description: 'Chain-of-thought reasoning (own key)' },
];

export const DEFAULT_SCRIBE_MODEL = 'google/gemini-3-pro-preview';

const STORAGE_KEY = 'dnd-scribe-ai-model';
const EXPLICIT_KEY = 'dnd-scribe-ai-model-explicit';

export function loadScribeModel(): string {
  try {
    const isExplicit = localStorage.getItem(EXPLICIT_KEY) === 'true';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isExplicit && saved && SCRIBE_MODELS.some(m => m.id === saved)) {
      return saved;
    }
  } catch { /* ignore */ }
  if (isClaudeEverywhereEnabled()) return CLAUDE_EVERYWHERE_MODEL_ID;
  if (isGPTEverywhereEnabled()) return GPT_EVERYWHERE_MODEL_ID;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SCRIBE_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_SCRIBE_MODEL;
}

export function saveScribeModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
    localStorage.setItem(EXPLICIT_KEY, 'true');
  } catch { /* ignore */ }
}

export function clearExplicitScribeModel(): void {
  try {
    localStorage.removeItem(EXPLICIT_KEY);
  } catch { /* ignore */ }
}

export function getScribeModelLabel(modelId: string): string {
  return SCRIBE_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}

/** Returns which edge function to call based on the model provider. */
export function getEdgeFunctionForModel(modelId: string): 'scribe-ai' | 'narrative-forge' {
  const model = SCRIBE_MODELS.find(m => m.id === modelId);
  // anthropic and openai-direct both use scribe-ai (which handles direct API calls)
  return (model?.provider === 'anthropic' || model?.provider === 'openai-direct' || model?.provider === 'perplexity') ? 'scribe-ai' : 'narrative-forge';
}

export function isPerplexityModel(modelId: string): boolean {
  return modelId.startsWith('perplexity/');
}

export function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith('anthropic/');
}

export function isOpenAIDirectModel(modelId: string): boolean {
  return modelId.startsWith('openai-direct/');
}
