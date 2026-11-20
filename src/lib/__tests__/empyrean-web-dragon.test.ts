// The progression web's last eight spokes, part 2: the dragon's half in a fight (Vigor, Scale, Fang and Flame, Wing,
// Guardian shielding, and what Loyalty's trust makes the dragon do).
import { describe, expect, it } from 'vitest';
import * as C from '../../../supabase/functions/empyrean-rules/combat';
import * as R from '../../../supabase/functions/empyrean-rules/rules';
import * as W from '../../../supabase/functions/empyrean-rules/web';

const always = (v: number): R.Rand => () => v;
/** Hands out these numbers in order, then 0.5 for ever. */
const script = (...values: number[]): R.Rand => { let i = 0; return () => (i < values.length ? values[i++] : 0.5); };
/** The random number that makes a d20 show `n`. */
const d20 = (n: number) => (n - 1) / 20 + 0.001;
const T0 = 1_000_000;
const perks = (over: Partial<W.WebBonuses> = {}): W.WebBonuses => ({ ...W.NO_BONUSES, ...over });
const texts = (f: C.Fight) => f.log.map(e => e.text).join(' | ');

interface Setup { dragon?: { hp?: number | null; bond?: number } | null; foe?: string; count?: number; arena?: string; hp?: number; prodigy?: number }
/** A level 4 rider (40 HP, AC 14, +5 to hit, a 1d8+2 sword) against cadets (AC 12, +5 to hit, 1d6+3) unless told otherwise. */
const start = (web?: Partial<W.WebBonuses>, o: Setup = {}): C.Fight => {
  const f = C.startFight({
    id: 'f1', riderName: 'Asha', level: 4, maxHp: 40, hp: o.hp ?? 40, ac: 14, attackBonus: 5, weapons: [{ name: 'Sword', damage: '1d8+2' }],
    foeKind: o.foe ?? 'cadet', count: o.count ?? 1, challenge: 'moderate', lethal: true, arena: o.arena ?? 'ground',
    dragon: o.dragon ? { name: 'Tairn', hp: o.dragon.hp ?? null, bond: o.dragon.bond ?? 50 } : null,
    masteryXp: 0, prodigy: o.prodigy ?? 0, web: web ? perks(web) : undefined,
  }, T0, always(0.5));
  for (const e of f.enemies) { e.hp = 500; e.maxHp = 500; e.nextAt = T0 + 900_000; }
  if (f.dragon) f.dragon.nextAt = T0 + 900_000;
  return f;
};
const dragonOf = (f: C.Fight) => { if (!f.dragon) throw new Error('no dragon'); return f.dragon; };
/** One weapon swing; returns the damage done. */
const swing = (f: C.Fight, rand: R.Rand = always(0.5)) => {
  const before = f.enemies[0].hp;
  const r = C.act(f, f.rider.readyAt + 10, { type: 'attack', targetId: 'e1' }, rand);
  if (!r.ok) throw new Error('the swing was refused');
  return before - f.enemies[0].hp;
};
/** A telegraphed heavy blow (11 damage with average dice) landing now. */
const heavy = (f: C.Fight, target: 'rider' | 'dragon', at: number, rand: R.Rand = always(0.5)) => {
  f.enemies[0].pending = { move: 'heavy', label: 'Heavy blow', target, strikeAt: at, clash: null };
  C.advance(f, at, rand);
};
/** The dragon's turn, now. */
const dragonActs = (f: C.Fight, at: number, rand: R.Rand = always(0.5)) => { dragonOf(f).nextAt = at; C.advance(f, at, rand); };

