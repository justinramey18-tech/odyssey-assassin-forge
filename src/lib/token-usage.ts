/**
 * Anthropic token usage display helpers.
 * Pricing as of 2025 for Claude Sonnet models.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

// $/million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-sonnet-4-5': { input: 3, output: 15 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-fable-5-1': { input: 10, output: 50 },
  'anthropic/claude-opus-5-5': { input: 4, output: 20 },
  'anthropic/claude-sonnet-5-5': { input: 2, output: 10 },
  // Haiku 5.5 doubles to $0.50 / $2.50 when a prompt is over 100K tokens.
  'anthropic/claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

export function estimateCost(usage: TokenUsage, modelId?: string): number {
  const p = (modelId && PRICING[modelId]) || DEFAULT_PRICING;
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
}

export function formatUsage(usage: TokenUsage, modelId?: string): string {
  const cost = estimateCost(usage, modelId);
  const total = usage.input_tokens + usage.output_tokens;
  const costStr = cost < 0.01
    ? `<$0.01`
    : `~$${cost.toFixed(3)}`;
  return `${total.toLocaleString()} tokens (${usage.input_tokens.toLocaleString()}↑ ${usage.output_tokens.toLocaleString()}↓) · ${costStr}`;
}

export function formatCostShort(usage: TokenUsage, modelId?: string): string {
  const cost = estimateCost(usage, modelId);
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(3)}`;
}
