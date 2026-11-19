// The progression web's Ward, Regeneration, Adrenaline and Lifeblood: the rules the server enforces.

import { describe, expect, it } from 'vitest';

import * as C from '../../../supabase/functions/empyrean-rules/combat';

import * as R from '../../../supabase/functions/empyrean-rules/rules';

import * as W from '../../../supabase/functions/empyrean-rules/web';



const always = (v: number): R.Rand => () => v;

const T0 = 1_000_000;

const perks = (over: Partial<W.WebBonuses> = {}): W.WebBonuses => ({ ...W.NO_BONUSES, ...over });

const start = (over: Partial<C.StartInput> = {}, rand: R.Rand = always(0.5)) => C.startFight({

  id: 'f1', riderName: 'Asha', level: 4, maxHp: 30, hp: 30, ac: 14, attackBonus: 5, weapons: [{ name: 'Dagger', damage: '1d4+3' }],

  foeKind: 'cadet', count: 1, challenge: 'moderate', lethal: true, arena: 'ground', dragon: null, masteryXp: 0, ...over,

}, T0, rand);

const ready = (f: C.Fight) => f.rider.readyAt + 10;

const texts = (f: C.Fight) => f.log.map(e => e.text);

const sheet = R.normalizeSheet({ level: 3, maxHp: 24 });



