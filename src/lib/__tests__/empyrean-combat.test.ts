import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';

import * as C from '../../../supabase/functions/empyrean-rules/combat';

import * as M from '../../../supabase/functions/empyrean-rules/minigames';

import * as PR from '../../../supabase/functions/npc-combat/rules';

import * as R from '../../../supabase/functions/empyrean-rules/rules';
import { freshState, normalizeState, passTime, rest, buildRuleFacts, type Rand } from '../../../supabase/functions/empyrean-rules/rules';



const always = (v: number): Rand => () => v;

const seeded = (seed: number): Rand => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const T0 = 1_000_000;

const start = (over: Partial<C.StartInput> = {}, rand: Rand = always(0.5)) => C.startFight({

  id: 'f1', riderName: 'Asha', level: 4, maxHp: 30, hp: 30, ac: 14, attackBonus: 5, weapons: [{ name: 'Dagger', damage: '1d4+3' }],

  foeKind: 'cadet', count: 1, challenge: 'moderate', lethal: true, arena: 'ground', dragon: null, masteryXp: 0, ...over,

}, T0, rand);



describe('shared rules stay in step', () => {

  it('the mini-game rules are the same file the party referee and the phone use', () => {

    const mine = readFileSync('supabase/functions/empyrean-rules/minigames.ts', 'utf8');

    expect(mine).toBe(readFileSync('src/lib/combatMinigames.ts', 'utf8'));

    expect(mine).toBe(readFileSync('supabase/functions/npc-combat/minigames.ts', 'utf8'));

  });

  it('dice and attack rolls agree with the party referee', () => {

    for (const text of ['1d6', '2d8+3', '1d4-1', '3d6 + 2', 'sword', '']) {

      const a = C.parseDice(text), b = PR.parseDice(text);

      expect(a ? [a.count, a.sides, a.bonus] : null).toEqual(b ? [b.count, b.sides, b.bonus] : null);

    }

    for (let face = 1; face <= 20; face++) {

      const mine = C.attackRoll(always((face - 0.5) / 20), 4, 15);

      const theirs = PR.resolveAttack(() => face, 4, 15);

      expect([mine.d20, mine.hit, mine.crit]).toEqual([theirs.d20, theirs.hit, theirs.crit]);

    }

    for (let lv = 1; lv <= 20; lv++) expect(C.proficiency(lv)).toBe(PR.proficiency(lv));

  });

});



describe('starting a fight', () => {

  it('scales enemies by challenge and count, and staggers their first moves', () => {

    const easy = start({ challenge: 'easy' }), deadly = start({ challenge: 'deadly' });

    expect(deadly.enemies[0].maxHp).toBeGreaterThan(easy.enemies[0].maxHp);

    expect(deadly.enemies[0].intervalMs).toBeLessThan(easy.enemies[0].intervalMs);

    const three = start({ count: 3, foeKind: 'wyvern', foeName: 'Wyvern' });

    expect(three.enemies.map(e => e.name)).toEqual(['Wyvern 1', 'Wyvern 2', 'Wyvern 3']);

    expect(new Set(three.enemies.map(e => e.nextAt)).size).toBe(3);

    expect(start({ count: 99 }).enemies).toHaveLength(4);

    expect(start({ foeKind: 'nonsense' }).enemies[0].kind).toBe('soldier');

  });

  it('keeps the dragon off the mat, and a match on the mat is never lethal', () => {

    const dragon = { name: 'Gwyn', hp: null, bond: 45 };

    const mat = start({ arena: 'mat', lethal: true, dragon });

    expect(mat.dragon).toBeNull();

    expect(mat.lethal).toBe(false);

    const field = start({ dragon });

    expect(field.dragon).toMatchObject({ name: 'Gwyn', hp: 108, maxHp: 108, atk: 6 });

    expect(start({ dragon: { name: 'Gwyn', hp: 40, bond: 45 } }).dragon?.hp).toBe(40);

    expect(start({ dragon: { name: 'Gwyn', hp: 0, bond: 45 } }).dragon).toBeNull();

  });

});



