import { describe, it, expect } from 'vitest';
import { pickWakes, STAND_IN_COOLDOWN_MS } from '../stand-in-triggers';

const A = { id: 'a', name: 'Arwen Vale' };
const X = { id: 'x', name: 'Xeyle' };
const now = 1_000_000;

describe('stand-in wake triggers', () => {
  it('wakes a stand-in named by first name', () => {
    expect(pickWakes('Arwen, what do you see?', [A, X], {}, now)).toEqual([{ npcId: 'a', trigger: 'name' }]);
  });
  it('marks a named insult as provocation', () => {
    expect(pickWakes('Xeyle is a coward.', [A, X], {}, now)).toEqual([{ npcId: 'x', trigger: 'provocation' }]);
  });
  it('one quietest stand-in answers an advice question', () => {
    const r = pickWakes('Should we take the left tunnel?', [A, X], { a: now - STAND_IN_COOLDOWN_MS - 1, x: 1 }, now);
    expect(r).toEqual([{ npcId: 'x', trigger: 'advice' }]);
  });
  it('wakes on a skill moment', () => {
    expect(pickWakes('The door has a strange lock.', [A], {}, now)).toEqual([{ npcId: 'a', trigger: 'skill' }]);
  });
  it('respects the 90 second cooldown', () => {
    expect(pickWakes('Arwen?', [A], { a: now - 30_000 }, now)).toEqual([]);
  });
  it('ignores explicit @ tags and plain lines', () => {
    expect(pickWakes('@Arwen hello', [A], {}, now)).toEqual([]);
    expect(pickWakes('I walk forward.', [A], {}, now)).toEqual([]);
  });
});
