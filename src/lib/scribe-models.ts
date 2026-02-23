/**
 * AI model definitions for the Scribe / Novel Builder.
 * Reuses the same shape as DMAIModel from dm-models.ts.
 */

export interface ScribeModel {
  id: string;
  label: string;
  provider: 'lovable' | 'anthropic';
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
];

export const DEFAULT_SCRIBE_MODEL = 'google/gemini-3-pro-preview';

const STORAGE_KEY = 'dnd-scribe-ai-model';

export function loadScribeModel(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SCRIBE_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_SCRIBE_MODEL;
}

export function saveScribeModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
  } catch { /* ignore */ }
}

export function getScribeModelLabel(modelId: string): string {
  return SCRIBE_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}

/** Returns which edge function to call based on the model provider. */
export function getEdgeFunctionForModel(modelId: string): 'scribe-ai' | 'narrative-forge' {
  const model = SCRIBE_MODELS.find(m => m.id === modelId);
  return model?.provider === 'anthropic' ? 'scribe-ai' : 'narrative-forge';
}

export function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith('anthropic/');
}
