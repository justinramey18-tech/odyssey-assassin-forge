import { describe, expect, it } from 'vitest';
import * as R from '../../../supabase/functions/npc-combat/rules.ts';
import * as S from '../../../supabase/functions/npc-combat/skills.ts';
import {
  JOIN_CHECKS, MAX_ALLIES, formatJoinMarker, joinOfferOf, readableText, splitJoinTag, tableText, validateJoinTag, wonOver,
} from '../../../supabase/functions/npc-reply/prompt.ts';
import { joinGateFor } from '../../../supabase/functions/npc-reply/handler.ts';
import { add, join, part } from '../../../supabase/functions/npc-reply/allies.ts';
import type { NpcContext, NpcRepo, NpcRow, RoundLine } from '../../../supabase/functions/npc-reply/repo.ts';
import { joinButtonLabel, keepNpcRoll, npcLineForDm, parseNpcJoin, parseNpcRoll } from '../live-npcs';

// D-24 NPC allies: the join offer (tag, marker, gate, pill text) and the ally's fight rules (pure, no database).

const NOW = Date.parse('2026-10-18T18:00:00Z');
const seats = [
  { user_id: 'u-phoenix', character_name: 'Phoenix' },
  { user_id: 'u-anduril', character_name: 'Anduril' },
];

describe('join tag and marker', () => {
  it('reads the [JOIN: Name] tag out of the words', () => {
    const { text, tag } = splitJoinTag('Fine. I will walk with you.\n[JOIN: Phoenix]\n[MOOD: pleased]');
    expect(tag).toEqual({ name: 'Phoenix' });
    expect(text).not.toContain('JOIN');
    expect(text).toContain('[MOOD: pleased]');
  });
  it('only counts an offer to a character the gate allowed', () => {
    expect(validateJoinTag({ name: 'Phoenix' }, [seats[0]])).toEqual({ to: 'u-phoenix', name: 'Phoenix' });
    expect(validateJoinTag({ name: '@phoenix' }, [seats[0]])).toEqual({ to: 'u-phoenix', name: 'Phoenix' });
    expect(validateJoinTag({ name: 'Anduril' }, [seats[0]])).toBeNull();
    expect(validateJoinTag({ name: 'Phoenix' }, [])).toBeNull();
    expect(validateJoinTag(null, seats)).toBeNull();
  });
  it('stores the offer at the end of the line and reads it back', () => {
    const stored = `[reply:11111111-1111-1111-1111-111111111111]\nI'm in.${formatJoinMarker({ to: 'u-phoenix', name: 'Phoenix' })}`;
    expect(joinOfferOf(stored)).toEqual({ to: 'u-phoenix', name: 'Phoenix' });
    expect(readableText(stored)).toBe("I'm in.");
    expect(tableText(stored)).toBe("I'm in. (offers to join the party with Phoenix)");
    expect(joinOfferOf('no marker here')).toBeNull();
  });
  it('knows which won checks let an NPC offer', () => {
    expect(JOIN_CHECKS).toEqual(['Persuasion', 'Intimidation', 'Deception']);
    expect(wonOver({ kind: 'roll', roller: 'Phoenix', check: 'Persuasion', save: false, total: 18, dc: 15, success: true, natural: null })).toBe(true);
    expect(wonOver({ kind: 'roll', roller: 'Phoenix', check: 'Persuasion', save: false, total: 8, dc: 15, success: false, natural: null })).toBe(false);
    expect(wonOver({ kind: 'roll', roller: 'Phoenix', check: 'Insight', save: false, total: 20, dc: 15, success: true, natural: null })).toBe(false);
    expect(wonOver({ kind: 'social', roller: 'Phoenix', skill: 'Intimidation', player: { die: 15, modifier: 3, total: 18 }, opposingLabel: 'Wisdom Save', npcRoll: { die: 5, modifier: 1, total: 6 }, outcome: 'success', said: 'Come with us.' })).toBe(true);
    expect(wonOver({ kind: 'social', roller: 'Phoenix', skill: 'Deception', player: { die: 5, modifier: 3, total: 8 }, opposingLabel: 'Insight', npcRoll: { die: 15, modifier: 1, total: 16 }, outcome: 'failure', said: 'x' })).toBe(false);
    expect(wonOver(undefined)).toBe(false);
  });
});