describe('Vigor, Scale and the dragon’s body in a fight', () => {
  it('more health, more armor, a surer strike, and health carried in from the last fight', () => {
    const plain = dragonOf(start(undefined, { dragon: {} }));
    expect(plain).toMatchObject({ hp: 108, maxHp: 108, ac: 16, atk: 6 });
    expect(dragonOf(start({ dHp: 50, dAc: 3, dAtk: 2 }, { dragon: {} }))).toMatchObject({ hp: 158, maxHp: 158, ac: 19, atk: 8 });
    expect(dragonOf(start({ dHp: 50 }, { dragon: { hp: 120 } }))).toMatchObject({ hp: 120, maxHp: 158 });
    expect(dragonOf(start({ dAirHit: 2 }, { dragon: {}, arena: 'air' })).atk).toBe(8);
    expect(dragonOf(start({ dAirHit: 2 }, { dragon: {} })).atk).toBe(6);
  });

  it('Thick Plates and Braced: less from every hit, half from a big move', () => {
    const lost = (web?: Partial<W.WebBonuses>) => { const f = start(web, { dragon: {} }); heavy(f, 'dragon', T0 + 5000); return 108 - dragonOf(f).hp; };
    expect(lost()).toBe(11);
    expect(lost({ dSoak: 3 })).toBe(8);
    expect(lost({ dBrace: true })).toBe(6);
    expect(lost({ dBrace: true, dSoak: 3 })).toBe(3);
    expect(lost({ dSoak: 10 })).toBe(1);
    expect(lost({ dBrace: true, dSoak: 10 })).toBe(0);
  });

  it('Ironhide: the first hit of the fight does nothing', () => {
    const f = start({ dFirstHit: true }, { dragon: {} });
    heavy(f, 'dragon', T0 + 5000);
    expect(dragonOf(f).hp).toBe(108);
    expect(texts(f)).toContain('Ironhide: the blow glances off Tairn.');
    heavy(f, 'dragon', T0 + 9000);
    expect(dragonOf(f).hp).toBe(97);
  });

  it('Unbroken: a killing blow leaves it at 1 HP once; the next one kills', () => {
    const f = start({ dLastStand: true }, { dragon: { hp: 5 } });
    heavy(f, 'dragon', T0 + 5000);
    expect(dragonOf(f).hp).toBe(1);
    expect(f.status).toBe('active');
    expect(texts(f)).toContain('Unbroken: Tairn will not fall.');
    heavy(f, 'dragon', T0 + 9000);
    expect(f).toMatchObject({ status: 'ended', outcome: 'defeat', dragonDied: true });
  });

  it('Second Wind: at a quarter health it recovers a third, once', () => {
    const f = start({ dSecondWind: true }, { dragon: { hp: 30 } });
    heavy(f, 'dragon', T0 + 5000);
    expect(dragonOf(f).hp).toBe(55);
    expect(texts(f)).toContain('Second Wind: Tairn recovers 36.');
    dragonOf(f).hp = 30;
    heavy(f, 'dragon', T0 + 9000);
    expect(dragonOf(f).hp).toBe(19);
  });

  it('Battle Mend: health back on each of its turns', () => {
    const f = start({ dMendTurn: 5 }, { dragon: { hp: 50 } });
    dragonActs(f, T0 + 6000);
    expect(dragonOf(f).hp).toBe(55);
    expect(texts(f)).toContain('Tairn mends 5.');
    dragonOf(f).hp = 106;
    dragonActs(f, T0 + 16000);
    expect(dragonOf(f).hp).toBe(108);
  });

  it("Victor's Rest: it mends a fifth after a win, and the fight's result carries what the rules need", () => {
    const win = (web?: Partial<W.WebBonuses>) => {
      const f = start(web, { dragon: { hp: 50 } });
      f.enemies[0].hp = 1;
      swing(f);
      expect(f.outcome).toBe('victory');
      return C.settle(f, always(0.5));
    };
    expect(win()).toMatchObject({ dragonHp: 50, together: true, rescued: false, dragonWeb: 0 });
    const rested = win({ dWinMend: true, dHp: 20 });
    expect(rested).toMatchObject({ dragonHp: 76, together: true, dragonWeb: 20 });
    expect(rested.line).toContain('mended 26 after the win');
    // A dragon that fell, or a fight that was fled, is not a win side by side.
    const f = start(undefined, { dragon: {} });
    C.act(f, f.rider.readyAt + 10, { type: 'flee' }, script(d20(20)));
    expect(C.settle(f, always(0.5)).together).toBe(false);
  });
});