describe('Ward: a shield kept by the server', () => {

  it('a new or bigger Ward is granted at once; a smaller one clamps; the same size changes nothing', () => {

    const s0 = R.freshState();

    const s1 = R.syncWard(s0, 4);

    expect([s1.ward, s1.wardCap]).toEqual([4, 4]);

    expect(R.syncWard(s1, 4)).toBe(s1);

    const hurt = { ...s1, ward: 1 };

    const s2 = R.syncWard(hurt, 8);

    expect([s2.ward, s2.wardCap]).toEqual([5, 8]);

    const s3 = R.syncWard({ ...s2, ward: 8 }, 4);

    expect([s3.ward, s3.wardCap]).toEqual([4, 4]);

    expect(R.syncWard(s0, 0)).toBe(s0);

  });



  it('survives a save and a read, and damaged numbers are made safe', () => {

    const s = R.normalizeState(JSON.parse(JSON.stringify({ ...R.freshState(), ward: 5, wardCap: 8, regenAt: 720 })));

    expect([s.ward, s.wardCap, s.regenAt]).toEqual([5, 8, 720]);

    const bad = R.normalizeState({ ward: 999, wardCap: 14, regenAt: 'x' });

    expect([bad.ward, bad.wardCap, bad.regenAt]).toEqual([14, 14, 0]);

    expect(R.normalizeState({}).ward).toBe(0);

  });



  it('damage on its way to the sheet goes through the Ward first; a fight result and blood do not', () => {

    const s = { ...R.freshState(), ward: 5, wardCap: 8 };

    const out = R.soakEvents(s, [

      { kind: 'travel', hp: -3, idem_key: 'a' },

      { kind: 'check', hp: -4, idem_key: 'b' },

      { kind: 'fight', hp: -9, idem_key: 'c' },

      { kind: 'lifeblood', hp: -6, idem_key: 'd' },

      { kind: 'regen', hp: 2, idem_key: 'e' },

    ]);

    expect(out.events.map(e => e.hp)).toEqual([0, -2, -9, -6, 2]);

    expect(out.events[0].payload?.wardSoaked).toBe(3);

    expect(out.events[1].payload?.wardSoaked).toBe(2);

    expect(out.state.ward).toBe(0);

    // No Ward, or nothing to soak: nothing is touched.

    const none = R.freshState();

    const events = [{ kind: 'check', hp: -4, idem_key: 'b' }];

    expect(R.soakEvents(none, events).events).toBe(events);

  });



  it('a failed physical check is soaked, and the ruling says so', () => {

    const base = { d20: 1, modifier: 0, dc: 25, risk: 'physical' as const, label: 'Climb', masteryXp: 0, bond: null };

    const plain = R.resolveCheck(R.freshState(), 600, sheet, base, always(0.5));

    expect(plain.hp).toBeLessThan(0);

    const dmg = -plain.hp;

    const warded = R.resolveCheck({ ...R.freshState(), ward: 4, wardCap: 4 }, 600, sheet, base, always(0.5));

    expect(warded.hp).toBe(-(dmg - Math.min(4, dmg)));

    expect(warded.state.ward).toBe(4 - Math.min(4, dmg));

    expect(warded.line).toContain(`the Ward absorbed ${Math.min(4, dmg)} damage`);

    expect(warded.events[0].hp).toBe(warded.hp);

    expect(plain.line).not.toContain('Ward');

  });



  it('damage the DM narrated asks the Ward first', () => {

    const s = { ...R.freshState(), ward: 5, wardCap: 8 };

    expect(R.soakDamage(s, 3)).toMatchObject({ soaked: 3, state: { ward: 2 } });

    expect(R.soakDamage(s, 9)).toMatchObject({ soaked: 5, state: { ward: 0 } });

    expect(R.soakDamage(R.freshState(), 9).soaked).toBe(0);

    expect(R.soakDamage(s, -4).soaked).toBe(0);

  });



  it('refills on a long rest; half on a short rest only with Quick Ward', () => {

    const s = { ...R.freshState(), ward: 1, wardCap: 14 };

    const long = R.rest(s, 20 * 60, 'long');

    expect(long.ok && long.state.ward).toBe(14);

    const short = R.rest(s, 600, 'short');

    expect(short.ok && short.state.ward).toBe(1);

    const quick = R.rest(s, 600, 'short', true);

    expect(quick.ok && quick.state.ward).toBe(7);

    expect(quick.ok && quick.summary).toContain('Your Ward is back to 7.');

    const full = R.rest({ ...s, ward: 12 }, 600, 'short', true);

    expect(full.ok && full.state.ward).toBe(12);

    expect(full.ok && full.summary).not.toContain('Ward');

  });



  it('in a fight the Ward takes hits before HP, and what is left is kept', () => {

    const f = start({ web: perks({ wardMax: 8 }), shield: 5 });

    expect([f.rider.shield, f.rider.shieldMax]).toEqual([5, 8]);

    f.enemies[0].nextAt = T0 + 100;

    C.advance(f, T0 + 200, always(0.99));

    const lostHp = 30 - f.rider.hp;

    expect(f.rider.shield).toBe(0);

    expect(texts(f).some(t => t === 'Your Ward absorbs 5.')).toBe(true);

    expect(lostHp).toBeGreaterThanOrEqual(0);

    expect(C.viewOf(f, T0 + 200).rider).toMatchObject({ shield: 0, shieldMax: 8 });

    f.status = 'ended'; f.outcome = 'victory';

    expect(C.settle(f, always(0.9)).shield).toBe(0);

  });



  it('Bulwark starts every fight with a full Ward; a rider with no Ward has none', () => {

    expect(start({ web: perks({ wardMax: 24, wardFightRefill: true }), shield: 0 }).rider.shield).toBe(24);

    expect(start({ web: perks({ wardMax: 24 }), shield: 99 }).rider.shield).toBe(24);

    const plain = start();

    expect(plain.rider.shield).toBeUndefined();

    expect(plain.web).toBeUndefined();

    plain.status = 'ended'; plain.outcome = 'victory';

    expect(C.settle(plain, always(0.9)).shield).toBeNull();

    expect(C.viewOf(plain, T0).rider).toMatchObject({ shield: 0, shieldMax: 0, adrenaline: 0, bloodPrice: 0 });

    expect(start({ web: perks() }).web).toBeUndefined();

  });

});



