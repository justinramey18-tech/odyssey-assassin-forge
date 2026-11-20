// The progression web's last eight spokes, part 1: the whole tree, Kinship, and the rider's half (Blade, Tempo, Saddle),
// with the between-fights rules of the dragon's half (Vigor's stored body, Loyalty's trust and needs).
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
const ledger = (nodes: string[], xp = 0, kin = 0) => W.normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0, kcamps: { c1: kin }, kgrant: 0 } });
const five = (b: string) => [1, 2, 3, 4, 5].map(i => `${b}-${i}`);
const sheet = R.normalizeSheet({ level: 4, maxHp: 40 });
const DAY = R.DAY;
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
/** The first enemy's plain attack on the rider, now. */
const enemyAttacks = (f: C.Fight, at: number, rand: R.Rand) => { f.enemies[0].nextAt = at; C.advance(f, at, rand); };
/** A telegraphed heavy blow (11 damage with average dice) landing now. */
const heavy = (f: C.Fight, target: 'rider' | 'dragon', at: number, rand: R.Rand = always(0.5)) => {
  f.enemies[0].pending = { move: 'heavy', label: 'Heavy blow', target, strikeAt: at, clash: null };
  C.advance(f, at, rand);
};

describe('the whole web: 180 nodes on ten spokes', () => {
  const view = W.webView(ledger([]));
  const all = view.spokes.flatMap(s => s.nodes);

  it('every spoke is open: Vitality and Channel hold 30 nodes, the other eight hold 15 (a trunk of 5 and two branches of 5)', () => {
    expect(all.length).toBe(180);
    expect(new Set(all.map(n => n.id)).size).toBe(180);
    for (const s of view.spokes) {
      expect(s.coming).toBe(false);
      if (s.id === 'vitality' || s.id === 'channel') continue;
      expect(s.nodes.length).toBe(15);
      expect(s.branches.length).toBe(2);
      const trunk = s.nodes.filter(n => !n.branch);
      expect(trunk.length).toBe(5);
      expect(trunk.every(n => n.tier === 'small')).toBe(true);
      for (const b of s.branches) {
        const nodes = s.nodes.filter(n => n.branch === b.id);
        expect(nodes.map(n => n.tier)).toEqual(['small', 'small', 'big', 'big', 'capstone']);
        expect(nodes[0].parent).toBe(trunk[4].id);
      }
    }
  });

  it("the rider's half is priced in XP and the dragon's half in Kinship", () => {
    for (const s of view.spokes) for (const n of s.nodes) {
      expect(n.currency).toBe(s.half === 'dragon' ? 'kin' : 'xp');
      expect(n.cost).toBe((s.half === 'dragon' ? W.KIN_COST : W.NODE_COST)[n.tier]);
    }
    const cost = (id: string) => view.spokes.find(s => s.id === id)?.nodes.reduce((sum, n) => sum + n.cost, 0);
    expect(cost('blade')).toBe(4950);
    expect(cost('vigor')).toBe(99);
  });

  it('every bonus a node gives is one the rules know, and every bonus the rules know is given by some node', () => {
    const given = new Set<string>();
    for (const s of W.WEB_SPOKES) for (const n of s.nodes) for (const key of Object.keys(n.gives)) {
      expect(Object.keys(W.NO_BONUSES)).toContain(key);
      given.add(key);
    }
    const folded = ['dAvenge', 'dTakeBlow', 'dRescue'];
    for (const key of Object.keys(W.NO_BONUSES)) expect(given.has(key) || folded.includes(key), key).toBe(true);
  });

  it('owning every node adds up as written', () => {
    const b = W.webBonuses(ledger(all.map(n => n.id)));
    expect(b).toMatchObject({
      wpnDamage: 7, wpnHit: 4, wpnDice: 1, wpnFinish: 2, critFrom: 18, graze: 2,
      tempoMs: 2000, openReady: true, foeDelayMs: 5000, firstCrit: true, blur: true, fightAc: 2, flee: 4, missHasteMs: 1000, dodgeFirst: true,
      help: 3, helpSteady: 2, helpSoften: 2, secondLook: 3, helpNoCrit: true,
      mountHit: 2, mountAc: 2, mountDamage: 1, mountDice: 1, mountGuard: 2, mountHasteMs: 1500,
      dHp: 94, dHuntMend: true, dRestMend: true, dMendTurn: 5, dSecondWind: true, dWinMend: true, dLastStand: true,
      dAtk: 2, dBite: 9, dBiteDice: 3, dCritFrom: 19, dCleave: true, dFireDice: 3, dFireEager: true, dFireFast: true, dFireOpen: true,
      dTempoMs: 2000, dOpenMs: 6000, dHarryMs: 2500, dFoeDelayMs: 4000, dFlee: 4, flyDays: 2, dAirHit: 2, dAirBite: 4, dSureFlee: true,
      dAc: 4, dSoak: 5, dBrace: true, dFirstHit: true, dShieldChance: 40, dShieldBond: 1, dShieldDeep: true, dShieldFree: true,
      trustHunt: 1, trustFly: 1, trustFight: 1, huntDays: 1, needGrace: 1,
      dAvenge: false, dTakeBlow: false, dRescue: false,
    });
    // Every fight perk survives the fight's own clean-up at the size the web gives it.
    const kept = C.cleanPerks(W.withTrust(b, 100));
    expect(kept).toMatchObject({ wpnDamage: 7, tempoMs: 2000, dHp: 94, dBite: 11, dBiteDice: 5, dAtk: 3, dTempoMs: 3000, dFlee: 6, dShieldChance: 40, dShieldBond: 1, dAvenge: true, dTakeBlow: true, dRescue: true });
  });
});

