// The solo referee tags the log line where an action shows with who acted and how (`by`, `move`).
// The phone's fight animations read those tags; the rules never do.
import { describe, it, expect } from 'vitest';
import * as C from '../../../supabase/functions/empyrean-rules/combat';
import * as M from '../../../supabase/functions/empyrean-rules/minigames';
import type { Rand } from '../../../supabase/functions/empyrean-rules/rules';

const always = (v: number): Rand => () => v;
const seeded = (seed: number): Rand => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const T0 = 1_000_000;
const start = (over: Partial<C.StartInput> = {}, rand: Rand = always(0.5)) => C.startFight({
  id: 'f1', riderName: 'Asha', level: 4, maxHp: 30, hp: 30, ac: 14, attackBonus: 5, weapons: [{ name: 'Dagger', damage: '1d4+3' }],
  foeKind: 'cadet', count: 1, challenge: 'moderate', lethal: true, arena: 'ground', dragon: null, masteryXp: 0, ...over,
}, T0, rand);

/** Plays fights with a dragon on many seeds and returns every log line in order. */
function dragonFights(): C.FightEvent[] {
  const lines: C.FightEvent[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rand = seeded(seed);
    const f = start({ dragon: { name: 'Gwyn', hp: 400, bond: 90 }, foeKind: 'soldier', count: 3, challenge: 'deadly', maxHp: 400, hp: 400 }, rand);
    for (let t = T0; t < T0 + 180_000 && f.status === 'active'; t += 500) C.advance(f, t, rand);
    lines.push(...f.log);
  }
  return lines;
}

describe('fight log: the dragon\'s moves are tagged', () => {
  const lines = dragonFights();
  const dragon = lines.filter(l => l.by === 'dragon');

  it('every kind of dragon move shows up, each on the line that says it', () => {
    const moves = new Set(dragon.map(l => l.move));
    expect(moves).toEqual(new Set(['guard', 'fire', 'bite', 'claw']));
    for (const l of dragon) {
      if (l.move === 'guard') expect(l.text).toContain('throws a wing between you and');
      if (l.move === 'fire') expect(l.text).toBe('Gwyn breathes fire!');
    }
  });

  it('a miss or a critical is a bite, any other hit is a claw, and a killing blow is tagged too', () => {
    const attacks = dragon.filter(l => l.move === 'bite' || l.move === 'claw');
    for (const l of attacks) {
      if (l.text.includes('snaps at')) expect(l.move).toBe('bite');
      else if (l.text.includes('tears into')) expect(l.move).toBe(l.text.includes('(critical)') ? 'bite' : 'claw');
      else expect(l.text).toMatch(/ falls!$/);
    }
    expect(attacks.some(l => l.text.includes('snaps at'))).toBe(true);
    expect(attacks.some(l => l.text.includes('tears into') && !l.text.includes('(critical)'))).toBe(true);
    expect(attacks.some(l => / falls!$/.test(l.text))).toBe(true);
  });

  it('no dragon line is left untagged, and nothing else carries the dragon\'s tag', () => {
    for (const l of lines) {
      const says = l.text.startsWith('Gwyn breathes fire!') || l.text.startsWith('Gwyn snaps at') || l.text.startsWith('Gwyn tears into') || l.text.startsWith('Gwyn throws a wing');
      if (says) expect(l.by).toBe('dragon');
    }
    // Burn lines after the first belong to the same breath: only one line per move is tagged.
    expect(lines.filter(l => l.text.includes('is burned for')).every(l => !l.by)).toBe(true);
  });

  it('a fight with no dragon tags nothing as the dragon', () => {
    const rand = seeded(7);
    const f = start({ foeKind: 'soldier', count: 2 }, rand);
    for (let t = T0; t < T0 + 60_000 && f.status === 'active'; t += 500) C.advance(f, t, rand);
    expect(f.log.some(l => l.by === 'dragon')).toBe(false);
  });
});

describe('fight log: the rider\'s moves are tagged', () => {
  it('a weapon attack: hit, miss and killing blow', () => {
    const hit = start();
    expect(C.act(hit, T0 + 10_000, { type: 'attack', targetId: hit.enemies[0].id, weapon: 'Dagger' }, always(0.99)).ok).toBe(true);
    expect(hit.log.filter(l => l.by === 'rider')).toHaveLength(1);
    expect(hit.log.find(l => l.by === 'rider')).toMatchObject({ move: 'attack' });

    const miss = start();
    C.act(miss, T0 + 10_000, { type: 'attack', targetId: miss.enemies[0].id, weapon: 'Dagger' }, always(0));
    expect(miss.log.find(l => l.by === 'rider')).toMatchObject({ move: 'attack' });
    expect(miss.log.find(l => l.by === 'rider')?.text).toContain('and miss');

    const kill = start();
    kill.enemies[0].hp = 1;
    C.act(kill, T0 + 10_000, { type: 'attack', targetId: kill.enemies[0].id, weapon: 'Dagger' }, always(0.99));
    expect(kill.log.find(l => l.by === 'rider')).toMatchObject({ move: 'attack' });
    expect(kill.log.find(l => l.by === 'rider')?.text).toMatch(/ falls!$/);
  });

  it('a signet, and a potion', () => {
    const f = start({ masteryXp: 0 });
    expect(C.act(f, T0 + 10_000, { type: 'signet', targetId: f.enemies[0].id, intensity: 2, strainRoom: 8 }, always(0.99)).ok).toBe(true);
    expect(f.log.filter(l => l.by === 'rider').map(l => l.move)).toEqual(['signet']);

    const p = start({ hp: 10 });
    expect(C.act(p, T0 + 10_000, { type: 'potion', name: 'Healing draught' }, always(0.5)).ok).toBe(true);
    expect(p.log.find(l => l.by === 'rider')).toMatchObject({ move: 'potion', flash: 'heal' });
  });

  it('a perfect Counter Clash is tagged as a counter', () => {
    const f = start({}, always(0.5));
    const e = f.enemies[0];
    C.advance(f, e.nextAt, always(0));
    if (!e.pending?.clash) throw new Error('Expected Counter Clash');
    const strike = e.pending.strikeAt;
    for (const s of e.pending.clash.swings) {
      const zero = M.swingTimes(s, strike).zero;
      C.clashTap(f, zero + 10, e.id, s.side, zero);
    }
    C.advance(f, strike, always(0.5));
    const line = f.log.find(l => l.text.startsWith('PERFECT!'));
    expect(line).toMatchObject({ by: 'rider', move: 'counter' });
  });

  it('the tags reach the phone in the view, and a fight stored without them still loads', () => {
    const f = start();
    C.act(f, T0 + 10_000, { type: 'attack', targetId: f.enemies[0].id, weapon: 'Dagger' }, always(0.99));
    expect(C.viewOf(f, T0 + 10_000).log.some(l => l.by === 'rider' && l.move === 'attack')).toBe(true);
    const old = JSON.parse(JSON.stringify(f)) as C.Fight;
    old.log = old.log.map(({ by: _by, move: _move, ...rest }) => rest);
    expect(C.cleanFight(old)?.log.every(l => !l.by)).toBe(true);
  });
});