describe('Fang and Flame: the dragon’s bite and fire', () => {
  const biteFor = (web?: Partial<W.WebBonuses>, rand: R.Rand = always(0.5), o: Setup = { dragon: {} }) => {
    const f = start(web, o);
    dragonActs(f, T0 + 6000, rand);
    return 500 - f.enemies[0].hp;
  };

  it('bite damage, extra dice, and more in the air', () => {
    expect(biteFor()).toBe(14);
    expect(biteFor({ dBite: 6 })).toBe(20);
    expect(biteFor({ dBiteDice: 2 })).toBe(24);
    expect(biteFor({ dAirBite: 4 })).toBe(14);
    expect(biteFor({ dAirBite: 4 }, always(0.5), { dragon: {}, arena: 'air' })).toBe(18);
  });

  it('to-hit turns a miss into a bite; Throat-Seeker widens the critical range', () => {
    expect(biteFor(undefined, script(d20(5)))).toBe(0);
    expect(biteFor({ dAtk: 1 }, script(d20(5)))).toBe(14);
    expect(biteFor(undefined, script(d20(19)))).toBe(14);
    expect(biteFor({ dCritFrom: 19 }, script(d20(19)))).toBe(24);
  });

  it('Savage: a bite that drops an enemy is followed by another at once', () => {
    const run = (web?: Partial<W.WebBonuses>) => {
      const f = start(web, { dragon: {}, count: 2 });
      f.enemies[0].hp = 1;
      dragonActs(f, T0 + 6000);
      return { second: 500 - f.enemies[1].hp, log: texts(f) };
    };
    expect(run().second).toBe(0);
    const savage = run({ dCleave: true });
    expect(savage.second).toBe(14);
    expect(savage.log).toContain('Savage: Tairn turns on Cadet 2.');
  });

  it('fire: more dice, at a single enemy, every second turn, and Inferno', () => {
    const fire = (web: Partial<W.WebBonuses> | undefined, turnsSoFar: number, rand: R.Rand) => {
      const f = start(web, { dragon: {} });
      dragonOf(f).turns = turnsSoFar;
      dragonActs(f, T0 + 6000, rand);
      return { lost: 500 - f.enemies[0].hp, fire: texts(f).includes('breathes fire') };
    };
    // Its third turn, one enemy: it breathes on a coin flip.
    expect(fire(undefined, 2, script(0.1))).toEqual({ lost: 15, fire: true });
    expect(fire(undefined, 2, script(0.9)).fire).toBe(false);
    expect(fire({ dFireEager: true }, 2, always(0.5))).toEqual({ lost: 15, fire: true });
    expect(fire({ dFireEager: true, dFireDice: 3 }, 2, always(0.5)).lost).toBe(30);
    // Its second turn: only with Quick Breath.
    expect(fire({ dFireEager: true }, 1, always(0.5)).fire).toBe(false);
    expect(fire({ dFireEager: true, dFireFast: true }, 1, always(0.5)).fire).toBe(true);
    // An enemy that avoids it takes half; with Inferno, never; and Inferno opens the fight with fire.
    expect(fire({ dFireEager: true }, 2, script(0.5, 0.5, 0.5, d20(2))).lost).toBe(7);
    expect(fire({ dFireEager: true, dFireOpen: true }, 2, script(0.5, 0.5, 0.5, d20(2))).lost).toBe(15);
    expect(fire({ dFireEager: true, dFireOpen: true }, 0, always(0.5)).fire).toBe(true);
    expect(fire({ dFireEager: true }, 0, always(0.5)).fire).toBe(false);
  });
});

