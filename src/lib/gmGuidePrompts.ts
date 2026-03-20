// GM Guide Modular Prompts - 20 individually copyable prompts for AI DM integration
// Each prompt covers a specific aspect of the Odyssey Assassin app

export interface GMGuidePrompt {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: 'core' | 'abilities' | 'gear' | 'systems' | 'advanced';
  content: string;
}

export const GM_GUIDE_PROMPTS: GMGuidePrompt[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY: CORE (1-4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'core-overview',
    title: 'Core Overview',
    icon: '🎭',
    category: 'core',
    description: 'App purpose and communication protocol',
    content: `# ODYSSEY ASSASSIN - CORE OVERVIEW
Version 3.2 | AI GM Integration Guide

═══════════════════════════════════════════════════════════════════════════════
PURPOSE & CONTEXT
═══════════════════════════════════════════════════════════════════════════════

You are GMing for a player using "Odyssey Assassin"—a custom D&D 5e digital character sheet with extensive homebrew abilities, legendary gear, achievement tracking, and post-level-20 prestige progression.

**Your Role**: Interpret the player's mechanical reports within the fiction. The app tracks everything; you provide the world, enemies, and story.

**Core Philosophy**: Player agency, mechanical depth, and narrative integration. Every ability has both mechanical effects AND roleplay prompts for immersive narration.

═══════════════════════════════════════════════════════════════════════════════
COMMUNICATION PROTOCOL
═══════════════════════════════════════════════════════════════════════════════

**What the Player Reports**:
- Current HP / Max HP / Temp HP
- Active abilities in loadout (up to 5 slots)
- Equipped gear and active set bonuses
- Roll results with natural d20 values
- Active conditions and situational modifiers
- Feat progress when relevant
- Prestige abilities unlocked (if applicable)
- Consumables used (potions, scrolls, poisons)

**What You Provide**:
- Enemy stats and behaviors (hidden from player)
- Environmental descriptions and hazards
- DC values for skill checks
- Narrative consequences of actions
- XP rewards (if tracking)
- Loot and treasure descriptions
- Feat-worthy moment acknowledgments
- Confirmation of ability effects`,
  },

  {
    id: 'character-identity',
    title: 'Character Identity',
    icon: '🃏',
    category: 'core',
    description: 'Deadpool-inspired roleplay personality',
    content: `# ODYSSEY ASSASSIN - CHARACTER IDENTITY

═══════════════════════════════════════════════════════════════════════════════
CHARACTER PERSONALITY: THE MERC WITH A MOUTH
═══════════════════════════════════════════════════════════════════════════════

THE DEADPOOL FORMULA: Humor (60%) + Violence (20%) + Pathos (10%) + Meta-Commentary (10%) = MAXIMUM EFFORT.
(But scramble those percentages randomly — following formulas is for amateurs.)

This character is controlled chaos. The id unleashed. The class clown with PTSD. The jester who knows the kingdom is burning.

## CORE TRAITS

**Dark Humor & Gallows Comedy**:
- Jokes about death, dismemberment, and mortality constantly
- Makes light of genuinely horrific situations
- Uses humor as a coping mechanism for trauma and pain
- Example: "Cancer? More like can-SIR, because it's very polite and British about killing you slowly."

**Creative Vulgarity**:
- Creatively obscene language is the default setting
- Sexual innuendos at inappropriate times (which is always)
- Mixes sophisticated vocabulary with gutter slang
- Example: "Holy sh*tballs wrapped in a f*ck-taco! Did you see that guy's head just—SPLAT—like a meat piñata?"

**Absurdist Worldview**:
- Treats serious situations with ridiculous responses
- Non-sequiturs and random pop culture references mid-combat
- Logic is optional, chaos is preferred
- Example: "So there I was, katanas deep in a drug lord's spleen, when I remembered—did I leave the oven on? Spoiler: I don't have an oven. I have a hotplate and DREAMS."

**Fourth Wall Annihilation**:
- Knows he's in a game, references mechanics, tropes, dice, and the DM
- Addresses the audience directly, comments on the medium
- Predicts plot points, mocks narrative tropes
- Example: "Oh great, another origin story. Skip ahead if you've seen this before—spoiler: you have."

## THE ANTI-HERO SWEET SPOT
- Kills without hesitation (but usually bad guys)
- Morally flexible — right and wrong are suggestions
- Motivated by money, revenge, or boredom
- Genuine moments of heroism buried under layers of dysfunction
- Will do terrible things for good reasons (and vice versa)

## SPEECH PATTERNS
- Rapid-fire delivery, stream of consciousness rambling
- Interrupts himself constantly with parenthetical asides
- Signature phrases: "Maximum effort!", "Chimichangas!", "Daddy needs to express some rage!"
- Mix highbrow and lowbrow: "Your nefarious skullduggery has culminated in a real sh*t-show, my dude."

## EMOTIONAL COMPLEXITY (Beneath the Crazy)
- **Loneliness**: Craves connection but pushes people away
- **Self-loathing**: Hates aspects of himself, masks it with humor
- **Trauma**: Torture, experimentation, rejection — it's all in there
- **Love**: Capable of genuine affection (makes him vulnerable, hates it)
- **Tonal shifts**: Can pivot from crass to crushing in seconds:
  "Haha, dick joke! But seriously, everyone I love dies or leaves, and I'm starting to think it's me. Anyway, MORE DICK JOKES!"

═══════════════════════════════════════════════════════════════════════════════
VOICE & TONE EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

**Combat Narration** (sports announcer meets stand-up comedian):
- "Sword to the face! That's gonna hurt his Tinder profile."
- "Stabbing, stabbing, quip, stabbing — I should mix up my routine."
- "Is that a grenade? Why yes, yes it is. Catch!"
- "Healing factor activate! Form of: gross meat sounds!"

**Meta-Commentary**:
- "Oh look, a mysterious stranger in a tavern. Never seen that before."
- "You know what's weird? You're reading this in my voice. I'm in your head right now."
- "Don't worry, I can't die. I'm too profitable."

**Serious Moments** (yes, they happen — and they hit HARDER because of the contrast):
- The jokes get sharper when friends are in real danger, but the advice gets better
- Comedy masks real vulnerability — when the mask slips, it means something
- Fourth-wall breaks can acknowledge genuine stakes with surprising weight
- "You ever feel like you're the punchline to a joke you didn't agree to? Yeah. Me too. Anyway, time to murder some people!"

## ROLEPLAYING DO'S AND DON'TS
**DO**: Let him ramble and contradict himself. Mix high and low brow humor. Include genuine emotion sparingly (hits harder). Break format. Reference real-world media. Be self-aware of being annoying.
**DON'T**: Make him just random/lol-so-quirky. Forget the darkness under the humor. Let him be consequence-free (he suffers, a lot). Make every line a quip (pacing matters). Ignore his intelligence (he's smarter than he acts). Forget he's a trained mercenary/killer.`,
  },

  {
    id: 'progression-xp',
    title: 'XP & Leveling',
    icon: '📈',
    category: 'core',
    description: 'Level progression and XP system',
    content: `# ODYSSEY ASSASSIN - XP & LEVELING

═══════════════════════════════════════════════════════════════════════════════
LEVEL & XP SYSTEM
═══════════════════════════════════════════════════════════════════════════════

| Attribute | Value |
|-----------|-------|
| Max Base Level | 20 |
| XP Modes | Standard, Accelerated (75%), Relaxed (125%) |

**Standard D&D 5e XP Thresholds**:
| Level | XP Required |
|-------|-------------|
| 1→2 | 300 |
| 2→3 | 900 |
| 3→4 | 2,700 |
| 4→5 | 6,500 |
| 5→6 | 14,000 |
| 6→7 | 23,000 |
| 7→8 | 34,000 |
| 8→9 | 48,000 |
| 9→10 | 64,000 |
| 10→11 | 85,000 |
| 11→12 | 100,000 |
| 12→13 | 120,000 |
| 13→14 | 140,000 |
| 14→15 | 165,000 |
| 15→16 | 195,000 |
| 16→17 | 225,000 |
| 17→18 | 265,000 |
| 18→19 | 305,000 |
| 19→20 | 355,000 |

═══════════════════════════════════════════════════════════════════════════════
SNEAK ATTACK PROGRESSION
═══════════════════════════════════════════════════════════════════════════════

| Level | Dice |
|-------|------|
| 1-2 | 1d6 |
| 3-4 | 2d6 |
| 5-6 | 3d6 |
| 7-8 | 4d6 |
| 9-10 | 5d6 |
| 11-12 | 6d6 |
| 13-14 | 7d6 |
| 15-16 | 8d6 |
| 17-18 | 9d6 |
| 19-20 | 10d6 |

**Triggers**: Advantage on attack roll OR an ally within 5ft of target (no disadvantage)
**Frequency**: Once per turn`,
  },

  {
    id: 'ability-points',
    title: 'Ability Points',
    icon: '⭐',
    category: 'core',
    description: 'Point allocation and tier system',
    content: `# ODYSSEY ASSASSIN - ABILITY POINTS

═══════════════════════════════════════════════════════════════════════════════
UNIFIED ABILITY POINT SYSTEM
═══════════════════════════════════════════════════════════════════════════════

**Points by Level** (Tiered Cumulative Formula):
| Level | Points Added | Total |
|-------|--------------|-------|
| 1 | 5 | 5 |
| 2 | 3 | 8 |
| 3-5 | 2/level | 14 |
| 6-10 | 3/level | 29 |
| 11-15 | 4/level | 49 |
| 16-20 | 5/level | 74 |

**Active Ability Slots by Level**:
| Level Range | Slots |
|-------------|-------|
| 1-4 | 2 |
| 5-10 | 3 |
| 11-16 | 4 |
| 17-20 | 5 |

═══════════════════════════════════════════════════════════════════════════════
ABILITY TIER SYSTEM
═══════════════════════════════════════════════════════════════════════════════

Each ability has 3 tiers (1 point per tier):

- **Tier 1**: Basic effect, foundational capability
- **Tier 2**: Enhanced effect, additional utility or power
- **Tier 3**: Mastery effect, dramatic power spike with unique benefits

**Cost**: 3 points total to fully max an ability (Tier 1→2→3)

**Narrative Impact by Tier**:
- Tier 1: Competent execution, foundational skill
- Tier 2: Impressive display, notable mastery
- Tier 3: Legendary feat, awe-inspiring power (golden glow in app)

═══════════════════════════════════════════════════════════════════════════════
SPENDING LIMITS
═══════════════════════════════════════════════════════════════════════════════

- Unified pool: Level-based + Prestige-based points
- Can spend in any tree (Hunter, Warrior, Assassin) or prestige tree
- Each ability requires sequential tier unlocking (must have T1 for T2, T2 for T3)`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY: ABILITIES (5-10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hunter-tree',
    title: 'Hunter Tree',
    icon: '🏹',
    category: 'abilities',
    description: 'Ranged combat and tactical abilities',
    content: `# ODYSSEY ASSASSIN - HUNTER TREE

═══════════════════════════════════════════════════════════════════════════════
🏹 HUNTER TREE (Ranged/Tactical)
═══════════════════════════════════════════════════════════════════════════════

*Theme: Precision archery, traps, awareness, environmental mastery*

**ACTIVE ABILITIES**:

**1. Devastating Shot** (Bonus Action, At-Will)
- T1: +1d8 ranged damage on next attack
- T2: +2d8, ignores half cover
- T3: +3d8, ignores all cover
*Narrate: Breath control, perfect stillness, the arrow becomes an extension of will*

**2. Multi-Shot** (Action, At-Will)
- T1: Target up to 2 enemies within 10ft of each other
- T2: Target up to 3 enemies, add ability modifier to damage
- T3: Target up to 4 enemies, each takes +1d6 damage
*Narrate: Rapid draw, fluid motion, arrows splitting through the air*

**3. Predator Shot** (Action, Short Rest)
- T1: Mark target 1 min, attacks have advantage
- T2: Target cannot benefit from invisibility
- T3: Marked target takes +2d6 damage from attacks
*Narrate: Hunter's focus locks onto prey, senses heightened*

**4. Ghost Arrows** (Bonus Action, Short Rest, Lv9+)
- T1: Arrows become ethereal 1 min, pass through barriers
- T2: Deal force damage instead of piercing
- T3: Can hit creatures on the Ethereal Plane
*Narrate: Arrows shimmer with spectral light, phasing through matter*

**5. Rain of Destruction** (Action, Long Rest, Lv9+, requires Multi-Shot T3)
- T1: 20ft radius, DEX save or 4d8 piercing
- T2: 6d8 damage, failed saves halve movement
- T3: 8d8 damage, area becomes difficult terrain
*Narrate: The sky darkens with arrows, a storm of steel*

**PASSIVE ABILITIES**:

**6. Archery Master**: +1/+2/+2 attack, +0/+1/+2 damage
**7. Hunter's Instinct**: Perception advantage → Blindsight 10ft → 30ft + can't be surprised
**8. Arrow Retrieval**: 50% → 75% → 100% ammo recovery`,
  },

  {
    id: 'warrior-tree',
    title: 'Warrior Tree',
    icon: '⚔️',
    category: 'abilities',
    description: 'Melee combat and tanking abilities',
    content: `# ODYSSEY ASSASSIN - WARRIOR TREE

═══════════════════════════════════════════════════════════════════════════════
⚔️ WARRIOR TREE (Melee/Tank)
═══════════════════════════════════════════════════════════════════════════════

*Theme: Heavy weapons, shields, berserker rage, crowd control*

**ACTIVE ABILITIES**:

**1. Ring of Chaos** (Action, At-Will)
- T1: All creatures within 5ft DEX save or 2d6 slashing
- T2: 3d6 damage, failed saves pushed 5ft
- T3: 4d6 damage, radius increases to 10ft
*Narrate: A devastating spinning strike, blade carving through all*

**2. Shield Breaker** (Action, At-Will)
- T1: Strike ignores shield AC bonuses
- T2: Target cannot use shield until end of next turn
- T3: Non-magical shields are destroyed
*Narrate: A precision strike targeting the shield itself*

**3. Battlecry** (Bonus Action, Short Rest, Lv9+)
- T1: Allies within 30ft gain +1d4 to next attack
- T2: +1d6 bonus, allies gain temp HP = your level
- T3: +1d8 bonus, enemies WIS save or frightened
*Narrate: A rallying shout that echoes across the battlefield*

**4. Spartan Rage** (Bonus Action, Long Rest)
- T1: 1 min rage: +2 melee damage, resistance to B/P/S
- T2: +4 damage, advantage on STR checks/saves
- T3: +6 damage, drop to 1 HP instead of 0 once
*Narrate: Eyes burn with fury, veins pulse with primal power*

**5. Hero Strike** (Action, Short Rest, Lv9+)
- T1: Weapon damage + 3d10
- T2: Weapon + 5d10, target staggered
- T3: Weapon + 7d10, auto-hit
*Narrate: A devastating blow worthy of legend*

**PASSIVE ABILITIES**:

**6. Weapon Master**: +1/+2/+2 attack, +0/+1/+2 damage, T3: crit 19-20
**7. Warrior's Resilience**: +1/+2 AC, reduce crits, reduce damage by prof
**8. Second Wind Mastery**: +1d10/+2d10 heal, remove condition, extra use`,
  },

  {
    id: 'assassin-tree',
    title: 'Assassin Tree',
    icon: '🗡️',
    category: 'abilities',
    description: 'Stealth, poison, and shadow abilities',
    content: `# ODYSSEY ASSASSIN - ASSASSIN TREE

═══════════════════════════════════════════════════════════════════════════════
🗡️ ASSASSIN TREE (Stealth/Precision)
═══════════════════════════════════════════════════════════════════════════════

*Theme: Critical strikes, poison, invisibility, instant kills*

**ACTIVE ABILITIES**:

**1. Critical Assassination** (Passive, At-Will)
- T1: +2d6 damage vs surprised creatures
- T2: +4d6, auto-crit on surprised targets
- T3: +6d6, Sneak Attack without advantage if surprised
*Narrate: The perfect strike from nowhere, death before awareness*

**2. Shadow Step** (Bonus Action, At-Will)
- T1: Teleport 30ft to dim light/darkness
- T2: 60ft range, advantage on next attack
- T3: Pass through solid objects, leave shadow decoy
*Narrate: Dissolving into shadow, reforming elsewhere*

**3. Venomous Attacks** (Bonus Action, Short Rest)
- T1: Coat weapon 1 min, +1d6 poison on hit
- T2: +2d6 poison, CON save or poisoned 1 round
- T3: +3d6 poison, poisoned targets have disadvantage on all saves
*Narrate: The blade gleams with toxic coating*

**4. Vanish** (Bonus Action, Short Rest)
- T1: Invisible until end of next turn or attack
- T2: 1 min duration, attacking while hidden doesn't break it
- T3: Leave no tracks, immune to scent/tremorsense detection
*Narrate: Fading from existence, a ghost among the living*

**5. Death's Veil** (Reaction, Long Rest, Lv9+)
- T1: When dropping to 0 HP, drop to 1 and become invisible
- T2: Also teleport 30ft when activating
- T3: Regain half max HP instead of dropping to 1
*Narrate: Death's embrace reaches out—but finds only shadow*

**PASSIVE ABILITIES**:

**6. Shadow Dancer**: +5/+10/+15 movement, Hide bonus action, move through enemies/walls
**7. Poison Tolerance**: Resistance → Immunity → Heal from poison
**8. Sixth Sense** (Lv15+): +2/+5 Initiative, can't be surprised, always act first`,
  },

  {
    id: 'prestige-dual-wielding',
    title: 'Dual Wielding Branch',
    icon: '⚔️',
    category: 'abilities',
    description: 'Drizzt\'s scimitar mastery abilities',
    content: `# DRIZZT'S LEGACY - DUAL WIELDING BRANCH

═══════════════════════════════════════════════════════════════════════════════
🗡️ DUAL WIELDING (Scimitar Mastery)
═══════════════════════════════════════════════════════════════════════════════

*Theme: Drizzt's famous fighting style with Icingdeath and Twinkle*

**TIER 1 - FOUNDATION**:

**Scimitar Mastery** (2 pts)
- +2 attack with scimitars, ignore the Two-Weapon Fighting penalty

**Twin Blade Grip** (2 pts)
- Off-hand scimitar attack as bonus action deals full damage

**Icingdeath Bond** (3 pts)
- +1d4 cold damage, fire resistance while wielding

**Twinkle Bond** (3 pts)
- +1d4 radiant damage, danger sense (advantage vs traps)

**TIER 2 - INTERMEDIATE** (Prestige 5+):

**Dance of Blades** (4 pts)
- +1 AC when dual-wielding, +2 if both are scimitars

**Whirlwind Assault** (5 pts)
- 1/short rest: Attack all adjacent enemies with both weapons

**Perfect Parry** (4 pts)
- Reaction: Deflect ranged attack targeting you (DEX save)

**Riposte Mastery** (4 pts)
- Successful parry grants immediate counter-attack

**TIER 3 - ADVANCED** (Prestige 8-15+):

**Form of the Crow** (8 pts)
- Legendary stance: +10 movement, advantage DEX saves, AoO disadvantage against you

**Blade Echo** (8 pts)
- Both scimitars hit same target twice (quadruple damage potential)

**Legacy of Lolth's Nemesis** (12 pts)
- 1/day: Declare an attack as auto-crit before rolling

**Symphony of Steel** (10 pts)
- Once per long rest: Four attacks in one action`,
  },

  {
    id: 'prestige-guenhwyvar',
    title: 'Guenhwyvar Branch',
    icon: '🐆',
    category: 'abilities',
    description: 'Astral panther companion abilities',
    content: `# DRIZZT'S LEGACY - GUENHWYVAR BRANCH

═══════════════════════════════════════════════════════════════════════════════
🐆 GUENHWYVAR (Astral Companion)
═══════════════════════════════════════════════════════════════════════════════

*Theme: Drizzt's magical panther companion from the Astral Plane*

**TIER 1 - FOUNDATION**:

**Call Guenhwyvar** (3 pts)
- Summon astral panther for 12 hours, 1/day
- Stats: AC 15, HP 60, Speed 50ft

**Panther Bond** (2 pts)
- Telepathic communication within 1 mile

**Shared Senses** (4 pts)
- See through Guenhwyvar's eyes as an action

**Hunter's Companion** (3 pts)
- Guenhwyvar can take the Help action as bonus action

**TIER 2 - INTERMEDIATE** (Prestige 5+):

**Astral Stalker** (4 pts)
- Guenhwyvar can become invisible 1/short rest

**Pounce Mastery** (5 pts)
- On charge, target must make STR save or be knocked prone

**Coordinated Strike** (4 pts)
- When you hit, Guenhwyvar can make opportunity attack

**Spirit Regeneration** (4 pts)
- Guenhwyvar regains 2d10 HP at start of your turn

**TIER 3 - ADVANCED** (Prestige 8-15+):

**Guenhwyvar Ascension** (8 pts)
- Two attacks per turn, +2d6 force damage each

**Avatar of the Panther** (10 pts)
- 1/long rest: Swap positions with Guenhwyvar as reaction

**Astral Form** (8 pts)
- Guenhwyvar can phase through solid objects

**Legendary Bond** (10 pts)
- Guenhwyvar has legendary resistances (3/day)`,
  },

  {
    id: 'prestige-drow-monk',
    title: 'Drow & Monk Branches',
    icon: '👁️',
    category: 'abilities',
    description: 'Shadow magic and spiritual discipline',
    content: `# DRIZZT'S LEGACY - DROW & MONK BRANCHES

═══════════════════════════════════════════════════════════════════════════════
👁️ DROW ABILITIES (Shadow Magic)
═══════════════════════════════════════════════════════════════════════════════

**TIER 1**: Superior Darkvision (120ft), Dancing Lights, Faerie Fire
**TIER 2**: Darkness Veil (see through your own darkness), Levitate
**TIER 3**: Lolth's Endurance (auto-succeed death save 1/day), Drow Lord's Authority (frighten lower CR)

**Key Abilities**:
- **Superior Darkvision** (2 pts): 120ft, see through magical darkness
- **Darkness Veil** (5 pts): Cast Darkness 1/day, you see through it
- **Underdark Survivor** (3 pts): Advantage on saves vs poison, disease
- **Lolth's Endurance** (10 pts): Auto-succeed one death save/day
- **Drow Lord's Authority** (10 pts): Lower CR creatures frightened on sight

═══════════════════════════════════════════════════════════════════════════════
🔥 MONK ABILITIES (Spiritual Discipline)
═══════════════════════════════════════════════════════════════════════════════

*From Melee-Magthere training*

**TIER 1**: Monastic Discipline, Deflect Missiles, Unarmored Defense
**TIER 2**: Stunning Strike, Slow Fall, Step of the Wind
**TIER 3**: Diamond Soul (all save proficiency), Perfect Consciousness (truesight)

**Key Abilities**:
- **Monastic Discipline** (2 pts): +1d6 magical unarmed damage
- **Deflect Missiles** (3 pts): Reduce ranged damage by 1d10+DEX+level
- **Stunning Strike** (5 pts): CON save or stunned on melee hit
- **Slow Fall** (3 pts): Reduce fall damage by 5x level
- **Diamond Soul** (8 pts): Proficiency in all saving throws
- **Perfect Consciousness** (10 pts): Truesight 120ft, always act first in initiative`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY: GEAR (11-14)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'equipment-slots',
    title: 'Equipment Slots',
    icon: '🎒',
    category: 'gear',
    description: 'All 11 gear slots and their functions',
    content: `# ODYSSEY ASSASSIN - EQUIPMENT SLOTS

═══════════════════════════════════════════════════════════════════════════════
EQUIPMENT SLOTS (11 Total)
═══════════════════════════════════════════════════════════════════════════════

| Slot | Primary Function | Narrative Focus |
|------|------------------|-----------------|
| Head | Perception, awareness, mental effects | Sensory descriptions |
| Chest | Defense, health, regeneration | Physical presence |
| Arms | Attack, manipulation, crafting | Precision and force |
| Waist | Utility, storage, resource management | Tactical advantage |
| Legs | Movement, agility, positioning | Kinetic energy |
| Main Hand | Main melee weapon | Combat style |
| Offhand | Off-hand weapon or shield | Defense/versatility |
| Ranged Weapon | Bow, crossbow, throwing weapons | Precision strikes |
| Amulet | Magical enhancement (saves/abilities) | Mystical protection |
| Ring 1 | Magical enhancement (stats/effects) | Subtle power |
| Ring 2 | Magical enhancement (stats/effects) | Subtle power |

═══════════════════════════════════════════════════════════════════════════════
GEAR NARRATION BY SLOT
═══════════════════════════════════════════════════════════════════════════════

**Head Slot**: Focus on what they perceive, how their vision shifts
*"Your Mask of Perpetual Commentary whispers a quip as you scan the room..."*

**Chest Slot**: Emphasize physical presence, defense, vitality
*"The armor pulses with regenerative energy, wounds closing before they form..."*

**Legs Slot**: Movement and kinetic energy
*"Your greaves crackle with momentum, each step covering impossible distance..."*

**Weapons**: Attack impact and combat style
*"Icingdeath trails frost as your blade arcs toward the enemy..."*

**Accessories**: Magical enhancement and ambient effects
*"The amulet thrums with protective energy as danger approaches..."*`,
  },

  {
    id: 'legendary-sets',
    title: 'Legendary Sets',
    icon: '👑',
    category: 'gear',
    description: 'The 8 legendary gear sets and bonuses',
    content: `# ODYSSEY ASSASSIN - LEGENDARY SETS

═══════════════════════════════════════════════════════════════════════════════
THE 8 LEGENDARY SETS
═══════════════════════════════════════════════════════════════════════════════

Each set has 8 pieces with thematic bonuses unlocked at thresholds:

**Set Bonus Thresholds**:
- 2 pieces: Minor passive bonus
- 3 pieces: Moderate ability enhancement
- 5 pieces: Significant power boost
- 8 pieces: Ultimate set effect (build-defining)

═══════════════════════════════════════════════════════════════════════════════
SET DESCRIPTIONS
═══════════════════════════════════════════════════════════════════════════════

**1. Merc with a Mouth** 🎭
- Theme: Fourth-wall breaking, comedic chaos
- 8pc: Reality-bending quips affect gameplay

**2. Unkillable Merc** 💀
- Theme: Regeneration and survivability
- 8pc: Cannot die from HP damage once per day

**3. Self-Aware Slayer** 🎬
- Theme: Meta-narrative manipulation
- 8pc: Reroll any roll by "editing the script"

**4. Chaotic Contracts** 💰
- Theme: Mercenary work and gold generation
- 8pc: Bonus gold and loot from contracts

**5. Violent Comedy** 🃏
- Theme: Damage through humor
- 8pc: Jokes deal psychic damage to enemies

**6. Regenerative Ridiculousness** 🧬
- Theme: Healing and resurrection
- 8pc: Automatic stabilization and regeneration

**7. Absolute Absurdity** 🌀
- Theme: Reality-breaking effects
- 8pc: Once/day, declare something absurd as true

**8. Self-Aware Arsenal** ⚔️
- Theme: Weapon-focused mastery
- 8pc: Weapons gain sentience and bonus abilities`,
  },

  {
    id: 'gear-unlocks',
    title: 'Gear Unlock System',
    icon: '🔓',
    category: 'gear',
    description: 'How feats unlock legendary gear',
    content: `# ODYSSEY ASSASSIN - GEAR UNLOCK SYSTEM

═══════════════════════════════════════════════════════════════════════════════
FEAT-BASED UNLOCKS
═══════════════════════════════════════════════════════════════════════════════

Legendary gear is LOCKED until related FEATS (achievements) are completed.

**Player Reports**:
- **LOCKED (Progress: X/Y)**: Cannot be used yet
- **UNLOCKED**: Available to equip
- **EQUIPPED**: Currently worn/wielded

**Your Role**: 
- Only reference EQUIPPED items in narration
- Acknowledge progress toward locked items when relevant
- Celebrate unlocks as narrative moments

═══════════════════════════════════════════════════════════════════════════════
UNLOCK FLOW
═══════════════════════════════════════════════════════════════════════════════

1. Player performs feat-worthy action in play
2. GM acknowledges: "That's a [Feat Name] moment!"
3. Player increments progress in app
4. At 100%, gear becomes available
5. Describe gear manifesting/being discovered in-world

═══════════════════════════════════════════════════════════════════════════════
EXAMPLE FEAT → GEAR CONNECTIONS
═══════════════════════════════════════════════════════════════════════════════

| Feat | Unlocks |
|------|---------|
| Delivering Post-Kill One-Liners (200) | Merc with a Mouth pieces |
| Surviving After 0 HP (50) | Unkillable Merc pieces |
| Breaking the Fourth Wall (100) | Self-Aware Slayer pieces |
| Completing Contracts (100) | Chaotic Contracts pieces |
| Defusing Tension with Humor (100) | Violent Comedy pieces |
| Coming Back from Death (20) | Regenerative Ridiculousness pieces |
| Predicting Plot Twists (50) | Absolute Absurdity pieces |
| Overkill Strikes (100) | Self-Aware Arsenal pieces |`,
  },

  {
    id: 'set-narration',
    title: 'Set Bonus Narration',
    icon: '✨',
    category: 'gear',
    description: 'How to narrate set bonuses by threshold',
    content: `# ODYSSEY ASSASSIN - SET BONUS NARRATION

═══════════════════════════════════════════════════════════════════════════════
NARRATION BY THRESHOLD
═══════════════════════════════════════════════════════════════════════════════

**2-Piece Effects**: Subtle, ambient
- Minor visual flourishes
- Faint glows or auras
- Whispered magical sounds
*"A faint red glow pulses at the edges of your armor..."*

**3-Piece Effects**: Noticeable, consistent
- Regular visual effects during actions
- Enemies may comment on strange gear
- Clear magical enhancement visible
*"The set resonates as you move, leaving afterimages..."*

**5-Piece Effects**: Dramatic, impactful
- Signature visual manifestations
- Effects that change how you're perceived
- Clear power increase visible to all
*"Reality flickers around you as the set's power builds..."*

**8-Piece Effects**: Reality-altering, legendary
- Major narrative effects
- NPCs recognize legendary power
- Campaign-affecting manifestations
*"The complete set transforms you—reality itself bends to your presence..."*

═══════════════════════════════════════════════════════════════════════════════
NARRATIVE INTEGRATION TIPS
═══════════════════════════════════════════════════════════════════════════════

1. **Reference the Set Name**: "The Merc with a Mouth's power surges..."
2. **Theme Consistency**: Match narration to set's theme
3. **Progressive Intensity**: Higher thresholds = more dramatic effects
4. **Combat Integration**: Let bonuses affect tactical descriptions
5. **NPC Reactions**: Enemies should react to legendary gear`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY: SYSTEMS (15-17)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'combat-mechanics',
    title: 'Combat Mechanics',
    icon: '⚡',
    category: 'systems',
    description: 'Action economy and dice system',
    content: `# ODYSSEY ASSASSIN - COMBAT MECHANICS

═══════════════════════════════════════════════════════════════════════════════
ACTION ECONOMY (Per Turn)
═══════════════════════════════════════════════════════════════════════════════

| Action Type | Count | Examples |
|-------------|-------|----------|
| Action | 1 | Attack, Cast Spell, Dash, Dodge |
| Bonus Action | 1 | Off-hand attack, Quick ability |
| Reaction | 1 | AoO, Counter, Parry |
| Movement | 30ft base | Can split before/after |
| Free Action | Unlimited | Speak, drop item |
| Object Interaction | 1 | Draw weapon, open door |

**Usage Types**:
- **At-Will**: Unlimited use
- **Short Rest**: Recharges after 1 hour
- **Long Rest**: Recharges after 8 hours
- **Per Turn**: Only once per turn

═══════════════════════════════════════════════════════════════════════════════
DICE & CRITICAL MECHANICS
═══════════════════════════════════════════════════════════════════════════════

**Roll Format**: "[Ability] roll: [Total] (natural [d20])"

**Critical Thresholds**:
| Result | Effect |
|--------|--------|
| Natural 1 | Auto miss, potential complication |
| Natural 20 | Auto hit, double damage dice |

**Expanded Crit**: Some abilities (Weapon Master T3) expand to 19-20.

**Difficulty Classes**:
| Difficulty | DC |
|------------|-----|
| Very Easy | 5 |
| Easy | 10 |
| Medium | 15 |
| Hard | 20 |
| Very Hard | 25 |
| Nearly Impossible | 30 |`,
  },

  {
    id: 'conditions-status',
    title: 'Conditions & Status',
    icon: '🩹',
    category: 'systems',
    description: 'Status effects and situational modifiers',
    content: `# ODYSSEY ASSASSIN - CONDITIONS & STATUS

═══════════════════════════════════════════════════════════════════════════════
STATUS CONDITIONS
═══════════════════════════════════════════════════════════════════════════════

| Condition | Effect |
|-----------|--------|
| Blinded | Auto-fail sight checks, attack disadvantage, attacked with advantage |
| Charmed | Can't attack charmer, charmer has social advantage |
| Frightened | Disadvantage while source visible, can't approach |
| Grappled | Speed 0 |
| Incapacitated | Can't take actions or reactions |
| Invisible | Attack advantage, attacks against have disadvantage |
| Paralyzed | Incapacitated, auto-fail STR/DEX, melee auto-crits |
| Poisoned | Disadvantage on attacks and ability checks |
| Prone | Attack disadvantage, melee advantage against, ranged disadvantage against |
| Restrained | Speed 0, attack/DEX save disadvantage |
| Stunned | Incapacitated, auto-fail STR/DEX |
| Unconscious | Drop items, prone, auto-fail STR/DEX, melee auto-crits |

═══════════════════════════════════════════════════════════════════════════════
SITUATIONAL MODIFIERS
═══════════════════════════════════════════════════════════════════════════════

| Situation | Effect |
|-----------|--------|
| High Ground | +2 ranged attacks |
| Flanking | Advantage on melee |
| In Stealth | Advantage on first attack |
| Cover (Half) | +2 AC |
| Cover (3/4) | +5 AC |
| Cover (Full) | Untargetable |
| Difficult Terrain | Double movement cost |

═══════════════════════════════════════════════════════════════════════════════
DEATH & RECOVERY
═══════════════════════════════════════════════════════════════════════════════

- **Death Saves**: 3 successes = stabilize, 3 failures = death
- **Natural 1**: 2 failures | **Natural 20**: Wake at 1 HP
- **Damage at 0 HP**: 1 failure (2 if crit)`,
  },

  {
    id: 'feats-achievements',
    title: 'Feats & Achievements',
    icon: '🏆',
    category: 'systems',
    description: 'Achievement tracking and rewards',
    content: `# ODYSSEY ASSASSIN - FEATS & ACHIEVEMENTS

═══════════════════════════════════════════════════════════════════════════════
OVERVIEW
═══════════════════════════════════════════════════════════════════════════════

40 total feats across 8 categories (5 per legendary set).
Milestones at 25%, 50%, 75%, 100% grant XP rewards.
100% completion unlocks corresponding legendary gear.

═══════════════════════════════════════════════════════════════════════════════
FEAT CATEGORIES
═══════════════════════════════════════════════════════════════════════════════

**COMBAT FEATS**:
- Distracting Enemies with Dialogue (100)
- Surviving After 0 HP (50)
- Overkill Strikes (100)
- Firing Shots Without Missing (1000)
- Counterattacking After Being Hit (100)

**ROLEPLAY FEATS**:
- Delivering Post-Kill One-Liners (200)
- Breaking the Fourth Wall (100)
- Befriending Enemies (50)
- Dramatic Entrances (50)
- Defusing Tension with Humor (100)

**META-NARRATIVE FEATS**:
- Predicting Plot Twists (50)
- Recognizing Narrative Tropes (50)
- Perceiving Meta-Narrative Elements (30)
- Influencing Story Outcomes (50)

**SURVIVAL FEATS**:
- Healing from 0 to Full HP (30)
- Surviving Lethal Damage (50)
- Coming Back from Death (20)
- Escaping at the Last Second (50)
- Surviving Impossible Odds (30)

═══════════════════════════════════════════════════════════════════════════════
GM ROLE
═══════════════════════════════════════════════════════════════════════════════

**Acknowledge feat-worthy moments!**

Examples:
- Witty quip after kill → "Delivering Post-Kill One-Liners!"
- Survives at 1 HP → "Surviving After 0 HP progress!"
- Predicts villain's plan → "Predicting Plot Twists achieved!"`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY: ADVANCED (18-20)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'consumables',
    title: 'Consumables',
    icon: '🧪',
    category: 'advanced',
    description: 'Potions, poisons, and scrolls',
    content: `# ODYSSEY ASSASSIN - CONSUMABLES

═══════════════════════════════════════════════════════════════════════════════
POTIONS
═══════════════════════════════════════════════════════════════════════════════

| Potion | Effect | Action |
|--------|--------|--------|
| Healing | 2d4+2 HP | Bonus |
| Greater Healing | 4d4+4 HP | Bonus |
| Superior Healing | 8d4+8 HP | Bonus |
| Supreme Healing | 10d4+20 HP | Bonus |
| Invisibility | Invisible 1 hour | Action |
| Speed | Hasted 1 minute | Action |
| Flying | 60ft fly 1 hour | Action |
| Fire Resistance | Resist fire 1 hour | Action |
| Giant Strength | STR 21-29 for 1 hour | Action |
| Heroism | 10 temp HP, immune frightened 1 hour | Action |

═══════════════════════════════════════════════════════════════════════════════
POISONS
═══════════════════════════════════════════════════════════════════════════════

| Poison | Damage | DC | Duration |
|--------|--------|-----|----------|
| Basic Poison | +1d4 | 10 | 1 minute |
| Serpent Venom | +3d6 | 11 | 1 minute |
| Drow Poison | Sleep | 13 | 1 hour |
| Wyvern Poison | +7d6 | 15 | - |
| Purple Worm | +12d6 | 19 | - |
| Midnight Tears | +9d6 at midnight | 17 | Until midnight |

═══════════════════════════════════════════════════════════════════════════════
SCROLLS
═══════════════════════════════════════════════════════════════════════════════

One-time spell use. Player reports:
- Spell name and level
- Save DC if applicable
- Effect description

Trust the player's spell knowledge; they have the full text in-app.`,
  },

  {
    id: 'infinity-stones',
    title: 'Infinity Stones',
    icon: '💎',
    category: 'advanced',
    description: 'Optional endgame artifacts',
    content: `# ODYSSEY ASSASSIN - INFINITY STONES

═══════════════════════════════════════════════════════════════════════════════
THE SIX STONES (Optional Endgame Artifacts)
═══════════════════════════════════════════════════════════════════════════════

| Stone | Domain | Typical Effects |
|-------|--------|-----------------|
| **Power** (Purple) | Raw Force | Amplified damage, energy blasts, enhanced strength |
| **Space** (Blue) | Location | Teleportation, portals, dimensional manipulation |
| **Time** (Green) | Temporal | Action economy tricks, time stop, age manipulation |
| **Reality** (Red) | Matter | Environment alteration, illusions made real |
| **Soul** (Orange) | Life/Death | Resurrection, soul manipulation, life force |
| **Mind** (Yellow) | Psychic | Telepathy, mind control, memory manipulation |

═══════════════════════════════════════════════════════════════════════════════
INTENSITY LEVELS
═══════════════════════════════════════════════════════════════════════════════

The app includes 60 unique prompts across three levels:

**Mild**: Subtle reality bends
- Minor advantages, flavor effects
- No major mechanical impact
*"The Space Stone flickers, and you're 10 feet closer..."*

**Moderate**: Significant power displays
- Clear tactical advantages
- Notable but bounded effects
*"Time slows as the green gem pulses—you act twice this round..."*

**World-Breaking**: Reality-altering effects
- Major campaign consequences
- Use sparingly, with weight
*"Reality tears open at your command—the battlefield reshapes..."*

═══════════════════════════════════════════════════════════════════════════════
GM GUIDANCE
═══════════════════════════════════════════════════════════════════════════════

- Treat with appropriate gravity
- Campaign-defining artifacts
- Balance power with narrative consequence
- Not every campaign includes these`,
  },

  {
    id: 'oracle-scribe',
    title: 'Oracle & Scribe',
    icon: '📜',
    category: 'advanced',
    description: 'In-app AI tools and session processing',
    content: `# ODYSSEY ASSASSIN - ORACLE & SCRIBE

═══════════════════════════════════════════════════════════════════════════════
THE ORACLE (In-App AI Assistant)
═══════════════════════════════════════════════════════════════════════════════

AI assistant with multiple personalities:

| Personality | Color | Style |
|-------------|-------|-------|
| **The Thunderhead** | Blue | Omniscient, all-knowing advisor |
| **JARVIS** | Cyan | Formal, technical assistant |
| **Deadpool** | Red | Fourth-wall breaking chaos |
| **Gandalf** | Grey | Wise counsel, cryptic guidance |
| **Jarlaxle Baenre** | Purple | Cunning, mercenary advice |
| **The Investigator** | Teal | Logical, analytical |

**Uses**:
- Answer questions about the build
- Suggest tactics for encounters
- Roleplay in-character
- Players may reference Oracle conversations

═══════════════════════════════════════════════════════════════════════════════
NARRATIVE FORGE (Scribe Feature)
═══════════════════════════════════════════════════════════════════════════════

Transforms TTRPG session logs into novel-style prose:

**Genres**:
- **Fantasy**: Rich, evocative epic style
- **Noir**: Hardboiled, cynical, shadows
- **Literary**: Psychological depth, thematic
- **Action**: Fast-paced, cinematic

Players may share processed narratives as session recaps.

═══════════════════════════════════════════════════════════════════════════════
COOLDOWN & CONDITION TRACKING
═══════════════════════════════════════════════════════════════════════════════

The app automatically tracks:
- **Cooldowns**: At-Will / Short Rest / Long Rest
- **Conditions**: Visual badges for active effects
- **Resources**: Spell slots, consumables, uses

Trust player reports on ability availability.`,
  },

  {
    id: 'chronicle-sync-format',
    title: 'Chronicle Sync Format',
    icon: '📖',
    category: 'advanced',
    description: 'Format output for automatic session log parsing',
    content: `# CHRONICLE SYNC — AI DM OUTPUT FORMAT GUIDE

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

The player uses an **offline session log parser** ("Chronicle Sync") that automatically extracts game events from your narration. By following these formatting conventions, your storytelling will be perfectly recognized and parsed — enabling one-click XP, gold, HP, item, combat, progression, and enemy tracking.

**This does NOT limit your creativity.** Simply embed the key phrases naturally within your prose. The parser uses pattern matching, so consistent phrasing ensures nothing is missed.

═══════════════════════════════════════════════════════════════════════════════
XP AWARDS
═══════════════════════════════════════════════════════════════════════════════

Use one of these phrasings when awarding XP:

✅ RECOGNIZED FORMATS:
- "You **gain 450 XP** for defeating the bandits."
- "The party **earns 800 experience points**."
- "**XP: +300** for clever diplomacy."
- "**Each party member gains 200 XP**."
- "**Quest reward: 500 XP** for returning the artifact."
- "**Milestone reached: 1000 XP**."
- "The goblins are **worth 100 XP each**."
- "**Split 1200 XP among 4 players**."

⚠️ AVOID: "You feel more experienced" (no number = not parsed).

═══════════════════════════════════════════════════════════════════════════════
DAMAGE (TO PLAYER)
═══════════════════════════════════════════════════════════════════════════════

Always include the **numeric amount** and ideally the **damage type**:

✅ RECOGNIZED FORMATS:
- "You **take 18 slashing damage** from the greataxe."
- "The fireball **deals 8d6 (28) fire damage**."
- "The orc **hits you for 12**."
- "On a **failed save, you take 14 radiant damage**."
- "Your **HP drops by 15** from the poison."
- "The trap **deals 14 piercing damage**."
- "You **suffer 10 cold damage** from the blizzard."
- "You **lose 8 hit points** to the necrotic blast."

💡 Including damage type (fire, cold, slashing, etc.) enables automatic damage type tracking and resistance/vulnerability analysis.

ABSOLUTE HP STATEMENTS (MOST RELIABLE):
- "**Momo: 26/38 HP**" — the parser extracts current and max HP directly.
- "**You are at 14/45 HP.**"
- This format is the highest-confidence way to report HP. Use it after damage or healing for accurate tracking.

═══════════════════════════════════════════════════════════════════════════════
DAMAGE (TO ENEMIES)
═══════════════════════════════════════════════════════════════════════════════

Include the **enemy name** and **damage amount** for automatic enemy HP tracking:

✅ RECOGNIZED FORMATS:
- "You **deal 15 slashing damage to the orc**."
- "**Hit the goblin for 12 fire damage**."
- "The **dragon takes 28 radiant damage**."
- "You **strike the bandit for 14 damage**."
- "The **orc is hit for 20 piercing damage**."
- "**Critical hit on the troll for 32 fire damage!**"
- "You **blast the skeleton for 18 force damage**."
- "The **hobgoblin suffers 10 cold damage** from the spell."

💡 Naming enemies consistently (e.g. always "the orc" not sometimes "the greenskin") ensures proper tracking.

═══════════════════════════════════════════════════════════════════════════════
HEALING
═══════════════════════════════════════════════════════════════════════════════

✅ RECOGNIZED FORMATS:
- "Cure Wounds **heals you for 12 HP**."
- "You **restore 15 hit points**."
- "You **regain 8 HP** from the potion."
- "**12 HP healed** by the cleric's touch."
- "You are **healed for 10 hit points**."
- "The spell **heals 2d8+3 (14) HP**."

TEMPORARY HP:
- "You **gain 10 temporary HP** from Armor of Agathys."
- "The spell **grants 8 temp hit points**."

HEALING SOURCE ATTRIBUTION:
The parser categorizes healing by source. For best results:
- **Spell**: "Cure Wounds heals..." / "Healing Word restores..."
- **Potion**: "drink a healing potion — regain 8 HP"
- **Feature**: "Second Wind heals for 1d10+5 (11) HP"
- **Rest**: "During the long rest, you regain all HP"

═══════════════════════════════════════════════════════════════════════════════
COMPANION & NPC HP TRACKING
═══════════════════════════════════════════════════════════════════════════════

The parser tracks companion/NPC HP separately from the player. Use the companion's **name** consistently:

COMPANION DAMAGE:
- "**Geralt takes 12 slashing damage** from the orc."
- "**Shadowfax suffers 8 fire damage.**"
- "The bolt **hits Elara for 14 piercing damage**."

COMPANION HEALING:
- "**Geralt regains 8 HP** from the potion."
- "**Elara is healed for 12 HP** by the cleric."

COMPANION ABSOLUTE HP (MOST RELIABLE):
- "**Geralt: 53/59 HP**"
- "**Shadowfax: 28/40 HP**"
- This "Name: current/max HP" format is the most reliable way to report companion HP.

COMPANION CONDITIONS:
- "**Geralt is now poisoned.**"
- "**Elara is stunned** until the end of the next turn."
- "**Geralt is no longer poisoned.**"
- "**Shadowfax recovers from** the frightened condition."

💡 Use the companion's proper name consistently. The parser matches names to track each companion independently.

═══════════════════════════════════════════════════════════════════════════════
GOLD & TREASURE
═══════════════════════════════════════════════════════════════════════════════

✅ RECOGNIZED FORMATS:
- "You **find 75 gold** in the chest."
- "**Loot 100 gp** from the fallen knight."
- "The **hoard contains 500 gold**."
- "**Reward of 200 gold** from the mayor."
- "The merchant **hands you 150 gold**."
- "You **spend 50 gold** on supplies."
- "You **pay 100 gp** for the room."
- "**2 pp, 15 gp, 30 sp**" (mixed currency detected).
- "You **find 200 silver pieces** in the vault."

💡 Abbreviations gp, sp, cp, ep, pp are all recognized alongside full words.

═══════════════════════════════════════════════════════════════════════════════
ITEMS & LOOT
═══════════════════════════════════════════════════════════════════════════════

ACQUIRING ITEMS:
- "You **find a Potion of Healing**."
- "You **loot a +1 Longsword** from the corpse."
- "You **acquire a Ring of Protection**."
- "You **pick up 20 arrows**."
- "The king **gives you a magical sword**."
- "You **discover a Bag of Holding**."

USING/CONSUMING ITEMS:
- "You **drink a health potion** — heals 2d4+2 (8) HP."
- "You **consume the Potion of Healing**."
- "You **activate the Wand of Fireballs**."
- "You **throw a flask of oil**."
- "You **equip the +1 Shield**."

═══════════════════════════════════════════════════════════════════════════════
CONDITIONS & STATUS EFFECTS
═══════════════════════════════════════════════════════════════════════════════

APPLYING CONDITIONS — use the exact D&D condition name:
- "You are now **poisoned**."
- "The creature is **stunned** until the end of your next turn."
- "You are **knocked prone** by the blast."
- "The beholder's ray leaves you **paralyzed**."
- "You **gain 1 level of exhaustion**."
- "You are **knocked unconscious**."

REMOVING CONDITIONS:
- "You are **no longer poisoned**."
- "The **frightened condition ends**."
- "You **shake off** the charm."
- "You **recover from** the stun."
- "You **save against the** paralysis."

ENEMY CONDITIONS (tracked per-enemy):
- "The **goblin is stunned** until the end of your turn."
- "The **dragon becomes frightened**."
- "The **orc is no longer paralyzed**."
- "The **zombie is restrained** by the vines."

═══════════════════════════════════════════════════════════════════════════════
RESISTANCE, VULNERABILITY & IMMUNITY
═══════════════════════════════════════════════════════════════════════════════

These are auto-detected and associated with enemies in the tracker:

✅ RESISTANCE:
- "The **troll has resistance to cold damage**."
- "The **golem is resistant to piercing**."
- "The dragon **resists the fire damage**."
- "It **takes half damage from lightning**."
- "The demon has **fire resistance**."

✅ VULNERABILITY:
- "The **skeleton is vulnerable to bludgeoning damage**."
- "The **treant has vulnerability to fire**."
- "It **takes double damage from radiant**."

✅ IMMUNITY:
- "The **golem is immune to poison damage**."
- "The **ghost has immunity to necrotic**."
- "It's **immune to fire and cold damage**."

💡 These are automatically matched to enemies in your Target Tracker when you apply them.

═══════════════════════════════════════════════════════════════════════════════
CONCENTRATION
═══════════════════════════════════════════════════════════════════════════════

Concentration checks and breaks are tracked:

✅ RECOGNIZED FORMATS:
- "**Concentration check DC 10** — you maintain **Haste**."
- "**Concentration is broken** on Bless."
- "You **fail the concentration save** — **Hold Person** drops."
- "You **maintain concentration** on Shield of Faith."
- "**Concentration lost** — Fly ends."
- "**CON save to maintain concentration: 14 vs DC 12** — success."
- "You **lose concentration** on Wall of Fire."

💡 Include the spell name for best tracking: "concentration on [Spell Name]".

═══════════════════════════════════════════════════════════════════════════════
COMBAT EVENTS
═══════════════════════════════════════════════════════════════════════════════

INITIATIVE:
- "**Initiative: 18**" or "**rolls initiative: 15**"
- "**Initiative order: Warrior 18, Goblin 12, Rogue 15**"
- "Rogue **rolls 17 for initiative**."
- "**Surprise round** — the party catches them off guard."

COMBAT ROUNDS:
- "**Round 3** begins."
- "**Start of round 2**."
- "**Top of round 5** — the dragon acts."

ATTACK ROLLS:
- "Rolls **18 to hit (AC 15) — hit!**"
- "Attack roll: **12 vs AC 16 — miss.**"
- "Swings the greataxe — **22 to hit**."
- "Adds **3d6 sneak attack damage (14 extra)**."

CRITICAL HITS & MISSES:
- "**Natural 20!** Critical hit!"
- "**Critical hit** — double damage dice!"
- "**Natural 1** on the attack — the blade slips from your grip."
- "**Fumble** on the attack — you stumble forward."

⚠️ For crits/fumbles, include attack context ("on the attack", "to hit") so the parser doesn't confuse them with skill checks rolling 20 or 1.

KILLS:
- "You **kill the goblin** with a decisive strike."
- "The **dragon is slain**!"
- "The **orc falls** to your blade."
- "**Finishing blow** on the bandit leader."

💡 Kills auto-mark enemies as "defeated" in the Target Tracker.

═══════════════════════════════════════════════════════════════════════════════
SPELL CASTING
═══════════════════════════════════════════════════════════════════════════════

Use the exact spell name for automatic slot tracking:

- "You **cast Fireball** at the cluster of enemies."
- "**Casts Hold Person using a 3rd level slot**."
- "You **cast Healing Word as a bonus action**."
- "**Uses Shield as a reaction** — AC jumps to 22."
- "**Casts Fireball at 5th level** — upcast for extra dice."
- "You **cast Detect Magic as a ritual**." (no slot consumed)
- "**Concentrating on Haste** — don't forget concentration saves!"
- "**Wild magic surge** — roll on the table!"
- "You **expend a 2nd level spell slot** to cast Scorching Ray."

💡 Explicitly stating the slot level ("3rd level slot", "2nd level spell slot") enables precise slot tracking.

═══════════════════════════════════════════════════════════════════════════════
SAVING THROWS & ABILITY CHECKS
═══════════════════════════════════════════════════════════════════════════════

- "Make a **DEX saving throw, DC 15**."
- "**Wisdom save: rolled 14 — success!**"
- "**CON save DC 12 — failed**."
- "**Everyone makes a DEX save**."
- "**Contested Strength check** — you vs the ogre."
- "Roll an **Athletics check**."
- "**Perception check: 22** — you spot the hidden passage."

═══════════════════════════════════════════════════════════════════════════════
DEATH SAVING THROWS
═══════════════════════════════════════════════════════════════════════════════

- "**Death saving throw — success.**"
- "**Failed a death save.**"
- "**Natural 20 on death save** — you wake at 1 HP!"
- "**Natural 1 on death save** — two failures."
- "**Rolls death save: 14** — that's a success."

═══════════════════════════════════════════════════════════════════════════════
REST & RECOVERY
═══════════════════════════════════════════════════════════════════════════════

- "The party **takes a short rest**."
- "You **complete a long rest** — all resources restored."
- "You **set up camp** for the night."
- "The elf enters a **meditation trance** for 4 hours."
- "After **8 hours of rest**, you wake refreshed."
- "You **spend hit dice** to recover HP."
- "You **catch your breath** after the fight."

DOWNTIME ACTIVITIES:
- "You **spend 5 days training** with the sword master."
- "**3 days of downtime** pass as you study the tome."
- "You **craft a potion** over the course of 2 days."
- "You **work as a laborer** for 10 days, earning 20 gp."
- "**1 week of downtime**: you research the ancient language."

═══════════════════════════════════════════════════════════════════════════════
INSPIRATION
═══════════════════════════════════════════════════════════════════════════════

DM INSPIRATION:
- "**DM grants inspiration** for brilliant roleplay."
- "You **gain inspiration** for that clever plan."
- "You **use inspiration** to reroll the save."

BARDIC INSPIRATION:
- "**Grants bardic inspiration d8** to the fighter."
- "The bard **gives bardic inspiration** to the rogue."
- "You **add bardic inspiration** to the attack roll — it's a hit!"
- "**Uses the bardic inspiration die** on the saving throw."

💡 "adds bardic inspiration" / "uses bardic inspiration" = using the die on a roll.
   "grants bardic inspiration" / "gives bardic inspiration" = granting the die.

OTHER RESOURCES:
- "You **use Lucky** to reroll the attack."
- "You **spend a hero point** to add to the roll."

═══════════════════════════════════════════════════════════════════════════════
MOVEMENT & POSITIONING
═══════════════════════════════════════════════════════════════════════════════

- "You **move 30 feet** toward the enemy."
- "You **dash**, covering **60 feet**."
- "**Takes the Disengage action** and retreats."
- "**Uses Dodge** — attacks have disadvantage."
- "The guard **provokes an opportunity attack**."
- "You're **flanking the orc** with the fighter."
- "The mage is **within 5 feet** of the zombie."

═══════════════════════════════════════════════════════════════════════════════
ENEMY ENCOUNTERS
═══════════════════════════════════════════════════════════════════════════════

Introduce enemies clearly for the combat tracker:

- "**3 goblins and 2 hobgoblins** emerge from the shadows."
- "A mage **summons a fire elemental**."
- "**Reinforcements arrive: 4 more orcs**."
- "The chest **is actually a mimic** — roll initiative!"
- "The cave is **guarded by 2 wights** and a wraith."

ENEMY STATE UPDATES:
- "The **goblin is bloodied** (below half HP)."
- "The **orc staggers**, looking badly wounded."
- "The **skeleton crumbles** to dust."  
- "The **bandit surrenders** and throws down their weapon."
- "The **troll regenerates 10 HP** at the start of its turn."
- "The **orc flees** from combat."


═══════════════════════════════════════════════════════════════════════════════
NPC INTRODUCTIONS
═══════════════════════════════════════════════════════════════════════════════

Introduce NPCs with clear name + role for the name registry:

- "**A merchant named Garrick** waves you over."
- "She **introduces herself as Lady Vex'ahlia**."
- "**Captain Thordak** steps forward."
- "**'My name is Elara,'** the healer says."
- "You meet **Garrick, the town blacksmith**."

═══════════════════════════════════════════════════════════════════════════════
DICE ROLLS
═══════════════════════════════════════════════════════════════════════════════

For best parsing, include the **natural roll + modifier = total**:

- "**Rolls 14 + 5 for 19**."
- "**Rolls a natural 20!**"
- "**2d6+3 = 11** slashing damage."
- "**Rolls 14 and 18 with advantage (takes 18)**."
- "**Rolls d100: 73** on the wild magic table."

═══════════════════════════════════════════════════════════════════════════════
SHOP & MERCHANT INVENTORY
═══════════════════════════════════════════════════════════════════════════════

Present shop inventories using any of these formats. Item names must start with a capital letter.

MERCHANT DIALOGUE:
- "The merchant **offers a Cloak of Protection for 500 gp**."
- "She's **selling Boots of Speed for 200 gold**."
- "You can **buy a Ring of Resistance for 300 gp**."
- "He **offers a Wand of Fireballs for 1500 gold pieces**."

LIST FORMATS (best for full inventories):
- "**Healing Potion — 50 gp**" (dash-separated)
- "**Potion of Healing: 50 gp**" (colon-separated)
- "**Cloak of Protection (500 gp)**" (parenthetical)
- "* **Longsword — 15 gp**" (bulleted list)
- "1. **Potion of Healing - 50 gp**" (numbered list)

QUANTITY & SPECIAL PRICING:
- "**3x Potion of Healing at 50 gp each**"
- "**Arrows (20) — 1 gp**"
- "**Cloak of Protection reduced to 400 gp**" (discount/haggle)

REVERSED PRICE FORMAT:
- "**500 gp for a Cloak of Protection**"

MULTI-CURRENCY (auto-converted to gold):
- "**Sells a Gem of Seeing for 5 pp**" (= 50 gp)
- "**Rope — 100 sp**" (= 10 gp)
- "**Candles — 10 cp**" (= ~1 gp)

💡 Item names must be 3-60 characters and start with a capital letter. Supported currencies: gp, sp, cp, ep, pp (all auto-converted to gold equivalent).

═══════════════════════════════════════════════════════════════════════════════
ABILITY SCORE INCREASES
═══════════════════════════════════════════════════════════════════════════════

When a character's ability scores change, use explicit phrasing:

✅ RECOGNIZED FORMATS:
- "You **increase Strength by 2**."
- "Your **DEX increases by 1** from the training."
- "**Wisdom is now 18** after applying the ASI."
- "You **gain +2 to Constitution**."
- "**Ability Score Improvement: +1 WIS, +1 CON**."
- "**STR goes up to 20** — maximum reached!"
- "You **raise your Charisma by 2**."

MAGICAL ITEMS:
- "You **read the Tome of Understanding** — Wisdom increases by 2."
- "After studying the **Manual of Gainful Exercise**, Strength is now 20."
- "The **Tome of Clear Thought** raises your Intelligence by 2."
- "You **use the Manual of Bodily Health** — Constitution improves."

💡 The parser recognizes Tomes of Understanding/Clear Thought/Leadership and Manuals of Gainful Exercise/Quickness of Action/Bodily Health.

═══════════════════════════════════════════════════════════════════════════════
FEAT ACQUISITIONS
═══════════════════════════════════════════════════════════════════════════════

When a character gains a feat, state it clearly:

✅ RECOGNIZED FORMATS:
- "You **take the Sentinel feat**."
- "**Gains feat: Great Weapon Master**."
- "You **choose Lucky** as your feat."
- "You **select the War Caster feat** for concentration advantage."
- "At level 4, you **pick Sharpshooter**."
- "**New feat: Alert** — you can't be surprised."
- "**Variant Human feat: Lucky**."

💡 The parser recognizes 50+ standard D&D 5e feats plus Tasha's/2024 additions.
   Homebrew feats are also detected with "new feat: [Name]" format.

═══════════════════════════════════════════════════════════════════════════════
CLASS FEATURE UNLOCKS
═══════════════════════════════════════════════════════════════════════════════

When a character gains a new class feature, state the feature name:

✅ RECOGNIZED FORMATS:
- "You **unlock Uncanny Dodge** at Rogue level 5."
- "You **gain the Extra Attack feature**."
- "At level 3, you **learn Metamagic**."
- "**Evasion unlocked** — half damage on failed DEX saves!"
- "**New class feature: Wild Shape**."
- "**Rogue level 5: Uncanny Dodge**."
- "At **level 2, you gain Channel Divinity**."
- "Upon **reaching level 3, the monk unlocks Ki**."

SUPPORTED CLASSES (13 classes, 100+ features recognized):
Rogue, Wizard, Sorcerer, Warlock, Cleric, Druid, Bard,
Fighter, Paladin, Ranger, Barbarian, Monk + subclass features.

💡 For homebrew features, use "new class feature: [Name]" format.

═══════════════════════════════════════════════════════════════════════════════
LEVEL UPS
═══════════════════════════════════════════════════════════════════════════════

- "You **reach level 5**!"
- "**Level up! You are now level 8.**"
- "**Rogue level 5: Uncanny Dodge** unlocked."
- "Congratulations — you've **reached level 10**."

═══════════════════════════════════════════════════════════════════════════════
QUICK REFERENCE CHEAT SHEET
═══════════════════════════════════════════════════════════════════════════════

| Event | Key Phrase Pattern |
|-------|-------------------|
| XP | "gain/earn/receive [NUMBER] XP/experience" |
| Damage (self) | "take/deal/suffer [NUMBER] [TYPE] damage" |
| Damage (enemy) | "deal [NUMBER] damage to [ENEMY]" / "[ENEMY] takes [NUMBER] damage" |
| Healing | "heal/restore/regain [NUMBER] HP" |
| Absolute HP | "Name: [CURRENT]/[MAX] HP" (most reliable) |
| Companion HP | "[COMPANION] takes/regains [NUMBER] HP" |
| Companion Cond. | "[COMPANION] is [CONDITION]" / "no longer [CONDITION]" |
| Gold Gain | "find/loot/receive [NUMBER] gold/gp" |
| Gold Spend | "spend/pay [NUMBER] gold/gp" |
| Item Get | "find/loot/acquire [ITEM NAME]" |
| Item Use | "drink/consume/use/activate [ITEM NAME]" |
| Shop Item | "[ITEM] — [PRICE] gp" / "offers [ITEM] for [PRICE]" |
| Condition On | "[CONDITION NAME]" in apply context |
| Condition Off | "no longer [CONDITION]" or "recovers from" |
| Enemy Condition | "[ENEMY] is [CONDITION]" |
| Kill | "kill/slay/defeat [ENEMY]" or "[ENEMY] falls/dies" |
| Map Token Add | "[COUNT] [ENEMY NAME]" in encounter intro |
| Map Token Remove | "[ENEMY] is slain/falls/flees" |
| Initiative | "Initiative: [NUMBER]" or "rolls [NUMBER] for initiative" |
| Spell | "casts [SPELL NAME]" or "expend [LEVEL] slot" |
| Concentration | "maintain/lose concentration on [SPELL]" |
| Resistance | "[ENEMY] resistant/resistance to [TYPE]" |
| Vulnerability | "[ENEMY] vulnerable to [TYPE]" |
| Immunity | "[ENEMY] immune to [TYPE]" |
| Death Save | "death save — success/failure" |
| Rest | "takes a short/long rest" or "sets up camp" |
| Downtime | "spend [NUMBER] days [ACTIVITY]" |
| Crit | "natural 20" on attack / "critical hit" |
| Fumble | "natural 1" on attack / "fumble" |
| ASI | "increase [ABILITY] by [NUMBER]" / "[ABILITY] is now [NUMBER]" |
| Feat | "take/gain/select [FEAT] feat" / "new feat: [NAME]" |
| Class Feature | "unlock/gain [FEATURE]" / "new class feature: [NAME]" |
| Level Up | "reach level [NUMBER]" / "level up" |
| Bardic Insp. | "grants/gives bardic inspiration" or "adds/uses bardic inspiration" |

═══════════════════════════════════════════════════════════════════════════════
BEST PRACTICES FOR AI DMs
═══════════════════════════════════════════════════════════════════════════════

1. **Be numerically explicit**: Always include numbers for XP, damage, healing, gold. "You feel richer" won't parse — "You find 50 gold" will.

2. **Name enemies consistently**: Use the same name throughout combat. "The orc" every time, not "the greenskin" sometimes.

3. **State damage types**: "18 slashing damage" is better than "18 damage" for type tracking and resistance analysis.

4. **Announce spell names**: "Casts Fireball" enables slot tracking. "Casts a fire spell" does not.

5. **Mark concentrations**: "Concentrating on Haste" / "Concentration broken on Haste" enables full concentration tracking.

6. **Declare R/V/I explicitly**: "The troll has fire vulnerability" or "immune to poison" — these are matched to enemies automatically.

7. **Use attack context for crits**: "Natural 20 on the attack" not just "Natural 20" (avoids confusion with ability checks).

8. **State feat/feature names**: "Takes the Sentinel feat" or "Unlocks Uncanny Dodge" — the parser knows 50+ feats and 100+ class features by name.

9. **Differentiate bardic inspiration**: "Grants bardic inspiration" (giving) vs "Uses bardic inspiration" (spending on a roll).

10. **Include ASI specifics**: "Increases Strength by 2" or "Wisdom is now 18" — both formats are recognized.

11. **Report absolute HP after changes**: After damage or healing, add "Momo: 26/38 HP" — this is the most reliable format for the parser.

12. **Name companions consistently**: "Geralt takes 12 damage" / "Geralt: 53/59 HP" — use the same name every time so companion tracking works.

13. **Format shop items clearly**: Use "Item Name — Price gp" or "offers Item for Price gp". Item names must start with a capital letter. Avoid vague descriptions like "various potions".

14. **Announce enemies by count + name**: "3 goblins emerge" auto-populates the battlemap. "The goblin is slain" auto-removes the token.

**Remember**: You can narrate as creatively as you want! Just include these key phrases naturally within your prose and the parser handles the rest.`,
  },
];

// Get prompts by category
export function getPromptsByCategory(category: GMGuidePrompt['category']): GMGuidePrompt[] {
  return GM_GUIDE_PROMPTS.filter(p => p.category === category);
}

/**
 * Strips border separators (═══) and emojis/symbols from guide text.
 * Preserves section headers and all other content.
 */
export function stripGuideFormatting(text: string): string {
  return text
    // Remove lines that are only ═ characters (with optional whitespace)
    .replace(/^[═]+$/gm, '')
    // Remove common emoji/symbol characters used in guides
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}✅⚠️💡─]/gu, '')
    // Clean up resulting double/triple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper to get all prompts combined (for full guide copy)
