// Cleric Divine Domain Subclasses
// Each domain grants bonus spells, Channel Divinity options, and unique features

export type ClericDomain = 'life' | 'light' | 'war' | 'knowledge' | 'nature' | 'tempest' | 'trickery' | 'death';

export interface DomainConfig {
  id: ClericDomain;
  name: string;
  subtitle: string;
  iconName: string;
  description: string;
  bonusSpells: DomainBonusSpell[];
  channelDivinityOptions: DomainChannelDivinity[];
  features: DomainFeature[];
  bonusProficiencies?: string[];
}

export interface DomainBonusSpell {
  spellId: string;
  spellName: string;
  level: number; // Cleric level when gained
}

export interface DomainChannelDivinity {
  id: string;
  name: string;
  level: number;
  description: string;
  mechanicalEffect?: string;
}

export interface DomainFeature {
  id: string;
  name: string;
  level: number;
  description: string;
}

// ============================================
// LIFE DOMAIN
// ============================================

export const LIFE_DOMAIN: DomainConfig = {
  id: 'life',
  name: 'Life Domain',
  subtitle: 'Healing & Protection',
  iconName: 'Heart',
  description: 'The Life domain focuses on the vibrant positive energy that sustains all life. Clerics of this domain are master healers.',
  bonusProficiencies: ['Heavy Armor'],
  bonusSpells: [
    { spellId: 'bless', spellName: 'Bless', level: 1 },
    { spellId: 'cure-wounds', spellName: 'Cure Wounds', level: 1 },
    { spellId: 'lesser-restoration', spellName: 'Lesser Restoration', level: 3 },
    { spellId: 'spiritual-weapon', spellName: 'Spiritual Weapon', level: 3 },
    { spellId: 'beacon-of-hope', spellName: 'Beacon of Hope', level: 5 },
    { spellId: 'revivify', spellName: 'Revivify', level: 5 },
    { spellId: 'death-ward', spellName: 'Death Ward', level: 7 },
    { spellId: 'guardian-of-faith', spellName: 'Guardian of Faith', level: 7 },
    { spellId: 'mass-cure-wounds', spellName: 'Mass Cure Wounds', level: 9 },
    { spellId: 'raise-dead', spellName: 'Raise Dead', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'preserve-life',
      name: 'Preserve Life',
      level: 2,
      description: 'As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to five times your cleric level. Choose any creatures within 30 feet and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum.',
      mechanicalEffect: 'Heal 5× cleric level HP, divided among creatures within 30 ft',
    },
  ],
  features: [
    {
      id: 'bonus-proficiency-life',
      name: 'Bonus Proficiency',
      level: 1,
      description: 'You gain proficiency with heavy armor.',
    },
    {
      id: 'disciple-of-life',
      name: 'Disciple of Life',
      level: 1,
      description: 'Your healing spells are more effective. Whenever you use a spell of 1st level or higher to restore hit points, the creature regains additional HP equal to 2 + the spell\'s level.',
    },
    {
      id: 'blessed-healer',
      name: 'Blessed Healer',
      level: 6,
      description: 'When you cast a spell of 1st level or higher that restores hit points to another creature, you regain HP equal to 2 + the spell\'s level.',
    },
    {
      id: 'divine-strike-life',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each of your turns when you hit a creature with a weapon attack, you can cause the attack to deal an extra 1d8 radiant damage (2d8 at 14th level).',
    },
    {
      id: 'supreme-healing',
      name: 'Supreme Healing',
      level: 17,
      description: 'When you roll dice to restore hit points with a spell, you can use the maximum number for each die instead of rolling.',
    },
  ],
};

// ============================================
// LIGHT DOMAIN
// ============================================