const npc = (over: Partial<NpcRow> = {}): NpcRow => ({
  id: 'n-wulfgar', party_id: 'p1', name: 'Wulfgar', model: 'x', on_stage: true, archived: false, ally_since: null, ally_of: null, ...over,
});
const ctx = (over: Partial<NpcContext> = {}): NpcContext => ({
  guides: [], anchors: [], summary: '', latestPost: '',
  roster: seats.map(s => ({ user_id: s.user_id, character_name: s.character_name, character_status: null })),
  table: [], allies: [], ...over,
});
const repoWith = (over: Partial<NpcRepo> = {}): NpcRepo => ({
  getLine: async () => null, getPartyHost: async () => 'host', isMember: async () => true, getNpc: async () => null, getGuide: async () => null,
  listStageNames: async () => [], loadContext: async () => ctx(), claim: async () => 'claimed', insertNpcLine: async () => 'line',
  updateNpcLine: async () => {}, finish: async () => {}, findReplyRecord: async () => null,
  enemyInOpenFight: async () => false, countAllies: async () => 0, ...over,
});
const wonRoll = { kind: 'roll' as const, roller: 'Phoenix', check: 'Persuasion', save: false, total: 18, dc: 15, success: true, natural: null };

describe('join gate', () => {
  it('opens for the character who won a social roll', async () => {
    const g = await joinGateFor(npc(), null, ctx(), wonRoll, { user_id: 'u-phoenix' }, repoWith(), NOW);
    expect(g.names).toEqual(['Phoenix']);
    expect(g.won).toBe('Phoenix');
    expect(g.seats).toEqual([seats[0]]);
  });
  it('stays shut after a lost roll, unless the NPC is already friendly', async () => {
    const lost = { ...wonRoll, success: false };
    expect((await joinGateFor(npc(), null, ctx(), lost, { user_id: 'u-phoenix' }, repoWith(), NOW)).names).toEqual([]);
    const friendly = ctx({ mind: { memory: [], attitudes: [{ user_id: 'u-anduril', character_name: 'Anduril', score: 1, updated_at: new Date(NOW).toISOString() }] } });
    const g = await joinGateFor(npc(), null, friendly, lost, { user_id: 'u-phoenix' }, repoWith(), NOW);
    expect(g.names).toEqual(['Anduril']);
    expect(g.won).toBeNull();
  });
  it('never opens for an ally, a stand-in, a knocked-out NPC, an enemy mid-fight, or a full party', async () => {
    const line = { user_id: 'u-phoenix' };
    expect((await joinGateFor(npc({ ally_since: 'x' }), null, ctx(), wonRoll, line, repoWith(), NOW)).names).toEqual([]);
    expect((await joinGateFor(npc({ player_user_id: 'u-x' }), null, ctx(), wonRoll, line, repoWith(), NOW)).names).toEqual([]);
    expect((await joinGateFor(npc({ combat_state: 'ko' }), null, ctx(), wonRoll, line, repoWith(), NOW)).names).toEqual([]);
    expect((await joinGateFor(npc(), null, ctx(), wonRoll, line, repoWith({ enemyInOpenFight: async () => true }), NOW)).names).toEqual([]);
    expect((await joinGateFor(npc(), null, ctx({ allies: ['A', 'B', 'C'] }), wonRoll, line, repoWith(), NOW)).names).toEqual([]);
    expect(MAX_ALLIES).toBe(3);
  });
});

