import { describe, it, expect } from 'vitest';
import { parseMovementEvents } from '../patterns/movement';

describe('parseMovementEvents', () => {
  it('detects "moves 30 feet"', () => {
    const r = parseMovementEvents('The fighter moves 30 feet toward the orc.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('move');
    expect(r[0].distance).toBe(30);
  });

  it('detects dashing with distance', () => {
    const r = parseMovementEvents('The rogue dashes 60 feet down the corridor.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('dash');
    expect(r[0].distance).toBe(60);
  });

  it('detects "uses Dash action"', () => {
    const r = parseMovementEvents('She uses the Dash action to escape.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('dash');
  });

  it('detects Disengage action', () => {
    const r = parseMovementEvents('The goblin takes the Disengage action.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('disengage');
  });

  it('detects Dodge action', () => {
    const r = parseMovementEvents('He takes the Dodge action this turn.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('dodge');
  });

  it('does NOT false-positive on "Dodge" as a name', () => {
    const r = parseMovementEvents('Dodge the halfling explores the tavern.');
    const dodgeActions = r.filter(e => e.type === 'dodge');
    expect(dodgeActions).toHaveLength(0);
  });

  it('detects opportunity attack', () => {
    const r = parseMovementEvents('The cleric provokes an opportunity attack from the ogre.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('opportunity_attack');
  });

  it('detects flanking', () => {
    const r = parseMovementEvents('The rogue is flanking the orc chieftain.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('position');
  });

  it('detects "within 5 feet of"', () => {
    const r = parseMovementEvents('You are within 5 feet of the dragon.');
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('position');
    expect(r[0].distance).toBe(5);
  });

  it('detects "30 feet away"', () => {
    const r = parseMovementEvents('The archer is 30 feet away from the target.');
    expect(r).toHaveLength(1);
    expect(r[0].distance).toBe(30);
  });

  it('handles multiple movement events', () => {
    const text = 'The fighter moves 30 feet and provokes an opportunity attack. Then retreats 15 feet.';
    const r = parseMovementEvents(text);
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for no matches', () => {
    expect(parseMovementEvents('The wizard studies the ancient tome.')).toHaveLength(0);
  });
});