export const LIGHT_DOMAIN: DomainConfig = {
  id: 'light',
  name: 'Light Domain',
  subtitle: 'Radiance & Fire',
  iconName: 'Sun',
  description: 'The Light domain emphasizes the ideals of rebirth, truth, vigilance, and beauty. Clerics of this domain are enlightened souls.',
  bonusSpells: [
    { spellId: 'burning-hands', spellName: 'Burning Hands', level: 1 },
    { spellId: 'faerie-fire', spellName: 'Faerie Fire', level: 1 },
    { spellId: 'flaming-sphere', spellName: 'Flaming Sphere', level: 3 },
    { spellId: 'scorching-ray', spellName: 'Scorching Ray', level: 3 },
    { spellId: 'daylight', spellName: 'Daylight', level: 5 },
    { spellId: 'fireball', spellName: 'Fireball', level: 5 },
    { spellId: 'guardian-of-faith', spellName: 'Guardian of Faith', level: 7 },
    { spellId: 'wall-of-fire', spellName: 'Wall of Fire', level: 7 },
    { spellId: 'flame-strike', spellName: 'Flame Strike', level: 9 },
    { spellId: 'scrying', spellName: 'Scrying', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'radiance-of-dawn',
      name: 'Radiance of the Dawn',
      level: 2,
      description: 'As an action, you present your holy symbol, and any magical darkness within 30 feet is dispelled. Each hostile creature within 30 feet must make a Constitution saving throw, taking 2d10 + cleric level radiant damage on a failed save, or half on success.',
      mechanicalEffect: 'Dispel magical darkness, deal 2d10 + level radiant damage (30 ft)',
    },
  ],
  features: [
    {
      id: 'light-cantrip',
      name: 'Bonus Cantrip',
      level: 1,
      description: 'You gain the Light cantrip if you don\'t already know it.',
    },
    {
      id: 'warding-flare',
      name: 'Warding Flare',
      level: 1,
      description: 'When you are attacked, you can use your reaction to impose disadvantage on the attack roll. Uses equal to Wisdom modifier per long rest.',
    },
    {
      id: 'improved-flare',
      name: 'Improved Flare',
      level: 6,
      description: 'You can use Warding Flare when a creature you can see within 30 feet attacks a creature other than you.',
    },
    {
      id: 'potent-spellcasting-light',
      name: 'Potent Spellcasting',
      level: 8,
      description: 'You add your Wisdom modifier to the damage you deal with any cleric cantrip.',
    },
    {
      id: 'corona-of-light',
      name: 'Corona of Light',
      level: 17,
      description: 'As an action, you can activate an aura of sunlight that lasts for 1 minute. You emit bright light in a 60-foot radius and dim light 30 feet beyond that. Enemies in the bright light have disadvantage on saving throws against spells that deal fire or radiant damage.',
    },
  ],
};

// ============================================
// WAR DOMAIN
// ============================================

export const WAR_DOMAIN: DomainConfig = {
  id: 'war',
  name: 'War Domain',
  subtitle: 'Combat & Victory',
  iconName: 'Swords',
  description: 'War has many manifestations. Clerics of the War domain excel at inspiring others to fight or fighting themselves.',
  bonusProficiencies: ['Heavy Armor', 'Martial Weapons'],
  bonusSpells: [
    { spellId: 'divine-favor', spellName: 'Divine Favor', level: 1 },
    { spellId: 'shield-of-faith', spellName: 'Shield of Faith', level: 1 },
    { spellId: 'magic-weapon', spellName: 'Magic Weapon', level: 3 },
    { spellId: 'spiritual-weapon', spellName: 'Spiritual Weapon', level: 3 },
    { spellId: 'crusaders-mantle', spellName: 'Crusader\'s Mantle', level: 5 },
    { spellId: 'spirit-guardians', spellName: 'Spirit Guardians', level: 5 },
    { spellId: 'freedom-of-movement', spellName: 'Freedom of Movement', level: 7 },
    { spellId: 'stoneskin', spellName: 'Stoneskin', level: 7 },
    { spellId: 'flame-strike', spellName: 'Flame Strike', level: 9 },
    { spellId: 'hold-monster', spellName: 'Hold Monster', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'guided-strike',
      name: 'Guided Strike',
      level: 2,
      description: 'When you make an attack roll, you can use your Channel Divinity to gain a +10 bonus to the roll. You make this choice after you see the roll, but before the DM says whether the attack hits or misses.',
      mechanicalEffect: '+10 to attack roll',
    },
    {
      id: 'war-gods-blessing',
      name: 'War God\'s Blessing',
      level: 6,
      description: 'When a creature within 30 feet makes an attack roll, you can use your reaction to grant that creature a +10 bonus to the roll, using your Channel Divinity.',
      mechanicalEffect: 'Grant ally +10 to attack roll (reaction)',
    },
  ],
  features: [
    {
      id: 'bonus-proficiency-war',
      name: 'Bonus Proficiencies',
      level: 1,
      description: 'You gain proficiency with heavy armor and martial weapons.',
    },
    {
      id: 'war-priest',
      name: 'War Priest',
      level: 1,
      description: 'When you use the Attack action, you can make one weapon attack as a bonus action. You can use this a number of times equal to your Wisdom modifier per long rest.',
    },
    {
      id: 'divine-strike-war',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each of your turns, you can cause a weapon attack to deal an extra 1d8 damage of the same type (2d8 at 14th level).',
    },
    {
      id: 'avatar-of-battle',
      name: 'Avatar of Battle',
      level: 17,
      description: 'You have resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons.',
    },
  ],
};

