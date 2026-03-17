// Equipment Presets for Character Wizard
// Defines starter gear loadouts for different levels and playstyles

import { CharacterEquipment, EquipmentItem, Rarity, EquipmentSlotType } from '@/lib/inventory/types';

export interface EquipmentPreset {
  id: string;
  name: string;
  description: string;
  flavor: string;
  minLevel: number;
  maxLevel: number;
  maxRarity: Rarity;
  totalAC: number;
  primaryDamage: string;
  setId?: string;
  items: Partial<Record<EquipmentSlotType, EquipmentItem>>;
}

// Helper to create equipment items
function createItem(
  id: string,
  name: string,
  slotType: EquipmentSlotType,
  rarity: Rarity,
  level: number,
  stats: EquipmentItem['stats'],
  options?: Partial<EquipmentItem>
): EquipmentItem {
  return {
    id,
    name,
    slotType,
    rarity,
    level,
    icon: getDefaultIcon(slotType),
    stats,
    weight: 1,
    value: getValueByRarity(rarity),
    ...options,
  };
}

function getDefaultIcon(slot: EquipmentSlotType): string {
  const icons: Record<EquipmentSlotType, string> = {
    head: 'Crown',
    chest: 'Shield',
    arms: 'Hand',
    waist: 'CircleDot',
    legs: 'Footprints',
    cloak: 'Wind',
    primary_weapon: 'Sword',
    secondary_weapon: 'Axe',
    ranged_weapon: 'Target',
    amulet: 'Gem',
    ring1: 'Circle',
    ring2: 'Circle',
  };
  return icons[slot] || 'Package';
}

function getValueByRarity(rarity: Rarity): number {
  const values: Record<Rarity, number> = {
    common: 10,
    uncommon: 50,
    rare: 200,
    epic: 500,
    legendary: 2000,
    artifact: 5000,
  };
  return values[rarity];
}

// ============================================
// EQUIPMENT PRESETS
// ============================================