describe('real time', () => {

  it('nothing happens before its moment, and each enemy acts on its own timer', () => {

    const f = start({}, always(0.999));

    const first = f.enemies[0].nextAt;

    C.advance(f, first - 1, always(0.999));

    expect(f.rider.hp).toBe(30);

    C.advance(f, first, always(0.999));

    expect(f.rider.hp).toBeLessThan(30); // a natural 20

    expect(f.enemies[0].nextAt).toBe(first + f.enemies[0].intervalMs);

    expect(C.nextDueAt(f)).toBe(f.enemies[0].nextAt);

  });

  it('stands still while the phone is away', () => {

    const f = start({}, always(0.999));

    const first = f.enemies[0].nextAt;

    C.advance(f, T0 + 10 * 60_000, always(0.999));

    expect(f.rider.hp).toBe(30);

    expect(f.enemies[0].nextAt).toBeGreaterThan(T0 + 9 * 60_000);

    expect(f.enemies[0].nextAt - first).toBe(10 * 60_000 - 1000);

  });

  it('telegraphs a big move, then lands it at its strike time', () => {

    const f = start({}, always(0.5));

    const e = f.enemies[0];

    const turnAt = e.nextAt;

    C.advance(f, turnAt, always(0)); // rand 0: a big move, aimed at the rider

    expect(e.pending).toMatchObject({ move: 'heavy', target: 'rider' });

    if (!e.pending?.clash) throw new Error('Expected Counter Clash');

    expect(e.pending.clash).not.toBeNull();

    const strike = e.pending.strikeAt;

    // The first ring appears a fixed lead after the warning, and the next turn comes a full interval after the blow.

    expect(M.clashStartsAt(e.pending.clash, strike)).toBe(turnAt + C.WINDUP_LEAD_MS);

    expect(e.nextAt).toBe(strike + e.intervalMs);

    expect(C.nextDueAt(f)).toBe(strike);

    C.advance(f, strike - 1, always(0.5));

    expect(f.rider.hp).toBe(30);

    C.advance(f, strike, always(0.5));

    expect(e.pending).toBeNull();

    expect(f.rider.hp).toBeLessThan(30);

  });

});



describe('Counter Clash', () => {

  const windUp = () => {

    const f = start({}, always(0.5));

    const e = f.enemies[0];

    C.advance(f, e.nextAt, always(0));

    if (!e.pending?.clash) throw new Error('Expected Counter Clash');

    return { f, e, chain: e.pending.clash, strike: e.pending.strikeAt };

  };

  it('perfect taps turn the blow aside and counter', () => {

    const { f, e, chain, strike } = windUp();

    for (const s of chain.swings) {

      const zero = M.swingTimes(s, strike).zero;

      expect(C.clashTap(f, zero + 10, e.id, s.side, zero)).toMatchObject({ ok: true, quality: 'perfect' });

    }

    const hpBefore = e.hp;

    C.advance(f, strike, always(0.5));

    expect(f.rider.hp).toBe(30);

    expect(e.hp).toBeLessThan(hpBefore);

    expect(f.log.some(l => l.text.startsWith('PERFECT!'))).toBe(true);

    expect(f.rider.streak).toBe(1);

  });

  it('a wrong side still hurts, a tap for another enemy or a late clock is refused', () => {

    const { f, e, chain, strike } = windUp();

    const s = chain.swings[0];

    const zero = M.swingTimes(s, strike).zero;

    expect(C.clashTap(f, zero, 'e9', s.side, zero).ok).toBe(false);

    expect(C.clashTap(f, zero, e.id, 'sideways', zero).ok).toBe(false);

    const wrong = s.side === 'left' ? 'right' : 'left';

    expect(C.clashTap(f, zero + 10, e.id, wrong, zero).quality).toBe('wrong');

    C.advance(f, strike, always(0.5));

    expect(f.rider.hp).toBeLessThan(30);

    expect(f.rider.streak).toBe(0);

  });

});