// ============================================
// KNOWLEDGE DOMAIN
// ============================================

export const KNOWLEDGE_DOMAIN: DomainConfig = {
  id: 'knowledge',
  name: 'Knowledge Domain',
  subtitle: 'Secrets & Learning',
  iconName: 'BookOpen',
  description: 'The gods of knowledge value learning and understanding above all. Clerics of this domain collect and share lore.',
  bonusSpells: [
    { spellId: 'command', spellName: 'Command', level: 1 },
    { spellId: 'identify', spellName: 'Identify', level: 1 },
    { spellId: 'augury', spellName: 'Augury', level: 3 },
    { spellId: 'suggestion', spellName: 'Suggestion', level: 3 },
    { spellId: 'nondetection', spellName: 'Nondetection', level: 5 },
    { spellId: 'speak-with-dead', spellName: 'Speak with Dead', level: 5 },
    { spellId: 'arcane-eye', spellName: 'Arcane Eye', level: 7 },
    { spellId: 'confusion', spellName: 'Confusion', level: 7 },
    { spellId: 'legend-lore', spellName: 'Legend Lore', level: 9 },
    { spellId: 'scrying', spellName: 'Scrying', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'knowledge-of-ages',
      name: 'Knowledge of the Ages',
      level: 2,
      description: 'As an action, you choose one skill or tool. For 10 minutes, you have proficiency with the chosen skill or tool.',
      mechanicalEffect: 'Gain any skill/tool proficiency for 10 min',
    },
    {
      id: 'read-thoughts',
      name: 'Read Thoughts',
      level: 6,
      description: 'You can use Channel Divinity to read a creature\'s thoughts. You then gain access to its surface thoughts and can use Suggestion on it without expending a spell slot.',
      mechanicalEffect: 'Read surface thoughts, cast Suggestion (free)',
    },
  ],
  features: [
    {
      id: 'blessings-of-knowledge',
      name: 'Blessings of Knowledge',
      level: 1,
      description: 'You learn two languages and gain proficiency in two skills: Arcana, History, Nature, or Religion. Your proficiency bonus is doubled for checks with those skills.',
    },
    {
      id: 'potent-spellcasting-knowledge',
      name: 'Potent Spellcasting',
      level: 8,
      description: 'You add your Wisdom modifier to the damage you deal with any cleric cantrip.',
    },
    {
      id: 'visions-of-the-past',
      name: 'Visions of the Past',
      level: 17,
      description: 'You can call up visions of the past by meditating. After 1 minute, you learn significant events that occurred in your immediate vicinity within the past number of days equal to your Wisdom score.',
    },
  ],
};

// ============================================
// NATURE DOMAIN
// ============================================

