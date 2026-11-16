import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
import { toast } from 'sonner';
import { useSoloFight, type SoloFightOptions } from '@/hooks/use-solo-fight';
import { parseFightOffer, type RulesContext } from '@/lib/empyrean-rules-client';
// The real referee stands in for the server, so these tests also prove the phone reads its replies.
import * as C from '../../../supabase/functions/empyrean-rules/combat';

const ctx: RulesContext = { campaignId: 'camp-1', riderKey: 'local', bonded: true, dragonName: 'Gwyn' };
const sheet = { level: 5, maxHp: 40, hp: 40, ac: 15, attackBonus: 7, weapons: [{ name: 'Short sword', damage: '1d6+4' }] };
const high = () => 0.99; // every roll the rider makes lands; used where the outcome must be certain

/** A tiny copy of the server's fight actions around one stored fight. */
function referee(rand: () => number = high) {
  let fight: C.Fight | null = null;
  const inboxOnEnd = [{ id: 'ev-1', kind: 'fight', reason: 'VICTORY: Cadet', xp: 10, gold: 0, hp: -3, payload: { line: '[FIGHT RESULT, binding: VICTORY.]' }, created_at: 't' }];
  const reply = (extra: Record<string, unknown> = {}) => {
    const now = Date.now();
    const view = fight ? C.viewOf(fight, now) : null;
    return { serverNow: now, ok: true, fight: view, ...(view?.status === 'ended' ? { inbox: inboxOnEnd } : {}), ...extra };
  };
  mock.invoke.mockImplementation(async (_name: string, { body }: any) => {
    const now = Date.now();
    if (body.action === 'fight_start') {
      fight = C.startFight({
        id: 'f1', riderName: body.label, level: body.sheet.level, maxHp: body.sheet.maxHp, hp: body.sheet.hp, ac: body.sheet.ac,
        attackBonus: body.sheet.attackBonus, weapons: body.sheet.weapons, foeKind: body.foeKind, count: body.count, challenge: body.challenge,
        lethal: body.lethal, arena: body.arena, dragon: null, masteryXp: 0,
      }, now, rand);
      return { data: reply(), error: null };
    }
    if (!fight) return { data: { serverNow: now, ok: true, fight: null }, error: null };
    if (body.action === 'fight_tick') { C.advance(fight, now, rand); return { data: reply(), error: null }; }
    if (body.action === 'fight_act') {
      C.advance(fight, now, rand);
      const out = C.act(fight, now, body.move, rand);
      return { data: out.ok ? reply({ strain: out.strain, usedPotion: out.usedPotion }) : { serverNow: now, ok: false, error: (out as { error: string }).error, fight: C.viewOf(fight, now) }, error: null };
    }
    if (body.action === 'fight_close') { fight = null; return { data: { serverNow: now, ok: true, fight: null }, error: null }; }
    return { data: null, error: { message: 'unknown' } };
  });
  return { get: () => fight };
}

const calls = () => ({ onInbox: vi.fn(), onStrain: vi.fn() });
const options = (c: ReturnType<typeof calls>, over: Partial<SoloFightOptions> = {}): SoloFightOptions => ({
  getContext: () => ctx, getSheet: () => sheet, riderName: 'Violet', resume: false, ...c, ...over,
});
const spar = { foeKind: 'cadet' as const, count: 1, challenge: 'easy' as const, lethal: false, arena: 'mat' as const };

