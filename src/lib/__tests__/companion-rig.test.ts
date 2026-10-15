import { describe, it, expect } from 'vitest';
import { sanitizeRig, addBond, DEFAULT_RIG, NAME_MAX } from '../companion-rig';

describe('companion rig', () => {
  it('bond never goes above 100', () => {
    expect(addBond({ ...DEFAULT_RIG, bond: 98 }, 10).bond).toBe(100);
  });
  it('bond never goes below 0', () => {
    expect(addBond({ ...DEFAULT_RIG, bond: 3 }, -10).bond).toBe(0);
  });
  it('a broken bond number is ignored, not saved', () => {
    expect(addBond({ ...DEFAULT_RIG, bond: 40 }, NaN).bond).toBe(40);
    expect(sanitizeRig({ bond: 'abc' }).bond).toBe(DEFAULT_RIG.bond);
  });
  it('unknown body type falls back to the default', () => {
    expect(sanitizeRig({ chassis: 'dragon-god' }).chassis).toBe('prowler');
  });
  it('name is capped at 24 letters', () => {
    expect(sanitizeRig({ name: 'x'.repeat(50) }).name.length).toBe(NAME_MAX);
    expect(NAME_MAX).toBe(24);
  });
  it('sliders are clamped between 0 and 1', () => {
    expect(sanitizeRig({ build: 5 }).build).toBe(1);
    expect(sanitizeRig({ muzzle: -2 }).muzzle).toBe(0);
  });
});