describe('Regeneration', () => {

  it('pays HP for each whole game hour, only what the rider is missing', () => {

    const s0 = R.regen(R.freshState(), 600, 2, 10).state;

    expect(s0.regenAt).toBe(600);

    expect(R.regen(s0, 650, 2, 10).events).toEqual([]);

    const three = R.regen(s0, 600 + 185, 2, 10);

    expect(three.events.length).toBe(1);

    expect(three.events[0]).toMatchObject({ kind: 'regen', hp: 6 });

    expect(three.state.regenAt).toBe(780);

    const nearlyFull = R.regen(s0, 780, 2, 1);

    expect(nearlyFull.events[0].hp).toBe(1);

    const full = R.regen(s0, 780, 2, 0);

    expect(full.events).toEqual([]);

    expect(full.state.regenAt).toBe(780);

  });



  it('does nothing without the perk, heals nothing when HP is unknown, and never pays for more than a day at once', () => {

    const s = R.freshState();

    expect(R.regen(s, 600, 0, 10)).toEqual({ state: s, events: [] });

    const s0 = R.regen(s, 600, 1, 10).state;

    const unknown = R.regen(s0, 900, 1, null);

    expect(unknown.events).toEqual([]);

    expect(unknown.state.regenAt).toBe(900);

    const week = R.regen(s0, 600 + 7 * R.DAY, 1, 999);

    expect(week.events[0].hp).toBe(24);

    expect(week.state.regenAt).toBe(600 + 7 * R.DAY);

  });



  it('Wellspring: what HP cannot hold refills the Ward', () => {

    const s0 = { ...R.regen(R.freshState(), 600, 3, 0).state, ward: 2, wardCap: 14 };

    const r = R.regen(s0, 720, 3, 1, true);

    expect(r.events[0].hp).toBe(1);

    expect(r.state.ward).toBe(7);

    expect(r.events[0].reason).toContain('1 HP and 5 Ward');

    const wardOnly = R.regen(s0, 720, 3, 0, true);

    expect(wardOnly.events[0].hp).toBe(0);

    expect(wardOnly.state.ward).toBe(8);

    expect(R.regen(s0, 720, 3, 0, false).state.ward).toBe(2);

  });



  it('a long rest starts the count again from waking', () => {

    const s0 = R.regen(R.freshState(), 600, 1, 10).state;

    const long = R.rest(s0, 20 * 60, 'long');

    expect(long.ok).toBe(true);

    if (!long.ok) return;

    expect(long.state.regenAt).toBe(long.setMinute);

    expect(R.regen(long.state, long.setMinute ?? 0, 1, 10).events).toEqual([]);

  });



  it('in a fight: HP on each of the rider\'s turns, then the Ward with Wellspring', () => {

    const f = start({ hp: 20, web: perks({ regenTurn: 2, regenWard: true, wardMax: 8 }), shield: 3 });

    C.act(f, ready(f), { type: 'attack', targetId: f.enemies[0].id }, always(0.5));

    expect(f.rider.hp).toBe(22);

    expect(texts(f)).toContain('Regeneration: +2 HP.');

    f.rider.hp = 29;

    C.act(f, ready(f), { type: 'attack', targetId: f.enemies[0].id }, always(0.5));

    expect(f.rider.hp).toBe(30);

    expect(f.rider.shield).toBe(4);

    C.act(f, ready(f), { type: 'attack', targetId: f.enemies[0].id }, always(0.5));

    expect(f.rider.shield).toBe(6);

    // A move that is refused heals nothing.

    const before = f.rider.shield;

    expect(C.act(f, f.rider.readyAt - 3000, { type: 'attack', targetId: f.enemies[0].id }, always(0.5)).ok).toBe(false);

    expect(f.rider.shield).toBe(before);

  });

});



