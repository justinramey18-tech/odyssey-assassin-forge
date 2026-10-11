// Combat perks bought with gold. Keep in sync with supabase/functions/npc-combat/rules.ts PERKS.
export const COMBAT_PERKS = [
  { id: 'iron_lungs', name: 'Iron Lungs', cost: 3000, text: 'Resolve fills 30% faster over time.' },
  { id: 'pain_fuel', name: 'Pain Fuel', cost: 3000, text: 'Taking damage gives double Resolve.' },
  { id: 'momentum', name: 'Momentum', cost: 3000, text: 'Landing a hit gives +10 Resolve instead of +5.' },
  { id: 'deep_breath', name: 'Deep Breath', cost: 5000, text: 'Second Wind rolls 2 hit dice.' },
  { id: 'battle_medic', name: 'Battle Medic', cost: 5000, text: 'Second Wind can heal an ally instead of you.' },
  { id: 'last_stand', name: 'Last Stand', cost: 8000, text: 'Once per fight, a full Resolve bar turns a fall to 0 HP into a Second Wind.' },
] as const;
export type CombatPerkId = typeof COMBAT_PERKS[number]['id'];
export const EXTRA_PERK_SLOT_COST = 10000;
