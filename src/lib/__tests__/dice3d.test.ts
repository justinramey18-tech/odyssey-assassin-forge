import { describe, it, expect } from 'vitest';
import { diceForRoll, relabelForTop, bumpMs } from '@/lib/dice3d';

describe('3D dice', () => {
  it('shows the d20 and each damage die of an attack with the decided values', () => {
    const d = diceForRoll({ kind: 'attack', d20: 17, damageRolls: [3, 6], damageDie: 6, damageTotal: 9 } as never);
    expect(d?.map((x) => [x.sides, x.value])).toEqual([[20, 17], [6, 3], [6, 6]]);
  });
  it('falls back to the flat roller for a d10', () => {
    expect(diceForRoll({ kind: 'effect', label: 'x', rolls: [7], die: 10, bonus: 0, total: 7, mode: 'fair' } as never)).toBeNull();
  });
  it('rejects impossible values', () => {
    expect(diceForRoll({ kind: 'check', d20: 21, outcome: 'success', mode: 'fair' } as never)).toBeNull();
  });
  it('the up face always ends up showing the decided number', () => {
    const labels = [1, 2, 3, 4, 5, 6];
    expect(relabelForTop(labels, 0, 5)[0]).toBe(5);
    expect(relabelForTop(labels, 4, 5)).toEqual(labels);
  });
  it('no buzz for a gentle touch', () => {
    expect(bumpMs(0.5)).toBe(0);
    expect(bumpMs(4)).toBeGreaterThan(0);
  });
});
