import { beforeEach, describe, expect, it } from 'vitest';
import { buildRoster, deleteRow, isCustomKey, loadEra, loadRows, MAX_MEMORIES, newRow, rosterNameEntries, saveEra, saveRow, withMemory, type SoloNpcRow } from '@/lib/solo-npcs';
import { matchNames, parseMention } from '@/lib/empyreanCanon/castNpcs';

const CAMPAIGN = '1393b23b-9efd-449f-ac00-5052c7cfc33a';
const row = (key: string, extra: Partial<SoloNpcRow> = {}): SoloNpcRow => ({ id: `id-${key}`, campaign_id: CAMPAIGN, npc_key: key, name: key, custom: null, attitude: 0, memories: [], status: 'met', ...extra });

describe('the solo roster (D-38)', () => {
  it('without any rows: the canon cast of the era, unmet, at their starting attitudes', () => {
    const r = buildRoster([], 'fw');
    const dain = r.find(e => e.key === 'dain-aetos');
    if (!dain) throw new Error("Expected valid result");
    expect(dain.status).toBe('unmet');
    expect(dain.listed).toBe(true);
    expect(dain.mind.role).toMatch(/Squad leader/);
    expect(r.find(e => e.key === 'burton-varrish')).toBeUndefined();
    expect(r.find(e => e.key === 'brennan-sorrengail')?.listed).toBe(false);
  });

  it('rows carry each NPC\'s state; custom NPCs join the roster', () => {
    const custom = { name: 'Corin Vale', role: 'Second-year', look: 'Tall', personality: 'Gruff.', voice: 'Low', wants: 'Respect', facts: ['Rides a brown clubtail.'], secrets: ['Owes Dain'], attitude: 1, fight: { kind: 'rider' as const, challenge: 'hard' as const } };
    const r = buildRoster([row('dain-aetos', { attitude: 2, memories: ['Kylar held formation.'] }), row('custom-ab12', { name: 'Corin Vale', custom })], 'fw');
    const dain = r.find(e => e.key === 'dain-aetos');
    if (!dain) throw new Error("Expected valid result");
    expect(dain.status).toBe('met');
    expect(dain.attitude).toBe(2);
    expect(dain.memories).toEqual(['Kylar held formation.']);
    const corin = r.find(e => e.key === 'custom-ab12');
    if (!corin) throw new Error("Expected valid result");
    expect(corin.custom).toBe(true);
    expect(corin.mind.secrets).toEqual(['Owes Dain']);
    expect(isCustomKey(corin.key)).toBe(true);
  });

  it('someone met in one era stays on the roster in an era where they are absent', () => {
    const r = buildRoster([row('liam-mairi')], 'if');
    expect(r.find(e => e.key === 'liam-mairi')?.status).toBe('met');
  });

  it('custom NPCs can be named in the story and @mentioned; the dead cannot', () => {
    const custom = { name: 'Corin Vale', role: '', look: '', personality: 'x', voice: '', wants: '', facts: [], secrets: [], attitude: 0, fight: null };
    const names = rosterNameEntries(buildRoster([row('custom-1', { name: 'Corin Vale', custom }), row('dain-aetos', { status: 'dead' })], 'fw'));
    expect(matchNames('Corin Vale grins.', names)).toEqual(['custom-1']);
    expect(parseMention('@corin vale hey', names)).toEqual({ key: 'custom-1', line: 'hey' });
    expect(parseMention('@Dain hey', names)).toBeNull();
  });

  it('memories: one step at a time, no repeats, the last 50 kept', () => {
    let r = row('dain-aetos', { attitude: 3 });
    r = withMemory(r, 'A', 1);
    expect(r.attitude).toBe(3);
    r = withMemory(r, 'A', -5);
    expect(r.memories).toEqual(['A']);
    expect(r.attitude).toBe(2);
    for (let i = 0; i < 60; i++) r = withMemory(r, `m${i}`, 0);
    expect(MAX_MEMORIES).toBe(50);
    expect(r.memories).toHaveLength(50);
    expect(r.memories[0]).toBe('m10');
    expect(r.memories.at(-1)).toBe('m59');
  });

  it('a new row starts met, with the NPC\'s attitude', () => {
    expect(newRow(CAMPAIGN, { key: 'dain-aetos', name: 'Dain Aetos', attitude: 7 })).toMatchObject({ status: 'met', attitude: 3, memories: [], custom: null });
  });
});

describe('the era, kept per campaign on the phone', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to the first year and remembers each campaign\'s choice', () => {
    expect(loadEra(CAMPAIGN)).toBe('fw');
    saveEra(CAMPAIGN, 'if');
    expect(loadEra(CAMPAIGN)).toBe('if');
    expect(loadEra('other')).toBe('fw');
    localStorage.setItem(`empyrean-npc-era::${CAMPAIGN}`, 'junk');
    expect(loadEra(CAMPAIGN)).toBe('fw');
  });
});

describe('storage in solo_npcs', () => {
  function fakeDb() {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const result = { data: [{ id: 'x', campaign_id: CAMPAIGN, npc_key: 'dain-aetos', name: 'Dain Aetos', attitude: 9, memories: ['a', 3], status: 'weird' }], error: null };
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'upsert', 'delete']) chain[op] = (...args: unknown[]) => { calls.push({ op, args }); return chain; };
    chain.single = () => Promise.resolve({ data: result.data[0], error: null });
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return { db: { from: (t: string) => { calls.push({ op: 'from', args: [t] }); return chain; } }, calls };
  }

  it('loads and cleans rows', async () => {
    const { db, calls } = fakeDb();
    const rows = await loadRows(CAMPAIGN, db);
    expect(calls[0]).toEqual({ op: 'from', args: ['solo_npcs'] });
    expect(rows[0]).toMatchObject({ npc_key: 'dain-aetos', attitude: 3, memories: ['a'], status: 'met' });
  });

  it('saves with an upsert on the player, campaign and NPC, never sending an id', async () => {
    const { db, calls } = fakeDb();
    await saveRow(row('dain-aetos'), db);
    const up = calls.find(c => c.op === 'upsert');
    if (!up) throw new Error("Expected valid result");
    expect(up.args[1]).toEqual({ onConflict: 'user_id,campaign_id,npc_key' });
    expect(up.args[0]).not.toHaveProperty('id');
  });

  it('deletes one NPC of one campaign', async () => {
    const { db, calls } = fakeDb();
    await deleteRow(CAMPAIGN, 'custom-1', db);
    expect(calls.filter(c => c.op === 'eq').map(c => c.args)).toEqual([['campaign_id', CAMPAIGN], ['npc_key', 'custom-1']]);
  });
});