describe('Wing: the dragon’s speed', () => {
  it('the trunk shortens the wait between its turns, never below the floor', () => {
    const next = (web?: Partial<W.WebBonuses>) => { const f = start(web, { dragon: {} }); dragonActs(f, T0 + 6000); return dragonOf(f).nextAt - (T0 + 6000); };
    expect(next()).toBe(10000);
    expect(next({ dTempoMs: 2000 })).toBe(8000);
    expect(next({ dTempoMs: 4000 })).toBe(C.DRAGON_INTERVAL_FLOOR_MS);
  });

  it('Quick Launch, Dive and Stormrider: the start of the fight', () => {
    const open = (web?: Partial<W.WebBonuses>, dragon = true) => C.startFight({
      id: 'f1', riderName: 'Asha', level: 4, maxHp: 40, hp: 40, ac: 14, foeKind: 'cadet', count: 1, challenge: 'moderate', lethal: true, arena: 'ground',
      dragon: dragon ? { name: 'Tairn', hp: null, bond: 50 } : null, masteryXp: 0, web: web ? perks(web) : undefined,
    }, T0, always(0.5));
    const plain = open();
    expect(plain.dragon?.nextAt).toBe(T0 + 6000);
    expect(open({ dOpenMs: 3000 }).dragon?.nextAt).toBe(T0 + 3000);
    expect(open({ dOpenMs: 6000 }).dragon?.nextAt).toBe(T0);
    expect(open({ dFoeDelayMs: 4000 }).enemies[0].nextAt).toBe(plain.enemies[0].nextAt + 4000);
    // Stormrider needs the dragon in the fight.
    expect(open({ dFoeDelayMs: 4000 }, false).enemies[0].nextAt).toBe(plain.enemies[0].nextAt);
  });

  it('Buffet and Harry: an enemy it bites acts later, unless its move is already winding up', () => {
    const f = start({ dHarryMs: 2500 }, { dragon: {} });
    const before = f.enemies[0].nextAt;
    dragonActs(f, T0 + 6000);
    expect(f.enemies[0].nextAt).toBe(before + 2500);
    const winding = start({ dHarryMs: 2500 }, { dragon: {} });
    winding.enemies[0].pending = { move: 'heavy', label: 'Heavy blow', target: 'rider', strikeAt: T0 + 9000, clash: null };
    dragonActs(winding, T0 + 6000);
    expect(winding.enemies[0].nextAt).toBe(before);
    expect(winding.enemies[0].pending?.strikeAt).toBe(T0 + 9000);
  });

  it('Strong Wings and Skyborne: getting the rider out', () => {
    const flee = (web: Partial<W.WebBonuses> | undefined, roll: number, dragon = true) => {
      const f = start(web, dragon ? { dragon: {} } : {});
      C.act(f, f.rider.readyAt + 10, { type: 'flee' }, script(d20(roll)));
      return f.outcome;
    };
    expect(flee(undefined, 4)).toBeNull();
    expect(flee({ dFlee: 2 }, 4)).toBe('fled');
    expect(flee({ dSureFlee: true }, 1)).toBe('fled');
    expect(flee({ dSureFlee: true, dFlee: 4 }, 1, false)).toBeNull();
  });
});

describe('Scale, Guardian: shielding the rider', () => {
  const guard = (web: Partial<W.WebBonuses> | undefined, bond: number, coin: number) => {
    const f = start(web, { dragon: { bond } });
    f.enemies[0].pending = { move: 'heavy', label: 'Heavy blow', target: 'rider', strikeAt: T0 + 9000, clash: null };
    dragonActs(f, T0 + 6000, script(coin));
    const shielded = !!f.enemies[0].pending?.warded;
    const bit = f.enemies[0].hp < 500 || texts(f).includes('snaps at');
    C.advance(f, T0 + 9000, always(0.5));
    return { shielded, bit, lost: 40 - f.rider.hp };
  };

  it('today: from bond 61, half the time, a shielded blow deals half and uses its turn', () => {
    expect(guard(undefined, 70, 0.4)).toEqual({ shielded: true, bit: false, lost: 6 });
    expect(guard(undefined, 70, 0.6)).toMatchObject({ shielded: false, lost: 11 });
    expect(guard(undefined, 50, 0.1)).toMatchObject({ shielded: false, lost: 11 });
  });

  it('Watchful and Ever Watchful: more often; Close Guard and Ever Watchful: at a lower bond', () => {
    expect(guard({ dShieldChance: 15 }, 70, 0.6).shielded).toBe(true);
    expect(guard({ dShieldChance: 15 }, 70, 0.7).shielded).toBe(false);
    expect(guard({ dShieldChance: 40 }, 70, 0.89).shielded).toBe(true);
    expect(guard({ dShieldBond: 41 }, 50, 0.1).shielded).toBe(true);
    expect(guard({ dShieldBond: 41 }, 30, 0.1).shielded).toBe(false);
    expect(guard({ dShieldBond: 1 }, 15, 0.1).shielded).toBe(true);
  });

  it('Wingwall: a quarter instead of half. Aegis: it shields and still strikes', () => {
    expect(guard({ dShieldDeep: true }, 70, 0.4)).toEqual({ shielded: true, bit: false, lost: 3 });
    expect(guard({ dShieldFree: true }, 70, 0.4)).toEqual({ shielded: true, bit: true, lost: 6 });
  });
});