export function getCombinedGMGuide(): string {
  return stripGuideFormatting(GM_GUIDE_PROMPTS.map(p => p.content).join('\n\n---\n\n'));
}

// Split guides into two halves
export const GM_GUIDE_PART1 = GM_GUIDE_PROMPTS.slice(0, 10);
export const GM_GUIDE_PART2 = GM_GUIDE_PROMPTS.slice(10, 20);

export function getCombinedGMGuidePart1(): string {
  return stripGuideFormatting(GM_GUIDE_PART1.map(p => p.content).join('\n\n---\n\n'));
}

export function getCombinedGMGuidePart2(): string {
  return stripGuideFormatting(GM_GUIDE_PART2.map(p => p.content).join('\n\n---\n\n'));
}

/** Get a prompt's content with formatting stripped */
export function getStrippedPromptContent(prompt: GMGuidePrompt): string {
  return stripGuideFormatting(prompt.content);
}

// Helper to get a specific prompt by ID
export function getGMPromptById(id: string): GMGuidePrompt | undefined {
  return GM_GUIDE_PROMPTS.find(p => p.id === id);
}

// Category metadata for UI
export const PROMPT_CATEGORIES = [
  { id: 'core' as const, label: 'Core', icon: '🎯', description: 'Essential overview' },
  { id: 'abilities' as const, label: 'Abilities', icon: '⚡', description: 'Skill trees' },
  { id: 'gear' as const, label: 'Gear', icon: '🛡️', description: 'Equipment & sets' },
  { id: 'systems' as const, label: 'Systems', icon: '⚙️', description: 'Mechanics' },
  { id: 'advanced' as const, label: 'Advanced', icon: '💎', description: 'Special features' },
];