describe('Adrenaline', () => {

  const adr = perks({ adrDamage: 2, adrHit: 1, adrDouble: true, adrHasteMs: 1000 });

  it('is off above half HP, on at half, doubled at a quarter', () => {

    const f = start({ web: adr });

    expect(C.adrenaline(f)).toEqual({ level: 0, damage: 0, hit: 0, hasteMs: 0 });

    f.rider.hp = 15;

    expect(C.adrenaline(f)).toEqual({ level: 1, damage: 2, hit: 1, hasteMs: 1000 });

    f.rider.hp = 7;

    expect(C.adrenaline(f)).toEqual({ level: 2, damage: 4, hit: 2, hasteMs: 1000 });

    expect(C.viewOf(f, T0).rider.adrenaline).toBe(2);

    const noDouble = start({ web: perks({ adrDamage: 1 }) });

    noDouble.rider.hp = 2;

    expect(C.adrenaline(noDouble)).toMatchObject({ level: 1, damage: 1 });

    const none = start();

    none.rider.hp = 2;

    expect(C.adrenaline(none).level).toBe(0);

  });



  it('adds its damage to a hit and names itself', () => {

    const hit = (hp: number, web?: W.WebBonuses) => {

      const f = start({ web });

      f.rider.hp = hp; f.enemies[0].hp = 500; f.enemies[0].maxHp = 500;

      C.act(f, ready(f), { type: 'attack', targetId: f.enemies[0].id }, always(0.5));

      return { lost: 500 - f.enemies[0].hp, log: texts(f).join(' | ') };

    };

    const plain = hit(10);

    const rushed = hit(10, adr);

    expect(rushed.lost - plain.lost).toBe(2);

    expect(rushed.log).toContain('(adrenaline +2)');

    expect(plain.log).not.toContain('adrenaline');

    expect(hit(30, adr).lost).toBe(plain.lost);

    expect(hit(5, adr).lost - plain.lost).toBe(4);

  });



  it('Blood Up shortens the wait by a second, never below the floor', () => {

    const wait = (hp: number, web?: W.WebBonuses, prodigy = 0) => {

      const f = start({ web, prodigy });

      f.rider.hp = hp; f.enemies[0].hp = 500;

      const at = ready(f);

      C.act(f, at, { type: 'attack', targetId: f.enemies[0].id }, always(0.5));

      return f.rider.readyAt - at;

    };

    expect(wait(30, adr)).toBe(8000);

    expect(wait(10, adr)).toBe(7000);

    expect(wait(10)).toBe(8000);

    expect(wait(10, perks({ adrHasteMs: 4000 }), 5)).toBe(C.RIDER_COOLDOWN_FLOOR_MS);

  });

});



