import { CatalogItem } from './types';

// Everything here is itemType 'miscellaneous', so it lands in the Misc Items list
// on the Consumables tab rather than in an equipment slot.

export const catalogGear: CatalogItem[] = [
  { id: 'backpack', name: 'Backpack', category: 'gear', subcategory: 'Container', itemType: 'miscellaneous', rarity: 'common', costGold: 2, weight: 5,
    description: 'A canvas pack with a stiffened frame and two side straps.',
    usage: 'Holds roughly 1 cubic foot or 30 lb of gear. Purely a carrying aid.' },

  { id: 'bedroll', name: 'Bedroll', category: 'gear', subcategory: 'Camp', itemType: 'miscellaneous', rarity: 'common', costGold: 1, weight: 7,
    description: 'Waxed canvas over wool batting, rolled and strapped.',
    usage: 'Lets you take a long rest outdoors without your DM calling it uncomfortable.' },

  { id: 'rations-10-days', name: 'Rations (10 days)', category: 'gear', subcategory: 'Supplies', itemType: 'miscellaneous', rarity: 'common', costGold: 5, weight: 20,
    description: 'Dried meat, hard biscuit, nuts and salted fruit in oilcloth.',
    usage: 'One package feeds one person for one day. Mark off a day each time you travel or camp.' },

  { id: 'torches-10', name: 'Torches (10)', category: 'gear', subcategory: 'Supplies', itemType: 'miscellaneous', rarity: 'common', costGold: 1, weight: 10,
    description: 'Pitch-soaked wooden brands, bundled in ten.',
    usage: 'Each burns for 1 hour, giving bright light in a 20 ft radius and dim light for 20 ft beyond that.' },

  { id: 'hooded-lantern', name: 'Hooded Lantern', category: 'gear', subcategory: 'Supplies', itemType: 'miscellaneous', rarity: 'common', costGold: 5, weight: 2,
    description: 'A tin lantern with a shutter that can be dropped over the flame.',
    usage: 'Burns 1 hour on a flask of oil, giving bright light for 30 ft. Lower the hood as a bonus action to drop to 5 ft of dim light without going dark.' },

  { id: 'rope-hempen-50ft', name: 'Hempen Rope (50 ft)', category: 'gear', subcategory: 'Tool', itemType: 'miscellaneous', rarity: 'common', costGold: 1, weight: 10,
    description: 'Fifty feet of three-strand hemp, coiled and whipped at both ends.',
    usage: 'Has 2 hit points and can be burst with a DC 17 Athletics check. The single most useful item in any dungeon.' },

  { id: 'grappling-hook', name: 'Grappling Hook', category: 'gear', subcategory: 'Tool', itemType: 'miscellaneous', rarity: 'common', costGold: 2, weight: 4,
    description: 'Four forged tines on a heavy ring.',
    usage: 'Tie it to rope and throw. Your DM will usually ask for an Athletics check to set it and a climb check to follow it up.' },

  { id: 'crowbar', name: 'Crowbar', category: 'gear', subcategory: 'Tool', itemType: 'miscellaneous', rarity: 'common', costGold: 2, weight: 5,
    description: 'A forged iron bar with a flattened, split end.',
    usage: 'Gives you advantage on Athletics checks where leverage helps: prying doors, lifting grates, cracking crates.' },

  { id: 'thieves-tools', name: "Thieves' Tools", category: 'gear', subcategory: 'Kit', itemType: 'miscellaneous', rarity: 'common', costGold: 25, weight: 1,
    description: 'A leather roll holding picks, tension wrenches, a small mirror, files and shears.',
    usage: 'Required to pick locks or disarm traps. Roll DEX plus your proficiency bonus if you are proficient with them.' },

  { id: 'healers-kit', name: "Healer's Kit", category: 'gear', subcategory: 'Kit', itemType: 'miscellaneous', rarity: 'common', costGold: 5, weight: 3,
    description: 'Bandages, salve, splints and a curved needle. Ten uses.',
    usage: 'Spend one use as an action to stabilise a dying creature without rolling a Medicine check.' },

  { id: 'disguise-kit', name: 'Disguise Kit', category: 'gear', subcategory: 'Kit', itemType: 'miscellaneous', rarity: 'common', costGold: 25, weight: 3,
    description: 'Cosmetics, hair dye, false hair and small props.',
    usage: 'Spend 10 minutes and roll DEX plus proficiency to build a disguise. Others must beat your result with an Investigation check to see through it.' },

  { id: 'poisoners-kit', name: "Poisoner's Kit", category: 'gear', subcategory: 'Kit', itemType: 'miscellaneous', rarity: 'common', costGold: 50, weight: 2,
    description: 'Glass vials, a mortar, stoppers, and gloves that have seen things.',
    usage: 'Needed to craft, harvest or safely handle poisons. Also grants advantage on checks to identify an unknown poison.' },

  { id: 'caltrops-bag', name: 'Bag of Caltrops', category: 'gear', subcategory: 'Tool', itemType: 'miscellaneous', rarity: 'common', costGold: 1, weight: 2,
    description: 'Twenty four-pronged iron spikes that always land point up.',
    usage: 'Scatter as an action over a 5 ft square. Any creature entering it makes a DC 15 DEX save or takes 1 piercing damage and has its speed reduced to 0 until it heals.' },

  { id: 'smoke-bomb', name: 'Smoke Bomb', category: 'gear', subcategory: 'Assassin Tool', itemType: 'miscellaneous', rarity: 'uncommon', costGold: 150, weight: 0.5,
    description: 'A clay sphere packed with saltpetre and powdered charcoal.',
    usage: 'Throw as an action to fill a 10 ft radius with heavy smoke for 1 minute. The area is heavily obscured, which usually means you can Hide.' },

  { id: 'manacles', name: 'Manacles', category: 'gear', subcategory: 'Tool', itemType: 'miscellaneous', rarity: 'common', costGold: 2, weight: 6,
    description: 'Iron wrist cuffs with a single key, and one spare.',
    usage: 'Restrains a Small or Medium creature. Escaping needs a DC 20 Acrobatics check, or DC 20 Athletics to break. Picking the lock is DC 15.' },

  { id: 'bag-of-holding', name: 'Bag of Holding', category: 'gear', subcategory: 'Container', itemType: 'miscellaneous', rarity: 'rare', costGold: 4000, weight: 15,
    description: 'An unremarkable sack whose inside is very much larger than its outside.',
    usage: 'Holds up to 500 lb in a space the size of a small room, and always weighs 15 lb regardless. Do not put it inside another bag of holding.' },
];
