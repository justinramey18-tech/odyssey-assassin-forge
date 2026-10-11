import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBAT_PERKS, EXTRA_PERK_SLOT_COST } from '@/lib/combat-perks';

// The shop's prices must match what the fight referee charges.
const rules = readFileSync('supabase/functions/npc-combat/rules.ts', 'utf8');

describe('combat perk prices', () => {
  for (const p of COMBAT_PERKS) {
    it(`${p.name} costs ${p.cost} on both sides`, () => {
      expect(rules).toContain(`${p.id}: { name: '${p.name}', cost: ${p.cost} }`);
    });
  }
  it('extra slot costs 10000 on both sides', () => {
    expect(EXTRA_PERK_SLOT_COST).toBe(10000);
    expect(rules).toContain('export const EXTRA_SLOT_COST = 10000;');
  });
});