export const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  // LEVEL 1-3: Street Runner (Common)
  {
    id: 'street-runner',
    name: 'Street Runner',
    description: 'Basic urban survival gear for a novice assassin',
    flavor: 'The clothes on your back and a sharp knife. Everyone starts somewhere.',
    minLevel: 1,
    maxLevel: 4,
    maxRarity: 'common',
    totalAC: 12,
    primaryDamage: '1d6',
    items: {
      head: createItem('street-hood', 'Street Hood', 'head', 'common', 1, { ac: 0 }, {
        description: 'A simple hood to hide your face in the crowd',
      }),
      chest: createItem('leather-vest', 'Leather Vest', 'chest', 'common', 1, { ac: 1 }, {
        description: 'Basic protection that doesn\'t slow you down',
      }),
      arms: createItem('fingerless-gloves', 'Fingerless Gloves', 'arms', 'common', 1, { ac: 0 }, {
        description: 'For when you need a better grip',
      }),
      waist: createItem('rope-belt', 'Rope Belt', 'waist', 'common', 1, { ac: 0 }),
      legs: createItem('worn-trousers', 'Worn Trousers', 'legs', 'common', 1, { ac: 0 }),
      primary_weapon: createItem('rusty-dagger', 'Rusty Dagger', 'primary_weapon', 'common', 1, 
        { damage: '1d4', attackBonus: 0 }, {
          description: 'A simple blade with a chip in it',
          properties: ['Light', 'Finesse', 'Thrown'],
        }
      ),
      ranged_weapon: createItem('shortbow', 'Shortbow', 'ranged_weapon', 'common', 1,
        { damage: '1d6', attackBonus: 0 }, {
          description: 'Basic bow for hunting... or hunting people',
          properties: ['Ammunition', 'Two-Handed'],
        }
      ),
    },
  },

  // LEVEL 3-6: Shadow Initiate (Common/Uncommon)
  {
    id: 'shadow-initiate',
    name: 'Shadow Initiate',
    description: 'Proper assassin training gear for those who\'ve proven themselves',
    flavor: 'You\'ve earned the right to wear the shadows.',
    minLevel: 3,
    maxLevel: 6,
    maxRarity: 'uncommon',
    totalAC: 14,
    primaryDamage: '1d6+1',
    items: {
      head: createItem('initiate-cowl', 'Initiate\'s Cowl', 'head', 'uncommon', 3, { ac: 1 }, {
        description: 'A dark cowl that helps you blend into shadows',
      }),
      chest: createItem('shadow-leather', 'Shadow Leather', 'chest', 'uncommon', 3, { ac: 2 }, {
        description: 'Supple leather treated with darkening oils',
        properties: ['Light Armor'],
      }),
      arms: createItem('silent-bracers', 'Silent Bracers', 'arms', 'uncommon', 3, { ac: 0, dexterity: 1 }, {
        description: 'Dampens the sound of your movements',
      }),
      waist: createItem('tool-belt', 'Assassin\'s Tool Belt', 'waist', 'uncommon', 3, { ac: 0 }, {
        description: 'Holds lockpicks, poison vials, and other essentials',
      }),
      legs: createItem('soft-boots', 'Soft-Soled Boots', 'legs', 'uncommon', 3, { ac: 0, movement: 5 }),
      primary_weapon: createItem('keen-shortsword', 'Keen Shortsword', 'primary_weapon', 'uncommon', 3,
        { damage: '1d6+1', attackBonus: 1 }, {
          description: 'A well-balanced blade for quick strikes',
          properties: ['Light', 'Finesse'],
        }
      ),
      secondary_weapon: createItem('parrying-dagger', 'Parrying Dagger', 'secondary_weapon', 'uncommon', 3,
        { damage: '1d4', attackBonus: 0, ac: 1 }, {
          description: 'Used for defense as much as offense',
          properties: ['Light', 'Finesse'],
        }
      ),
      ranged_weapon: createItem('composite-shortbow', 'Composite Shortbow', 'ranged_weapon', 'uncommon', 3,
        { damage: '1d6+1', attackBonus: 1 }, {
          properties: ['Ammunition', 'Two-Handed'],
        }
      ),
    },
  },

  // LEVEL 5-10: Wetboy Operative (Uncommon/Rare)
  {
    id: 'wetboy-operative',
    name: 'Wetboy Operative',
    description: 'Professional-grade equipment for contracted killers',
    flavor: 'Wetboys don\'t have targets. They have "deaders."',
    minLevel: 5,
    maxLevel: 10,
    maxRarity: 'rare',
    totalAC: 16,
    primaryDamage: '1d8+2',
    items: {
      head: createItem('wetboy-mask', 'Wetboy\'s Mask', 'head', 'rare', 5, { ac: 1 }, {
        description: 'A featureless mask that strikes fear into targets',
        enchantments: [{ name: 'Intimidating Presence', description: '+1 to Intimidation checks' }],
      }),
      chest: createItem('nightcloak-armor', 'Nightcloak Armor', 'chest', 'rare', 5, { ac: 3 }, {
        description: 'Armor that seems to drink in light',
        properties: ['Light Armor', 'Stealth Advantage'],
      }),
      arms: createItem('strangler-gloves', 'Strangler\'s Gloves', 'arms', 'rare', 5, { ac: 0, strength: 1 }, {
        description: 'Reinforced for silent takedowns',
      }),
      waist: createItem('poison-sash', 'Poison Master\'s Sash', 'waist', 'rare', 5, { ac: 0 }, {
        description: 'Hidden compartments for various toxins',
      }),
      legs: createItem('shadowstep-boots', 'Shadowstep Boots', 'legs', 'rare', 5, { ac: 1, movement: 10 }, {
        description: 'Your footsteps make no sound',
        enchantments: [{ name: 'Silent Step', description: 'Advantage on Stealth checks' }],
      }),
      primary_weapon: createItem('vorpal-rapier', 'Vorpal Rapier', 'primary_weapon', 'rare', 5,
        { damage: '1d8+2', attackBonus: 2 }, {
          description: 'A blade so sharp it seems to cut the air itself',
          properties: ['Finesse'],
          enchantments: [{ name: 'Keen Edge', description: 'Crits on 19-20' }],
        }
      ),
      secondary_weapon: createItem('poisoned-dagger', 'Poisoned Dagger', 'secondary_weapon', 'rare', 5,
        { damage: '1d4+1d6', attackBonus: 1 }, {
          description: 'The blade weeps with deadly toxin',
          properties: ['Light', 'Finesse', 'Thrown'],
        }
      ),
      ranged_weapon: createItem('assassin-crossbow', 'Assassin\'s Hand Crossbow', 'ranged_weapon', 'rare', 5,
        { damage: '1d6+2', attackBonus: 2 }, {
          description: 'Silent, deadly, and easily concealed',
          properties: ['Ammunition', 'Light', 'Loading'],
        }
      ),
    },
  },

  // LEVEL 10-20: Greek Heroes Set (Rare/Epic)
  {
    id: 'greek-heroes',
    name: 'Greek Heroes',
    description: 'Legendary armor of ancient Greek warriors',
    flavor: 'Forged in the fires of Olympus, worn by demigods.',
    minLevel: 10,
    maxLevel: 20,
    maxRarity: 'epic',
    totalAC: 18,
    primaryDamage: '2d6+3',
    setId: 'greek-heroes',
    items: {
      head: createItem('spartan-war-helm', 'Spartan War Helm', 'head', 'rare', 15, { ac: 2 }, {
        description: 'A battle-worn helm bearing the marks of countless Spartan victories',
        setId: 'greek-heroes',
        setName: 'Greek Heroes Set',
      }),
      chest: createItem('greek-heroes-cuirass', 'Greek Heroes Cuirass', 'chest', 'epic', 18, { ac: 5 }, {
        description: 'Legendary armor said to have been worn by the heroes of old',
        properties: ['Heavy Armor'],
        setId: 'greek-heroes',
        setName: 'Greek Heroes Set',
      }),
      arms: createItem('mercenary-gauntlets', 'Mercenary Gauntlets', 'arms', 'rare', 12, { ac: 1, attackBonus: 1 }, {
        description: 'Reinforced gauntlets favored by hired blades across Greece',
        setId: 'greek-heroes',
        setName: 'Greek Heroes Set',
      }),
      waist: createItem('belt-of-immortal', 'Belt of the Immortal', 'waist', 'epic', 16, { ac: 2, constitution: 1 }, {
        description: 'A belt woven with threads said to be from the Fates themselves',
        enchantments: [{ name: 'Undying Fortitude', description: 'Once per long rest, drop to 1 HP instead of 0' }],
        setId: 'greek-heroes',
        setName: 'Greek Heroes Set',
      }),
      legs: createItem('spartan-war-greaves', 'Spartan War Greaves', 'legs', 'rare', 15, { ac: 3, movement: 5 }, {
        description: 'Bronze greaves that have marched across countless battlefields',
        setId: 'greek-heroes',
        setName: 'Greek Heroes Set',
      }),
      primary_weapon: createItem('sword-of-damokles', 'Sword of Damokles', 'primary_weapon', 'legendary', 20,
        { damage: '2d6+3', attackBonus: 2 }, {
          description: 'A blade that hangs by a thread over the heads of tyrants',
          properties: ['Magical', 'Versatile'],
          enchantments: [
            { name: 'Impending Doom', description: '+1d6 damage on critical hits' },
            { name: 'Favor of Fortune', description: 'Advantage on death saving throws' },
          ],
        }
      ),
    },
  },

  // Custom/Empty - for players who want to pick their own gear later
  {
    id: 'custom',
    name: 'Custom Selection',
    description: 'Start with nothing and build your own loadout',
    flavor: 'You prefer to choose your own tools of the trade.',
    minLevel: 1,
    maxLevel: 20,
    maxRarity: 'artifact',
    totalAC: 10,
    primaryDamage: '—',
    items: {},
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get presets available for a given level and game mode
 */
export function getAvailablePresets(
  level: number, 
  isHonestMode: boolean = false
): EquipmentPreset[] {
  return EQUIPMENT_PRESETS.filter(preset => {
    // Level check
    if (level < preset.minLevel) return false;
    if (level > preset.maxLevel && preset.id !== 'custom') return false;
    
    // Honest mode rarity restrictions
    if (isHonestMode) {
      if (preset.maxRarity === 'legendary' && level < 15) return false;
      if (preset.maxRarity === 'epic' && level < 10) return false;
      if (preset.maxRarity === 'rare' && level < 5) return false;
    }
    
    return true;
  });
}

/**
 * Convert preset to CharacterEquipment format
 */
export function presetToEquipment(preset: EquipmentPreset): CharacterEquipment {
  const slots: Record<EquipmentSlotType, EquipmentItem | null> = {
    head: null,
    chest: null,
    arms: null,
    waist: null,
    legs: null,
    primary_weapon: null,
    secondary_weapon: null,
    ranged_weapon: null,
    amulet: null,
    ring1: null,
    ring2: null,
  };

  // Fill in items from preset
  Object.entries(preset.items).forEach(([slot, item]) => {
    if (item) {
      slots[slot as EquipmentSlotType] = item;
    }
  });

  return {
    slots,
    inventory: [],
  };
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): EquipmentPreset | undefined {
  return EQUIPMENT_PRESETS.find(p => p.id === id);
}
