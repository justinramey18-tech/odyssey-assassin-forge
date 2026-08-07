import { CatalogItem } from './types';

// Rings all use slotType 'ring1'. The inventory screen automatically moves a second
// ring into the ring2 slot, so this is correct and does not need changing.

export const catalogJewelry: CatalogItem[] = [
  { id: 'silver-signet-ring', name: 'Silver Signet Ring', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'common', costGold: 50, weight: 0,
    stats: {},
    description: 'A heavy silver band with a blank face, ready to be cut with a sigil.',
    usage: 'Equip to a Ring slot. No combat bonus. Useful for sealing letters or impersonating someone with standing.' },

  { id: 'ring-of-swimming', name: 'Ring of Swimming', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'uncommon', costGold: 1000, weight: 0,
    stats: {}, properties: ['Magical'],
    description: 'A twist of blue-green coral set in silver.',
    usage: 'Equip to a Ring slot. You gain a swimming speed of 40 ft while wearing it.' },

  { id: 'ring-of-mind-shielding', name: 'Ring of Mind Shielding', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'rare', costGold: 4000, weight: 0,
    stats: {}, properties: ['Magical', 'Requires Attunement'],
    description: 'A dull lead band that swallows reflections.',
    usage: 'Equip to a Ring slot. You are immune to magic that reads your thoughts, determines if you are lying, or detects your alignment. Creatures can only learn these things if you allow it.' },

  { id: 'ring-of-protection', name: 'Ring of Protection', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'rare', costGold: 3500, weight: 0,
    stats: { ac: 1, saves: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A simple silver band that raises a faint aura when danger is near.',
    usage: 'Equip to a Ring slot for +1 AC and +1 to all saving throws. Stacks with a Cloak of Protection.' },

  { id: 'ring-of-evasion', name: 'Ring of Evasion', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'rare', costGold: 5000, weight: 0,
    stats: { dexterity: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A band of braided grey wire holding three charges of luck.',
    usage: 'Equip to a Ring slot for +1 DEX. Holds 3 charges, regaining 1d3 at dawn. Spend 1 charge as a reaction to turn a failed DEX save into a success.' },

  { id: 'ring-of-the-ram', name: 'Ring of the Ram', category: 'jewelry', subcategory: 'Ring', itemType: 'equipment', slotType: 'ring1', rarity: 'rare', costGold: 5500, weight: 0,
    stats: {}, properties: ['Magical', 'Requires Attunement'],
    description: "A ring shaped as a ram's head with garnet eyes.",
    usage: 'Equip to a Ring slot. Holds 3 charges, regaining 1d3 at dawn. Spend up to 3 charges as an action for a ranged spell attack at +7: each charge deals 2d10 force damage and pushes the target 5 ft.' },

  { id: 'copper-pendant', name: 'Copper Pendant', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'common', costGold: 40, weight: 0.1,
    stats: {},
    description: 'A hand-beaten copper disc on a leather thong.',
    usage: 'Equip to the Amulet slot. Purely decorative, but it fills the slot and looks like it means something.' },

  { id: 'eye-of-the-hawk-pendant', name: 'Eye of the Hawk Pendant', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'uncommon', costGold: 1200, weight: 0.1,
    stats: { perception: 2, wisdom: 1 }, properties: ['Magical'],
    description: 'A polished amber cabochon with a slit pupil that tracks movement.',
    usage: 'Equip to the Amulet slot for +2 Perception and +1 WIS. The strongest cheap scouting item in the shop.' },

  { id: 'medallion-of-thoughts', name: 'Medallion of Thoughts', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'uncommon', costGold: 2000, weight: 0.1,
    stats: { intelligence: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A flat silver disc engraved with a closed eye.',
    usage: 'Equip to the Amulet slot for +1 INT. Holds 3 charges, regaining 1d3 at dawn. Spend 1 charge to cast Detect Thoughts (save DC 13).' },

  { id: 'periapt-of-wound-closure', name: 'Periapt of Wound Closure', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'uncommon', costGold: 2500, weight: 0.1,
    stats: { constitution: 1 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A blood-red gem that dims each time it knits a wound shut.',
    usage: 'Equip to the Amulet slot for +1 CON. You stabilise automatically whenever you make a death saving throw, and spent Hit Dice restore double the normal HP.' },

  { id: 'amulet-of-proof-against-detection', name: 'Amulet of Proof Against Detection', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'uncommon', costGold: 3000, weight: 0.1,
    stats: {}, properties: ['Magical', 'Requires Attunement'],
    description: 'A featureless obsidian teardrop that gives back no light at all.',
    usage: 'Equip to the Amulet slot. You are hidden from divination magic. You cannot be targeted by it, nor perceived through magical scrying sensors.' },

  { id: 'amulet-of-health', name: 'Amulet of Health', category: 'jewelry', subcategory: 'Amulet', itemType: 'equipment', slotType: 'amulet', rarity: 'rare', costGold: 6000, weight: 0.1,
    stats: { constitution: 3 }, properties: ['Magical', 'Requires Attunement'],
    description: 'A fat green beryl in a heavy gold setting, always slightly too warm.',
    usage: 'Equip to the Amulet slot for +3 CON. In the rulebook this sets your CON to 19, so if your CON is already 19 or higher, ignore the bonus.' },
];
