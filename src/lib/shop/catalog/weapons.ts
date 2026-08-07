import { CatalogItem } from './types';

export const catalogWeapons: CatalogItem[] = [
  { id: 'dagger', name: 'Dagger', category: 'weapons', subcategory: 'Simple Melee', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'common', costGold: 2, weight: 1,
    stats: { damage: '1d4 piercing' }, properties: ['Finesse', 'Light', 'Thrown (20/60 ft)'],
    description: 'A short, balanced blade that hides easily in a boot or a sleeve.',
    usage: 'Equip to the Offhand slot. Attack with STR or DEX, your choice. Throw up to 20 ft normally, 60 ft at disadvantage.' },

  { id: 'quarterstaff', name: 'Quarterstaff', category: 'weapons', subcategory: 'Simple Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 1, weight: 4,
    stats: { damage: '1d6 bludgeoning' }, properties: ['Versatile (1d8)'],
    description: 'A length of hardened oak, as useful for walking as for cracking skulls.',
    usage: 'Equip to Main Hand. Deals 1d6 one-handed, 1d8 if you hold it with both hands and leave your Offhand empty.' },

  { id: 'handaxe', name: 'Handaxe', category: 'weapons', subcategory: 'Simple Melee', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'common', costGold: 5, weight: 2,
    stats: { damage: '1d6 slashing' }, properties: ['Light', 'Thrown (20/60 ft)'],
    description: 'A stubby chopping axe weighted for throwing.',
    usage: 'Equip to the Offhand slot. Good for two-weapon fighting, or throw it up to 20 ft.' },

  { id: 'shortsword', name: 'Shortsword', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'common', costGold: 10, weight: 2,
    stats: { damage: '1d6 piercing' }, properties: ['Finesse', 'Light'],
    description: 'A quick thrusting blade favoured by scouts and cutpurses.',
    usage: 'Equip to the Offhand slot. Finesse lets you attack with DEX instead of STR. Pairs well with a second light weapon.' },

  { id: 'battleaxe', name: 'Battleaxe', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 10, weight: 4,
    stats: { damage: '1d8 slashing' }, properties: ['Versatile (1d10)'],
    description: 'A broad crescent head on a hickory haft. Simple, heavy, decisive.',
    usage: 'Equip to Main Hand. 1d8 with a shield, 1d10 with both hands free.' },

  { id: 'longsword', name: 'Longsword', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 15, weight: 3,
    stats: { damage: '1d8 slashing' }, properties: ['Versatile (1d10)'],
    description: 'The straight, double-edged standard of knights and sellswords alike.',
    usage: 'Equip to Main Hand. Attack with STR. 1d8 one-handed, 1d10 two-handed.' },

  { id: 'warhammer', name: 'Warhammer', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 15, weight: 2,
    stats: { damage: '1d8 bludgeoning' }, properties: ['Versatile (1d10)'],
    description: 'A blunt steel head made for caving in plate armour.',
    usage: 'Equip to Main Hand. Bludgeoning damage is useful against skeletons and constructs.' },

  { id: 'rapier', name: 'Rapier', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 25, weight: 2,
    stats: { damage: '1d8 piercing' }, properties: ['Finesse'],
    description: 'A slender duelling blade with a swept-steel guard.',
    usage: 'Equip to Main Hand. Finesse means you attack and damage with DEX. The best single-handed weapon for a dexterous killer.' },

  { id: 'scimitar', name: 'Scimitar', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 25, weight: 3,
    stats: { damage: '1d6 slashing' }, properties: ['Finesse', 'Light'],
    description: 'A curved blade built for drawing cuts from horseback or in a sprint.',
    usage: 'Equip to Main Hand or Offhand. Light and Finesse, so it works in either hand using DEX.' },

  { id: 'greatsword', name: 'Greatsword', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 50, weight: 6,
    stats: { damage: '2d6 slashing' }, properties: ['Heavy', 'Two-Handed'],
    description: 'Five feet of steel that ends arguments in one swing.',
    usage: 'Equip to Main Hand and leave your Offhand empty. Two-handed only, so no shield.' },

  { id: 'maul', name: 'Maul', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 10, weight: 10,
    stats: { damage: '2d6 bludgeoning' }, properties: ['Heavy', 'Two-Handed'],
    description: 'A sledge built for war. Ugly, slow, and absolutely final.',
    usage: 'Equip to Main Hand with the Offhand empty. Heaviest bludgeoning option in the shop.' },

  { id: 'glaive', name: 'Glaive', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'common', costGold: 20, weight: 6,
    stats: { damage: '1d10 slashing' }, properties: ['Heavy', 'Reach', 'Two-Handed'],
    description: 'A single-edged blade mounted on a long pole.',
    usage: 'Equip to Main Hand with the Offhand empty. Reach lets you attack targets 10 ft away.' },

  { id: 'shortbow', name: 'Shortbow', category: 'weapons', subcategory: 'Ranged', itemType: 'equipment', slotType: 'ranged_weapon', rarity: 'common', costGold: 25, weight: 2,
    stats: { damage: '1d6 piercing' }, properties: ['Ammunition (80/320 ft)', 'Two-Handed'],
    description: 'A compact recurve that fits under a cloak.',
    usage: 'Equip to the Ranged slot. Attack with DEX. Needs arrows.' },

  { id: 'longbow', name: 'Longbow', category: 'weapons', subcategory: 'Ranged', itemType: 'equipment', slotType: 'ranged_weapon', rarity: 'common', costGold: 50, weight: 2,
    stats: { damage: '1d8 piercing' }, properties: ['Ammunition (150/600 ft)', 'Heavy', 'Two-Handed'],
    description: 'A tall yew bow with a draw weight that snaps ribs on the wrong archer.',
    usage: 'Equip to the Ranged slot. Attack with DEX. Longest reliable range in the shop.' },

  { id: 'light-crossbow', name: 'Light Crossbow', category: 'weapons', subcategory: 'Ranged', itemType: 'equipment', slotType: 'ranged_weapon', rarity: 'common', costGold: 25, weight: 5,
    stats: { damage: '1d8 piercing' }, properties: ['Ammunition (80/320 ft)', 'Loading', 'Two-Handed'],
    description: 'A cranked stock that anyone can point and pull.',
    usage: 'Equip to the Ranged slot. Loading means one bolt per action, no matter how many attacks you have.' },

  { id: 'hand-crossbow', name: 'Hand Crossbow', category: 'weapons', subcategory: 'Ranged', itemType: 'equipment', slotType: 'ranged_weapon', rarity: 'common', costGold: 75, weight: 3,
    stats: { damage: '1d6 piercing' }, properties: ['Ammunition (30/120 ft)', 'Light', 'Loading'],
    description: 'A one-handed crossbow small enough to conceal in a coat.',
    usage: 'Equip to the Ranged slot. Fires one bolt per action. The assassin standard for a quiet opener.' },

  { id: 'silvered-dagger', name: 'Silvered Dagger', category: 'weapons', subcategory: 'Simple Melee', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'uncommon', costGold: 102, weight: 1,
    stats: { damage: '1d4 piercing' }, properties: ['Finesse', 'Light', 'Thrown (20/60 ft)', 'Silvered'],
    description: 'A dagger with its edge fused in alchemical silver.',
    usage: 'Equip to the Offhand slot. Silvering bypasses the damage resistance of lycanthropes, devils and many undead.' },

  { id: 'longsword-plus-1', name: 'Longsword +1', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'uncommon', costGold: 800, weight: 3,
    stats: { damage: '1d8+1 slashing', attackBonus: 1 }, properties: ['Magical', 'Versatile (1d10)'],
    description: 'A longsword with a faint blue seam of enchantment running the fuller.',
    usage: 'Equip to Main Hand. Adds +1 to attack rolls and +1 to damage automatically. Counts as magical for resistance.' },

  { id: 'longbow-plus-1', name: 'Longbow +1', category: 'weapons', subcategory: 'Ranged', itemType: 'equipment', slotType: 'ranged_weapon', rarity: 'uncommon', costGold: 1500, weight: 2,
    stats: { damage: '1d8+1 piercing', attackBonus: 1 }, properties: ['Magical', 'Ammunition (150/600 ft)', 'Heavy', 'Two-Handed'],
    description: 'The stave hums a half-tone flat when a target enters range.',
    usage: 'Equip to the Ranged slot. Adds +1 to attack and damage rolls. Counts as magical.' },

  { id: 'shadowfang-stiletto', name: 'Shadowfang Stiletto', category: 'weapons', subcategory: 'Assassin Blade', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'rare', costGold: 3500, weight: 1,
    stats: { damage: '1d4+2 piercing', attackBonus: 2, dexterity: 1 }, properties: ['Magical', 'Finesse', 'Light'],
    description: 'A needle of blackened steel that drinks the light around the blade.',
    lore: 'Guild lore says the first Shadowfang was quenched in the shadow of a dying man rather than in water.',
    usage: 'Equip to the Offhand slot. +2 to attack and damage, +1 DEX. Ask your DM to grant advantage when you attack a creature that has not yet acted in combat.' },

  { id: 'flame-tongue-shortsword', name: 'Flame Tongue Shortsword', category: 'weapons', subcategory: 'Martial Melee', itemType: 'equipment', slotType: 'primary_weapon', rarity: 'rare', costGold: 5000, weight: 2,
    stats: { damage: '1d6 piercing + 2d6 fire' }, properties: ['Magical', 'Finesse', 'Light'],
    description: 'Speak the command word and the blade sheathes itself in roaring flame.',
    usage: 'Equip to Main Hand. Use a bonus action and the command word to ignite it, adding 2d6 fire damage on every hit. It sheds bright light in a 40 ft radius while lit.' },

  { id: 'dagger-of-venom', name: 'Dagger of Venom', category: 'weapons', subcategory: 'Assassin Blade', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'rare', costGold: 2500, weight: 1,
    stats: { damage: '1d4+1 piercing', attackBonus: 1 }, properties: ['Magical', 'Finesse', 'Light'],
    description: 'A blade with a hollow channel that weeps black ichor on command.',
    usage: 'Equip to the Offhand slot. +1 to attack and damage. Once per day, use an action to coat the blade in poison for 1 minute. The next creature hit makes a DC 15 CON save or takes 2d10 poison damage and is poisoned for 1 minute.' },
];
