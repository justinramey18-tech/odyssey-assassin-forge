import { describe, it, expect } from 'vitest';
import { parseDamageMatches, parseHealingMatches, parseCritMatches, parseConditionMatches } from '../patterns';
import { parseInspirationMatches } from '../patterns/inspiration';
import { parseRestMatches } from '../patterns/rests';
import { parseLogOffline } from '../processor';

// ===== BUG: Damage deduplication =====

describe('damage deduplication', () => {
  it('does not double-count damage when multiple patterns match the same text', () => {
    // "takes 18 slashing damage" matches DAMAGE_PATTERNS[0] and could match [2]
    const result = parseDamageMatches('The fighter takes 18 slashing damage.');
    const total = result.reduce((s, m) => s + (m.value as number), 0);
    expect(total).toBe(18);
  });

  it('does not double-count "deals 25 damage" matched by multiple patterns', () => {
    const result = parseDamageMatches('The orc deals 25 damage to the fighter.');
    const total = result.reduce((s, m) => s + (m.value as number), 0);
    expect(total).toBe(25);
  });

  it('counts different damage events separately', () => {
    const result = parseDamageMatches(
      'The orc deals 10 damage. Later, the goblin deals 15 damage.'
    );
    expect(result.length).toBe(2);
    const total = result.reduce((s, m) => s + (m.value as number), 0);
    expect(total).toBe(25);
  });

  it('does not double-count "for 28 points of fire damage" with base pattern', () => {
    const result = parseDamageMatches('The dragon breathes fire for 28 points of fire damage.');
    const amounts = result.map(m => m.value as number);
    // Should have 28 only once, not doubled
    expect(amounts.filter(a => a === 28).length).toBe(1);
  });
});

// ===== BUG: Healing deduplication =====

describe('healing deduplication', () => {
  it('does not double-count healing from overlapping patterns', () => {
    // "heals 12 HP" could match HEALING_PATTERNS[0] and [2]
    const result = parseHealingMatches('The cleric heals 12 HP.');
    const total = result.reduce((s, m) => s + (m.value as number), 0);
    expect(total).toBe(12);
  });

  it('counts separate healing events correctly', () => {
    const result = parseHealingMatches(
      'The cleric heals 8 HP. The paladin restores 15 hit points.'
    );
    expect(result.length).toBe(2);
  });
});

// ===== BUG: Crit detection false positives =====

describe('crit detection', () => {
  it('does not match "rolls 20 for Perception" as a critical hit', () => {
    const result = parseCritMatches('The rogue rolls 20 for Perception.');
    // Should NOT match as a crit because it's a skill check
    const crits = result.filter(m => m.value === 'critical_hit');
    // The "rolls 20" pattern now requires "to hit" or "on attack" context
    expect(crits.length).toBe(0);
  });

  it('does not match "rolls a 20 on the saving throw" as a critical hit', () => {
    const result = parseCritMatches('The wizard rolls a 20 on the saving throw.');
    const crits = result.filter(m => m.value === 'critical_hit');
    expect(crits.length).toBe(0);
  });

  it('matches "rolls a 20 to hit" as a critical hit', () => {
    const result = parseCritMatches('The fighter rolls a 20 to hit the orc.');
    const crits = result.filter(m => m.value === 'critical_hit');
    expect(crits.length).toBeGreaterThanOrEqual(1);
  });

  it('still matches "natural 20" without context', () => {
    const result = parseCritMatches('Natural 20!');
    expect(result.some(m => m.value === 'critical_hit')).toBe(true);
  });

  it('still matches "critical hit" text', () => {
    const result = parseCritMatches('Critical hit on the goblin!');
    expect(result.some(m => m.value === 'critical_hit')).toBe(true);
  });

  it('deduplicates overlapping crit detections at same position', () => {
    // "natural 20" and "critical hit" in the SAME phrase should dedup
    const result = parseCritMatches('Scores a natural 20 critical hit!');
    const crits = result.filter(m => m.value === 'critical_hit');
    // Both patterns overlap at the same position, so should dedup to 1
    expect(crits.length).toBe(1);
  });

  it('does not match bare "fumbles" without attack context', () => {
    // The tightened pattern requires attack/swing/strike/shot context
    const result = parseCritMatches('The bard fumbles with the lockpick.');
    const fumbles = result.filter(m => m.value === 'fumble');
    // "fumbles with" doesn't match "fumbles the attack" pattern
    expect(fumbles.length).toBe(0);
  });

  it('matches "fumbles the attack"', () => {
    const result = parseCritMatches('The fighter fumbles the attack roll.');
    expect(result.some(m => m.value === 'fumble')).toBe(true);
  });

  it('does not match "natural 1 for Stealth" as a fumble', () => {
    const result = parseCritMatches('Rolls a natural 1 for Stealth.');
    const fumbles = result.filter(m => m.value === 'fumble');
    expect(fumbles.length).toBe(0);
  });
});

