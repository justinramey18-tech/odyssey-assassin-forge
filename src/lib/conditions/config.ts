import { ConditionDefinition, DeadpoolEventType } from './types';

// D&D 5e Core Conditions with personality-voiced descriptions
export const CONDITION_DEFINITIONS: ConditionDefinition[] = [
  {
    id: 'blinded',
    name: 'Blinded',
    icon: 'EyeOff',
    category: 'debuff',
    severity: 'high',
    mechanicalEffect: "Can't see, auto-fail sight checks. Attack rolls have disadvantage. Attacks against you have advantage.",
    personalityDescriptions: {
      thunderhead: "Visual input: zero. I calculate a 73.4% reduction in combat effectiveness. All attacks against you carry statistical advantage.",
      jarvis: "Sir, your optical systems appear to be... offline. I'm detecting significant targeting complications. Enemies will exploit this.",
      deadpool: "EVERYTHING IS DARKNESS. Like that time I watched the Snyder Cut with no contrast settings. Spoiler: you're gonna miss. A LOT.",
    },
    saveStat: 'CON',
    color: 'hsl(0 0% 30%)',
  },
  {
    id: 'charmed',
    name: 'Charmed',
    icon: 'Heart',
    category: 'debuff',
    severity: 'medium',
    mechanicalEffect: "Can't attack charmer. Charmer has advantage on social checks against you.",
    personalityDescriptions: {
      thunderhead: "Neural manipulation detected. Your hostility toward the source has been artificially suppressed. Social resistance: compromised.",
      jarvis: "I'm detecting... unusual brain chemistry, Sir. You appear to be rather fond of someone who may not deserve it.",
      deadpool: "Aww, you made a new friend! A MIND-CONTROLLING friend who is DEFINITELY going to betray you. But isn't that how all friendships work?",
    },
    saveStat: 'WIS',
    color: 'hsl(330 70% 50%)',
  },
  {
    id: 'deafened',
    name: 'Deafened',
    icon: 'EarOff',
    category: 'debuff',
    severity: 'low',
    mechanicalEffect: "Can't hear, auto-fail hearing checks.",
    personalityDescriptions: {
      thunderhead: "Auditory input: terminated. While not directly combat-impacting, communication and perception are reduced by 31.7%.",
      jarvis: "Audio systems are non-responsive, Sir. I'm afraid shouted warnings will go... unheeded.",
      deadpool: "WHAT? CAN'T HEAR YOU. Actually this is kind of peaceful. No one telling me what to do. *bliss*",
    },
    shortRestClears: true,
    color: 'hsl(200 30% 40%)',
  },
  {
    id: 'frightened',
    name: 'Frightened',
    icon: 'AlertTriangle',
    category: 'debuff',
    severity: 'medium',
    mechanicalEffect: "Disadvantage on ability checks and attacks while source is visible. Can't willingly move closer to source.",
    personalityDescriptions: {
      thunderhead: "Fear responses detected. Neural activity indicates an 89.2% impulse to flee. Combat efficiency reduced while the source remains visible.",
      jarvis: "Your amygdala appears to be... overreacting, Sir. Might I suggest looking elsewhere? Your accuracy is suffering.",
      deadpool: "BIG SCARY THING. LEGS WON'T MOVE TOWARD IT. We've all been there, buddy. *Usually involving clowns or my monthly credit card statement.*",
    },
    saveStat: 'WIS',
    color: 'hsl(270 60% 50%)',
  },
  {
    id: 'grappled',
    name: 'Grappled',
    icon: 'Hand',
    category: 'debuff',
    severity: 'low',
    mechanicalEffect: "Speed becomes 0. Can't benefit from speed bonuses.",
    personalityDescriptions: {
      thunderhead: "Mobility: zero. You are physically restrained. Escape requires a contested check or eliminating the grappler.",
      jarvis: "You appear to be... held, Sir. Movement is not currently an option. Might I suggest convincing them to let go?",
      deadpool: "Someone's HUGGING you. Without consent. Rude. Also your movement speed is now 'lol nope.'",
    },
    color: 'hsl(30 60% 40%)',
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    icon: 'Ban',
    category: 'debuff',
    severity: 'high',
    mechanicalEffect: "Can't take actions or reactions.",
    personalityDescriptions: {
      thunderhead: "Action capacity: suspended. Zero percent operational capability for voluntary responses. This is... concerning.",
      jarvis: "All tactical systems are offline, Sir. You cannot act or react. I would describe this as 'suboptimal.'",
      deadpool: "Your turn is basically 'exist and hope nobody hits you.' Riveting gameplay. 10/10 would not recommend.",
    },
    color: 'hsl(0 70% 45%)',
  },
  {
    id: 'invisible',
    name: 'Invisible',
    icon: 'Ghost',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Heavily obscured for hiding. Attack rolls against you have disadvantage. Your attacks have advantage.",
    personalityDescriptions: {
      thunderhead: "Visual signature: null. Your probability of successful attacks increased by 64.3%. Incoming attacks suffer equivalent penalties.",
      jarvis: "Stealth mode engaged, Sir. You are, for all practical purposes, a tactical ghost. Enemies will struggle to target you.",
      deadpool: "JOHN CENA MODE ACTIVATED. They can't see you! ...Okay they might HEAR you if you keep talking. Which you will. Because you're you.",
    },
    color: 'hsl(180 60% 45%)',
  },
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    icon: 'Zap',
    category: 'debuff',
    severity: 'critical',
    mechanicalEffect: "Incapacitated. Can't move or speak. Auto-fail Str/Dex saves. Attacks have advantage. Melee hits are auto-crits.",
    personalityDescriptions: {
      thunderhead: "Motor functions: TERMINATED. You cannot move, speak, or defend. Melee attacks against you will critically succeed. Survival probability: declining rapidly.",
      jarvis: "Sir, this is... extremely concerning. All systems are frozen. Any melee attack will inflict critical damage. I strongly recommend teammates intervene.",
      deadpool: "YOU'RE A STATUE NOW. A very handsome, very DEAD-SOON statue. Anyone with a sword is about to have a GREAT time. You? Not so much.",
    },
    saveStat: 'CON',
    color: 'hsl(60 80% 45%)',
  },
  {
    id: 'petrified',
    name: 'Petrified',
    icon: 'Mountain',
    category: 'debuff',
    severity: 'critical',
    mechanicalEffect: "Transformed to stone. Incapacitated, unaware. Weight x10. Resistance to all damage. Immune to poison/disease.",
    personalityDescriptions: {
      thunderhead: "Biological processes: suspended. You have been converted to inanimate stone. Time has effectively stopped for you. Restoration requires external intervention.",
      jarvis: "Sir, you are currently... a rock. A very durable rock, resistant to damage, but also completely unaware. Not ideal.",
      deadpool: "Congratulations! You're a lawn ornament now! On the plus side, you're basically indestructible. On the minus side, EVERYTHING ELSE.",
    },
    saveStat: 'CON',
    longRestClears: false,
    color: 'hsl(30 20% 40%)',
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    icon: 'Skull',
    category: 'debuff',
    severity: 'medium',
    mechanicalEffect: "Disadvantage on attack rolls and ability checks.",
    personalityDescriptions: {
      thunderhead: "Toxins detected in your system. I calculate a 47.3% reduction in combat efficacy until purged. All attacks and checks compromised.",
      jarvis: "Sir, your biological systems are experiencing... interference. I strongly recommend finding an antidote. Your performance is significantly impaired.",
      deadpool: "Ugh, you got the spinny-brain poison. Everything looks green and your attacks are gonna be *garbage*. Ask me how I know. 💀",
    },
    saveStat: 'CON',
    shortRestClears: true,
    color: 'hsl(120 60% 35%)',
  },
  {
    id: 'prone',
    name: 'Prone',
    icon: 'ArrowDown',
    category: 'debuff',
    severity: 'low',
    mechanicalEffect: "Disadvantage on attacks. Melee attacks against you have advantage. Ranged attacks against you have disadvantage.",
    personalityDescriptions: {
      thunderhead: "Orientation: horizontal. Your attack accuracy is reduced. Melee combatants have advantage; ranged attackers do not. Standing requires half movement.",
      jarvis: "You appear to be... on the ground, Sir. This presents tactical complications for melee defense but advantages against ranged attacks.",
      deadpool: "Floor gang! FLOOR GANG! ...Okay this is actually bad for melee but good against archers. Silver linings!",
    },
    color: 'hsl(40 50% 40%)',
  },
  {
    id: 'restrained',
    name: 'Restrained',
    icon: 'Link',
    category: 'debuff',
    severity: 'medium',
    mechanicalEffect: "Speed 0. Attacks have disadvantage. Attacks against you have advantage. Disadvantage on Dex saves.",
    personalityDescriptions: {
      thunderhead: "Movement: impossible. Attack accuracy and defensive reflexes: significantly impaired. Escape is your optimal priority.",
      jarvis: "You are immobilized, Sir, and your combat effectiveness has dropped substantially. I would prioritize freeing yourself.",
      deadpool: "Tied up again. This keeps happening to me. Your attacks are garbage, their attacks are great. Classic restraint problems.",
    },
    saveStat: 'DEX',
    color: 'hsl(25 70% 45%)',
  },
  {
    id: 'stunned',
    name: 'Stunned',
    icon: 'Star',
    category: 'debuff',
    severity: 'high',
    mechanicalEffect: "Incapacitated. Can't move. Auto-fail Str/Dex saves. Attacks against you have advantage.",
    personalityDescriptions: {
      thunderhead: "Motor functions suspended. Zero percent capacity for voluntary action until recovery. Defensive capabilities: critical failure mode.",
      jarvis: "All systems are currently... offline, Sir. A concerning development. You cannot move, and enemies have significant advantage.",
      deadpool: "BRAIN.EXE HAS STOPPED WORKING. You're basically a very handsome punching bag right now. Teammates? HELP?",
    },
    saveStat: 'CON',
    color: 'hsl(45 90% 50%)',
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    icon: 'Moon',
    category: 'debuff',
    severity: 'critical',
    mechanicalEffect: "Incapacitated. Drop items. Fall prone. Auto-fail Str/Dex saves. Attacks have advantage. Melee hits are auto-crits.",
    personalityDescriptions: {
      thunderhead: "Consciousness: terminated. You are completely defenseless. Melee attacks will critically succeed. Probability of death without intervention: escalating.",
      jarvis: "Sir? Sir! ...No response. You are unconscious and extremely vulnerable. Melee attacks will be devastating. Medical attention required immediately.",
      deadpool: "Nighty-night! You're taking a dirt nap and anyone with a pointy thing is about to go HAM on you. Wake up wake up WAKE UP.",
    },
    saveStat: 'CON',
    color: 'hsl(240 40% 25%)',
  },
  {
    id: 'exhaustion_1',
    name: 'Exhaustion (1)',
    icon: 'Battery',
    category: 'debuff',
    severity: 'low',
    mechanicalEffect: "Disadvantage on ability checks.",
    personalityDescriptions: {
      thunderhead: "Fatigue level: 1. Ability checks impaired by approximately 25%. Rest is recommended.",
      jarvis: "You're experiencing mild fatigue, Sir. Ability checks will be somewhat unreliable.",
      deadpool: "Feeling a little tired, huh? Ability checks are gonna be rough. Maybe less murder, more naps?",
    },
    shortRestClears: true,
    color: 'hsl(35 60% 45%)',
  },
  {
    id: 'exhaustion_2',
    name: 'Exhaustion (2)',
    icon: 'Battery',
    category: 'debuff',
    severity: 'medium',
    mechanicalEffect: "Disadvantage on ability checks. Speed halved.",
    personalityDescriptions: {
      thunderhead: "Fatigue level: 2. Ability checks impaired. Movement speed reduced by 50%. Rest urgently recommended.",
      jarvis: "Fatigue is accumulating, Sir. Your movement is sluggish and ability checks are suffering.",
      deadpool: "Okay you're dragging now. Half speed, terrible at skill stuff. You need a Red Bull. Or a long rest. Probably both.",
    },
    color: 'hsl(35 60% 40%)',
  },
  {
    id: 'exhaustion_3',
    name: 'Exhaustion (3)',
    icon: 'Battery',
    category: 'debuff',
    severity: 'high',
    mechanicalEffect: "Disadvantage on ability checks, attack rolls, and saves. Speed halved.",
    personalityDescriptions: {
      thunderhead: "Fatigue level: 3. CRITICAL. All d20 rolls compromised. Combat effectiveness: severely diminished.",
      jarvis: "Sir, you are dangerously fatigued. Everything you attempt is impaired. I strongly recommend immediate rest.",
      deadpool: "You look like ME after a bender. Everything's hard now - attacks, saves, skills, existing. REST. NOW.",
    },
    color: 'hsl(25 70% 40%)',
  },
  // Custom/Buff conditions
  {
    id: 'blessed',
    name: 'Blessed',
    icon: 'Sparkles',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Add 1d4 to attack rolls and saving throws.",
    personalityDescriptions: {
      thunderhead: "Divine enhancement detected. All attack and save rolls receive a +1d4 bonus. Probability improvement: 12.5% average.",
      jarvis: "You've received a blessing, Sir. Attack rolls and saving throws will benefit from an additional d4.",
      deadpool: "Someone LIKES you! Add a d4 to attacks and saves. It's like having a tiny lucky charm that actually works!",
    },
    color: 'hsl(45 90% 60%)',
  },
  {
    id: 'hasted',
    name: 'Hasted',
    icon: 'Zap',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Speed doubled. +2 AC. Advantage on Dex saves. Extra action (Attack, Dash, Disengage, Hide, Use Object only).",
    personalityDescriptions: {
      thunderhead: "Temporal acceleration active. Speed: 200%. AC: +2. Additional action available per turn. When it ends, you will be incapacitated briefly.",
      jarvis: "Haste protocol engaged, Sir. You're operating at double speed with improved defenses. Do note the lethargy when it ends.",
      deadpool: "GOTTA GO FAST! Double speed, extra action, better AC! Just don't think about the crash when it ends. *internal screaming*",
    },
    color: 'hsl(50 100% 50%)',
  },
  {
    id: 'enlarged',
    name: 'Enlarged',
    icon: 'Maximize',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Size increased. Advantage on Str checks/saves. Weapon damage +1d4.",
    personalityDescriptions: {
      thunderhead: "Physical dimensions: expanded. Strength-based activities enhanced. Weapon damage augmented by 1d4.",
      jarvis: "You've grown considerably, Sir. Strength advantages apply, and your weapons hit harder.",
      deadpool: "BIG MODE ACTIVATED! You're huge and your weapons hit like trucks! Doorways are now your enemy.",
    },
    color: 'hsl(15 80% 50%)',
  },
  {
    id: 'hexed',
    name: 'Hexed',
    icon: 'Target',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Extra 1d6 necrotic damage against hexed target. Target has disadvantage on one chosen ability check.",
    personalityDescriptions: {
      thunderhead: "Hex connection established. Additional 1d6 necrotic damage per hit. Target's ability checks in chosen stat: compromised.",
      jarvis: "Hex is active, Sir. Your attacks deal bonus necrotic damage, and the target struggles with their weakened ability.",
      deadpool: "You've put a HEX on them! Extra d6 damage every hit, and they're bad at one thing now. Magic is FUN.",
    },
    color: 'hsl(280 70% 40%)',
  },
  {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    icon: 'Crosshair',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Extra 1d6 damage against marked target. Advantage on Survival/Perception to track them.",
    personalityDescriptions: {
      thunderhead: "Target marked. Weapon attacks deal additional 1d6 damage. Tracking probability: significantly enhanced.",
      jarvis: "Hunter's Mark is active, Sir. Bonus damage applies, and you can track this target with ease.",
      deadpool: "MARKED FOR DEATH. Extra d6 damage and you can find them anywhere. They can run but they CAN'T hide. Well, they can try.",
    },
    color: 'hsl(120 50% 40%)',
  },
  {
    id: 'concentrating',
    name: 'Concentrating',
    icon: 'Eye',
    category: 'buff',
    severity: 'low',
    mechanicalEffect: "Maintaining a concentration spell. Taking damage requires Con save (DC 10 or half damage, whichever is higher).",
    personalityDescriptions: {
      thunderhead: "Concentration lock: active. Damage will trigger Constitution saves. Failure terminates the maintained effect.",
      jarvis: "You're maintaining concentration, Sir. Any damage will test your focus. The DC is 10 or half the damage taken.",
      deadpool: "Don't. Get. Hit. Your brain is holding something important and ONE good bonk could ruin it. No pressure!",
    },
    color: 'hsl(200 80% 50%)',
  },
];

