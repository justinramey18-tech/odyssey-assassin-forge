import { CatalogItem } from './types';

export const catalogConsumables: CatalogItem[] = [
  { id: 'potion-of-healing', name: 'Potion of Healing', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'common', costGold: 50, weight: 0.5,
    effect: 'Regain 2d4 + 2 hit points.', duration: 'Instant',
    description: 'A red liquid that glimmers when shaken.',
    usage: 'Drink as an action to regain 2d4 + 2 HP. You can also feed it to an unconscious ally as an action.' },

  { id: 'potion-of-greater-healing', name: 'Potion of Greater Healing', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'uncommon', costGold: 150, weight: 0.5,
    effect: 'Regain 4d4 + 4 hit points.', duration: 'Instant',
    description: 'A deeper crimson than the common brew, and noticeably heavier.',
    usage: 'Drink as an action to regain 4d4 + 4 HP.' },

  { id: 'potion-of-superior-healing', name: 'Potion of Superior Healing', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'rare', costGold: 450, weight: 0.5,
    effect: 'Regain 8d4 + 8 hit points.', duration: 'Instant',
    description: 'Almost black in the vial, and it tastes of iron and pine.',
    usage: 'Drink as an action to regain 8d4 + 8 HP. Worth saving for the moment a fight goes wrong.' },

  { id: 'potion-of-climbing', name: 'Potion of Climbing', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'common', costGold: 75, weight: 0.5,
    effect: 'Gain a climbing speed equal to your walking speed, and advantage on Athletics checks to climb.', duration: '1 hour',
    description: 'Layered brown and grey sludge that never fully mixes.',
    usage: 'Drink as an action. For 1 hour you climb at your full walking speed with advantage on climb checks.' },

  { id: 'potion-of-water-breathing', name: 'Potion of Water Breathing', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'uncommon', costGold: 180, weight: 0.5,
    effect: 'Breathe underwater.', duration: '1 hour',
    description: 'Cloudy green, with a single jellyfish-like bubble drifting in it.',
    usage: 'Drink as an action to breathe underwater for 1 hour.' },

  { id: 'potion-of-heroism', name: 'Potion of Heroism', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'rare', costGold: 400, weight: 0.5,
    effect: 'Gain 10 temporary HP and the effect of Bless.', duration: '1 hour',
    description: 'Blue liquid with a slow curl of white smoke trapped inside.',
    usage: 'Drink as an action for 10 temporary HP and Bless (+1d4 to attack rolls and saves) for 1 hour, no concentration needed.' },

  { id: 'potion-of-fire-breath', name: 'Potion of Fire Breath', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'uncommon', costGold: 300, weight: 0.5,
    effect: 'Bonus action to exhale fire at a target within 30 ft: DEX save DC 13 or 4d6 fire damage, half on a success. Three uses.', duration: '1 hour',
    description: 'Orange, and it flickers as though something is burning at the bottom.',
    usage: 'Drink as an action. For the next hour you can use a bonus action up to three times to breathe fire at one target within 30 ft.' },

  { id: 'potion-of-invisibility', name: 'Potion of Invisibility', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'very_rare', costGold: 500, weight: 0.5,
    effect: 'Become invisible. Anything you carry is invisible with you. The effect ends if you attack or cast a spell.', duration: '1 hour',
    description: 'The vial looks empty. Its stopper does not.',
    usage: 'Drink as an action to turn invisible for up to 1 hour. Attacking or casting a spell ends it immediately.' },

  { id: 'potion-of-speed', name: 'Potion of Speed', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'very_rare', costGold: 800, weight: 0.5,
    effect: 'Gain the Haste effect: doubled speed, +2 AC, advantage on DEX saves, and one extra action each turn.', duration: '1 minute',
    description: 'Yellow, with a black stripe that whips around when the vial is disturbed.',
    usage: 'Drink as an action for 1 minute of Haste with no concentration required. When it ends you cannot move or act for 1 turn.' },

  { id: 'antitoxin', name: 'Antitoxin', category: 'consumables', subcategory: 'Potion', itemType: 'consumable', consumableType: 'potion', usageType: 'drink', rarity: 'common', costGold: 50, weight: 0.5,
    effect: 'Advantage on saving throws against poison.', duration: '1 hour',
    description: 'A chalky white draught that numbs the tongue.',
    usage: 'Drink as an action. For 1 hour you have advantage on saves against poison. It does not cure poison already in you.' },

  { id: 'basic-poison-vial', name: 'Basic Poison', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'apply', rarity: 'common', costGold: 100, weight: 0.1,
    effect: 'Target makes a DC 10 CON save or takes 1d4 poison damage.', duration: 'Coating lasts 1 minute',
    description: 'A cloudy grey paste sold openly in most ports.',
    usage: 'Use an action to coat one weapon or up to three pieces of ammunition. The coating lasts 1 minute or until you hit.' },

  { id: 'serpent-venom', name: 'Serpent Venom', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'injury', rarity: 'uncommon', costGold: 200, weight: 0.1,
    effect: 'Target makes a DC 11 CON save or takes 3d6 poison damage, half on a success.', duration: 'Coating lasts 1 minute',
    description: 'Milked from a giant poisonous snake and stabilised with brandy.',
    usage: 'Use an action to coat a weapon or three pieces of ammunition. The next creature you hit makes a DC 11 CON save.' },

  { id: 'drow-poison', name: 'Drow Poison', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'injury', rarity: 'uncommon', costGold: 250, weight: 0.1,
    effect: 'DC 13 CON save or be poisoned for 1 hour. If the save fails by 5 or more, the target also falls unconscious until it takes damage or is woken.', duration: 'Coating lasts 1 minute',
    description: 'A black resin that must be kept out of sunlight or it goes inert.',
    usage: 'Use an action to coat a weapon or three pieces of ammunition. The classic non-lethal takedown for capture jobs.' },

  { id: 'essence-of-ether', name: 'Essence of Ether', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'inhale', rarity: 'uncommon', costGold: 300, weight: 0.1,
    effect: 'DC 15 CON save or be poisoned for 8 hours. A poisoned creature is unconscious, and wakes if it takes damage.', duration: '8 hours',
    description: 'A colourless gas kept under pressure in a thick glass sphere.',
    usage: 'Use an action to release it in a 10 ft cube. Every creature in the cloud must save. Ideal for clearing a guard post without a body count.' },

  { id: 'torpor', name: 'Torpor', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'ingested', rarity: 'rare', costGold: 600, weight: 0.1,
    effect: 'DC 15 CON save or be poisoned for 4d6 hours. A poisoned creature is incapacitated.', duration: '4d6 hours',
    description: 'Tasteless, odourless, and it dissolves completely in wine.',
    usage: 'Slip it into food or drink. The target must swallow it, so this needs a Sleight of Hand check or a distracted mark.' },

  { id: 'purple-worm-poison', name: 'Purple Worm Poison', category: 'consumables', subcategory: 'Poison', itemType: 'consumable', consumableType: 'poison', usageType: 'injury', rarity: 'very_rare', costGold: 2000, weight: 0.1,
    effect: 'DC 19 CON save or take 12d6 poison damage, half on a success.', duration: 'Coating lasts 1 minute',
    description: 'Harvested from a stinger the size of a man. Sold with an apology and a waiver.',
    usage: 'Use an action to coat a weapon or three pieces of ammunition. The most lethal single application in the shop.' },

  { id: 'scroll-of-cure-wounds', name: 'Scroll of Cure Wounds', category: 'consumables', subcategory: 'Scroll', itemType: 'consumable', consumableType: 'scroll', usageType: 'read', rarity: 'common', costGold: 60, weight: 0,
    effect: 'Cast Cure Wounds (1st level): a creature you touch regains 1d8 + your spellcasting modifier HP.', duration: 'Instant',
    description: 'A short strip of vellum, the ink still faintly damp.',
    usage: 'Read as an action. The spell must be on your class list, or make a DC 10 INT check to cast it anyway. The scroll crumbles after use.' },

  { id: 'scroll-of-magic-missile', name: 'Scroll of Magic Missile', category: 'consumables', subcategory: 'Scroll', itemType: 'consumable', consumableType: 'scroll', usageType: 'read', rarity: 'common', costGold: 60, weight: 0,
    effect: 'Cast Magic Missile (1st level): three darts each deal 1d4 + 1 force damage and always hit.', duration: 'Instant',
    description: 'Three neat sigils in a row, each one pulsing out of time with the others.',
    usage: 'Read as an action. Never misses, so useful for finishing a fleeing target.' },

  { id: 'scroll-of-misty-step', name: 'Scroll of Misty Step', category: 'consumables', subcategory: 'Scroll', itemType: 'consumable', consumableType: 'scroll', usageType: 'read', rarity: 'uncommon', costGold: 150, weight: 0,
    effect: 'Cast Misty Step (2nd level): teleport up to 30 ft to a space you can see.', duration: 'Instant',
    description: 'The parchment is cold, and smells faintly of wet stone.',
    usage: 'Read as a bonus action to teleport 30 ft. The single best escape item at this price.' },

  { id: 'scroll-of-fireball', name: 'Scroll of Fireball', category: 'consumables', subcategory: 'Scroll', itemType: 'consumable', consumableType: 'scroll', usageType: 'read', rarity: 'uncommon', costGold: 350, weight: 0,
    effect: 'Cast Fireball (3rd level): 8d6 fire damage in a 20 ft radius, DEX save DC 15 for half.', duration: 'Instant',
    description: 'The parchment is scorched at the edges and warm in the middle.',
    usage: 'Read as an action. Make sure your own party is not standing in the 20 ft radius.' },

  { id: 'scroll-of-revivify', name: 'Scroll of Revivify', category: 'consumables', subcategory: 'Scroll', itemType: 'consumable', consumableType: 'scroll', usageType: 'read', rarity: 'rare', costGold: 400, weight: 0,
    effect: 'Cast Revivify (3rd level): return a creature dead no longer than 1 minute to life with 1 hit point.', duration: 'Instant',
    description: 'Written in silver ink on skin-thin vellum, sealed in a lead tube.',
    usage: 'Read as an action. Consumes 300 gp of diamonds, which must be bought separately. Only works within 1 minute of death.' },

  { id: 'alchemists-fire', name: "Alchemist's Fire", category: 'consumables', subcategory: 'Oil', itemType: 'consumable', consumableType: 'potion', usageType: 'throw', rarity: 'common', costGold: 50, weight: 1,
    effect: 'On a hit, the target burns for 1d4 fire damage at the start of each of its turns until a creature uses an action to make a DC 10 DEX check to put it out.', duration: 'Until extinguished',
    description: 'A sticky amber fluid in a thin flask, ready to break on impact.',
    usage: 'Throw as an action at a target within 20 ft, making a ranged attack roll. Do not carry it in the same pouch as anything you value.' },

  { id: 'holy-water-flask', name: 'Flask of Holy Water', category: 'consumables', subcategory: 'Oil', itemType: 'consumable', consumableType: 'potion', usageType: 'throw', rarity: 'common', costGold: 25, weight: 1,
    effect: 'On a hit, a fiend or undead takes 2d6 radiant damage.', duration: 'Instant',
    description: 'Water blessed at a temple altar, sealed with wax and a prayer strip.',
    usage: 'Throw as an action at a target within 20 ft, making a ranged attack roll. Only harms fiends and undead.' },

  { id: 'oil-of-slipperiness', name: 'Oil of Slipperiness', category: 'consumables', subcategory: 'Oil', itemType: 'consumable', consumableType: 'potion', usageType: 'apply', rarity: 'uncommon', costGold: 480, weight: 0.5,
    effect: 'Gain the effect of Freedom of Movement: you cannot be restrained or paralysed, and difficult terrain does not slow you.', duration: '8 hours',
    description: 'A clear, sticky grease that will not wash off in water.',
    usage: 'Spend 10 minutes applying it to yourself. For the next 8 hours you slip out of grapples, restraints and manacles automatically.' },
];
