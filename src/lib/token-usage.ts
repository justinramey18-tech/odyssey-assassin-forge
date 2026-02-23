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
