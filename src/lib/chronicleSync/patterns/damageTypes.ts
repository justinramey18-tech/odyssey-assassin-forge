// Chronicle Sync: Damage Type Extraction
// Extracts structured damage types from damage event context

import { ConfidenceLevel } from '../types';

// All D&D 5e damage types
export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force',
  'lightning', 'necrotic', 'piercing', 'poison',
  'psychic', 'radiant', 'slashing', 'thunder',
] as const;

export type DamageType = typeof DAMAGE_TYPES[number];

// Context words that imply damage types even without explicit naming
const DAMAGE_TYPE_CONTEXT: Record<string, DamageType> = {
  // Fire
  burn: 'fire', burns: 'fire', burned: 'fire', burning: 'fire',
  flame: 'fire', flames: 'fire', flaming: 'fire',
  scorch: 'fire', scorched: 'fire', searing: 'fire', sear: 'fire',
  ignite: 'fire', incinerate: 'fire', blaze: 'fire',
  fireball: 'fire', 'fire bolt': 'fire',
  lava: 'fire', magma: 'fire', inferno: 'fire', conflagration: 'fire',
  // Cold
  freeze: 'cold', freezes: 'cold', frozen: 'cold', freezing: 'cold',
  frost: 'cold', frostbite: 'cold', icy: 'cold', chill: 'cold',
  'ray of frost': 'cold', 'cone of cold': 'cold',
  glacial: 'cold', hypothermia: 'cold', blizzard: 'cold',
  // Lightning
  shock: 'lightning', shocks: 'lightning', shocked: 'lightning',
  electrocute: 'lightning', electrified: 'lightning', jolt: 'lightning',
  'lightning bolt': 'lightning', 'chain lightning': 'lightning',
  zap: 'lightning', spark: 'lightning',
  // Thunder
  thunder: 'thunder', thunderous: 'thunder', sonic: 'thunder',
  deafen: 'thunder', shatter: 'thunder', thunderwave: 'thunder',
  concussive: 'thunder', boom: 'thunder',
  // Poison
  venom: 'poison', venomous: 'poison', toxic: 'poison', toxin: 'poison',
  // Necrotic
  necrotic: 'necrotic', wither: 'necrotic', withering: 'necrotic',
  decay: 'necrotic', rot: 'necrotic', rotting: 'necrotic',
  'chill touch': 'necrotic', blight: 'necrotic',
  'toll the dead': 'necrotic', 'finger of death': 'necrotic',
  drain: 'necrotic', 'life drain': 'necrotic',
  // Radiant
  radiant: 'radiant', holy: 'radiant', divine: 'radiant',
  smite: 'radiant', 'guiding bolt': 'radiant', 'sacred flame': 'radiant',
  'moonbeam': 'radiant', 'dawn': 'radiant', 'sunbeam': 'radiant',
  'sunburst': 'radiant', 'word of radiance': 'radiant',
  // Psychic
  psychic: 'psychic', mental: 'psychic', 'mind blast': 'psychic',
  'psychic scream': 'psychic', 'mind spike': 'psychic', 'synaptic static': 'psychic',
  // Force
  force: 'force', 'magic missile': 'force', 'eldritch blast': 'force',
  'spiritual weapon': 'force', 'bigby\'s hand': 'force', 'disintegrate': 'force',
  // Acid
  acid: 'acid', corrode: 'acid', corrosive: 'acid', dissolve: 'acid',
  'acid splash': 'acid', 'melf\'s acid arrow': 'acid',
  // Physical - weapons
  slash: 'slashing', slashing: 'slashing', cleave: 'slashing', cut: 'slashing',
  longsword: 'slashing', greatsword: 'slashing', scimitar: 'slashing',
  greataxe: 'slashing', handaxe: 'slashing', glaive: 'slashing',
  halberd: 'slashing', sickle: 'slashing', whip: 'slashing',
  pierce: 'piercing', piercing: 'piercing', stab: 'piercing', impale: 'piercing',
  longbow: 'piercing', shortbow: 'piercing', crossbow: 'piercing',
  rapier: 'piercing', spear: 'piercing', javelin: 'piercing', pike: 'piercing',
  arrow: 'piercing', bolt: 'piercing', dart: 'piercing', trident: 'piercing',
  bite: 'piercing', fang: 'piercing', sting: 'piercing',
  bludgeon: 'bludgeoning', bludgeoning: 'bludgeoning', crush: 'bludgeoning',
  smash: 'bludgeoning', slam: 'bludgeoning', pummel: 'bludgeoning',
  warhammer: 'bludgeoning', mace: 'bludgeoning', flail: 'bludgeoning',
  quarterstaff: 'bludgeoning', maul: 'bludgeoning', club: 'bludgeoning',
  falling: 'bludgeoning', drowning: 'bludgeoning', constrict: 'bludgeoning',
  'tail swipe': 'bludgeoning', 'tail attack': 'bludgeoning',
};

/**
 * Extract damage type from a damage event's source/context text
 */
export function extractDamageType(sourceText: string): { type: DamageType | null; confidence: ConfidenceLevel } {
  const lower = sourceText.toLowerCase();

  // 1. Check for explicit "X damage" pattern
  for (const dt of DAMAGE_TYPES) {
    if (new RegExp(`\\b${dt}\\s+damage`, 'i').test(lower)) {
      return { type: dt, confidence: 'high' };
    }
  }

  // 2. Check for "points of X damage"
  for (const dt of DAMAGE_TYPES) {
    if (new RegExp(`points?\\s+of\\s+${dt}`, 'i').test(lower)) {
      return { type: dt, confidence: 'high' };
    }
  }

  // 3. Check context words
  const words = lower.split(/\W+/);
  for (const word of words) {
    if (DAMAGE_TYPE_CONTEXT[word]) {
      return { type: DAMAGE_TYPE_CONTEXT[word], confidence: 'medium' };
    }
  }

  // 4. Check multi-word context keys
  for (const [phrase, dt] of Object.entries(DAMAGE_TYPE_CONTEXT)) {
    if (phrase.includes(' ') && lower.includes(phrase)) {
      return { type: dt, confidence: 'medium' };
    }
  }

  return { type: null, confidence: 'low' };
}
