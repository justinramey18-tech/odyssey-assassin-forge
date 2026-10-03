/**
 * AI model definitions for the Solo AI DM.
 * Models from the Lovable AI gateway use LOVABLE_API_KEY;
 * Claude models route directly to the Anthropic API using ANTHROPIC_API_KEY.
 * OpenAI models route directly to the OpenAI API using user's own key.
 */

import { isClaudeEverywhereEnabled, isGPTEverywhereEnabled } from '@/lib/api-keys';

export const CLAUDE_EVERYWHERE_MODEL_ID = 'anthropic/claude-sonnet-4-5';
export const GPT_EVERYWHERE_MODEL_ID = 'openai-direct/gpt-5';

export interface DMAIModel {
  id: string;
  label: string;
  provider: 'lovable' | 'anthropic' | 'openai-direct' | 'perplexity' | 'xai-direct' | 'venice';
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
  { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast & cheap creative AI (own key)' },
  { id: 'openai-direct/gpt-5', label: 'GPT-5 (own key)', provider: 'openai-direct', description: 'Full GPT-5 via your OpenAI key' },
  { id: 'openai-direct/gpt-4o', label: 'GPT-4o (own key)', provider: 'openai-direct', description: 'Fast multimodal (own key)' },
  { id: 'openai-direct/gpt-4o-mini', label: 'GPT-4o Mini (own key)', provider: 'openai-direct', description: 'Cheapest & fastest (own key)' },
  { id: 'openai-direct/gpt-4-turbo', label: 'GPT-4 Turbo (own key)', provider: 'openai-direct', description: 'Large context, high quality (own key)' },
  { id: 'openai-direct/o1', label: 'o1 (own key)', provider: 'openai-direct', description: 'Advanced reasoning (own key)' },
  { id: 'openai-direct/o1-mini', label: 'o1 Mini (own key)', provider: 'openai-direct', description: 'Fast reasoning (own key)' },
  { id: 'perplexity/sonar', label: 'Sonar (own key)', provider: 'perplexity', description: 'Fast search-grounded AI (own key)' },
  { id: 'perplexity/sonar-pro', label: 'Sonar Pro (own key)', provider: 'perplexity', description: 'Best search-grounded quality (own key)' },
  { id: 'perplexity/sonar-reasoning', label: 'Sonar Reasoning (own key)', provider: 'perplexity', description: 'Chain-of-thought reasoning (own key)' },
  { id: 'xai-direct/grok-4', label: 'Grok 4 (own key)', provider: 'xai-direct', description: 'xAI flagship, uncensored narrative (own key)' },
  { id: 'xai-direct/grok-3', label: 'Grok 3 (own key)', provider: 'xai-direct', description: 'Strong reasoning + creativity (own key)' },
  { id: 'xai-direct/grok-3-mini', label: 'Grok 3 Mini (own key)', provider: 'xai-direct', description: 'Fast & cheap (own key)' },
  { id: 'xai-direct/grok-2-latest', label: 'Grok 2 (own key)', provider: 'xai-direct', description: 'Prior-gen Grok (own key)' },
  { id: 'venice/venice-uncensored-1-2', label: 'Venice Uncensored 1.2', provider: 'venice', description: 'Fewest refusals, built for uncensored stories (Venice)' },
  { id: 'venice/venice-uncensored-role-play', label: 'Venice Role Play', provider: 'venice', description: 'Uncensored, tuned for character role-play (Venice)' },
  { id: 'venice/hermes-3-llama-3.1-405b', label: 'Hermes 3 405B', provider: 'venice', description: 'Classic creative role-play model (Venice)' },
  { id: 'venice/qwen-3-6-plus', label: 'Qwen 3.6 Plus Uncensored', provider: 'venice', description: 'Uncensored with a huge memory (Venice)' },
  { id: 'venice/gemma-4-uncensored', label: 'Gemma 4 Uncensored', provider: 'venice', description: 'Fast, uncensored, mid-size (Venice)' },
  { id: 'venice/grok-4-7', label: 'Grok 4.7', provider: 'venice', description: 'Venice\'s smartest pick (Venice)' },
  { id: 'venice/kimi-k3', label: 'Kimi K3', provider: 'venice', description: 'Strong reasoning and long context (Venice)' },
  { id: 'venice/deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'venice', description: 'High quality, low cost (Venice)' },
  { id: 'venice/zai-org-glm-5-2', label: 'GLM 5.2', provider: 'venice', description: 'Venice\'s default all-rounder (Venice)' },
  { id: 'venice/claude-opus-5', label: 'Claude Opus 5 (Venice)', provider: 'venice', description: 'Top-tier writing, billed through Venice' },
  { id: 'venice/claude-sonnet-5', label: 'Claude Sonnet 5 (Venice)', provider: 'venice', description: 'Great writing, cheaper than Opus (Venice)' },
  { id: 'venice/gemini-3-8-flash', label: 'Gemini 3.8 Flash (Venice)', provider: 'venice', description: 'Very fast (Venice)' },
];

export const DEFAULT_MODEL_ID = 'google/gemini-3-pro-preview';

const STORAGE_KEY = 'dnd-dm-ai-model';
const EXPLICIT_KEY = 'dnd-dm-ai-model-explicit';

export function loadSelectedModel(): string {
  try {
    const isExplicit = localStorage.getItem(EXPLICIT_KEY) === 'true';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isExplicit && saved && DM_MODELS.some(m => m.id === saved)) {
      return saved;
    }
  } catch { /* ignore */ }
  if (isClaudeEverywhereEnabled()) return CLAUDE_EVERYWHERE_MODEL_ID;
  if (isGPTEverywhereEnabled()) return GPT_EVERYWHERE_MODEL_ID;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_MODEL_ID;
}

export function saveSelectedModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
    localStorage.setItem(EXPLICIT_KEY, 'true');
  } catch { /* ignore */ }
}

export function clearExplicitModel(): void {
  try {
    localStorage.removeItem(EXPLICIT_KEY);
  } catch { /* ignore */ }
}

export function getModelLabel(modelId: string): string {
  return DM_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}