describe('Lifeblood', () => {

  const terms = (hp: number | null, price = 4, ease = false): R.BloodTerms => ({ price, hp, ease });

  it('pays in HP only for what does not fit under the limit, and never down to 0', () => {

    expect(R.bloodFor(4, 4, terms(30))).toEqual({ points: 0, hp: 0 });

    expect(R.bloodFor(4, 1, terms(30))).toEqual({ points: 3, hp: 12 });

    expect(R.bloodFor(4, 1, terms(30, 2))).toEqual({ points: 3, hp: 6 });

    expect(R.bloodFor(4, 0, terms(9))).toEqual({ points: 2, hp: 8 });

    expect(R.bloodFor(4, 0, terms(4))).toEqual({ points: 0, hp: 0 });

    expect(R.bloodFor(4, 1, terms(null))).toEqual({ points: 0, hp: 0 });

    expect(R.bloodFor(4, 1, null)).toEqual({ points: 0, hp: 0 });

    expect(R.bloodFor(4, null, terms(30))).toEqual({ points: 0, hp: 0 });

  });



  it('a story channel bigger than the room: strain lands on the limit, the rest is HP, and it costs bond', () => {

    const s = { ...R.freshState(), strain: 6 };

    const r = R.channelSignet(s, 600, 4, 0, 0, 8, false, terms(30));

    expect(r.state.strain).toBe(8);

    expect([r.bloodPoints, r.bloodHp]).toEqual([2, 8]);

    expect(r.events.map(e => e.kind)).toEqual(['strain_limit', 'lifeblood']);

    expect(r.events[1]).toMatchObject({ hp: -8, payload: { points: 2, hp: 8 } });

    expect(new Set(r.events.map(e => e.idem_key)).size).toBe(2);

    // Blood is the rider's own: the Ward does not take it.

    expect(R.soakEvents({ ...r.state, ward: 9, wardCap: 9 }, r.events).events[1].hp).toBe(-8);

  });



  it('without Lifeblood the same channel is what it always was', () => {

    const s = { ...R.freshState(), strain: 6 };

    const r = R.channelSignet(s, 600, 4, 0, 0, 8);

    expect(r.state.strain).toBe(8);

    expect([r.bloodPoints, r.bloodHp]).toEqual([0, 0]);

    expect(r.events.map(e => e.kind)).toEqual(['strain_limit']);

    const fits = R.channelSignet({ ...R.freshState(), strain: 2 }, 600, 4, 0, 0, 8, false, terms(30));

    expect(fits.bloodPoints).toBe(0);

    expect(fits.events).toEqual([]);

  });



  it('Bloodletting eases strain by 1 after a blood-paid channel, and the next one costs bond again', () => {

    const r = R.channelSignet({ ...R.freshState(), strain: 6 }, 600, 4, 0, 0, 8, false, terms(30, 4, true));

    expect(r.state.strain).toBe(7);

    const again = R.channelSignet(r.state, 700, 4, 0, 0, 8, false, terms(22, 4, true));

    expect(again.bloodPoints).toBe(3);

    expect(again.events.map(e => e.kind)).toEqual(['strain_limit', 'lifeblood']);

    expect(again.state.strain).toBe(7);

  });



  it('at the limit already, a blood-paid channel still costs bond', () => {

    const s = { ...R.freshState(), strain: 8 };

    const pushed = R.pushedPast(s, 8, [], 'test');

    expect(pushed.events.map(e => e.kind)).toEqual(['strain_limit']);

    expect(pushed.events[0].payload).toMatchObject({ limit: 8, blood: true });

    const already = R.pushedPast(s, 8, pushed.events, 'test');

    expect(already.events.length).toBe(1);

    expect(R.pushedPast(s, null, [], 'test').events).toEqual([]);

    const r = R.channelSignet(s, 600, 2, 0, 0, 8, false, terms(30));

    expect(r.events.map(e => e.kind)).toEqual(['strain_limit', 'lifeblood']);

    expect(r.state.strain).toBe(8);

  });



  it('in a fight: refused without it, paid from HP with it, and never the last HP', () => {

    const go = (web: W.WebBonuses | undefined, hp: number, intensity: number, room: number) => {

      const f = start({ web, hp });

      f.enemies[0].hp = 500; f.enemies[0].maxHp = 500;

      const r = C.act(f, ready(f), { type: 'signet', targetId: f.enemies[0].id, intensity, strainRoom: room }, always(0.5));

      return { r, f };

    };

    const refused = go(undefined, 30, 4, 1);

    expect(refused.r).toEqual({ ok: false, error: 'That much power would burn you out. Channel less.' });

    const paid = go(perks({ bloodPrice: 4 }), 30, 4, 1);

    expect(paid.r).toMatchObject({ ok: true, strain: 1, blood: 3 });

    expect(paid.f.rider.hp).toBe(18);

    expect(texts(paid.f)).toContain('You push past your limit and pay 12 HP in blood.');

    const tooDear = go(perks({ bloodPrice: 4 }), 12, 4, 1);

    expect(tooDear.r).toEqual({ ok: false, error: 'You do not have the blood to pay for that. Channel less.' });

    expect(tooDear.f.rider.hp).toBe(12);

    const fits = go(perks({ bloodPrice: 4 }), 30, 4, 4);

    expect(fits.r).toMatchObject({ ok: true, strain: 4 });

    expect('blood' in fits.r).toBe(false);

    expect(fits.f.rider.hp).toBe(30);

  });



  it('Heartfire: a blood-paid strike rolls 2 extra dice; a normal strike does not', () => {

    const dmg = (web: W.WebBonuses, room: number) => {

      const f = start({ web });

      f.enemies[0].hp = 500; f.enemies[0].maxHp = 500;

      C.act(f, ready(f), { type: 'signet', targetId: f.enemies[0].id, intensity: 4, strainRoom: room }, always(0.5));

      return { lost: 500 - f.enemies[0].hp, log: texts(f).join(' | ') };

    };

    const plain = dmg(perks({ bloodPrice: 2 }), 1);

    const heart = dmg(perks({ bloodPrice: 2, heartfire: true }), 1);

    expect(heart.lost - plain.lost).toBe(8);

    expect(heart.log).toContain('(heartfire)');

    expect(dmg(perks({ bloodPrice: 2, heartfire: true }), 4).lost).toBe(plain.lost);

  });

});



describe('a rider who owns none of it', () => {

  it('fights exactly as before: same log, same numbers', () => {

    const run = (web?: W.WebBonuses) => {

      const f = start({ web }, always(0.6));

      for (let i = 0; i < 6 && f.status === 'active'; i++) {

        C.advance(f, ready(f), always(0.6));

        if (f.status === 'active') C.act(f, ready(f), { type: 'attack', targetId: f.enemies[0].id }, always(0.6));

      }

      return JSON.stringify({ log: f.log, rider: { ...f.rider }, enemies: f.enemies });

    };

    expect(run(perks())).toBe(run());

  });

});