export const NATURE_DOMAIN: DomainConfig = {
  id: 'nature',
  name: 'Nature Domain',
  subtitle: 'Natural World',
  iconName: 'Leaf',
  description: 'Gods of nature encompass the wild, the land, and beasts. Clerics of this domain learn nature magic and gain animal companions.',
  bonusProficiencies: ['Heavy Armor'],
  bonusSpells: [
    { spellId: 'animal-friendship', spellName: 'Animal Friendship', level: 1 },
    { spellId: 'speak-with-animals', spellName: 'Speak with Animals', level: 1 },
    { spellId: 'barkskin', spellName: 'Barkskin', level: 3 },
    { spellId: 'spike-growth', spellName: 'Spike Growth', level: 3 },
    { spellId: 'plant-growth', spellName: 'Plant Growth', level: 5 },
    { spellId: 'wind-wall', spellName: 'Wind Wall', level: 5 },
    { spellId: 'dominate-beast', spellName: 'Dominate Beast', level: 7 },
    { spellId: 'grasping-vine', spellName: 'Grasping Vine', level: 7 },
    { spellId: 'insect-plague', spellName: 'Insect Plague', level: 9 },
    { spellId: 'tree-stride', spellName: 'Tree Stride', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'charm-animals-plants',
      name: 'Charm Animals and Plants',
      level: 2,
      description: 'As an action, you present your holy symbol and invoke the name of your deity. Each beast or plant creature that can see you within 30 feet must make a Wisdom saving throw or be charmed by you for 1 minute or until it takes damage.',
      mechanicalEffect: 'Charm beasts/plants within 30 ft for 1 min',
    },
  ],
  features: [
    {
      id: 'acolyte-of-nature',
      name: 'Acolyte of Nature',
      level: 1,
      description: 'You learn one druid cantrip and gain proficiency in Animal Handling, Nature, or Survival.',
    },
    {
      id: 'bonus-proficiency-nature',
      name: 'Bonus Proficiency',
      level: 1,
      description: 'You gain proficiency with heavy armor.',
    },
    {
      id: 'dampen-elements',
      name: 'Dampen Elements',
      level: 6,
      description: 'When you or a creature within 30 feet takes acid, cold, fire, lightning, or thunder damage, you can use your reaction to grant resistance to that instance of damage.',
    },
    {
      id: 'divine-strike-nature',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each turn, your weapon attack deals an extra 1d8 cold, fire, or lightning damage (your choice). At 14th level, this becomes 2d8.',
    },
    {
      id: 'master-of-nature',
      name: 'Master of Nature',
      level: 17,
      description: 'You can command creatures charmed by your Charm Animals and Plants feature.',
    },
  ],
};

// ============================================
// TEMPEST DOMAIN
// ============================================

export const TEMPEST_DOMAIN: DomainConfig = {
  id: 'tempest',
  name: 'Tempest Domain',
  subtitle: 'Storm & Thunder',
  iconName: 'CloudLightning',
  description: 'Gods of the tempest govern storms, sea, and sky. Clerics of this domain command thunder and lightning.',
  bonusProficiencies: ['Heavy Armor', 'Martial Weapons'],
  bonusSpells: [
    { spellId: 'fog-cloud', spellName: 'Fog Cloud', level: 1 },
    { spellId: 'thunderwave', spellName: 'Thunderwave', level: 1 },
    { spellId: 'gust-of-wind', spellName: 'Gust of Wind', level: 3 },
    { spellId: 'shatter', spellName: 'Shatter', level: 3 },
    { spellId: 'call-lightning', spellName: 'Call Lightning', level: 5 },
    { spellId: 'sleet-storm', spellName: 'Sleet Storm', level: 5 },
    { spellId: 'control-water', spellName: 'Control Water', level: 7 },
    { spellId: 'ice-storm', spellName: 'Ice Storm', level: 7 },
    { spellId: 'destructive-wave', spellName: 'Destructive Wave', level: 9 },
    { spellId: 'insect-plague', spellName: 'Insect Plague', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'destructive-wrath',
      name: 'Destructive Wrath',
      level: 2,
      description: 'When you roll lightning or thunder damage, you can use your Channel Divinity to deal maximum damage instead of rolling.',
      mechanicalEffect: 'Maximize lightning/thunder damage roll',
    },
  ],
  features: [
    {
      id: 'bonus-proficiency-tempest',
      name: 'Bonus Proficiencies',
      level: 1,
      description: 'You gain proficiency with heavy armor and martial weapons.',
    },
    {
      id: 'wrath-of-the-storm',
      name: 'Wrath of the Storm',
      level: 1,
      description: 'When a creature within 5 feet hits you with an attack, you can use your reaction to cause 2d8 lightning or thunder damage (DEX save for half). Uses equal to Wisdom modifier per long rest.',
    },
    {
      id: 'thunderbolt-strike',
      name: 'Thunderbolt Strike',
      level: 6,
      description: 'When you deal lightning damage to a Large or smaller creature, you can push it up to 10 feet away from you.',
    },
    {
      id: 'divine-strike-tempest',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each turn, your weapon attack deals an extra 1d8 thunder damage (2d8 at 14th level).',
    },
    {
      id: 'stormborn',
      name: 'Stormborn',
      level: 17,
      description: 'You have a flying speed equal to your walking speed whenever you are outdoors.',
    },
  ],
};