describe('Kinship: the ledger', () => {
  it('a dragon node is bought with Kinship and never with XP; a rider node never with Kinship', () => {
    expect(W.buyNode(ledger([], 99_999, 2), 'vigor-1')).toEqual({ ok: false, error: 'You need 1 more Kinship.' });
    expect(W.buyNode(ledger([], 0, 99), 'blade-1')).toEqual({ ok: false, error: 'You need 150 more XP.' });
    const r = W.buyNode(ledger([], 0, 3), 'vigor-1');
    if (!r.ok) throw new Error('refused');
    expect(r.ledger).toMatchObject({ nodes: ['vigor-1'], spent: 0, kspent: 3 });
    expect(W.kinBalance(r.ledger)).toBe(0);
    const v = W.webView(r.ledger);
    expect(v.kin).toEqual({ earned: 3, spent: 3, balance: 0 });
    expect(v.xp).toEqual({ earned: 0, spent: 0, balance: 0 });
    // It saves and reads back the same.
    expect(W.normalizeLedger(JSON.parse(JSON.stringify(W.withLedger({ other: 1 }, r.ledger))))).toEqual(r.ledger);
  });

  it("what was spent is always what the owned nodes cost, in each half's own currency", () => {
    const l = W.normalizeLedger({ web: { nodes: ['blade-1', 'vigor-1', 'vigor-2'], spent: 9, kspent: 900, camps: {}, kcamps: {}, grant: 0, kgrant: 0 } });
    expect(l.spent).toBe(150);
    expect(l.kspent).toBe(6);
  });

  it('riders from before the cutoff start with enough Kinship for one small dragon node, even on a ledger saved before Kinship existed', () => {
    const OLD = '2026-11-15T00:00:00.000Z', NEW = '2027-01-05T00:00:00.000Z';
    expect(W.normalizeLedger({}, OLD).kgrant).toBe(W.KIN_COST.small);
    expect(W.normalizeLedger({}, NEW).kgrant).toBe(0);
    expect(W.normalizeLedger({ web: { nodes: ['channel-1'], camps: { c1: 225 }, grant: 150 } }, OLD)).toMatchObject({ kgrant: 3, grant: 150, kcamps: {} });
    // Once saved, the number stands: it is not given again.
    expect(W.normalizeLedger({ web: { nodes: [], camps: {}, grant: 150, kgrant: 0 } }, OLD).kgrant).toBe(0);
  });

  it("a campaign's Kinship only ever goes up", () => {
    let l = ledger([]);
    l = W.creditKinship(l, 'c2', 4);
    expect(W.kinEarned(l)).toBe(4);
    expect(W.creditKinship(l, 'c2', 3)).toBe(l);
    expect(W.kinEarned(W.creditKinship(l, 'c2', 9))).toBe(9);
    expect(W.creditKinship(l, 'c3', 0)).toBe(l);
  });
});

