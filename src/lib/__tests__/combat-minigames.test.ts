import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as M from '../combatMinigames';
import * as S from '../../../supabase/functions/npc-combat/skills.ts';

// Combat mini-games v6: Counter Clash and Tug & Slip (pure rules shared by phones and the referee).

describe('the referee copy', () => {
  it('is identical to src/lib/combatMinigames.ts', () => {
    const a = readFileSync('src/lib/combatMinigames.ts', 'utf8');
    const b = readFileSync('supabase/functions/npc-combat/minigames.ts', 'utf8');
    expect(b).toBe(a);
  });
});

/** Dice that always roll the same face (clamped to the die). */
const fixed = (face: number): M.Roller => sides => Math.min(sides, face);
/** Dice that return the given faces in turn. */
const seq = (...faces: number[]): M.Roller => { let i = 0; return sides => Math.min(sides, faces[i++ % faces.length]); };

describe('Counter Clash: building a chain', () => {
  it('gives each move its number of swings, ending CLASH_HOLD_MS before the hit', () => {
    for (const move of M.CLASH_MOVES) {
      const c = M.buildClash('x', move, fixed(10));
      expect(c.swings).toHaveLength(M.CLASH_SWINGS[move]);
      expect(c.swings[c.swings.length - 1].off).toBe(-M.CLASH_HOLD_MS);
      c.swings.forEach(s => expect(s.off).toBeLessThanOrEqual(0));
    }
  });
  it('spaces swings 0.85 s apart, plus 0.6 s for a feint', () => {
    const plain = M.buildClash('x', 'signature', seq(10, 1)); // never a feint, sides left
    expect(plain.swings.map(s => s.off)).toEqual([-2150, -1300, -450]);
    expect(plain.swings.every(s => !s.feint && s.side === 'left')).toBe(true);
    const feints = M.buildClash('x', 'heavy', seq(1, 3)); // always a feint, sides right
    expect(feints.swings.map(s => s.off)).toEqual([-1900, -450]);
    expect(feints.swings.every(s => s.feint && s.side === 'right')).toBe(true);
  });
  it('fits inside every wind-up even when every swing is a feint, with time to see it coming', () => {
    for (const move of M.CLASH_MOVES) {
      const c = M.buildClash('x', move, fixed(1));
      const lead = 10_000 - M.clashStartsAt(c, 10_000);
      expect(lead).toBeLessThan(S.WINDUP_S[move] * 1000 - 1000);
    }
  });
  it('reads back a stored chain and rejects junk', () => {
    const c = M.buildClash('abc', 'heavy', fixed(2));
    expect(M.cleanClash(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(M.cleanClash({ id: 'a', move: 'strike', swings: [] })).toBeNull();
    expect(M.cleanClash({ id: 'a', move: 'heavy', swings: [{ off: 50, side: 'top' }] })).toBeNull();
    expect(M.cleanClash(null)).toBeNull();
  });
});

describe('Counter Clash: judging taps', () => {
  const HIT = 100_000;
  const two: M.Clash = { id: 'c', move: 'heavy', swings: [{ off: -1300, side: 'left', feint: false }, { off: -450, side: 'top', feint: false }] };
  const z0 = HIT - 1300;
  const z1 = HIT - 450;
  it('perfect within 0.12 s, block from 0.3 s early to 0.25 s late', () => {
    expect(M.judgeClash(two, HIT, z0 + 100, 'left', [])).toEqual({ index: 0, q: 'perfect' });
    expect(M.judgeClash(two, HIT, z0 - 120, 'left', [])).toEqual({ index: 0, q: 'perfect' });
    expect(M.judgeClash(two, HIT, z0 - 290, 'left', [])).toEqual({ index: 0, q: 'block' });
    expect(M.judgeClash(two, HIT, z0 + 240, 'left', [])).toEqual({ index: 0, q: 'block' });
    expect(M.judgeClash(two, HIT, z0 - 400, 'left', [])).toEqual({ index: 0, q: 'early' });
  });
  it('the wrong third is a full hit even with perfect timing', () => {
    expect(M.judgeClash(two, HIT, z0, 'right', [])).toEqual({ index: 0, q: 'wrong' });
  });
  it('a closed swing is skipped and the tap goes to the next one; a tapped swing takes no more taps', () => {
    expect(M.judgeClash(two, HIT, z1, 'top', [])).toEqual({ index: 1, q: 'perfect' });
    expect(M.judgeClash(two, HIT, z0 + 50, 'left', ['perfect'])).toEqual({ index: 1, q: 'early' });
    expect(M.judgeClash(two, HIT, z1 + 400, 'top', [])).toBeNull();
  });
  it('ignores a tap before the first circle appears', () => {
    expect(M.judgeClash(two, HIT, z0 - 1200, 'left', [])).toBeNull();
  });
  it('a tap on a feint\'s fake landing takes the bait', () => {
    const f: M.Clash = { id: 'f', move: 'pin', swings: [{ off: -450, side: 'top', feint: true }] };
    const zero = HIT - 450;
    expect(M.judgeClash(f, HIT, zero - M.FEINT_EXTRA_MS + 50, 'top', [])).toEqual({ index: 0, q: 'bait' });
    expect(M.judgeClash(f, HIT, zero + 20, 'top', [])).toEqual({ index: 0, q: 'perfect' });
  });
  it('signature moves have narrower windows', () => {
    const sig: M.Clash = { id: 's', move: 'signature', swings: [{ off: -450, side: 'top', feint: false }] };
    expect(M.judgeClash(sig, HIT, HIT - 450 + 100, 'top', [])?.q).toBe('block');
    expect(M.judgeClash(sig, HIT, HIT - 450 + 200, 'top', [])).toBeNull();
  });
  it('scales damage per swing and only a fully perfect chain counts', () => {
    expect(M.chainScale(two, ['perfect', 'block'])).toBe(0.25);
    expect(M.chainScale(two, [])).toBe(1);
    expect(M.chainPerfect(two, ['perfect', 'perfect'])).toBe(true);
    expect(M.chainPerfect(two, ['perfect', null])).toBe(false);
  });
  it('reads stored taps only for the same chain', () => {
    expect(M.clashResultsOf({ clash: { id: 'c', r: ['perfect', 'junk'] } }, 'c')).toEqual(['perfect', null]);
    expect(M.clashResultsOf({ clash: { id: 'old', r: ['perfect'] } }, 'c')).toEqual([]);
  });
  it('the third perfect chain in a row is a Riposte, then the count starts again', () => {
    expect(M.nextClashStreak(0, true)).toEqual({ streak: 1, riposte: false });
    expect(M.nextClashStreak(2, true)).toEqual({ streak: 0, riposte: true });
    expect(M.nextClashStreak(2, false)).toEqual({ streak: 0, riposte: false });
    expect(M.counterDamage(8, 'heavy')).toBe(12);
    expect(M.counterDamage(8, 'signature')).toBe(16);
  });
  it('splits the ring into thirds', () => {
    expect(M.sideOfAngle(0)).toBe('right');
    expect(M.sideOfAngle(-20)).toBe('right');
    expect(M.sideOfAngle(150)).toBe('left');
    expect(M.sideOfAngle(270)).toBe('top');
    expect(M.sideOfAngle(-90)).toBe('top');
    expect(M.clashUnderWay(two, HIT, M.clashStartsAt(two, HIT))).toBe(true);
    expect(M.clashUnderWay(two, HIT, M.clashStartsAt(two, HIT) - 1)).toBe(false);
  });
});

describe('Tug & Slip', () => {
  const T0 = 1_000_000;
  const s0 = M.newStruggle(12345, T0);
  /** The first moment at or after t when the needle is well inside the gap. */
  const inGapAt = (s: M.Struggle, t: number) => {
    for (let x = Math.max(t, s.t0); x < t + 20_000; x += 5) {
      const p = M.struggleAt(s, x);
      if (Math.abs(p.needle - p.gap) < p.width / 2 - 1) return x;
    }
    throw new Error('never in the gap');
  };
  /** The first moment at or after t when the needle is far from the gap (no grace, no trap). */
  const farAt = (s: M.Struggle, t: number) => {
    for (let x = Math.max(t, s.t0); x < t + 20_000; x += 5) {
      let far = true;
      for (let g = x - 160; g <= x; g += 5) {
        const p = M.struggleAt(s, g);
        if (Math.abs(p.needle - p.gap) <= p.width / 2 + M.TUG.trap + 1) far = false;
      }
      if (far) return x;
    }
    throw new Error('never far');
  };

  it('starts with the knot in the middle, a 20% gap and the needle at the left', () => {
    expect(s0).toMatchObject({ knot: 50, size: 2, needle: 2, nDir: 1, n: 0, heaves: 0 });
    expect(M.gapWidth(s0.size)).toBe(20);
    expect(M.newStruggle(12345, T0)).toEqual(s0);
    expect(M.newStruggle(12345, T0, M.BLOCKED_PIN_KNOT).knot).toBe(70);
  });
  it('the needle sweeps there and back in 2.2 s and the enemy pulls 4.5% a second', () => {
    expect(M.struggleAt(s0, T0 + 1100).needle).toBeCloseTo(98, 5);
    expect(M.struggleAt(s0, T0 + 2200).needle).toBeCloseTo(2, 5);
    expect(M.struggleAt(s0, T0 + 2000).knot).toBeCloseTo(41, 5);
    expect(M.struggleAt(s0, T0 + 60_000).knot).toBe(0);
  });
  it('bounces at the ends', () => {
    expect(M.bounce(90, 1, 10, 2000, 0, 100)).toEqual({ pos: 90, dir: -1 });
    expect(M.bounce(5, -1, 10, 1000, 0, 100)).toEqual({ pos: 5, dir: 1 });
  });
  it('a heave in the gap pulls 10, then 12, 14, 16 in a row, shrinking the gap and speeding up', () => {
    let s = s0;
    const pulls: number[] = [];
    let t = T0;
    for (let i = 0; i < 5; i++) {
      t = inGapAt(s, t + 50);
      const r = M.heave(s, t)!;
      expect(r.outcome).toBe('heave');
      pulls.push(r.amount);
      s = r.state;
    }
    expect(pulls).toEqual([10, 12, 14, 16, 16]);
    expect(s.size).toBe(6);
    expect(M.gapWidth(s.size)).toBe(8);
    expect(M.needleSpeed(s.heaves)).toBeCloseTo(M.TUG.needleBasePerS * 1.8, 5);
    expect(M.driftSpeed(s.heaves)).toBeCloseTo(150, 5);
  });
  it('a miss slips 5, then 8, locks Heave for 0.7 s, and widens the gap one step', () => {
    const t1 = farAt(s0, T0 + 50);
    const r1 = M.heave(s0, t1)!;
    expect(r1.outcome).toBe('fumble');
    expect(r1.amount).toBe(5);
    expect(r1.state.size).toBe(1);
    expect(r1.state.lockUntil).toBe(t1 + 700);
    expect(M.heave(r1.state, t1 + 300)).toBeNull();
    const t2 = farAt(r1.state, t1 + 700);
    const r2 = M.heave(r1.state, t2)!;
    expect(r2.amount).toBe(8);
    expect(r2.state.size).toBe(0);
  });
  it('a tap on the red edge costs double', () => {
    for (let x = T0 + 200; x < T0 + 20_000; x += 3) {
      const p = M.struggleAt(s0, x);
      const d = Math.abs(p.needle - p.gap) - p.width / 2;
      if (d > 2 && d < M.TUG.trap - 0.5) {
        let graced = false;
        for (let g = x - 145; g <= x; g += 5) {
          const q = M.struggleAt(s0, g);
          if (Math.abs(q.needle - q.gap) <= q.width / 2) graced = true;
        }
        if (graced) continue;
        const r = M.heave(s0, x)!;
        expect(r.outcome).toBe('trap');
        expect(r.amount).toBe(10);
        return;
      }
    }
    throw new Error('no edge tap found');
  });
  it('counts a tap up to 140 ms after the needle left the gap', () => {
    const inside = inGapAt(s0, T0 + 50);
    let leftAt = inside;
    while (Math.abs(M.struggleAt(s0, leftAt).needle - M.struggleAt(s0, leftAt).gap) <= M.struggleAt(s0, leftAt).width / 2) leftAt += 1;
    expect(M.heave(s0, leftAt + 100)!.outcome).toBe('heave');
  });
  it('ignores a tap older than the last counted one, and breaks free at 96', () => {
    expect(M.heave({ ...s0, t0: T0 + 500 }, T0 + 100)).toBeNull();
    const near: M.Struggle = { ...s0, knot: 90 };
    const t = inGapAt(near, T0);
    const r = M.heave(near, t)!;
    expect(r.free).toBe(r.state.knot >= 96);
    expect(r.state.knot).toBeCloseTo(90 - (4.5 * (t - T0)) / 1000 + 10, 5);
  });
  it('replays the same way from the stored state (what the server does)', () => {
    let s = s0;
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t = (i % 2 ? farAt : inGapAt)(s, Math.max(t + 50, s.lockUntil));
      s = M.heave(s, t)!.state;
    }
    const stored = M.cleanStruggle(JSON.parse(JSON.stringify(s)))!;
    expect(stored).toEqual(s);
    const next = inGapAt(stored, t + 50);
    expect(M.heave(stored, next)).toEqual(M.heave(s, next));
  });
  it('a pause moves the struggle later by its length', () => {
    const moved = M.shiftStruggle({ ...s0, lockUntil: T0 + 700 }, 5000);
    expect(moved.t0).toBe(T0 + 5000);
    expect(moved.lockUntil).toBe(T0 + 5700);
    expect(M.struggleAt(moved, T0 + 6000)).toEqual(M.struggleAt(s0, T0 + 1000));
    expect(M.cleanStruggle({ seed: 1 })).toBeNull();
  });
  it('the seeded numbers repeat and spread out', () => {
    expect(M.seeded(7, 3, 1)).toBe(M.seeded(7, 3, 1));
    const xs = Array.from({ length: 200 }, (_, k) => M.seeded(99, k, 1));
    expect(Math.min(...xs)).toBeLessThan(0.05);
    expect(Math.max(...xs)).toBeGreaterThan(0.95);
  });
});
