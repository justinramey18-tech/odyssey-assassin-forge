// Random Loot Generator
// Creates randomized loot items with weighted rarity

import { 
  LootItem, 
  LootRarity, 
  LootCategory,
  LootMechanics,
  RANDOM_LOOT_TABLES,
  lootRarityConfig,
} from './types';

// Weighted rarity distribution
const RARITY_WEIGHTS: Array<{ rarity: LootRarity; weight: number }> = [
  { rarity: 'common', weight: 40 },
  { rarity: 'uncommon', weight: 30 },
  { rarity: 'rare', weight: 15 },
  { rarity: 'very_rare', weight: 10 },
  { rarity: 'legendary', weight: 4 },
  { rarity: 'artifact', weight: 1 },
];

// Random adjectives for flavor
const RARITY_ADJECTIVES: Record<LootRarity, string[]> = {
  common: ['Worn', 'Ordinary', 'Simple', 'Plain', 'Basic'],
  uncommon: ['Sturdy', 'Fine', 'Quality', 'Well-made', 'Reliable'],
  rare: ['Exceptional', 'Masterwork', 'Enchanted', 'Mystic', 'Arcane'],
  very_rare: ['Legendary', 'Pristine', 'Ancient', 'Fabled', 'Mythic'],
  legendary: ['Godforged', 'Primordial', 'Celestial', 'Infernal', 'Divine'],
  artifact: ['Reality-warping', 'Cosmic', 'Eldritch', 'Omnipotent', 'Impossible'],
};

// Descriptions based on category and rarity
const DESCRIPTIONS: Record<LootCategory, Record<LootRarity, string[]>> = {
  weapon: {
    common: ['A functional blade with minor wear.', 'Shows signs of regular use but remains serviceable.'],
    uncommon: ['Crafted with care by a skilled smith.', 'The edge holds true and the balance is good.'],
    rare: ['Runes shimmer faintly along the blade.', 'Whispers of battles past echo from within.'],
    very_rare: ['Light seems to bend around its edge.', 'The weapon hums with barely contained power.'],
    legendary: ['Forged in the heart of a dying star.', 'Its mere presence causes lesser weapons to tremble.'],
    artifact: ['Reality itself acknowledges this weapon\'s supremacy.', 'Time and space warp in its presence.'],
  },
  armor: {
    common: ['Basic protection that\'s seen better days.', 'Functional if unremarkable.'],
    uncommon: ['Well-maintained and reliable.', 'Quality materials and construction.'],
    rare: ['Magical wards protect the wearer.', 'Lighter than it appears, tougher than steel.'],
    very_rare: ['Shifts and adapts to threats.', 'Contains the essence of protective spirits.'],
    legendary: ['Blessed by forgotten gods.', 'No mortal weapon should pierce this.'],
    artifact: ['Defies the laws of physics and magic alike.', 'Worn by beings who shaped reality.'],
  },
  trinket: {
    common: ['A curious bauble of unknown origin.', 'Might be worth something to the right buyer.'],
    uncommon: ['There\'s something unusual about this...', 'Tingles slightly when touched.'],
    rare: ['Glows softly in moonlight.', 'Warm to the touch despite the cold.'],
    very_rare: ['Changes color based on nearby magic.', 'Whispers secrets in forgotten tongues.'],
    legendary: ['Said to have been held by heroes of old.', 'The air around it feels different.'],
    artifact: ['Should not exist according to natural law.', 'Looking at it too long causes headaches.'],
  },
  treasure: {
    common: ['A handful of coins from various realms.', 'Small valuables that add up.'],
    uncommon: ['Quality precious metals and gems.', 'Worth a fair sum to any merchant.'],
    rare: ['Exquisite craftsmanship and pure materials.', 'A collector would pay handsomely.'],
    very_rare: ['Museum-worthy antiquities.', 'Royal treasures of fallen kingdoms.'],
    legendary: ['Dragon hoard centerpieces.', 'The stuff of legends and heist stories.'],
    artifact: ['Value literally incalculable.', 'Nations would go to war over this.'],
  },
  usable: {
    common: ['Simple alchemical concoction.', 'Should work... probably.'],
    uncommon: ['Professionally prepared and reliable.', 'Quality ingredients ensure potency.'],
    rare: ['Master alchemist work.', 'The effects are guaranteed and enhanced.'],
    very_rare: ['Rare ingredients from dangerous places.', 'Effects exceed normal limitations.'],
    legendary: ['Mythical components from legendary creatures.', 'Beyond normal alchemy.'],
    artifact: ['Breaks the rules of what\'s alchemically possible.', 'Side effects may include enlightenment.'],
  },
  miscellaneous: {
    common: ['An odd item of uncertain purpose.', 'Might be useful for something.'],
    uncommon: ['Interesting craftsmanship.', 'Someone went to effort making this.'],
    rare: ['Strange and wondrous.', 'Its true purpose may be hidden.'],
    very_rare: ['Defies easy categorization.', 'Scholars would debate its nature.'],
    legendary: ['One of a kind.', 'The universe may have only one of these.'],
    artifact: ['Beyond mortal comprehension.', 'Exists despite impossibility.'],
  },
};