// Get condition by ID
export function getConditionById(id: string): ConditionDefinition | undefined {
  return CONDITION_DEFINITIONS.find(c => c.id === id);
}

// Get all conditions by category
export function getConditionsByCategory(category: 'debuff' | 'buff' | 'environmental'): ConditionDefinition[] {
  return CONDITION_DEFINITIONS.filter(c => c.category === category);
}

// Get debuffs only
export function getDebuffs(): ConditionDefinition[] {
  return CONDITION_DEFINITIONS.filter(c => c.category === 'debuff');
}

// Get buffs only
export function getBuffs(): ConditionDefinition[] {
  return CONDITION_DEFINITIONS.filter(c => c.category === 'buff');
}

// Deadpool commentary for condition events
export const DEADPOOL_COMMENTARY: Record<DeadpoolEventType, string[]> = {
  condition_added: [
    "Aaand now you're {condition}. Cool cool cool. *This is fine.* 🔥",
    "New debuff unlocked! ...Wait, that's bad. That's definitely bad.",
    "Oh look, {source} gave you a present! A terrible, terrible present.",
    "Adding '{condition}' to the list of reasons this day sucks.",
  ],
  condition_cleared: [
    "FREEDOM! 🎉 ...For now. They'll probably do it again.",
    "'{condition}' has left the chat. Good riddance!",
    "Bye bye {condition}! Don't let the door hit you on the way out!",
    "One less thing trying to kill you. Progress!",
  ],
  critical_severity: [
    "Oh no. OH NO. *checks notes* Yep, that's bad. That's REAL bad.",
    "CRITICAL CONDITION ALERT. This is not a drill. I repeat, NOT A DRILL.",
    "So... you know how I said things could get worse? SURPRISE!",
    "Time to panic. Organized, tactical panic, but definitely panic.",
  ],
  save_succeeded: [
    "NAT 20 ENERGY! Your body said 'NOPE' to that nonsense!",
    "SAVED IT! Like a goalkeeper but for... not dying!",
    "Your dice actually WORKED! Mark this on the calendar!",
    "Constitution check passed! Liver of steel, baby!",
  ],
  save_failed: [
    "Oof. Your dice betrayed you. *Again.* We need to talk to those dice.",
    "Save failed. The dice gods are NOT on your side today.",
    "Welp. That didn't work. Maybe next round? *nervous laughter*",
    "Your body tried. It really did. It just... didn't.",
  ],
  short_rest: [
    "Nap time over! You're probably not gonna die. Probably.",
    "Short rest complete! Some conditions cleared, some... not so much.",
    "One hour of sitting around has restored you to 'mostly functional.'",
    "Feeling better? Good. Because something else is about to happen.",
  ],
  long_rest: [
    "FULL RESET! You're basically a new person! A person who's about to get hurt again, but NEW!",
    "8 hours of sleep and you're ready to make more poor decisions!",
    "All conditions cleared! ...Give it 5 minutes.",
    "Rise and shine! The world is ready to traumatize you again!",
  ],
};

// Get random Deadpool commentary
export function getDeadpoolCommentary(
  event: DeadpoolEventType,
  conditionName?: string,
  source?: string
): string {
  const options = DEADPOOL_COMMENTARY[event];
  const comment = options[Math.floor(Math.random() * options.length)];
  
  return comment
    .replace('{condition}', conditionName || 'something nasty')
    .replace('{source}', source || 'the universe');
}

// Severity to animation class mapping
export const SEVERITY_ANIMATIONS: Record<string, string> = {
  low: 'condition-severity-low',
  medium: 'condition-severity-medium',
  high: 'condition-severity-high',
  critical: 'condition-severity-critical',
};

// Default colors for severities
export const SEVERITY_COLORS = {
  low: 'hsl(45 60% 50%)',
  medium: 'hsl(30 70% 50%)',
  high: 'hsl(15 80% 50%)',
  critical: 'hsl(0 90% 50%)',
};

// Buff color
export const BUFF_COLOR = 'hsl(150 70% 45%)';
