/**
 * AI model definitions for the Solo AI DM.
 * Models from the Lovable AI gateway use LOVABLE_API_KEY;
 * Claude models route directly to the Anthropic API using ANTHROPIC_API_KEY.
 */

export interface DMAIModel {
  id: string;
  label: string;
  provider: 'lovable' | 'anthropic';
  description: string;
}

export const DM_MODELS: DMAIModel[] = [
  { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'lovable', description: 'Best narrative quality (default)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'lovable', description: 'Strong reasoning + big context' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'lovable', description: 'Faster, slightly less nuanced' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'lovable', description: 'Fastest & cheapest' },
  { id: 'openai/gpt-5', label: 'GPT-5', provider: 'lovable', description: 'High accuracy, slower' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'lovable', description: 'Good balance of cost/quality' },
  { id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'lovable', description: 'Enhanced reasoning' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude 4 Sonnet', provider: 'anthropic', description: 'Excellent narrative & reasoning (own key)' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude 4.5 Sonnet', provider: 'anthropic', description: 'Strong creative writing (own key)' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude 4.6 Sonnet', provider: 'anthropic', description: 'Best creative writing (own key)' },
];

export const DEFAULT_MODEL_ID = 'google/gemini-3-pro-preview';

const STORAGE_KEY = 'dnd-dm-ai-model';

export function loadSelectedModel(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_MODEL_ID;
}

export function saveSelectedModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
  } catch { /* ignore */ }
}

export function getModelLabel(modelId: string): string {
  return DM_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}
