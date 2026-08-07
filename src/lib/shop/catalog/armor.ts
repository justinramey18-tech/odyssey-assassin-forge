import { CatalogItem } from './types';

// IMPORTANT: this app calculates AC as 10 + the sum of stats.ac on every equipped item.
// So stats.ac here is a BONUS, not a final AC. Leather Armour is AC 11 in the rulebook,
// which is stats.ac = 1 here. The full rulebook AC is written into the description text.

export const catalogArmor: CatalogItem[] = [
  { id: 'padded-armor', name: 'Padded Armor', category: 'armor', subcategory: 'Light Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 5, weight: 8,
    stats: { ac: 1 }, properties: ['Light Armor', 'Stealth Disadvantage'],
    description: 'Quilted layers of cloth and batting. Rulebook AC 11 + DEX modifier.',
    usage: 'Equip to the Chest slot for +1 AC. Cheap, but it rustles: disadvantage on Stealth checks.' },

  { id: 'leather-armor', name: 'Leather Armor', category: 'armor', subcategory: 'Light Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 10, weight: 10,
    stats: { ac: 1 }, properties: ['Light Armor'],
    description: 'Boiled leather chest and shoulders. Rulebook AC 11 + DEX modifier.',
    usage: 'Equip to the Chest slot for +1 AC. No stealth penalty, so it is the default rogue starting armour.' },

  { id: 'studded-leather', name: 'Studded Leather', category: 'armor', subcategory: 'Light Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 45, weight: 13,
    stats: { ac: 2 }, properties: ['Light Armor'],
    description: 'Supple leather reinforced with close-set rivets. Rulebook AC 12 + DEX modifier.',
    usage: 'Equip to the Chest slot for +2 AC with no stealth penalty. The best light armour in the shop.' },

  { id: 'hide-armor', name: 'Hide Armor', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 10, weight: 12,
    stats: { ac: 2 }, properties: ['Medium Armor'],
    description: 'Thick furs and rough pelts. Rulebook AC 12 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +2 AC. Crude but cheap.' },

  { id: 'chain-shirt', name: 'Chain Shirt', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 50, weight: 20,
    stats: { ac: 3 }, properties: ['Medium Armor'],
    description: 'Interlocking rings worn under clothing. Rulebook AC 13 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +3 AC. Conceals under a coat and carries no stealth penalty.' },

  { id: 'scale-mail', name: 'Scale Mail', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 50, weight: 45,
    stats: { ac: 4 }, properties: ['Medium Armor', 'Stealth Disadvantage'],
    description: 'Overlapping metal scales on a leather backing. Rulebook AC 14 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +4 AC. Noisy: disadvantage on Stealth checks.' },

  { id: 'breastplate', name: 'Breastplate', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 400, weight: 20,
    stats: { ac: 4 }, properties: ['Medium Armor'],
    description: 'A fitted steel chestplate over supple leather. Rulebook AC 14 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +4 AC with no stealth penalty. Expensive, but quiet.' },

  { id: 'half-plate', name: 'Half Plate', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 750, weight: 40,
    stats: { ac: 5 }, properties: ['Medium Armor', 'Stealth Disadvantage'],
    description: 'Shaped plates covering most of the body. Rulebook AC 15 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +5 AC. Disadvantage on Stealth checks.' },

  { id: 'ring-mail', name: 'Ring Mail', category: 'armor', subcategory: 'Heavy Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 30, weight: 40,
    stats: { ac: 4 }, properties: ['Heavy Armor', 'Stealth Disadvantage'],
    description: 'Leather with heavy rings sewn into it. Rulebook AC 14, no DEX bonus.',
    usage: 'Equip to the Chest slot for +4 AC. The cheapest heavy armour, worn by those who cannot afford better.' },

  { id: 'chain-mail', name: 'Chain Mail', category: 'armor', subcategory: 'Heavy Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 75, weight: 55,
    stats: { ac: 6 }, properties: ['Heavy Armor', 'Requires STR 13', 'Stealth Disadvantage'],
    description: 'A full suit of interlocking rings with quilted padding. Rulebook AC 16, no DEX bonus.',
    usage: 'Equip to the Chest slot for +6 AC. Needs STR 13 or your speed drops by 10 ft. Disadvantage on Stealth.' },

  { id: 'splint-armor', name: 'Splint Armor', category: 'armor', subcategory: 'Heavy Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 200, weight: 60,
    stats: { ac: 7 }, properties: ['Heavy Armor', 'Requires STR 15', 'Stealth Disadvantage'],
    description: 'Vertical strips of metal riveted to a leather backing. Rulebook AC 17, no DEX bonus.',
    usage: 'Equip to the Chest slot for +7 AC. Needs STR 15 or your speed drops by 10 ft.' },

  { id: 'plate-armor', name: 'Plate Armor', category: 'armor', subcategory: 'Heavy Armor', itemType: 'equipment', slotType: 'chest', rarity: 'common', costGold: 1500, weight: 65,
    stats: { ac: 8 }, properties: ['Heavy Armor', 'Requires STR 15', 'Stealth Disadvantage'],
    description: 'Shaped, interlocking steel over a full suit of padding. Rulebook AC 18, no DEX bonus.',
    usage: 'Equip to the Chest slot for +8 AC, the highest non-magical armour in the shop. Needs STR 15 or your speed drops by 10 ft.' },

  { id: 'shield', name: 'Shield', category: 'armor', subcategory: 'Shield', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'common', costGold: 10, weight: 6,
    stats: { ac: 2 }, properties: ['Shield'],
    description: 'A banded wooden shield with an iron rim.',
    usage: 'Equip to the Offhand slot for +2 AC. You cannot use a shield and a two-handed weapon at the same time.' },

  { id: 'shield-plus-1', name: 'Shield +1', category: 'armor', subcategory: 'Shield', itemType: 'equipment', slotType: 'secondary_weapon', rarity: 'uncommon', costGold: 1500, weight: 6,
    stats: { ac: 3 }, properties: ['Shield', 'Magical'],
    description: 'A shield warded with a lattice of silver sigils.',
    usage: 'Equip to the Offhand slot for +3 AC total.' },

  { id: 'mithral-chain-mail', name: 'Mithral Chain Mail', category: 'armor', subcategory: 'Heavy Armor', itemType: 'equipment', slotType: 'chest', rarity: 'rare', costGold: 4000, weight: 27,
    stats: { ac: 6 }, properties: ['Heavy Armor', 'Magical'],
    description: 'Chain mail forged from featherlight mithral. Rulebook AC 16 with no strength requirement.',
    usage: 'Equip to the Chest slot for +6 AC. Mithral removes the STR requirement and the Stealth disadvantage that normally comes with chain mail.' },

  { id: 'elven-chain', name: 'Elven Chain', category: 'armor', subcategory: 'Medium Armor', itemType: 'equipment', slotType: 'chest', rarity: 'rare', costGold: 4000, weight: 20,
    stats: { ac: 3, dexterity: 1 }, properties: ['Medium Armor', 'Magical'],
    description: 'Fine mithral links woven so tightly they move like silk. Rulebook AC 13 + DEX modifier (max +2).',
    usage: 'Equip to the Chest slot for +3 AC and +1 DEX. You count as proficient with it even if you normally are not.' },

  { id: 'studded-leather-plus-1', name: 'Studded Leather +1', category: 'armor', subcategory: 'Light Armor', itemType: 'equipment', slotType: 'chest', rarity: 'rare', costGold: 1500, weight: 13,
    stats: { ac: 3 }, properties: ['Light Armor', 'Magical'],
    description: 'Enchanted studded leather that hardens at the moment of impact.',
    usage: 'Equip to the Chest slot for +3 AC with no stealth penalty. The best stealth-friendly armour in the shop.' },
];
