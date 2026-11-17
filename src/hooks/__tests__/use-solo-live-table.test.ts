import { describe, expect, it } from 'vitest';
import { stageFromStory } from '@/hooks/use-solo-live-table';
import { buildRoster } from '@/lib/solo-npcs';
import { CANON_ERAS } from '@/lib/empyreanCanon/castNpcs';

describe('solo Live Table stage', () => {
  const roster = buildRoster([], CANON_ERAS[0]);
  const someone = roster[0];
  it('puts NPCs named in the latest DM post on stage', () => {
    expect(stageFromStory(`${someone.name} waits by the gate.`, roster)).toEqual([someone.key]);
  });
  it('leaves the stage empty when nobody is named', () => {
    expect(stageFromStory('Rain falls on the empty courtyard.', roster)).toEqual([]);
  });
  it('keeps dead NPCs off the stage', () => {
    const dead = roster.map(e => (e.key === someone.key ? { ...e, status: 'dead' as const } : e));
    expect(stageFromStory(`${someone.name} waits by the gate.`, dead)).toEqual([]);
  });
});
