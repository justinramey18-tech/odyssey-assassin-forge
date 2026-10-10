import { describe, it, expect, beforeEach } from 'vitest';
import { CLAUDE_EVERYWHERE_MODEL_ID, DM_MODELS, getModelLabel, loadSelectedModel, upgradeModelId } from '@/lib/dm-models';

describe('Claude models', () => {
  beforeEach(() => localStorage.clear());

  it('lists the four current Claude models and none of the old ones', () => {
    const claude = DM_MODELS.filter(m => m.provider === 'anthropic').map(m => m.id);
    expect(claude).toEqual(['anthropic/claude-fable-5-1', 'anthropic/claude-opus-5-5', 'anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5']);
    expect(DM_MODELS.some(m => m.id === CLAUDE_EVERYWHERE_MODEL_ID)).toBe(true);
  });

  it('moves an old saved choice to its replacement', () => {
    expect(upgradeModelId('anthropic/claude-sonnet-4-5')).toBe('anthropic/claude-sonnet-5-5');
    expect(upgradeModelId('anthropic/claude-haiku-4-5')).toBe('anthropic/claude-haiku-5-5');
    expect(upgradeModelId('venice/kimi-k3')).toBe('venice/kimi-k3');
    localStorage.setItem('dnd-dm-ai-model', 'anthropic/claude-sonnet-4');
    localStorage.setItem('dnd-dm-ai-model-explicit', 'true');
    expect(loadSelectedModel()).toBe('anthropic/claude-sonnet-5-5');
    expect(getModelLabel('anthropic/claude-sonnet-4-6')).toBe('Claude Sonnet 5.5');
  });
});
