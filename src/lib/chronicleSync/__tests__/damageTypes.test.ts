import { describe, it, expect } from 'vitest';
import { extractDamageType } from '../patterns/damageTypes';

describe('extractDamageType', () => {
  // === Explicit "X damage" patterns (high confidence) ===
  it('detects explicit damage type keywords', () => {
    expect(extractDamageType('takes 10 fire damage')).toEqual({ type: 'fire', confidence: 'high' });
    expect(extractDamageType('suffers 8 necrotic damage')).toEqual({ type: 'necrotic', confidence: 'high' });
    expect(extractDamageType('deals 14 radiant damage')).toEqual({ type: 'radiant', confidence: 'high' });
    expect(extractDamageType('takes 6 psychic damage')).toEqual({ type: 'psychic', confidence: 'high' });
    expect(extractDamageType('12 points of cold damage')).toEqual({ type: 'cold', confidence: 'high' });
  });

  it('detects "points of X" pattern', () => {
    expect(extractDamageType('takes 12 points of fire damage')).toEqual({ type: 'fire', confidence: 'high' });
    expect(extractDamageType('suffers 8 points of thunder')).toEqual({ type: 'thunder', confidence: 'high' });
  });

  // === Multi-word context keys should take priority over single-word ===
  it('resolves "fire bolt" to fire, not "bolt" to piercing', () => {
    const result = extractDamageType('fire bolt hits for 10');
    expect(result.type).toBe('fire');
  });

  it('resolves "magic missile" to force, not random single word', () => {
    const result = extractDamageType('magic missile strikes the target');
    expect(result.type).toBe('force');
  });

  it('resolves "eldritch blast" to force', () => {
    const result = extractDamageType('eldritch blast hits for 12');
    expect(result.type).toBe('force');
  });

  it('resolves "lightning bolt" to lightning, not "bolt" to piercing', () => {
    const result = extractDamageType('lightning bolt streaks across the room');
    expect(result.type).toBe('lightning');
  });

  it('resolves "chain lightning" to lightning', () => {
    const result = extractDamageType('chain lightning arcs between targets');
    expect(result.type).toBe('lightning');
  });

  it('resolves "acid splash" to acid', () => {
    const result = extractDamageType('acid splash hits the goblin');
    expect(result.type).toBe('acid');
  });

  it('resolves "sacred flame" to radiant', () => {
    const result = extractDamageType('sacred flame descends on the undead');
    expect(result.type).toBe('radiant');
  });

  it('resolves "toll the dead" to necrotic', () => {
    const result = extractDamageType('toll the dead echoes');
    expect(result.type).toBe('necrotic');
  });

  // === Single-word context fallbacks ===
  it('falls back to single-word context when no multi-word match', () => {
    // "slashes" doesn't match context key "slash" (exact word split), but "slash" does
    expect(extractDamageType('a slash across the chest')).toEqual({ type: 'slashing', confidence: 'medium' });
    expect(extractDamageType('stab with the rapier')).toEqual({ type: 'piercing', confidence: 'medium' });
    expect(extractDamageType('smash with the hammer')).toEqual({ type: 'bludgeoning', confidence: 'medium' });
  });

  // === Weapon inference ===
  it('infers damage type from weapon names', () => {
    expect(extractDamageType('attacks with a longsword').type).toBe('slashing');
    expect(extractDamageType('fires the longbow').type).toBe('piercing');
    expect(extractDamageType('swings the warhammer').type).toBe('bludgeoning');
    expect(extractDamageType('thrusts with the rapier').type).toBe('piercing');
  });

  // === Unknown / no match ===
  it('returns null with low confidence for unrecognizable text', () => {
    const result = extractDamageType('something happens');
    expect(result.type).toBeNull();
    expect(result.confidence).toBe('low');
  });
});