describe('Kinship: earned from time with the dragon', () => {
  const s0 = R.freshState();

  it('a hunt, a flight and a long rest count once an in-game day; a won fight counts 2; never more than 5 a day', () => {
    let s = s0;
    const hunt = R.earnKin(s, 600, 'hunt');
    expect(hunt).toMatchObject({ gained: 1, first: true });
    expect(R.earnKin(hunt.state, 700, 'hunt')).toMatchObject({ gained: 0, first: false });
    s = R.earnKin(hunt.state, 700, 'fly').state;
    s = R.earnKin(s, 800, 'fight').state;
    expect(s.kin.total).toBe(4);
    const second = R.earnKin(s, 900, 'fight');
    expect(second.gained).toBe(1);
    expect(R.earnKin(second.state, 950, 'rest').gained).toBe(0);
    // A new day starts the count again.
    const tomorrow = R.earnKin(second.state, DAY + 600, 'hunt');
    expect(tomorrow.gained).toBe(1);
    expect(tomorrow.state.kin).toMatchObject({ total: 6, today: 1 });
  });

  it('passing time hunting or flying earns it and says so; waiting does not', () => {
    const hunt = R.passTime(s0, 600, 3, 'hunt', true);
    if (!hunt.ok) throw new Error('refused');
    expect(hunt.state.kin.total).toBe(1);
    expect(hunt.summary).toContain('(+1 Kinship)');
    expect(hunt.events).toEqual([]);
    const fly = R.passTime(hunt.state, 800, 1, 'fly', true);
    if (!fly.ok) throw new Error('refused');
    expect(fly.state.kin.total).toBe(2);
    const wait = R.passTime(fly.state, 900, 2, 'wait', true);
    if (!wait.ok) throw new Error('refused');
    expect(wait.state.kin.total).toBe(2);
    expect(wait.summary).not.toContain('Kinship');
  });

  it('a long rest beside a bonded dragon earns 1; without a dragon it earns none', () => {
    const bonded = R.rest(s0, 20 * 60, 'long', false, 0, { bonded: true });
    if (!bonded.ok) throw new Error('refused');
    expect(bonded.state.kin.total).toBe(1);
    expect(bonded.summary).toContain('+1 Kinship');
    const alone = R.rest(s0, 20 * 60, 'long');
    if (!alone.ok) throw new Error('refused');
    expect(alone.state.kin.total).toBe(0);
  });

  it('a journey on dragonback counts as a flight together', () => {
    expect(R.flightMeetsNeed(s0, 3 * DAY + 60)).toMatchObject({ needs: { flyMetDay: 4 }, kin: { total: 1, flyDay: 4 } });
  });

  it('Kinship survives a save and a load', () => {
    const s = R.earnKin(s0, 600, 'fight').state;
    expect(R.normalizeState(JSON.parse(JSON.stringify(s))).kin).toEqual(s.kin);
    expect(R.normalizeState({}).kin).toEqual(s0.kin);
  });
});

