import { describe, it, expect } from 'vitest';
import { rollNpcOpposingCheckWithStats } from '@/lib/npcSocialChecks';
import { sanitizeNpcSocialStats } from '@/lib/live-npcs';

const stats = sanitizeNpcSocialStats({ insight: 5, deception: -2, wisdomSave: 7, wisdom: 1, charisma: 3, perception: 9 });

describe('Live NPC opposed social modifiers', () => {
  it('Persuasion uses Insight', () => expect(rollNpcOpposingCheckWithStats(stats, 'persuasion', 'fair').modifier).toBe(5));
  it('Deception uses Insight', () => expect(rollNpcOpposingCheckWithStats(stats, 'deception', 'fair').modifier).toBe(5));
  it('Insight uses Deception', () => expect(rollNpcOpposingCheckWithStats(stats, 'insight', 'fair').modifier).toBe(-2));
  it('Intimidation uses Wisdom Save', () => expect(rollNpcOpposingCheckWithStats(stats, 'intimidation', 'fair').modifier).toBe(7));
  it('clamps to -10..20', () => expect(sanitizeNpcSocialStats({ insight: 99, deception: -50 })).toMatchObject({ insight: 20, deception: -10 }));
});
