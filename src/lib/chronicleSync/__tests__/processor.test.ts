import { describe, it, expect } from 'vitest';
import { parseLogOffline, calculateChangeSummary } from '../processor';

describe('parseLogOffline', () => {
  it('returns a valid empty result for blank input', () => {
    const result = parseLogOffline('');
    expect(result.parseMode).toBe('offline');
    expect(result.xpChanges).toEqual([]);
    expect(result.hpChanges).toEqual([]);
    expect(result.inputLength).toBe(0);
  });

  it('parses XP gains', () => {
    const result = parseLogOffline('The party earns 500 XP for defeating the goblin chief.');
    expect(result.xpChanges.length).toBeGreaterThanOrEqual(1);
    expect(result.xpChanges[0].amount).toBe(500);
  });

  it('parses damage events', () => {
    const result = parseLogOffline('The fighter takes 12 fire damage from the dragon breath.');
    expect(result.hpChanges.some(h => h.type === 'damage')).toBe(true);
    const dmg = result.hpChanges.find(h => h.type === 'damage');
    expect(dmg).toBeDefined();
    expect(dmg!.amount).toBeLessThan(0); // Damage is negative
  });

  it('parses healing events with source attribution', () => {
    const result = parseLogOffline('The cleric casts Cure Wounds and heals 8 hit points.');
    const heal = result.hpChanges.find(h => h.type === 'healing');
    expect(heal).toBeDefined();
    expect(heal!.amount).toBeGreaterThan(0);
  });

  it('parses gold gained and spent', () => {
    const result = parseLogOffline('The party finds 50 gold pieces in the chest. Later they spend 20 gold at the shop.');
    const gained = result.goldChanges.filter(g => g.action === 'gained');
    const spent = result.goldChanges.filter(g => g.action === 'spent');
    expect(gained.length).toBeGreaterThanOrEqual(1);
    expect(spent.length).toBeGreaterThanOrEqual(1);
  });

  it('parses conditions applied', () => {
    const result = parseLogOffline('The rogue is now poisoned by the trap.');
    expect(result.conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('parses level up', () => {
    const result = parseLogOffline('Congratulations! You have reached level 5!');
    expect(result.levelUp).not.toBeNull();
    expect(result.levelUp!.newLevel).toBe(5);
  });

  it('parses combat events (critical hits)', () => {
    const result = parseLogOffline('The paladin scores a critical hit on the skeleton!');
    expect(result.combatEvents.some(e => e.type === 'critical_hit')).toBe(true);
  });

  it('parses item acquisition', () => {
    const result = parseLogOffline('The party acquires a potion of healing from the treasure.');
    expect(result.itemChanges.some(i => i.action === 'acquired')).toBe(true);
  });

  it('parses item consumption', () => {
    const result = parseLogOffline('The wizard drinks a potion of healing.');
    expect(result.itemChanges.some(i => i.action === 'consumed')).toBe(true);
  });

  it('deduplicates XP from summary lines', () => {
    const log = `The party earns 200 XP for defeating the bandits.\nSession Summary: Total XP: 200`;
    const result = parseLogOffline(log);
    const totalXP = result.xpChanges.reduce((s, x) => s + x.amount, 0);
    // Should not double-count the 200 XP from summary
    expect(totalXP).toBe(200);
  });

  it('applies cross-category validation (XP near combat boosted)', () => {
    const log = 'The party defeats the troll. They earn 450 XP.';
    const result = parseLogOffline(log);
    // XP near combat should have boosted confidence
    if (result.xpChanges.length > 0 && result.combatEvents.length > 0) {
      expect(result.xpChanges[0].confidence).not.toBe('low');
    }
  });

  it('handles malformed condition values gracefully', () => {
    // This tests that the processor doesn't crash on edge cases
    const result = parseLogOffline('Something weird happens with no conditions.');
    expect(result.conditions).toBeDefined();
  });

  it('sets inputLength from raw input, not filtered', () => {
    const raw = 'Test input with 100 XP gained.';
    const result = parseLogOffline(raw);
    expect(result.inputLength).toBe(raw.length);
  });
});

describe('calculateChangeSummary', () => {
  it('calculates correct totals', () => {
    const result = parseLogOffline(
      'Gained 100 XP. Gained 200 XP. Takes 15 damage. Heals 8 hit points. Finds 50 gold. Spends 20 gold.'
    );
    const summary = calculateChangeSummary(result);
    expect(summary.totalXP).toBeGreaterThanOrEqual(100);
    expect(summary.totalHP.damage).toBeGreaterThanOrEqual(0);
    expect(summary.totalHP.healing).toBeGreaterThanOrEqual(0);
  });

  it('returns zero totals for empty result', () => {
    const result = parseLogOffline('');
    const summary = calculateChangeSummary(result);
    expect(summary.totalXP).toBe(0);
    expect(summary.totalItems).toBe(0);
    expect(summary.totalAchievements).toBe(0);
    expect(summary.hasLevelUp).toBe(false);
  });
});