describe('Loyalty: trust earned, needs eased, and branches that wait for trust', () => {
  const s0 = R.freshState();

  it('Kept Faith and Shared Sky: a hunt and a flight earn trust once a day, as a result the phone already knows how to apply', () => {
    const hunt = R.passTime(s0, 600, 3, 'hunt', true, 0, { trustHunt: 1 });
    if (!hunt.ok) throw new Error('refused');
    expect(hunt.events).toEqual([{ kind: 'dragon_need', reason: 'You hunted together: your dragon trusts you a little more', idem_key: 'trust:hunt:1', payload: { trust: 1, gain: true } }]);
    const again = R.passTime(hunt.state, 900, 3, 'hunt', true, 0, { trustHunt: 1 });
    if (!again.ok) throw new Error('refused');
    expect(again.events).toEqual([]);
    const fly = R.passTime(s0, 600, 1, 'fly', true, 0, { trustFly: 1 });
    if (!fly.ok) throw new Error('refused');
    expect(fly.events[0]).toMatchObject({ kind: 'dragon_need', idem_key: 'trust:fly:1', payload: { trust: 1 } });
  });

  it('Patient, Long Glide and Tireless: the needs come round less often', () => {
    const day5 = 4 * DAY + 60;
    expect(R.unmetNeeds(s0, day5)).toEqual(['hunt', 'fly']);
    expect(R.unmetNeeds(s0, day5, { huntDays: 1 })).toEqual(['fly']);
    expect(R.unmetNeeds(s0, day5, { huntDays: 1, flyDays: 2 })).toEqual([]);
  });

  it('Forgiving: the first day a need goes unmet costs no trust; the second day does', () => {
    const day4 = 3 * DAY + 60;
    expect(R.chargeNeeds(s0, day4, true).events.length).toBe(1);
    expect(R.chargeNeeds(s0, day4, true, { grace: 1 }).events).toEqual([]);
    expect(R.chargeNeeds(s0, day4 + DAY, true, { grace: 1 }).events[0]).toMatchObject({ kind: 'dragon_need', payload: { trust: -1 } });
  });

  it('a branch node works only once trust has reached its tier', () => {
    const b = W.webBonuses(ledger([...five('loyalty'), ...five('fierce'), ...five('devoted')]));
    const at = (trust: number | null) => { const t = W.withTrust(b, trust); return [t.dAtk, t.dBite, t.help, t.dFlee, t.dTempoMs, t.restEase, t.dAvenge, t.dTakeBlow, t.dBiteDice, t.dRescue]; };
    expect(at(null)).toEqual([0, 0, 0, 0, 0, 0, false, false, 0, false]);
    expect(at(20)).toEqual([0, 0, 0, 0, 0, 0, false, false, 0, false]);
    expect(at(21)).toEqual([1, 2, 1, 2, 0, 0, false, false, 0, false]);
    expect(at(41)).toEqual([1, 2, 1, 2, 1000, 1, true, true, 0, false]);
    expect(at(61)).toEqual([1, 2, 1, 2, 1000, 1, true, true, 2, true]);
    // Trust adds to what other spokes already give.
    expect(W.withTrust(perks({ dAtk: 2, help: 3, t21Atk: 1, t21Help: 1 }), 50)).toMatchObject({ dAtk: 3, help: 4 });
  });
});

describe('Vigor between fights: the dragon’s stored body', () => {
  const s0 = { ...R.freshState(), dragon: { name: 'Tairn', hp: 108, maxHp: 108 } };

  it('new max HP arrives filled, so the bar grows; losing it never leaves more HP than the max', () => {
    const up = R.syncDragon(s0, 20);
    expect(up).toMatchObject({ dragonWeb: 20, dragon: { hp: 128, maxHp: 128 } });
    expect(R.syncDragon(up, 20)).toBe(up);
    expect(R.syncDragon({ ...up, dragon: { name: 'Tairn', hp: 60, maxHp: 128 } }, 30)).toMatchObject({ dragon: { hp: 70, maxHp: 138 } });
    expect(R.syncDragon(up, 0)).toMatchObject({ dragonWeb: 0, dragon: { hp: 108, maxHp: 108 } });
    expect(R.syncDragon({ ...up, dragon: { name: 'Tairn', hp: 0, maxHp: 128 } }, 50).dragon).toMatchObject({ hp: 0, maxHp: 158 });
    expect(R.syncDragon(R.freshState(), 20)).toMatchObject({ dragon: null, dragonWeb: 0 });
  });

  it('Good Hunting and Deep Rest: a hunt mends half, a long rest mends it fully', () => {
    const hurt = { ...s0, dragon: { name: 'Tairn', hp: 10, maxHp: 108 } };
    const hunt = (care: R.DragonCare) => { const r = R.passTime(hurt, 600, 3, 'hunt', true, 0, care); if (!r.ok) throw new Error('refused'); return r.state.dragon?.hp; };
    expect(hunt({})).toBe(37);
    expect(hunt({ huntMend: true })).toBe(64);
    const sleep = (care: R.DragonCare) => { const r = R.rest(hurt, 20 * 60, 'long', false, 0, care); if (!r.ok) throw new Error('refused'); return r.state.dragon?.hp; };
    expect(sleep({})).toBe(64);
    expect(sleep({ restMend: true })).toBe(108);
  });
});

