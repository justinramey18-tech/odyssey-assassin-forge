// D&D 5e Reactions Configuration
// Organized by category for intuitive combat flow
import { applyTimePrefix } from '../fourthWallTime';

export type ReactionCategory = 
  | 'defensive' 
  | 'offensive' 
  | 'movement' 
  | 'utility' 
  | 'class_features' 
  | 'custom';

export interface Reaction {
  id: string;
  name: string;
  category: ReactionCategory;
  trigger: string;
  effect: string;
  source: string;
  isEnabled: boolean;
  isCustom?: boolean;
  prerequisite?: string;
  dmPrompt: string;
}

// Category metadata for UI
export const REACTION_CATEGORIES: Record<ReactionCategory, { 
  label: string; 
  icon: string; 
  color: string;
  description: string;
}> = {
  defensive: {
    label: 'Defensive',
    icon: 'Shield',
    color: 'cyan',
    description: 'Protect yourself or allies',
  },
  offensive: {
    label: 'Offensive',
    icon: 'Sword',
    color: 'red',
    description: 'Strike when enemies let their guard down',
  },
  movement: {
    label: 'Movement',
    icon: 'Footprints',
    color: 'green',
    description: 'Reposition in response to threats',
  },
  utility: {
    label: 'Utility',
    icon: 'Sparkles',
    color: 'amber',
    description: 'Tactical options and special effects',
  },
  class_features: {
    label: 'Class Features',
    icon: 'Star',
    color: 'purple',
    description: 'Rogue and assassin class abilities',
  },
  custom: {
    label: 'Custom',
    icon: 'Plus',
    color: 'slate',
    description: 'Your custom reactions',
  },
};

