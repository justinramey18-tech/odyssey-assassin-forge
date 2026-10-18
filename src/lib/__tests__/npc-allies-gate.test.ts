import { describe, expect, it } from 'vitest';
import { joinGateFor } from '../../../supabase/functions/npc-reply/handler.ts';
import { formatJoinMarker, joinOfferOf, readableText, splitJoinTag, validateJoinTag, wonOver, type NpcSituation } from '../../../supabase/functions/npc-reply/prompt.ts';
import type { NpcContext, NpcRepo, NpcRow } from '../../../supabase/functions/npc-reply/repo.ts';

const now = Date.parse('2026-10-18T20:00:00Z');
const seat = { user_id: 'player-one', character_name: 'Anduril', character_status: null };
const npc: NpcRow = { id: 'npc-one', party_id: 'party', name: 'Mira', model: '', on_stage: true, archived: false };
const ctx: NpcContext = { guides: [], anchors: [], summary: '', latestPost: '', roster: [seat], table: [] };
const repo = { enemyInOpenFight: async () => false } as NpcRepo;
const win: NpcSituation = { kind: 'roll', roller: 'Anduril', check: 'Persuasion', save: false, total: 18, dc: 15, success: true, natural: null };
const gate = (n = npc, c = ctx, s: NpcSituation | undefined = win, r = repo) => joinGateFor(n, null, c, s, { user_id: seat.user_id }, r, now);

describe('NPC ally offer eligibility', () => {
  it.each(['Persuasion', 'Intimidation', 'Deception'])('permits a won %s check for the winning player', async check => {
    expect(await gate(npc, ctx, { ...win, check })).toEqual({ names: ['Anduril'], won: 'Anduril', seats: [expect.objectContaining({ user_id: 'player-one' })] });
  });
  it('Insight and a failed roll are not won-over checks', () => {
    expect(wonOver({ ...win, check: 'Insight' })).toBe(false);
    expect(wonOver({ ...win, success: false })).toBe(false);
  });
  it('allows volunteers only at Friendly or Loyal standing', async () => {
    for (const score of [-2, -1, 0, 1, 2]) {
      const c = { ...ctx, mind: { memory: [], attitudes: [{ user_id: seat.user_id, character_name: seat.character_name, score, last_seen_at: new Date(now).toISOString() }] } };
      expect((await gate(npc, c, undefined)).names).toEqual(score >= 1 ? ['Anduril'] : []);
    }
  });
  it('blocks an offer when three allies already travel with the party', async () => {
    expect((await gate(npc, { ...ctx, allies: ['A', 'B', 'C'] })).names).toEqual([]);
    expect((await gate(npc, { ...ctx, allies: ['A', 'B'] })).names).toEqual(['Anduril']);
  });
  it.each([{ ally_since: '2026-10-18' }, { player_user_id: 'away-player' }, { combat_state: 'ko' }, { combat_state: 'dead' }])('blocks an ally, stand-in or incapacitated NPC: %j', async patch => {
    expect((await gate({ ...npc, ...patch })).names).toEqual([]);
  });
  it('blocks an enemy in an unfinished fight', async () => {
    expect((await gate(npc, ctx, win, { enemyInOpenFight: async () => true } as NpcRepo)).names).toEqual([]);
  });
  it('rejects offers naming someone outside the allowed seats', () => {
    expect(validateJoinTag({ name: 'Phoenix' }, [seat])).toBeNull();
    expect(validateJoinTag({ name: '@Anduril' }, [seat])).toEqual({ to: 'player-one', name: 'Anduril' });
  });
  it('stores the offer separately from spoken words and reads it back', () => {
    const split = splitJoinTag('I will come.\n[JOIN: Anduril]');
    const offer = validateJoinTag(split.tag, [seat]);
    if (!offer) throw new Error('Expected an eligible offer');
    const stored = split.text.trim() + formatJoinMarker(offer);
    expect(joinOfferOf(stored)).toEqual({ to: 'player-one', name: 'Anduril' });
    expect(readableText(stored)).toBe('I will come.');
  });
});