describe('Saddle, on checks: what the rider draws from a bonded dragon', () => {
  const s0 = R.freshState();
  const check = (over: Partial<R.CheckInput>, state: R.CampaignState = s0, rand: R.Rand = always(0.5)) =>
    R.resolveCheck(state, 600, sheet, { d20: 10, modifier: 2, dc: 15, risk: 'mental', label: 'Test', masteryXp: 0, bond: 15, ...over }, rand);

  it("the dragon's help is added to the roll and named; a rider with no dragon gets none of it", () => {
    expect(check({}).total).toBe(12);
    const helped = check({ help: 3 });
    expect(helped.total).toBe(15);
    expect(helped.outcome).toBe('success');
    expect(helped.parts).toContain("+3 dragon's help");
    expect(check({ help: 3, bond: null }).total).toBe(12);
    // On top of what the bond already gives.
    expect(check({ help: 2, bond: 65 }).total).toBe(16);
  });

  it('Shared Calm: wounds and conditions take less off the check', () => {
    const hurt = { ...s0, injuries: [{ id: 'i', name: 'Cracked rib', severity: 2 }] };
    expect(check({}, hurt).total).toBe(10);
    const calm = check({ steady: 1 }, hurt);
    expect(calm.total).toBe(11);
    expect(calm.parts.join(' ')).toContain('your dragon steadies you');
    expect(check({ steady: 4 }, hurt).total).toBe(12);
    expect(check({ steady: 4, bond: null }, hurt).total).toBe(10);
  });

  it('Warning Growl: a failed physical check costs 2 less HP, never less than nothing', () => {
    const fail = (soften?: number, bond: number | null = 15) => check({ risk: 'physical', dc: 20, d20: 11, soften, bond }, s0, always(0.5));
    expect(fail().hp).toBe(-6);
    const growl = fail(2);
    expect(growl.hp).toBe(-4);
    expect(growl.line).toContain("your dragon's warning saved 2 HP");
    expect(fail(10).hp).toBe(0);
    expect(fail(2, null).hp).toBe(-6);
  });

  it('Second Look: a failed check is rolled again once a day, and the better roll stands', () => {
    const better = check({ looks: 1, d20: 4 }, s0, always(d20(17)));
    expect(better.outcome).toBe('success');
    expect(better.total).toBe(19);
    expect(better.line).toContain('Second Look: rolled again (4 became 17)');
    expect(better.state.look).toEqual({ day: 1, n: 1 });
    // Used up for today.
    const spent = check({ looks: 1, d20: 4 }, better.state, always(d20(17)));
    expect(spent.outcome).toBe('failure');
    // A worse second roll changes nothing, but the look is still used.
    const worse = check({ looks: 1, d20: 9 }, s0, always(d20(3)));
    expect(worse.total).toBe(11);
    expect(worse.line).toContain('the first roll stands');
    expect(worse.state.look.n).toBe(1);
    // A success is never rolled again; Mind-speak gives three a day; tomorrow it is back.
    expect(check({ looks: 1, d20: 15 }).state.look.n).toBe(0);
    expect(check({ looks: 3, d20: 4 }, { ...s0, look: { day: 1, n: 2 } }, always(d20(17))).outcome).toBe('success');
    expect(R.resolveCheck(better.state, DAY + 600, sheet, { d20: 4, modifier: 2, dc: 15, risk: 'mental', label: 'Test', masteryXp: 0, bond: 15, looks: 1 }, always(d20(17))).outcome).toBe('success');
    expect(check({ looks: 1, d20: 4, bond: null }, s0, always(d20(17))).outcome).toBe('failure');
  });

  it('Mind-speak: with a bonded dragon a check never fails critically', () => {
    expect(check({ d20: 1 }).outcome).toBe('critical_failure');
    const spoken = check({ d20: 1, noCrit: true });
    expect(spoken.outcome).toBe('failure');
    expect(spoken.condition).toBeNull();
    expect(check({ d20: 1, noCrit: true, bond: null }).outcome).toBe('critical_failure');
  });
});

