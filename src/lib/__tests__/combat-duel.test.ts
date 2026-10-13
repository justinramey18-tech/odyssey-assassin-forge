=== START OF src/lib/__tests__/combat-duel.test.ts ===
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as D from '@/lib/combatDuel';

const fair: D.DuelFighters = { level: 3, dex: 14, ac: 14, maxHp: 40, npcAttack: 5, npcDamageAvg: 8, npcSpeed: 'medium' };
const under: D.DuelFighters = { level: 1, dex: 10, ac: 12, maxHp: 22, npcAttack: 8, npcDamageAvg: 11, npcSpeed: 'hard' };
const over: D.DuelFighters = { level: 8, dex: 18, ac: 17, maxHp: 70, npcAttack: 4, npcDamageAvg: 7, npcSpeed: 'easy' };

const make = (F: D.DuelFighters, seed: number) =>
  D.newDuel({ id: `d${seed}`, npcId: 'npc', npcName: 'Ogre', startAt: 0, finish: 'knockout', weapon: null }, D.deriveDuel(F), D.seededRandom(seed));

/** Taps every strike dead on time, holds every heavy, dodges every sweep, leaves feints, and counters when it is safe. */
function perfectTaps(duel: D.Duel): D.DuelInput[] {
  const out: D.DuelInput[] = [];
  const S = duel.strikes;
  const clear = (lane: number, t: number) =>
    !S.some(o => o.lane === lane && Math.abs(o.zero - t) < 400) &&
    !S.some(o => o.kind === 'heavy' && o.lane === lane && t >= o.zero - o.warn - 100 && t <= o.zero + 700);
  for (const s of S) {
    if (s.feint) continue;
    if (s.kind === 'sweep') { out.push([s.zero, 16]); continue; }
    if (s.kind === 'heavy') {
      out.push([s.zero - 100, s.lane], [s.zero + 450, s.lane + 8]);
      continue;
    }
    out.push([s.zero, s.lane], [s.zero + 40, s.lane + 8]);
    const rt = s.zero + 120;
    if (clear(s.lane, rt)) out.push([rt, s.lane], [rt + 40, s.lane + 8]);
  }
  return out;
}

describe('Duel rules', () => {
  it('is the same file on the phone and on the server', () => {
    const a = readFileSync('src/lib/combatDuel.ts', 'utf8');
    const b = readFileSync('supabase/functions/npc-combat/duel.ts', 'utf8');
    expect(b).toBe(a);
  });

  it('turns stats into numbers: a stronger player gets a wider window, longer counter and softer blocks', () => {
    const f = D.deriveDuel(fair);
    const u = D.deriveDuel(under);
    const o = D.deriveDuel(over);
    expect(f).toMatchObject({ style: 'brute', strikes: 8, warn: 920, gap: 670, perfect: 120, riposteMs: 680 });
    expect(u).toMatchObject({ style: 'savage', strikes: 10, perfect: 70 });
    expect(o).toMatchObject({ style: 'soldier', strikes: 6, perfect: 160, riposteMs: 800 });
    expect(o.block).toBeLessThan(f.block);
    expect(u.block).toBeGreaterThan(f.block);
    expect(D.deriveDuel({ ...fair, feel: 'relaxed' }).perfect).toBeGreaterThan(f.perfect);
    expect(D.deriveDuel({ ...fair, feel: 'tough' }).perfect).toBeLessThan(f.perfect);
  });

  it('perfect play blocks everything, and doing nothing lets every real strike through', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const duel = make([fair, under, over][seed % 3], seed);
      const best = D.replayDuel(duel, perfectTaps(duel));
      expect(best.allPerfect).toBe(true);
      expect(best.feintsBit).toBe(0);
      expect(best.through.every(x => x === 0)).toBe(true);
      const none = D.replayDuel(duel, []);
      expect(none.hits).toBe(duel.strikes.filter(s => !s.feint).length);
      expect(none.ripostes).toBe(0);
    }
  });

  it('a phone playing live and the server replaying the same taps agree', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const duel = make([fair, under, over][seed % 3], seed);
      const jitter = D.seededRandom(seed * 7);
      const taps = perfectTaps(duel)
        .map(([t, c]) => [t + Math.round((jitter() - 0.5) * 360), c] as D.DuelInput)
        .sort((a, b) => a[0] - b[0]);
      const run = D.startRun(duel);
      let t = -500;
      let k = 0;
      while (t < duel.endMs + 50) {
        t += 5 + jitter() * 30;
        while (k < taps.length && taps[k][0] <= t) D.inputRun(run, taps[k++]);
        D.advanceRun(run, t);
      }
      expect(D.finishRun(run)).toEqual(D.replayDuel(duel, taps));
    }
  });

  it('never puts a sweep and another strike in the same direction at once', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const duel = make(under, seed);
      const T = D.DUEL_TIMING;
      const lanes = (s: D.DuelStrike) => (s.kind === 'sweep' ? [(s.lane + 7) % 8, s.lane, (s.lane + 1) % 8] : [s.lane]);
      const span = (s: D.DuelStrike) => [s.zero - s.warn, s.zero + T.lateMs + (s.kind === 'heavy' ? T.holdMs : 0)];
      duel.strikes.forEach((a, i) => duel.strikes.slice(0, i).forEach(b => {
        const [a0, a1] = span(a);
        const [b0, b1] = span(b);
        if (a0 < b1 && b0 < a1) expect(lanes(a).some(l => lanes(b).includes(l))).toBe(false);
      }));
    }
  });

  it('a stored duel reads back the same', () => {
    const duel = make(fair, 3);
    expect(D.cleanDuel(JSON.parse(JSON.stringify(duel)))).toEqual(duel);
    expect(D.cleanDuel({ v: 2 })).toBeNull();
  });

  it('fills the Duel bar by share of max HP, 4 to 30 per hit', () => {
    expect(D.duelChargeGain(0, 40)).toBe(0);
    expect(D.duelChargeGain(1, 200)).toBe(4);
    expect(D.duelChargeGain(4, 40)).toBe(13);
    expect(D.duelChargeGain(30, 40)).toBe(30);
    expect(D.duelChargeNow(140)).toBe(100);
  });
});
