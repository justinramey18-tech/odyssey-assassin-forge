import { describe, it, expect, beforeEach } from 'vitest';
import { SCRIBE_MODELS, loadScribeModel, getEdgeFunctionForModel } from '@/lib/scribe-models';

describe('Scribe Claude models (CL-047)', () => {
  beforeEach(() => localStorage.clear());

  it('lists only current Claude models', () => {
    const claude = SCRIBE_MODELS.filter(m => m.provider === 'anthropic').map(m => m.id);
    expect(claude).toEqual(['anthropic/claude-opus-5-5', 'anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5']);
    for (const id of claude) expect(getEdgeFunctionForModel(id)).toBe('scribe-ai');
  });

  it('moves an old saved Claude choice to its replacement instead of dropping it', () => {
    localStorage.setItem('dnd-scribe-ai-model', 'anthropic/claude-sonnet-4-5');
    localStorage.setItem('dnd-scribe-ai-model-explicit', 'true');
    expect(loadScribeModel()).toBe('anthropic/claude-sonnet-5-5');
    localStorage.removeItem('dnd-scribe-ai-model-explicit');
    expect(loadScribeModel()).toBe('anthropic/claude-sonnet-5-5');
  });
});