describe('Loyalty in a fight: what trust makes the dragon do', () => {
  it('Take the Blow: once a fight, a hit that would drop the rider lands on the dragon instead', () => {
    const f = start({ dTakeBlow: true }, { dragon: {}, hp: 5 });
    heavy(f, 'rider', T0 + 5000);
    expect(f.rider.hp).toBe(5);
    expect(dragonOf(f).hp).toBe(97);
    expect(texts(f)).toContain('Tairn takes the blow meant for you (11).');
    heavy(f, 'rider', T0 + 9000);
    expect(f).toMatchObject({ status: 'ended', outcome: 'defeat', riderDown: true });
    // A hit the rider can take is not the dragon's to take.
    const fine = start({ dTakeBlow: true }, { dragon: {} });
    heavy(fine, 'rider', T0 + 5000);
    expect(fine.rider.hp).toBe(29);
    expect(dragonOf(fine).hp).toBe(108);
  });

  it('Vengeance: once a fight, the dragon strikes at once when the rider falls to half HP or less', () => {
    const f = start({ dAvenge: true }, { dragon: {}, hp: 25 });
    heavy(f, 'rider', T0 + 5000);
    expect(f.rider.hp).toBe(14);
    expect(texts(f)).toContain('Tairn roars and turns on your attacker.');
    expect(dragonOf(f).turns).toBe(1);
    expect(f.enemies[0].hp).toBe(486);
    // Above half, it waits for its own turn.
    const calm = start({ dAvenge: true }, { dragon: {} });
    heavy(calm, 'rider', T0 + 5000);
    expect(dragonOf(calm).turns).toBe(0);
  });

  it('Devoted: the dragon carries a fallen rider out of a real fight; the rider lives at 1 HP', () => {
    const f = start({ dRescue: true }, { dragon: {}, hp: 5 });
    heavy(f, 'rider', T0 + 5000);
    expect(f).toMatchObject({ status: 'ended', outcome: 'fled', riderDown: false, rescued: true });
    expect(f.rider.hp).toBe(1);
    const out = C.settle(f, always(0.5));
    expect(out).toMatchObject({ rescued: true, together: false, xp: 0 });
    expect(out.line).toContain('Tairn carried the fallen rider out of the fight');
    // Without it, and without the dragon, the rider goes down.
    const lost = start(undefined, { dragon: {}, hp: 5 });
    heavy(lost, 'rider', T0 + 5000);
    expect(lost).toMatchObject({ outcome: 'defeat', riderDown: true });
    const alone = start({ dRescue: true }, { hp: 5 });
    heavy(alone, 'rider', T0 + 5000);
    expect(alone).toMatchObject({ outcome: 'defeat', riderDown: true });
  });

  it('a fight saved before these perks existed still runs: missing perks read as off', () => {
    const f = start({ wardMax: 4 }, { dragon: {} });
    f.web = { wardMax: 4, wardFightRefill: false, regenTurn: 0, regenWard: false, adrDamage: 0, adrHit: 0, adrDouble: false, adrHasteMs: 0, bloodPrice: 0, heartfire: false, sigDamage: 0, sigDice: 0, sigKillRefund: false } as unknown as C.FightPerks;
    expect(swing(f)).toBe(7);
    dragonActs(f, T0 + 6000);
    heavy(f, 'rider', T0 + 9000);
    expect(f.status).toBe('active');
  });
});