describe("the rider's moves", () => {

  it('wait on the cooldown', () => {

    const f = start();

    expect(C.act(f, T0, { type: 'attack', targetId: 'e1' }, always(0.999))).toMatchObject({ ok: false });

    const ready = f.rider.readyAt;

    expect(C.act(f, ready, { type: 'attack', targetId: 'e1' }, always(0.999)).ok).toBe(true);

    expect(f.rider.readyAt).toBe(ready + C.RIDER_COOLDOWN_MS);

    expect(C.act(f, ready + 1000, { type: 'attack', targetId: 'e1' }, always(0.999)).ok).toBe(false);

  });

  it('an attack that drops the last enemy wins the fight', () => {

    const f = start();

    f.enemies[0].hp = 1;

    C.act(f, f.rider.readyAt, { type: 'attack', targetId: 'e1', weapon: 'dagger' }, always(0.999));

    expect(f).toMatchObject({ status: 'ended', outcome: 'victory' });

    expect(C.nextDueAt(f)).toBeNaN();

    expect(C.act(f, f.rider.readyAt + 9000, { type: 'attack', targetId: 'e1' }, always(0.5)).ok).toBe(false);

  });

  it('the signet costs strain, eased by mastery, and refuses to burn the rider out', () => {

    const f = start({ masteryXp: 40 }); // rank 2

    const at = f.rider.readyAt;

    expect(C.act(f, at, { type: 'signet', targetId: 'e1', intensity: 5, strainRoom: 3 }, always(0.5))).toMatchObject({ ok: false });

    const r = C.act(f, at, { type: 'signet', targetId: 'e1', intensity: 5, strainRoom: 4 }, always(0.999));

    expect(r).toMatchObject({ ok: true, strain: 4 });

    expect(f.strainSpent).toBe(4);

    expect(f.enemies[0].hp).toBeLessThan(f.enemies[0].maxHp);

  });

  it('a potion heals up to full; fleeing needs a roll; the mat allows only yielding', () => {

    const f = start({ hp: 10 });

    expect(C.act(f, f.rider.readyAt, { type: 'potion', dice: '2d4+2', name: 'Healing draught' }, always(0.999))).toMatchObject({ ok: true, usedPotion: true });

    expect(f.rider.hp).toBe(20);

    expect(C.act(f, f.rider.readyAt, { type: 'flee' }, always(0)).ok).toBe(true);

    expect(f.status).toBe('active');

    C.act(f, f.rider.readyAt, { type: 'flee' }, always(0.999));

    expect(f).toMatchObject({ status: 'ended', outcome: 'fled' });

    expect(C.act(start(), T0, { type: 'yield' }, always(0.5)).ok).toBe(false);

    const mat = start({ arena: 'mat' });

    expect(C.act(mat, T0 + 2000, { type: 'flee' }, always(0.5)).ok).toBe(false);

    C.act(mat, T0, { type: 'yield' }, always(0.5));

    expect(mat.outcome).toBe('yield');

  });

});



describe('the dragon', () => {

  const dragon = { name: 'Gwyn', hp: null, bond: 70 };

  it('acts on its own timer and goes for the enemy', () => {

    const f = start({ dragon, foeKind: 'wyvern' }, always(0.999));

    f.enemies[0].nextAt = T0 + 999_000; // hold the wyvern still for this check

    if (!f.dragon) throw new Error('Expected dragon');

    C.advance(f, f.dragon.nextAt, always(0.999));

    expect(f.enemies[0].hp).toBeLessThan(f.enemies[0].maxHp);

    expect(f.dragon.turns).toBe(1);

  });

  it('at a deep bond it can shield its rider from a blow already coming', () => {

    const f = start({ dragon, foeKind: 'cadet' }, always(0.5));

    const e = f.enemies[0];

    if (!f.dragon) throw new Error('Expected dragon');

    f.dragon.nextAt = T0 + 999_000;

    C.advance(f, e.nextAt, always(0));

    if (!e.pending) throw new Error('Expected pending move');

    f.dragon.nextAt = e.pending.strikeAt - 500;

    C.advance(f, f.dragon.nextAt, always(0.1));

    expect(e.pending.warded).toBe(true);

  });

  it('canon: if the dragon is killed the rider dies with it', () => {

    const f = start({ dragon: { name: 'Gwyn', hp: 3, bond: 70 }, foeKind: 'wyvern' }, always(0.5));

    if (!f.dragon) throw new Error('Expected dragon');

    f.dragon.nextAt = T0 + 999_000;

    // rand 0.55: under the wyvern's 0.6 pull toward the dragon, over its 0.45 chance of a big move, and a hit

    C.advance(f, f.enemies[0].nextAt, always(0.55));

    expect(f).toMatchObject({ status: 'ended', outcome: 'defeat', dragonDied: true });

    const s = C.settle(f, always(0.9));

    expect(s.events[0].payload).toMatchObject({ dragonDied: true, outcome: 'defeat' });

    expect(s.dragonHp).toBe(0);

    expect(s.line).toContain('dies with the bond');

  });

});