describe('join, add and part on the server', () => {
  const offerLine = (over: Partial<RoundLine> = {}): RoundLine => ({
    id: '22222222-2222-2222-2222-222222222222', party_id: 'p1', user_id: 'host', character_name: 'Wulfgar',
    content: `Fine, I'll come.${formatJoinMarker({ to: 'u-phoenix', name: 'Phoenix' })}`,
    in_character: true, round_id: 'r1', consumed: false, selected: true, created_at: new Date(NOW).toISOString(),
    npc_id: 'n-wulfgar', ...over,
  });
  const deps = (repo: NpcRepo) => ({ repo, callModel: async () => ({ ok: false, reason: 'no' }), now: () => NOW });

  it('lets the named player accept, and nobody else', async () => {
    const writes: string[] = [];
    const repo = repoWith({
      getLine: async () => offerLine(),
      getNpc: async () => npc(),
      setAlly: async (id, allyOf) => { writes.push(`ally:${id}:${allyOf}`); return npc({ ally_since: new Date(NOW).toISOString() }); },
      postPartyLine: async (_p, _h, text) => { writes.push(text); },
      ensureEventMemory: async (_n, _p, note) => { writes.push(`memory:${note}`); },
    });
    const no = await join({ userId: 'u-anduril', messageId: offerLine().id }, deps(repo));
    expect(no.status).toBe(403);
    const yes = await join({ userId: 'u-phoenix', messageId: offerLine().id }, deps(repo));
    expect(yes.status).toBe(200);
    expect(writes[0]).toBe('ally:n-wulfgar:u-phoenix');
    expect(writes[1]).toBe('🤝 Wulfgar joins the party.');
    expect(writes[2]).toContain('joined the party');
  });
  it('refuses once the round went to the DM, when the party is full, or mid-fight', async () => {
    const r1 = await join({ userId: 'u-phoenix', messageId: offerLine().id }, deps(repoWith({ getLine: async () => offerLine({ consumed: true }), getNpc: async () => npc() })));
    expect(r1.status).toBe(409);
    const r2 = await join({ userId: 'u-phoenix', messageId: offerLine().id }, deps(repoWith({ getLine: async () => offerLine(), getNpc: async () => npc(), countAllies: async () => 3 })));
    expect(r2.status).toBe(409);
    const r3 = await join({ userId: 'u-phoenix', messageId: offerLine().id }, deps(repoWith({ getLine: async () => offerLine(), getNpc: async () => npc(), enemyInOpenFight: async () => true })));
    expect(r3.status).toBe(409);
  });
  it('is harmless to tap twice', async () => {
    const r = await join({ userId: 'u-phoenix', messageId: offerLine().id }, deps(repoWith({ getLine: async () => offerLine(), getNpc: async () => npc({ ally_since: 'x' }) })));
    expect(r.status).toBe(200);
    expect(r.body.already).toBe(true);
  });
  it('add and part are the host\'s only', async () => {
    const calls: string[] = [];
    const repo = repoWith({
      getNpc: async () => npc({ ally_since: 'x' }),
      setAlly: async (_id, allyOf) => { calls.push(`set:${allyOf}`); return npc(); },
      postPartyLine: async (_p, _h, text) => { calls.push(text); },
    });
    expect((await part({ userId: 'u-phoenix', npcId: '33333333-3333-3333-3333-333333333333' }, deps(repo))).status).toBe(403);
    expect((await part({ userId: 'host', npcId: '33333333-3333-3333-3333-333333333333' }, deps(repo))).status).toBe(200);
    expect(calls).toEqual(['set:null', '🤝 Wulfgar parts ways with the party.']);
    const repo2 = repoWith({ getNpc: async () => npc(), setAlly: async () => npc({ ally_since: 'x' }) });
    expect((await add({ userId: 'u-phoenix', npcId: '33333333-3333-3333-3333-333333333333' }, deps(repo2))).status).toBe(403);
    expect((await add({ userId: 'host', npcId: '33333333-3333-3333-3333-333333333333' }, deps(repo2))).status).toBe(200);
    expect((await add({ userId: 'host', npcId: '33333333-3333-3333-3333-333333333333' }, deps(repoWith({ getNpc: async () => npc({ archived: true }) })))).status).toBe(409);
  });
});

describe('the phone reads the offer', () => {
  const stored = `Fine, I'll come.${formatJoinMarker({ to: 'u-phoenix', name: 'Phoenix' })}`;
  it('hides the marker and shows the pill text', () => {
    const { body, join } = parseNpcJoin(stored);
    expect(body).toBe("Fine, I'll come.");
    expect(join).toEqual({ to: 'u-phoenix', name: 'Phoenix' });
    expect(joinButtonLabel('Wulfgar')).toBe('Add Wulfgar to the party');
    expect(parseNpcRoll(stored).roll).toBeNull();
  });
  it('tells the DM in plain words, and keeps the marker through a host edit', () => {
    expect(npcLineForDm(stored)).toBe("Fine, I'll come. (offers to join the party with Phoenix)");
    const edited = keepNpcRoll('Fine. I will come.', stored);
    expect(parseNpcJoin(edited).join).toEqual({ to: 'u-phoenix', name: 'Phoenix' });
    expect(parseNpcJoin(edited).body).toBe('Fine. I will come.');
  });
});