// Default D&D 5e reactions organized by category
export const DEFAULT_REACTIONS: Reaction[] = [
  // ===== OFFENSIVE REACTIONS =====
  {
    id: 'opportunity_attack',
    name: 'Opportunity Attack',
    category: 'offensive',
    trigger: 'A hostile creature you can see moves out of your reach',
    effect: 'Make one melee attack against the provoking creature. The attack interrupts their movement.',
    source: 'Core Rules',
    isEnabled: true,
    dmPrompt: `## ⚔️ OPPORTUNITY ATTACK

**Trigger:** Enemy moves out of melee reach without disengaging

The assassin's blade flashes out, punishing the foolish creature for turning its back.

### Mechanics
- Make one melee weapon attack
- Uses your reaction for this round
- Attack interrupts the creature's movement
- Sneak Attack applies if conditions are met

### Narration Hooks
- Describe the swift, instinctive strike
- How does the target react to being caught off-guard?
- Does this change the flow of combat?`,
  },
  {
    id: 'sentinel_attack',
    name: 'Sentinel Attack',
    category: 'offensive',
    trigger: 'A creature within 5 feet attacks a target other than you',
    effect: 'Make a melee weapon attack against the attacking creature. Requires Sentinel feat.',
    source: 'Sentinel Feat',
    isEnabled: false,
    prerequisite: 'Sentinel feat',
    dmPrompt: `## 🛡️ SENTINEL ATTACK

**Trigger:** Enemy attacks an ally within 5 feet

The assassin punishes the creature for daring to ignore them.

### Mechanics
- Make one melee weapon attack
- If hit, creature's speed drops to 0 for this turn
- Sneak Attack applies if conditions are met

### Narration Hooks
- Describe protecting your ally
- The creature's surprise at being intercepted`,
  },
  {
    id: 'riposte',
    name: 'Riposte',
    category: 'offensive',
    trigger: 'A creature misses you with a melee attack',
    effect: 'Spend 1 superiority die to make a melee attack. On hit, add superiority die to damage.',
    source: 'Battle Master',
    isEnabled: false,
    prerequisite: 'Battle Master subclass',
    dmPrompt: `## 🗡️ RIPOSTE

**Trigger:** Enemy misses with melee attack

The assassin turns the enemy's failure into their own opportunity.

### Mechanics
- Spend 1 superiority die
- Make a melee weapon attack
- On hit: Add superiority die to damage
- Sneak Attack applies if conditions are met

### Narration Hooks
- Describe the fluid counter-attack
- The enemy's overextension creates the opening`,
  },

  // ===== DEFENSIVE REACTIONS =====
  {
    id: 'uncanny_dodge',
    name: 'Uncanny Dodge',
    category: 'defensive',
    trigger: 'An attacker you can see hits you with an attack',
    effect: 'Halve the attack\'s damage against you.',
    source: 'Rogue 5th Level',
    isEnabled: true,
    dmPrompt: `## 🎯 UNCANNY DODGE

**Trigger:** Hit by an attack from a visible attacker

With preternatural reflexes, the assassin twists at the last moment, reducing the blow's impact.

### Mechanics
- Halve the damage from one attack
- Must be able to see the attacker
- Uses your reaction

### Narration Hooks
- Describe the instinctive dodge or deflection
- The attack still connects, but not as intended
- Show the assassin's supernatural reflexes`,
  },
  {
    id: 'shield_spell',
    name: 'Shield',
    category: 'defensive',
    trigger: 'You are hit by an attack or targeted by magic missile',
    effect: '+5 AC until start of next turn, including against triggering attack. Blocks magic missile.',
    source: 'Spell (1st level)',
    isEnabled: false,
    prerequisite: 'Shield spell prepared',
    dmPrompt: `## ✨ SHIELD SPELL

**Trigger:** Hit by attack or magic missile

A shimmering barrier of magical force springs into existence.

### Mechanics
- Casting Time: 1 reaction
- +5 AC until start of your next turn
- Applies to the triggering attack
- Automatically blocks all magic missiles

### Narration Hooks
- Describe the magical shield manifesting
- The attacker's surprise as their blow is deflected`,
  },
  {
    id: 'absorb_elements',
    name: 'Absorb Elements',
    category: 'defensive',
    trigger: 'You take acid, cold, fire, lightning, or thunder damage',
    effect: 'Resistance to triggering damage type until next turn. Next melee hit deals +1d6 of that type.',
    source: 'Spell (1st level)',
    isEnabled: false,
    prerequisite: 'Absorb Elements prepared',
    dmPrompt: `## 🔥 ABSORB ELEMENTS

**Trigger:** Take elemental damage

The assassin absorbs the elemental energy, turning it into a weapon.

### Mechanics
- Gain resistance to triggering damage type
- Lasts until start of next turn
- First melee hit deals +1d6 of absorbed element
- Higher slots: +1d6 per level above 1st

### Narration Hooks
- Describe absorbing the elemental energy
- Energy crackles along weapon for the counter-strike`,
  },
  {
    id: 'parry',
    name: 'Parry',
    category: 'defensive',
    trigger: 'A creature damages you with a melee attack',
    effect: 'Spend 1 superiority die. Reduce damage by superiority die + DEX modifier.',
    source: 'Battle Master',
    isEnabled: false,
    prerequisite: 'Battle Master subclass',
    dmPrompt: `## 🤺 PARRY

**Trigger:** Damaged by melee attack

The assassin's blade intercepts, deflecting part of the blow.

### Mechanics
- Spend 1 superiority die
- Reduce damage by roll + DEX modifier
- Uses your reaction

### Narration Hooks
- Describe the defensive blade work
- The clash of steel as damage is reduced`,
  },
  {
    id: 'hellish_rebuke',
    name: 'Hellish Rebuke',
    category: 'defensive',
    trigger: 'You are damaged by a creature within 60 feet that you can see',
    effect: 'Creature makes DEX save. Takes 2d10 fire on fail, half on success.',
    source: 'Spell (1st level)',
    isEnabled: false,
    prerequisite: 'Hellish Rebuke prepared or racial',
    dmPrompt: `## 🔥 HELLISH REBUKE

**Trigger:** Damaged by a visible creature within 60 feet

Flames erupt from the assassin, punishing the attacker.

### Mechanics
- DEX save vs spell DC
- 2d10 fire damage on failed save
- Half damage on success
- Higher slots: +1d10 per level above 1st

### Narration Hooks
- Describe the sudden burst of hellfire
- The attacker's shock at the fiery retaliation`,
  },

  // ===== MOVEMENT REACTIONS =====
  {
    id: 'defensive_duelist',
    name: 'Defensive Duelist',
    category: 'movement',
    trigger: 'A creature hits you with a melee attack',
    effect: 'Add proficiency bonus to AC against that attack, potentially causing it to miss.',
    source: 'Defensive Duelist Feat',
    isEnabled: false,
    prerequisite: 'Defensive Duelist feat, finesse weapon',
    dmPrompt: `## 🤺 DEFENSIVE DUELIST

**Trigger:** Hit by melee attack while wielding finesse weapon

The assassin's blade deflects the incoming strike with expert precision.

### Mechanics
- Add proficiency bonus to AC vs triggering attack
- May cause the attack to miss
- Must be wielding a finesse weapon

### Narration Hooks
- Describe the precise parry
- The attacker's weapon sliding harmlessly past`,
  },
  {
    id: 'mounted_combatant_redirect',
    name: 'Mounted Redirect',
    category: 'movement',
    trigger: 'Your mount is targeted by an attack',
    effect: 'Force the attack to target you instead of your mount.',
    source: 'Mounted Combatant Feat',
    isEnabled: false,
    prerequisite: 'Mounted Combatant feat, mounted',
    dmPrompt: `## 🐴 MOUNTED REDIRECT

**Trigger:** Mount targeted by attack

The assassin interposes themselves, protecting their mount.

### Mechanics
- Redirect attack from mount to yourself
- You become the new target
- Does not use your reaction (free action)

### Narration Hooks
- Describe the protective maneuver
- The bond between rider and mount`,
  },

  // ===== UTILITY REACTIONS =====
  {
    id: 'counterspell',
    name: 'Counterspell',
    category: 'utility',
    trigger: 'A creature within 60 feet casts a spell',
    effect: 'Attempt to interrupt. Auto-success if spell level ≤ slot used. Otherwise, ability check DC 10 + spell level.',
    source: 'Spell (3rd level)',
    isEnabled: false,
    prerequisite: 'Counterspell prepared',
    dmPrompt: `## ✋ COUNTERSPELL

**Trigger:** Creature within 60 feet casts a spell

The assassin disrupts the magical weave with a gesture.

### Mechanics
- Casting Time: 1 reaction
- Auto-counters spells of slot level or lower
- Higher spells: Spellcasting check DC 10 + spell level
- Range: 60 feet, must see the caster

### Narration Hooks
- Describe disrupting the magical energy
- The caster's frustration as their spell fizzles`,
  },
  {
    id: 'feather_fall',
    name: 'Feather Fall',
    category: 'utility',
    trigger: 'You or a creature within 60 feet falls',
    effect: 'Up to 5 creatures fall slowly (60 ft/round) and take no falling damage.',
    source: 'Spell (1st level)',
    isEnabled: false,
    prerequisite: 'Feather Fall prepared',
    dmPrompt: `## 🪶 FEATHER FALL

**Trigger:** You or ally within 60 feet begins falling

Gravity loosens its grip as magic slows the descent.

### Mechanics
- Affect up to 5 falling creatures
- Falling rate: 60 feet per round
- No falling damage while spell lasts
- Duration: 1 minute or until landing

### Narration Hooks
- Describe the gentle descent
- The dramatic slow-motion fall`,
  },
  {
    id: 'silvery_barbs',
    name: 'Silvery Barbs',
    category: 'utility',
    trigger: 'A creature within 60 feet succeeds on an attack, ability check, or saving throw',
    effect: 'Force reroll and use lower result. Grant advantage to yourself or ally on next roll.',
    source: 'Spell (1st level)',
    isEnabled: false,
    prerequisite: 'Silvery Barbs prepared',
    dmPrompt: `## ✨ SILVERY BARBS

**Trigger:** Creature within 60 feet succeeds on d20 roll

A whisper of enchantment clouds the creature's moment of triumph.

### Mechanics
- Force creature to reroll and use lower result
- Choose one creature: advantage on next attack/check/save
- Powerful reaction spell

### Narration Hooks
- Describe the subtle magical interference
- The creature's confusion as success turns to failure`,
  },

  // ===== CLASS FEATURE REACTIONS =====
  {
    id: 'sneak_attack_reaction',
    name: 'Sneak Attack (Reaction)',
    category: 'class_features',
    trigger: 'You hit with an opportunity attack or held action attack',
    effect: 'Apply Sneak Attack damage if you haven\'t used it this turn and conditions are met.',
    source: 'Rogue Class',
    isEnabled: true,
    dmPrompt: `## 🗡️ SNEAK ATTACK (REACTION)

**Trigger:** Hit with opportunity attack or held action

The assassin's reaction strike finds a vital point.

### Mechanics
- Must not have used Sneak Attack this turn
- Need advantage OR ally within 5ft of target
- Cannot have disadvantage
- Add Sneak Attack dice to damage

### Narration Hooks
- Describe the precise, lethal strike
- The target's vulnerability exploited`,
  },
  {
    id: 'evasion_save',
    name: 'Evasion',
    category: 'class_features',
    trigger: 'You make a DEX save against an effect that deals half damage on success',
    effect: 'Take no damage on success, half damage on fail. Not a reaction but often relevant.',
    source: 'Rogue 7th Level',
    isEnabled: true,
    dmPrompt: `## 💨 EVASION

**Trigger:** DEX save for half damage

With impossible agility, the assassin dances through the danger.

### Mechanics
- Success: Take no damage
- Failure: Take half damage
- Must not be incapacitated
- Passive ability (not a reaction)

### Narration Hooks
- Describe the acrobatic evasion
- How does the assassin escape the area effect?`,
  },
  {
    id: 'slippery_mind',
    name: 'Slippery Mind',
    category: 'class_features',
    trigger: 'You make a WIS saving throw',
    effect: 'Proficiency in Wisdom saving throws. Resist mental effects more easily.',
    source: 'Rogue 15th Level',
    isEnabled: false,
    dmPrompt: `## 🧠 SLIPPERY MIND

**Trigger:** Wisdom saving throw

The assassin's trained mind resists manipulation.

### Mechanics
- Proficiency in WIS saves
- Passive ability
- Helps resist charm, fear, and other mental effects

### Narration Hooks
- Describe mental fortitude
- The failed attempt to control the assassin`,
  },
];

