// Output budget for every model path except Anthropic (which has claudeRequestOptions).
// Reasoning models (Gemini 2.5 and 3.x, GPT-5, Grok, many Venice models) spend hidden thinking
// tokens out of max_tokens. A short request, such as one NPC's two-line reply capped at 260 tokens,
// could spend the whole budget thinking and be cut off after a few words (CL-070). Short requests
// therefore get extra room for the thinking; their length is still set by the prompt.
export const SHORT_REQUEST_TOKENS = 2000;
export const THINKING_HEADROOM = 4096;

export function outputBudget(maxTokens?: number): number {
  if (!maxTokens || maxTokens <= 0) return 16000;
  return maxTokens < SHORT_REQUEST_TOKENS ? maxTokens + THINKING_HEADROOM : maxTokens;
}
