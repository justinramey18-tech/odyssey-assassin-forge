import { describe, expect, it, vi } from 'vitest';
import { soloRollLine } from '@/lib/solo-table-actions';
import type { DiceTestRoll } from '@/lib/diceRollBus';

const roll: DiceTestRoll = { kind: 'test', rolls: [17, 9], kept: 17, die: 20, modifier: 3, total: 20, rollMode: 'advantage', mode: 'fair' };
describe('solo manual roll rulings', () => {
  it('passes the final d20 and modifier once to the same referee', async () => {
    const check = vi.fn(async () => ({ line: 'Binding ruling', outcome: 'success' as const, dc: 15, total: 20, hp: 0, strain: 0, injury: null, condition: null }));
    expect(await soloRollLine('Roll 17', roll, 15, 'physical', 'Athletics', check)).toBe('Roll 17\nBinding ruling');
    expect(check).toHaveBeenCalledExactlyOnceWith({ d20: 17, modifier: 3, dc: 15, risk: 'physical', label: 'Athletics' });
  });
  it('does not referee a quick die or a roll without a DC', async () => {
    const check = vi.fn();
    expect(await soloRollLine('d6', { ...roll, die: 6 }, 15, 'mental', 'd6', check)).toBe('d6');
    expect(await soloRollLine('d20', roll, null, 'mental', 'd20', check)).toBe('d20');
    expect(check).not.toHaveBeenCalled();
  });
});