// ============================================
// TRICKERY DOMAIN
// ============================================

export const TRICKERY_DOMAIN: DomainConfig = {
  id: 'trickery',
  name: 'Trickery Domain',
  subtitle: 'Deception & Stealth',
  iconName: 'Drama',
  description: 'Gods of trickery are mischief-makers and instigators. Clerics of this domain prefer subterfuge and cunning.',
  bonusSpells: [
    { spellId: 'charm-person', spellName: 'Charm Person', level: 1 },
    { spellId: 'disguise-self', spellName: 'Disguise Self', level: 1 },
    { spellId: 'mirror-image', spellName: 'Mirror Image', level: 3 },
    { spellId: 'pass-without-trace', spellName: 'Pass Without Trace', level: 3 },
    { spellId: 'blink', spellName: 'Blink', level: 5 },
    { spellId: 'dispel-magic', spellName: 'Dispel Magic', level: 5 },
    { spellId: 'dimension-door', spellName: 'Dimension Door', level: 7 },
    { spellId: 'polymorph', spellName: 'Polymorph', level: 7 },
    { spellId: 'dominate-person', spellName: 'Dominate Person', level: 9 },
    { spellId: 'modify-memory', spellName: 'Modify Memory', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'invoke-duplicity',
      name: 'Invoke Duplicity',
      level: 2,
      description: 'As an action, you create an illusory duplicate of yourself within 30 feet that lasts for 1 minute. You can cast spells as though you were in the illusion\'s space. When both you and illusion are within 5 feet of a creature, you have advantage on attack rolls.',
      mechanicalEffect: 'Create illusory duplicate, cast from its space',
    },
    {
      id: 'cloak-of-shadows',
      name: 'Cloak of Shadows',
      level: 6,
      description: 'As an action, you become invisible until the end of your next turn. You become visible if you attack or cast a spell.',
      mechanicalEffect: 'Become invisible until end of next turn',
    },
  ],
  features: [
    {
      id: 'blessing-of-the-trickster',
      name: 'Blessing of the Trickster',
      level: 1,
      description: 'You can touch a willing creature (other than yourself) to give it advantage on Stealth checks. This blessing lasts for 1 hour or until you use it again.',
    },
    {
      id: 'divine-strike-trickery',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each turn, your weapon attack deals an extra 1d8 poison damage (2d8 at 14th level).',
    },
    {
      id: 'improved-duplicity',
      name: 'Improved Duplicity',
      level: 17,
      description: 'You can create up to four duplicates of yourself with Invoke Duplicity. You can move any number of them up to 30 feet as a bonus action.',
    },
  ],
};

// ============================================
// DEATH DOMAIN
// ============================================

