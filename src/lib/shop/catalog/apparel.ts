import { CatalogItem } from './types';

// Reminder: stats.ac is a BONUS added on top of base AC 10, not a final AC value.

export const catalogApparel: CatalogItem[] = [
  { id: 'iron-helm', name: 'Iron Helm', category: 'apparel', subcategory: 'Head', itemType: 'equipment', slotType: 'head', rarity: 'common', costGold: 30, weight: 4,
    stats: { ac: 1 }, properties: ['Heavy'],
    description: 'A plain riveted skullcap with a nose guard.',
    usage: 'Equip to the Head slot for +1 AC. Restricts peripheral vision, so your DM may impose disadvantage on sight-based Perception.' },

  { id: 'hood-of-the-wanderer', name: 'Hood of the Wanderer', category: 'apparel', subcategory: 'Head', itemType: 'equipment', slotType: 'head', rarity: 'uncommon', costGold: 250, weight: 1,
    stats: { perception: 1 },
    description: 'A deep travelling hood lined with muffling grey wool.',
    usage: 'Equip to the Head slot for +1 Perception. Keeps your face in shadow, which your DM may treat as a bonus to going unrecognised.' },

  { id: 'helm-of-comprehending-languages', name: 'Helm of Comprehending Languages', category: 'apparel', subcategory: 'Head', itemType: 'equipment', slotType: 'head', rarity: 'uncommon', costGold: 500, weight: 3,
    stats: { ac: 1, intelligence: 1 }, properties: ['Magical'],
    description: 'A visored helm etched inside with a thousand overlapping alphabets.',
    usage: 'Equip to the Head slot for +1 AC and +1 INT. Use an action to cast Comprehend Languages from the helm, at will.' },

  { id: 'leather-bracers', name: 'Leather Bracers', category: 'apparel', subcategory: 'Arms', itemType: 'equipment', slotType: 'arms', rarity: 'common', costGold: 25, weight: 2,
    stats: { ac: 1 },
    description: 'Stiff forearm guards, scuffed white where blades have skated off.',
    usage: 'Equip to the Arms slot for +1 AC. No downside, no requirements.' },

  { id: 'bracers-of-defense', name: 'Bracers of Defense', category: 'apparel', subcategory: 'Arms', itemType: 'equipment', slotType: 'arms', rarity: 'rare', costGold: 3500, weight: 1,
    stats: { ac: 2 }, properties: ['Magical'],
    description: 'Slim silver bands that hum faintly when a blow comes near.',
    usage: 'Equip to the Arms slot for +2 AC. In the rulebook this only works with no armour and no shield, so check with your DM.' },

  { id: 'gauntlets-of-ogre-power', name: 'Gauntlets of Ogre Power', category: 'apparel', subcategory: 'Arms', itemType: 'equipment', slotType: 'arms', rarity: 'rare', costGold: 4000, weight: 2,
    stats: { strength: 2, attackBonus: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'Heavy black iron gauntlets sized for hands much larger than yours.',
    usage: 'Equip to the Arms slot for +2 STR and +1 to attack. In the rulebook these set your STR to 19, so if your STR is already 19 or higher, ignore the bonus.' },

  { id: 'adventurers-belt', name: "Adventurer's Belt", category: 'apparel', subcategory: 'Waist', itemType: 'equipment', slotType: 'waist', rarity: 'common', costGold: 20, weight: 1,
    stats: {}, properties: ['4 Pouches'],
    description: 'A wide belt hung with four hard-leather pouches and a dagger loop.',
    usage: 'Equip to the Waist slot. No combat bonus, but your DM may let you draw a small item as a free action instead of an object interaction.' },

  { id: 'belt-of-dwarvenkind', name: 'Belt of Dwarvenkind', category: 'apparel', subcategory: 'Waist', itemType: 'equipment', slotType: 'waist', rarity: 'rare', costGold: 5000, weight: 1,
    stats: { constitution: 2 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A broad belt of hammered gold plates, warm to the touch.',
    usage: 'Equip to the Waist slot for +2 CON. Grants advantage on CHA checks with dwarves, darkvision to 60 ft, and resistance to poison damage.' },

  { id: 'marching-boots', name: 'Marching Boots', category: 'apparel', subcategory: 'Legs', itemType: 'equipment', slotType: 'legs', rarity: 'common', costGold: 15, weight: 2,
    stats: {},
    description: 'Hobnailed boots broken in by someone with a longer stride than yours.',
    usage: 'Equip to the Legs slot. No mechanical bonus, but they keep your feet dry on a forced march.' },

  { id: 'boots-of-striding-and-springing', name: 'Boots of Striding and Springing', category: 'apparel', subcategory: 'Legs', itemType: 'equipment', slotType: 'legs', rarity: 'uncommon', costGold: 2500, weight: 1,
    stats: { movement: 10 }, properties: ['Magical', 'Requires Attunement'],
    description: 'Soft leather boots that always land you a half-step further than you meant to go.',
    usage: 'Equip to the Legs slot for +10 ft speed. Your jump distance also triples while you wear them.' },

  { id: 'boots-of-elvenkind', name: 'Boots of Elvenkind', category: 'apparel', subcategory: 'Legs', itemType: 'equipment', slotType: 'legs', rarity: 'uncommon', costGold: 2500, weight: 1,
    stats: {}, properties: ['Magical'],
    description: 'Woven bark-cloth boots that make no sound on any surface.',
    usage: 'Equip to the Legs slot. Your steps make no noise, granting advantage on Stealth checks made to move silently.' },

  { id: 'travelers-cloak', name: "Traveler's Cloak", category: 'apparel', subcategory: 'Cloak', itemType: 'equipment', slotType: 'cloak', rarity: 'common', costGold: 15, weight: 4,
    stats: {},
    description: 'Heavy oiled wool with a deep hood and a brass throat-clasp.',
    usage: 'Equip to the Cloak slot. Keeps out rain and cold. Your DM may waive exhaustion from severe weather while you wear it.' },

  { id: 'cloak-of-protection', name: 'Cloak of Protection', category: 'apparel', subcategory: 'Cloak', itemType: 'equipment', slotType: 'cloak', rarity: 'uncommon', costGold: 3500, weight: 1,
    stats: { ac: 1, saves: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A plain grey cloak that never quite hangs where you expect it to.',
    usage: 'Equip to the Cloak slot for +1 AC and +1 to all saving throws.' },

  { id: 'cloak-of-elvenkind', name: 'Cloak of Elvenkind', category: 'apparel', subcategory: 'Cloak', itemType: 'equipment', slotType: 'cloak', rarity: 'uncommon', costGold: 5000, weight: 1,
    stats: {}, properties: ['Magical', 'Requires Attunement'],
    description: 'The colour of this cloak shifts to match whatever is behind you.',
    usage: 'Equip to the Cloak slot. Pull the hood up as a bonus action: Perception checks to see you have disadvantage, and you have advantage on Stealth checks.' },
];