/**
 * Roll weighted rarity
 */
function rollRarity(): LootRarity {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  
  return 'common';
}

/**
 * Pick random item from array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random loot item
 */
export function generateRandomLoot(
  categoryFilter?: LootCategory
): LootItem {
  // Roll rarity first
  const rarity = rollRarity();
  const rarityConfig = lootRarityConfig[rarity];
  
  // Pick category (or use filter)
  const categories: LootCategory[] = categoryFilter 
    ? [categoryFilter] 
    : ['weapon', 'armor', 'trinket', 'treasure', 'usable', 'miscellaneous'];
  const category = pickRandom(categories);
  
  // Get table for category
  const tableKey = category === 'miscellaneous' ? 'trinkets' : (category + 's') as keyof typeof RANDOM_LOOT_TABLES;
  const table = RANDOM_LOOT_TABLES[tableKey] || RANDOM_LOOT_TABLES.trinkets;
  
  // Pick base item
  const baseItem = pickRandom(table);
  
  // Calculate gold value with rarity multiplier
  const goldValue = Math.floor(baseItem.baseValue * rarityConfig.goldMultiplier);
  
  // Generate name with adjective for higher rarities
  let name = baseItem.name;
  if (rarity !== 'common') {
    const adjective = pickRandom(RARITY_ADJECTIVES[rarity]);
    name = `${adjective} ${baseItem.name}`;
  }
  
  // Pick description
  const categoryDescriptions = DESCRIPTIONS[category] || DESCRIPTIONS.miscellaneous;
  const description = pickRandom(categoryDescriptions[rarity] || categoryDescriptions.common);
  
  // Check for dice mechanics - use optional chaining for type safety
  const itemMechanics = (baseItem as { mechanics?: LootMechanics }).mechanics;
  const hasDiceMechanics = !!(
    itemMechanics?.diceRoll || 
    itemMechanics?.damage
  );
  
  const lootItem: LootItem = {
    id: `loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    category: baseItem.category || category,
    rarity,
    goldValue,
    description,
    mechanics: itemMechanics,
    acquiredAt: new Date().toISOString(),
    hasDiceMechanics,
    aiGenerated: {
      description: true,
      lore: false,
      mechanics: false,
      goldValue: true,
    },
  };
  
  // Add AI prompt for usable items
  if (category === 'usable' && itemMechanics?.effect) {
    lootItem.aiPrompt = `Use ${name}: ${itemMechanics.effect}`;
  }
  
  return lootItem;
}

/**
 * Generate multiple random loot items
 */
export function generateLootDrop(
  count: number = 3,
  categoryFilter?: LootCategory
): LootItem[] {
  const items: LootItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateRandomLoot(categoryFilter));
  }
  return items;
}
