import { describe, it, expect } from 'vitest';
import { parseDiceSpec, rollDice, describeRoll, parseHostRoll, parseRollRequest, randomDie, rollForAssistant } from '@/lib/dm-dice';

const fixed = (...faces: number[]) => { let i = 0; return () => faces[i++ % faces.length]; };

describe('dice', () => {
  it('reads common expressions', () => {
    expect(parseDiceSpec('1d20+5')).toEqual({ count: 1, sides: 20, modifier: 5, mode: 'normal' });
    expect(parseDiceSpec('2d6 - 1')).toEqual({ count: 2, sides: 6, modifier: -1, mode: 'normal' });
    expect(parseDiceSpec('d20 adv')).toMatchObject({ count: 1, sides: 20, mode: 'advantage' });
    expect(parseDiceSpec('1d20+2 disadvantage')).toMatchObject({ mode: 'disadvantage' });
    expect(parseDiceSpec('no dice here')).toBeNull();
    expect(parseDiceSpec('99d6')).toBeNull();
  });

  it('adds up rolls and keeps the right die with advantage', () => {
    const r = rollDice('Club', '2d8+3', parseDiceSpec('2d8+3')!, fixed(4, 7));
    expect(r.total).toBe(14);
    expect(describeRoll(r)).toBe('[4, 7] + 3 = 14');
    const adv = rollDice('Attack', '1d20+5 adv', parseDiceSpec('1d20+5 adv')!, fixed(8, 20));
    expect(adv.kept).toEqual([20]);
    expect(adv.crit).toBe('nat20');
    expect(rollForAssistant(adv)).toBe('Attack: 1d20+5 adv → [8, 20] keep 20 + 5 = 25 (natural 20)');
  });

  it('only rolls host messages that start with roll and contain dice', () => {
    expect(parseHostRoll('roll 1d20+5 Grukk attack')).toMatchObject({ label: 'Grukk attack', expr: '1d20+5' });
    expect(parseHostRoll('/roll for Grukk stealth d20 adv')).toMatchObject({ label: 'Grukk stealth', expr: 'd20 adv' });
    expect(parseHostRoll('roll for initiative')).toBeNull();
    expect(parseHostRoll('what if Grukk rolls 1d20')).toBeNull();
  });

  it('reads the assistant roll requests', () => {
    expect(parseRollRequest("- Grukk's attack on Kaelen: 1d20+5")).toMatchObject({ label: "Grukk's attack on Kaelen", expr: '1d20+5' });
    expect(parseRollRequest('just words')).toBeNull();
  });

  it('stays in range', () => {
    for (let i = 0; i < 2000; i++) {
      const v = randomDie(20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});