describe('how fights end', () => {

  it('a rider at 0 in a real fight is down; on the mat they are left at 1 HP', () => {

    const real = start({ hp: 1 }, always(0.999));

    C.advance(real, real.enemies[0].nextAt, always(0.999));

    expect(real).toMatchObject({ status: 'ended', outcome: 'defeat', riderDown: true });

    expect(C.settle(real, always(0.9)).events[0]).toMatchObject({ hp: -1, xp: 0 });

    const mat = start({ hp: 1, arena: 'mat' }, always(0.999));

    C.advance(mat, mat.enemies[0].nextAt, always(0.999));

    expect(mat).toMatchObject({ outcome: 'defeat', riderDown: false });

    expect(mat.rider.hp).toBe(1);

    const s = C.settle(mat, always(0.9));

    expect(s.condition?.name).toBe('Battered');

    expect(s.events[0].hp).toBe(0);

  });

  it('victory pays XP by challenge, count and level, a quarter on the mat, keyed to the fight', () => {

    const f = start({ count: 2, challenge: 'hard' });

    for (const e of f.enemies) e.hp = 1;

    C.act(f, f.rider.readyAt, { type: 'attack', targetId: 'e1' }, always(0.999));

    C.act(f, f.rider.readyAt, { type: 'attack', targetId: 'e2' }, always(0.999));

    const s = C.settle(f, always(0.9));

    expect(s.xp).toBe(Math.round(180 * 1.5 * 1));

    expect(s.events[0]).toMatchObject({ kind: 'fight', idem_key: 'fight:f1', xp: 270 });

    expect(s.line).toMatch(/^\[FIGHT RESULT, binding: VICTORY against 2 cadets/);

    const mat = start({ arena: 'mat', challenge: 'hard' });

    mat.enemies[0].hp = 1;

    C.act(mat, mat.rider.readyAt, { type: 'attack', targetId: 'e1' }, always(0.999));

    expect(C.settle(mat, always(0.9)).xp).toBe(45);

  });

  it('whole fights always end, whatever the dice', () => {

    for (let seed = 1; seed <= 25; seed++) {

      const rand = seeded(seed);

      const f = start({ count: 1 + (seed % 3), foeKind: C.FOE_KINDS[seed % C.FOE_KINDS.length], challenge: C.CHALLENGES[seed % 4], dragon: seed % 2 ? { name: 'Gwyn', hp: null, bond: 50 } : null }, rand);

      let now = T0;

      for (let step = 0; step < 4000 && f.status === 'active'; step++) {

        now += 1000;

        C.advance(f, now, rand);

        const target = f.enemies.find(e => e.status === 'up');

        if (f.status === 'active' && target && now >= f.rider.readyAt) C.act(f, now, { type: 'attack', targetId: target.id }, rand);

      }

      expect(f.status).toBe('ended');

      expect(['victory', 'defeat']).toContain(f.outcome);

      expect(f.rider.hp).toBeGreaterThanOrEqual(0);

      const view = C.viewOf(f, now);

      expect(view.nextDueAt).toBeNull();

      expect(JSON.parse(JSON.stringify(C.cleanFight(JSON.parse(JSON.stringify(f)))))).toEqual(JSON.parse(JSON.stringify(f)));

    }

  });

});



describe('between fights', () => {

  // Step 2 is deliberately not installed yet. Optional reads keep these checks runnable
  // without declaring missing production fields or suppressing type errors.
  type DragonBody = { name: string; hp: number; maxHp: number };
  const futureState = (state: R.CampaignState) => state as R.CampaignState & { fight?: unknown; dragon?: DragonBody | null };
  const mendDragon = (body: DragonBody | null | undefined, share: number): DragonBody | null | undefined => {
    const mend: unknown = Reflect.get(R, 'mendDragon');
    if (typeof mend !== 'function') throw new Error('Step 2 dragon recovery is not installed.');
    return mend(body, share);
  };

  it('the campaign state keeps the fight and the dragon, and mends the dragon', () => {

    const f = start();

    const s = futureState(normalizeState(JSON.parse(JSON.stringify({ ...freshState(), fight: f, dragon: { name: 'Gwyn', hp: 20, maxHp: 108 } }))));

    expect(C.cleanFight(s.fight)?.id).toBe('f1');

    expect(s.dragon).toEqual({ name: 'Gwyn', hp: 20, maxHp: 108 });

    expect(normalizeState({ fight: 'nope', dragon: { hp: 5 } })).toMatchObject({ fight: null, dragon: null });

    expect(mendDragon(s.dragon, 0.5)?.hp).toBe(74);

    expect(mendDragon({ name: 'Gwyn', hp: 0, maxHp: 108 }, 0.5)?.hp).toBe(0);

    const slept = rest(s, 21 * 60, 'long');

    expect(slept.ok && futureState(slept.state).dragon?.hp).toBe(74);

    const hunted = passTime(s, 600, 4, 'hunt', true);

    expect(hunted.ok && futureState(hunted.state).dragon?.hp).toBe(47);

  });

  it('tells the DM that fights belong to the app, and when the dragon is hurt', () => {

    const s = { ...freshState(), dragon: { name: 'Gwyn', hp: 20, maxHp: 108 } };

    const facts = buildRuleFacts(s, { minute: 600, masteryXp: 0, bond: 50, bonded: true, traveling: false });

    expect(facts).toContain('<!--FIGHT:kind|name|count|challenge|lethal-->');

    expect(facts).toContain('wounded from a fight (20/108)');

  });

});