export const DEATH_DOMAIN: DomainConfig = {
  id: 'death',
  name: 'Death Domain',
  subtitle: 'Necrotic Power',
  iconName: 'Skull',
  description: 'The Death domain is concerned with the forces that cause death, as well as the negative energy that gives rise to undead creatures.',
  bonusProficiencies: ['Martial Weapons'],
  bonusSpells: [
    { spellId: 'false-life', spellName: 'False Life', level: 1 },
    { spellId: 'ray-of-sickness', spellName: 'Ray of Sickness', level: 1 },
    { spellId: 'blindness-deafness', spellName: 'Blindness/Deafness', level: 3 },
    { spellId: 'ray-of-enfeeblement', spellName: 'Ray of Enfeeblement', level: 3 },
    { spellId: 'animate-dead', spellName: 'Animate Dead', level: 5 },
    { spellId: 'vampiric-touch', spellName: 'Vampiric Touch', level: 5 },
    { spellId: 'blight', spellName: 'Blight', level: 7 },
    { spellId: 'death-ward', spellName: 'Death Ward', level: 7 },
    { spellId: 'antilife-shell', spellName: 'Antilife Shell', level: 9 },
    { spellId: 'cloudkill', spellName: 'Cloudkill', level: 9 },
  ],
  channelDivinityOptions: [
    {
      id: 'touch-of-death',
      name: 'Touch of Death',
      level: 2,
      description: 'When you hit a creature with a melee attack, you can use Channel Divinity to deal extra necrotic damage equal to 5 + twice your cleric level.',
      mechanicalEffect: 'Deal 5 + (2 × cleric level) necrotic damage on hit',
    },
  ],
  features: [
    {
      id: 'bonus-proficiency-death',
      name: 'Bonus Proficiency',
      level: 1,
      description: 'You gain proficiency with martial weapons.',
    },
    {
      id: 'reaper',
      name: 'Reaper',
      level: 1,
      description: 'You learn the Chill Touch cantrip. When you cast a necromancy cantrip that targets one creature, you can target two creatures within range that are within 5 feet of each other.',
    },
    {
      id: 'inescapable-destruction',
      name: 'Inescapable Destruction',
      level: 6,
      description: 'Your ability to channel negative energy becomes more potent. Necrotic damage dealt by your cleric spells and Channel Divinity ignores resistance to necrotic damage.',
    },
    {
      id: 'divine-strike-death',
      name: 'Divine Strike',
      level: 8,
      description: 'Once on each turn, your weapon attack deals an extra 1d8 necrotic damage (2d8 at 14th level).',
    },
    {
      id: 'improved-reaper',
      name: 'Improved Reaper',
      level: 17,
      description: 'When you cast a necromancy spell of 1st through 5th level that targets only one creature, you can target a second creature.',
    },
  ],
};

// ============================================
// REGISTRY & HELPERS
// ============================================

export const ALL_DOMAINS: DomainConfig[] = [
  LIFE_DOMAIN,
  LIGHT_DOMAIN,
  WAR_DOMAIN,
  KNOWLEDGE_DOMAIN,
  NATURE_DOMAIN,
  TEMPEST_DOMAIN,
  TRICKERY_DOMAIN,
  DEATH_DOMAIN,
];

export const DOMAIN_REGISTRY: Record<ClericDomain, DomainConfig> = {
  life: LIFE_DOMAIN,
  light: LIGHT_DOMAIN,
  war: WAR_DOMAIN,
  knowledge: KNOWLEDGE_DOMAIN,
  nature: NATURE_DOMAIN,
  tempest: TEMPEST_DOMAIN,
  trickery: TRICKERY_DOMAIN,
  death: DEATH_DOMAIN,
};

export function getDomainById(id: ClericDomain): DomainConfig | undefined {
  return DOMAIN_REGISTRY[id];
}

export function getDomainBonusSpells(domain: ClericDomain, clericLevel: number): DomainBonusSpell[] {
  const config = getDomainById(domain);
  if (!config) return [];
  return config.bonusSpells.filter(spell => clericLevel >= spell.level);
}

export function getDomainChannelDivinity(domain: ClericDomain, clericLevel: number): DomainChannelDivinity[] {
  const config = getDomainById(domain);
  if (!config) return [];
  return config.channelDivinityOptions.filter(cd => clericLevel >= cd.level);
}

export function getDomainFeaturesForLevel(domain: ClericDomain, clericLevel: number): DomainFeature[] {
  const config = getDomainById(domain);
  if (!config) return [];
  return config.features.filter(f => clericLevel >= f.level);
}