describe('useSoloFight', () => {
  beforeEach(() => { mock.invoke.mockReset(); vi.mocked(toast.error).mockReset(); });
  afterEach(() => cleanup());

  it('starts a fight with the full sheet and shows what the server sent back', async () => {
    referee();
    const { result } = renderHook(() => useSoloFight(options(calls())));
    let ok = false;
    await act(async () => { ok = await result.current.start(spar); });
    expect(ok).toBe(true);
    const body = mock.invoke.mock.calls[0][1].body;
    expect(body).toMatchObject({ action: 'fight_start', campaignId: 'camp-1', label: 'Violet', foeKind: 'cadet', arena: 'mat', lethal: false });
    expect(body.sheet).toEqual(sheet);
    const f = result.current.fight;
    if (!f) throw new Error('Expected a started fight');
    expect(f.status).toBe('active');
    expect(f.lethal).toBe(false);
    expect(f.dragon).toBeNull();
    expect(f.rider).toMatchObject({ name: 'Violet', hp: 40, maxHp: 40, weapons: ['Short sword'] });
    expect(f.enemies).toHaveLength(1);
  });

  it('sends moves, flashes the hit on the enemy, and hands the end of the fight to the rules inbox', async () => {
    const server = referee();
    const c = calls();
    const { result } = renderHook(() => useSoloFight(options(c)));
    await act(async () => { await result.current.start(spar); });
    const enemy = result.current.fight?.enemies[0];
    const stored = server.get();
    if (!enemy || !stored) throw new Error('Expected a started fight');
    // Leave the cadet one blow from the floor, then land it.
    stored.enemies[0].hp = 1;
    stored.rider.readyAt = 0; // skip the opening beat
    let landed = false;
    await act(async () => { landed = await result.current.act({ type: 'attack', targetId: enemy.id, weapon: 'Short sword' }); });
    expect(landed).toBe(true);
    expect(result.current.fight?.status).toBe('ended');
    expect(result.current.fight?.outcome).toBe('victory');
    expect(result.current.flashes.some(f => f.id === enemy.id && f.kind === 'hit' && f.amount > 0)).toBe(true);
    expect(c.onInbox).toHaveBeenCalledTimes(1);
    expect(c.onInbox.mock.calls[0][0][0]).toMatchObject({ kind: 'fight', hp: -3 });
  });

  it('charges signet strain as the server counted it, and reports a refused move', async () => {
    const server = referee();
    const c = calls();
    const { result } = renderHook(() => useSoloFight(options(c)));
    await act(async () => { await result.current.start({ ...spar, challenge: 'deadly', count: 2 }); });
    const enemy = result.current.fight?.enemies[0];
    const stored = server.get();
    if (!enemy || !stored) throw new Error('Expected a started fight');
    stored.rider.readyAt = 0; // skip the opening beat
    await act(async () => { await result.current.act({ type: 'signet', targetId: enemy.id, intensity: 4, strainRoom: 10 }); });
    expect(c.onStrain).toHaveBeenCalledTimes(1);
    expect(c.onStrain.mock.calls[0][0]).toBeGreaterThan(0);
    // Straight away again: the rider is still recovering. No error toast for that; just no move.
    let again = true;
    await act(async () => { again = await result.current.act({ type: 'attack', targetId: enemy.id }); });
    expect(again).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    // Yielding has no place in a real fight; on the mat it ends the match.
    await act(async () => { await result.current.act({ type: 'yield' }); });
    expect(result.current.fight?.outcome).toBe('yield');
  });

  it('picks up a fight the server still has after a reload, and forgets it on close', async () => {
    const server = referee();
    const first = renderHook(() => useSoloFight(options(calls())));
    await act(async () => { await first.result.current.start(spar); });
    first.unmount();
    const { result } = renderHook(() => useSoloFight(options(calls(), { resume: true })));
    await waitFor(() => expect(result.current.fight?.id).toBe('f1'));
    await act(async () => { await result.current.close(); });
    expect(result.current.fight).toBeNull();
    expect(server.get()).toBeNull();
  });

  it('does nothing while the engine is off, and says so when the server cannot be reached', async () => {
    const off = renderHook(() => useSoloFight(options(calls(), { getContext: () => null })));
    let ok = true;
    await act(async () => { ok = await off.result.current.start(spar); });
    expect(ok).toBe(false);
    expect(mock.invoke).not.toHaveBeenCalled();
    mock.invoke.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { result } = renderHook(() => useSoloFight(options(calls())));
    await act(async () => { ok = await result.current.start(spar); });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.fight).toBeNull();
  });
});

describe('parseFightOffer', () => {
  it("reads the DM's hidden fight tag", () => {
    expect(parseFightOffer('Steel rings.\n<!--FIGHT:wyvern|Wyvern|2|hard|yes-->')).toEqual({ foeKind: 'wyvern', foeName: 'Wyvern', count: 2, challenge: 'hard', lethal: true });
    expect(parseFightOffer('<!--FIGHT:cadet|Jack Barlowe|1|moderate|no-->')).toMatchObject({ foeKind: 'cadet', foeName: 'Jack Barlowe', lethal: false });
  });
  it('falls back safely on a sloppy tag and finds nothing in ordinary text', () => {
    expect(parseFightOffer('<!--FIGHT:ogre||9|brutal|-->')).toEqual({ foeKind: 'soldier', foeName: 'Soldier', count: 4, challenge: 'moderate', lethal: true });
    expect(parseFightOffer('They fight. <!--SITUATION:combat-->')).toBeNull();
    expect(parseFightOffer(null)).toBeNull();
  });
});