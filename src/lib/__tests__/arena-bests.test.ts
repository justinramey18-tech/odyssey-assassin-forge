import { describe, it, expect } from 'vitest';
import { mergeBests } from '@/lib/arena/arenaBests';
import { timingText } from '@/components/arena/ArenaPractice';

describe('arena personal bests', () => {
  it('keeps the faster escape and the longer chain', () => {
    const b = mergeBests({ bestChain: 4, bestEscapeMs: 5000, mostDamage: 30 }, { bestChain: 2, bestEscapeMs: 3200, damage: 50 });
    expect(b).toEqual({ bestChain: 4, bestEscapeMs: 3200, mostDamage: 50, bestWave: 0 });
  });
  it('ignores broken saved numbers', () => {
    const b = mergeBests({ bestChain: NaN, bestEscapeMs: NaN, mostDamage: -1 }, { bestChain: 1, bestEscapeMs: null, damage: 9 });
    expect(b).toEqual({ bestChain: 1, bestEscapeMs: null, mostDamage: 9, bestWave: 0 });
  });
});

describe('timing feedback', () => {
  it('says early or late by seconds', () => {
    expect(timingText(-120)).toBe('Early by 0.12s');
    expect(timingText(300)).toBe('Late by 0.30s');
  });
});
