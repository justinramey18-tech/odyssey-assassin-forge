import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'gte', 'lte', 'gt', 'lt', 'not', 'match', 'filter']) builder[m] = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  const channel: any = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => builder, channel: () => channel, removeChannel: () => {}, auth: { getUser: async () => ({ data: { user: null } }) } } };
});

import { tableNpcsFor } from '@/hooks/use-solo-live-table';
import { buildRoster, type RosterEntry } from '@/lib/solo-npcs';
import { CANON_ERAS } from '@/lib/empyreanCanon/castNpcs';
import { CAST_PORTRAITS } from '@/lib/empyreanCanon/castPortraits';

const roster = buildRoster([], CANON_ERAS[0]);

describe('solo Live Table NPC portraits', () => {
  it('gives every canon character with a built-in portrait that portrait, the same one People shows', () => {
    const list = tableNpcsFor(roster, []);
    const withArt = roster.filter(e => CAST_PORTRAITS[e.key]);
    expect(withArt.length).toBeGreaterThan(0);
    for (const e of withArt) expect(list.find(n => n.id === e.key)?.portrait_url).toBe(CAST_PORTRAITS[e.key]);
  });

  it('a player-made NPC (no built-in art) shows initials, as before', () => {
    const custom: RosterEntry = { ...roster[0], key: 'custom-1', name: 'Old Hagen', group: 'custom', custom: true };
    expect(tableNpcsFor([custom], [])[0].portrait_url).toBeNull();
  });

  it('keeps who is on stage, hides hidden NPCs and keeps the dead off stage', () => {
    const [a, b, c] = roster;
    const list = tableNpcsFor([a, { ...b, status: 'hidden' }, { ...c, status: 'dead' }], [a.key, c.key]);
    expect(list.map(n => n.id)).toEqual([a.key, c.key]);
    expect(list[0].on_stage).toBe(true);
    expect(list[1].on_stage).toBe(false);
  });
});