// Storage key for user's reaction preferences
export const REACTIONS_STORAGE_KEY = 'dnd-reactions-config';

// Helper to get enabled reactions
export function getEnabledReactions(reactions: Reaction[]): Reaction[] {
  return reactions.filter(r => r.isEnabled);
}

// Helper to get reactions by category
export function getReactionsByCategory(
  reactions: Reaction[], 
  category: ReactionCategory
): Reaction[] {
  return reactions.filter(r => r.category === category);
}

// Helper to count enabled reactions per category
export function countEnabledByCategory(reactions: Reaction[]): Record<ReactionCategory, number> {
  const counts: Record<ReactionCategory, number> = {
    defensive: 0,
    offensive: 0,
    movement: 0,
    utility: 0,
    class_features: 0,
    custom: 0,
  };
  
  reactions.forEach(r => {
    if (r.isEnabled) {
      counts[r.category]++;
    }
  });
  
  return counts;
}

// Generate clipboard-ready prompt for a reaction
export function generateReactionClipboard(reaction: Reaction): string {
  const rawPrompt = `**${reaction.name}** (${reaction.source})
  
**Trigger:** ${reaction.trigger}

**Effect:** ${reaction.effect}

---

${reaction.dmPrompt}`;

  return applyTimePrefix(rawPrompt);
}