describe('an ally in a fight (pure rules)', () => {
  const stats = R.cleanCombatStats({ maxHp: 60, ac: 14, attackBonus: 6, damage: '1d8+3', speed: 'medium' });
  if (!stats) throw new Error('Invalid ally test combat stats');
  const skills = S.skillsOf({ skills: [{ type: 'strike', name: 'Aegis-fang' }, { type: 'mend', name: 'Field dressing' }, { type: 'retreat', name: 'Run' }] }, stats);
  const base = {
    skills, selfId: 'ally', turnNo: 1, signatureTurn: -99,
    friends: [
      { id: 'ally', hp: 60, maxHp: 60, status: 'up', ward: 0, player: false, present: true },
      { id: 'p1', hp: 30, maxHp: 38, status: 'up', ward: 0, player: true, present: true },
    ],
    enemies: [{ id: 'e1', hp: 40, maxHp: 50, status: 'up' }, { id: 'e2', hp: 5, maxHp: 50, status: 'up' }],
  };
  const fixed = (n: number): R.Roller => () => n;

  it('wakes a downed player before anything else', () => {
    const c = S.chooseAllySkill({ ...base, friends: [base.friends[0], { ...base.friends[1], hp: 0, status: 'down' }] }, fixed(3));
    expect(c).toEqual({ kind: 'skill', skill: skills.find(s => s.type === 'mend'), targetIds: ['p1'] });
  });
  it('mends the most hurt friend under half, players included', () => {
    const c = S.chooseAllySkill({ ...base, friends: [base.friends[0], { ...base.friends[1], hp: 10 }] }, fixed(3));
    expect(c.kind).toBe('skill');
    if (c.kind === 'skill') expect([c.skill.type, c.targetIds]).toEqual(['mend', ['p1']]);
  });
  it('attacks an enemy when nobody needs help, favouring the one closest to falling', () => {
    const c = S.chooseAllySkill(base, fixed(3));
    expect(c.kind).toBe('skill');
    if (c.kind === 'skill') {
      expect(c.skill.type).toBe('strike');
      expect(c.targetIds).toEqual(['e2']);
    }
  });
  it('never retreats, and idles with no enemy standing or no player present', () => {
    const c = S.chooseAllySkill({ ...base, friends: [{ ...base.friends[0], hp: 5 }, base.friends[1]] }, fixed(1));
    expect(c.kind === 'skill' && c.skill.type === 'retreat').toBe(false);
    expect(S.chooseAllySkill({ ...base, enemies: [{ id: 'e1', hp: 0, maxHp: 50, status: 'ko' }] }, fixed(3))).toEqual({ kind: 'idle' });
    expect(S.chooseAllySkill({ ...base, friends: [base.friends[0], { ...base.friends[1], present: false }] }, fixed(3))).toEqual({ kind: 'idle' });
  });
  it('is never pinned by an enemy', () => {
    const enemySkills = S.skillsOf({ skills: [{ type: 'pin', name: 'Net' }, { type: 'strike', name: 'Club' }] }, stats);
    // roll(5) === 1 is both the "talk" check and the pin check; a roller that answers 2 then 1 reaches the pin branch.
    const answers = [2, 1, 1, 1, 1, 1];
    const roller: R.Roller = () => answers.shift() ?? 1;
    const c = S.chooseSkill({
      skills: enemySkills, selfId: 'e1', turnNo: 1, signatureTurn: -99, canRetreat: false,
      npcs: [{ id: 'e1', hp: 50, maxHp: 50, status: 'up', ward: 0 }],
      players: [{ id: 'ally', status: 'up', present: true, threat: 10, pinnable: false }],
    }, roller);
    expect(c.kind === 'skill' && c.skill.type === 'pin').toBe(false);
    // The same dice DO pin a player, so the test above really reached the pin branch.
    const again = [2, 1, 1, 1, 1, 1];
    const roller2: R.Roller = () => again.shift() ?? 1;
    const d = S.chooseSkill({
      skills: enemySkills, selfId: 'e1', turnNo: 1, signatureTurn: -99, canRetreat: false,
      npcs: [{ id: 'e1', hp: 50, maxHp: 50, status: 'up', ward: 0 }],
      players: [{ id: 'p1', status: 'up', present: true, threat: 10 }],
    }, roller2);
    expect(d.kind === 'skill' && d.skill.type === 'pin').toBe(true);
  });
  it('has the agreed ally numbers', () => {
    expect(S.ALLY_PIN_DELAY_MS).toBe(8000);
    expect(S.ALLY_RALLY_RESOLVE).toBe(15);
    expect(S.MAX_ALLIES).toBe(MAX_ALLIES);
  });
});
