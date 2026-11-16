import { describe, expect, it } from 'vitest';
import { outputBudget, SHORT_REQUEST_TOKENS, THINKING_HEADROOM } from '../../../supabase/functions/ai-dm/output-budget';

describe('ai-dm output budget for thinking models (CL-070)', () => {
  it('an NPC reply (260) gets room to think before it writes', () => {
    expect(outputBudget(260)).toBe(260 + THINKING_HEADROOM);
    expect(outputBudget(200)).toBe(200 + THINKING_HEADROOM);
  });
  it('long requests keep their own limit; no limit means 16,000', () => {
    expect(outputBudget(SHORT_REQUEST_TOKENS)).toBe(SHORT_REQUEST_TOKENS);
    expect(outputBudget(16000)).toBe(16000);
    expect(outputBudget(undefined)).toBe(16000);
    expect(outputBudget(0)).toBe(16000);
  });
});