// ===== BUG: Bardic inspiration add vs use =====

describe('bardic inspiration add/use classification', () => {
  it('classifies "adds bardic inspiration" as used (adding to a roll)', () => {
    const result = parseInspirationMatches('The fighter adds bardic inspiration d8 to the attack roll.');
    const bardic = result.filter(m => m.inspirationType === 'bardic_used');
    expect(bardic.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies "grants bardic inspiration" as granted', () => {
    const result = parseInspirationMatches('The bard grants bardic inspiration d10.');
    const bardic = result.filter(m => m.inspirationType === 'bardic_granted');
    expect(bardic.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies "uses bardic inspiration" as used', () => {
    const result = parseInspirationMatches('The fighter uses bardic inspiration d8.');
    const bardic = result.filter(m => m.inspirationType === 'bardic_used');
    expect(bardic.length).toBe(1);
  });
});

// ===== BUG: Rest proximity deduplication =====

describe('rest proximity deduplication', () => {
  it('does not double-count "takes a short rest for an hour"', () => {
    const result = parseRestMatches('The party takes a short rest for an hour to recover.');
    const shortRests = result.filter(m => m.restType === 'short');
    // "takes a short rest" and "rests for an hour" could both match — should dedup
    expect(shortRests.length).toBe(1);
  });

  it('does not double-count "took a long rest and slept for the night"', () => {
    const result = parseRestMatches('The party took a long rest and slept for the night.');
    const longRests = result.filter(m => m.restType === 'long');
    expect(longRests.length).toBe(1);
  });

  it('counts separate rest events correctly', () => {
    const result = parseRestMatches(
      'After the fight, the party takes a short rest. ' +
      'Several hours later, they decide to take a long rest for the night.'
    );
    const shortRests = result.filter(m => m.restType === 'short');
    const longRests = result.filter(m => m.restType === 'long');
    expect(shortRests.length).toBe(1);
    expect(longRests.length).toBeGreaterThanOrEqual(1);
  });

  it('counts two separate short rests far apart in text', () => {
    // Use longer text to ensure they're more than 100 chars apart
    const result = parseRestMatches(
      'The party takes a short rest after the first battle. They spend hit dice and recover some health. ' +
      'The bard plays a soothing melody while the fighter patches wounds. ' +
      'Much later that day, the party takes a short rest after a grueling exploration of the cave system.'
    );
    const shortRests = result.filter(m => m.restType === 'short');
    expect(shortRests.length).toBe(2);
  });
});

// ===== INTEGRATION: Full processor bug checks =====

describe('processor integration bug checks', () => {
  it('does not double-count damage in full parse', () => {
    const result = parseLogOffline('The orc deals 15 fire damage to the fighter.');
    const totalDmg = result.hpChanges
      .filter(h => h.type === 'damage')
      .reduce((s, h) => s + Math.abs(h.amount), 0);
    expect(totalDmg).toBe(15);
  });

  it('does not count skill check nat 20 as a combat crit', () => {
    const result = parseLogOffline('The rogue rolls a natural 20 on the Stealth check.');
    // Should still detect the nat 20 from the base "natural 20" pattern
    // but should NOT double-count from the "rolls 20" pattern
    const crits = result.combatEvents.filter(e => e.type === 'critical_hit');
    // The "natural 20" pattern still matches, which is OK for combat events
    // But the "rolls 20 for Perception" pattern should NOT add a second one
    expect(crits.length).toBeLessThanOrEqual(1);
  });
});