describe('Blade: weapon attacks', () => {
  it('flat damage, extra dice, and more dice against a wounded enemy', () => {
    expect(swing(start())).toBe(7);
    const edged = start({ wpnDamage: 3 });
    expect(swing(edged)).toBe(10);
    expect(texts(edged)).toContain('(Blade +3)');
    expect(swing(start({ wpnDice: 1 }))).toBe(12);
    const finish = start({ wpnFinish: 2 });
    expect(swing(finish)).toBe(7);
    finish.enemies[0].hp = 250;
    expect(swing(finish)).toBe(17);
  });

  it('to-hit turns a near miss into a hit', () => {
    expect(swing(start(), script(d20(6)))).toBe(0);
    expect(swing(start({ wpnHit: 1 }), script(d20(6)))).toBe(7);
  });

  it('Weak Points and Deadeye widen the critical range', () => {
    expect(swing(start(), script(d20(19)))).toBe(7);
    const keen = start({ critFrom: 19 });
    expect(swing(keen, script(d20(19)))).toBe(12);
    expect(texts(keen)).toContain('(critical)');
    expect(swing(start({ critFrom: 19 }), script(d20(18)))).toBe(7);
    expect(swing(start({ critFrom: 18 }), script(d20(18)))).toBe(12);
  });

  it('Glancing Blow: a miss by 2 or less lands for half; a wider miss and a natural 1 do not', () => {
    const graze = start({ graze: 2 });
    expect(swing(graze, script(d20(5)))).toBe(3);
    expect(texts(graze)).toContain('glances off');
    expect(swing(start({ graze: 2 }), script(d20(4)))).toBe(0);
    expect(swing(start({ graze: 5, wpnHit: 5 }), script(d20(1)))).toBe(0);
  });
});

describe('Tempo: speed', () => {
  const waitAfter = (f: C.Fight) => { const now = f.rider.readyAt + 10; C.act(f, now, { type: 'attack', targetId: 'e1' }, always(0.5)); return f.rider.readyAt - now; };

  it('the trunk shortens the wait between moves, never below the floor', () => {
    expect(waitAfter(start())).toBe(8000);
    expect(waitAfter(start({ tempoMs: 2000 }))).toBe(6000);
    expect(waitAfter(start({ tempoMs: 2000 }, { prodigy: 5 }))).toBe(3500);
    expect(waitAfter(start({ tempoMs: 4000 }, { prodigy: 5 }))).toBe(C.RIDER_COOLDOWN_FLOOR_MS);
  });

  it('Quick Draw, Wrong-Footed and Off Balance: the first seconds of a fight', () => {
    const open = (web?: Partial<W.WebBonuses>) => C.startFight({
      id: 'f1', riderName: 'Asha', level: 4, maxHp: 40, hp: 40, ac: 14, foeKind: 'cadet', count: 2, challenge: 'moderate', lethal: true, arena: 'ground',
      dragon: null, masteryXp: 0, web: web ? perks(web) : undefined,
    }, T0, always(0.5));
    const plain = open();
    expect(plain.rider.readyAt).toBe(T0 + 1500);
    expect(open({ openReady: true }).rider.readyAt).toBe(T0);
    expect(open({ foeDelayMs: 5000 }).enemies.map(e => e.nextAt)).toEqual(plain.enemies.map(e => e.nextAt + 5000));
  });

  it('First Blood: the first hit of a fight is critical, and only the first', () => {
    const f = start({ firstCrit: true });
    expect(swing(f, script(d20(3)))).toBe(0);
    expect(swing(f)).toBe(12);
    expect(swing(f)).toBe(7);
  });

  it('Blur: no wait after the first move, once', () => {
    const f = start({ blur: true });
    const now = f.rider.readyAt + 10;
    C.act(f, now, { type: 'attack', targetId: 'e1' }, always(0.5));
    expect(f.rider.readyAt).toBe(now);
    expect(texts(f)).toContain('Blur: you can act again at once.');
    C.act(f, now + 10, { type: 'attack', targetId: 'e1' }, always(0.5));
    expect(f.rider.readyAt).toBe(now + 10 + 8000);
  });

  it('Light Feet: AC in a fight turns a hit into a miss; Sidestep: a miss brings your next move closer', () => {
    const hit = start();
    enemyAttacks(hit, T0 + 5000, script(0.9, d20(9)));
    expect(hit.rider.hp).toBe(33);
    const light = start({ fightAc: 1, missHasteMs: 1000 });
    light.rider.readyAt = T0 + 9000;
    enemyAttacks(light, T0 + 5000, script(0.9, d20(9)));
    expect(light.rider.hp).toBe(40);
    expect(light.rider.readyAt).toBe(T0 + 8000);
    // Never earlier than the miss itself.
    const soon = start({ missHasteMs: 3000 });
    soon.rider.readyAt = T0 + 6000;
    enemyAttacks(soon, T0 + 5000, script(0.9, d20(2)));
    expect(soon.rider.readyAt).toBe(T0 + 5000);
  });

  it('Untouchable: the first hit of the fight misses, a plain attack or a big move; the next one lands', () => {
    const f = start({ dodgeFirst: true });
    enemyAttacks(f, T0 + 5000, script(0.9, d20(15)));
    expect(f.rider.hp).toBe(40);
    expect(texts(f)).toContain("Untouchable: you slip Cadet's blow.");
    enemyAttacks(f, T0 + 9000, script(0.9, d20(15)));
    expect(f.rider.hp).toBe(33);
    const big = start({ dodgeFirst: true });
    heavy(big, 'rider', T0 + 5000);
    expect(big.rider.hp).toBe(40);
    expect(texts(big)).toContain('Untouchable: you slip Heavy blow.');
    heavy(big, 'rider', T0 + 9000);
    expect(big.rider.hp).toBe(29);
  });

  it('Open Ground and Slippery: Flee', () => {
    const flee = (web?: Partial<W.WebBonuses>) => { const f = start(web); C.act(f, f.rider.readyAt + 10, { type: 'flee' }, script(d20(8))); return f.outcome; };
    expect(flee()).toBeNull();
    expect(flee({ flee: 2 })).toBe('fled');
  });
});

describe('Saddle, in a fight: stronger while the dragon is up', () => {
  const withDragon = { dragon: { bond: 50 } };

  it('to-hit, damage and extra dice count only while the dragon is up', () => {
    expect(swing(start({ mountHit: 2 }, withDragon), script(d20(5)))).toBe(7);
    expect(swing(start({ mountHit: 2 }), script(d20(5)))).toBe(0);
    const paired = start({ mountDamage: 1, mountDice: 1 }, withDragon);
    expect(swing(paired)).toBe(13);
    expect(texts(paired)).toContain('(mounted +1)');
    dragonOf(paired).hp = 0; dragonOf(paired).status = 'down';
    expect(swing(paired)).toBe(7);
  });

  it('a signet strike gets the same', () => {
    const strike = (web?: Partial<W.WebBonuses>) => {
      const f = start(web, withDragon);
      C.act(f, f.rider.readyAt + 10, { type: 'signet', targetId: 'e1', intensity: 3, strainRoom: 10 }, always(0.5));
      return 500 - f.enemies[0].hp;
    };
    expect(strike({ mountDamage: 1, mountDice: 1 }) - strike()).toBe(5);
  });

  it('Wing Cover and Under the Wing: AC, and less damage from every hit', () => {
    const covered = start({ mountAc: 1 }, withDragon);
    enemyAttacks(covered, T0 + 5000, script(0.9, 0.9, d20(9)));
    expect(covered.rider.hp).toBe(40);
    const guarded = start({ mountGuard: 2 }, withDragon);
    enemyAttacks(guarded, T0 + 5000, script(0.9, 0.9, d20(15)));
    expect(guarded.rider.hp).toBe(35);
    const alone = start({ mountAc: 1, mountGuard: 2 });
    enemyAttacks(alone, T0 + 5000, script(0.9, d20(9)));
    expect(alone.rider.hp).toBe(33);
  });

  it('Shared Fury: a hit on the dragon brings your next move closer', () => {
    const f = start({ mountHasteMs: 1500 }, withDragon);
    f.rider.readyAt = T0 + 9000;
    heavy(f, 'dragon', T0 + 5000);
    expect(dragonOf(f).hp).toBe(97);
    expect(f.rider.readyAt).toBe(T0 + 7500);
  });
});
