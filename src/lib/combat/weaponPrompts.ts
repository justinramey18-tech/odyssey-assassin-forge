// Weapon attack RP prompt generation
// Extracted from CombatTabScreen.tsx and MobileCombatLayout.tsx

import { WeaponAttack } from './combatTypes';
import { DiceRoll, isCriticalHit, isCriticalMiss, inferRollMode, RollMode } from '@/lib/diceRoller';
import { TargetPromptInfo, formatTargetForPrompt } from './promptContext';
import { getD20RollQuality } from '@/lib/rollQuality';

// ============= Deadpool Quips =============

const CRIT_QUIPS = [
  "Maximum effort!",
  "I'm touching myself tonight!",
  "Did you see that?! Somebody better be taking notes!",
  "Sword to the face! That's gonna hurt his Tinder profile.",
  "Insert slow-mo here. You're welcome, audience.",
  "That's what peak performance looks like, folks. Screenshot it.",
  "Healing factor activate! Form of: gross meat sounds!",
  "Holy sh*tballs! That was BEAUTIFUL. I'm framing that d20.",
  "And THAT is why I'm too profitable to kill. Mouse ears need boats, people!",
];

const FUMBLE_QUIPS = [
  "Well, that's coming out of my budget.",
  "I've made a huge mistake. *narrator voice* He had.",
  "This is fine. Everything is fine. *It was not fine.*",
  "Plot armor, don't fail me now!",
  "I blame the writers for this one. The dialogue was basically me talking to myself. Wait...",
  "Fourth wall? Meet the floor. I'm joining you down there.",
  "Oh no, I'm dying. Again. Spoiler alert: I'm not used to it. It still hurts like a—",
  "The developers coded this outcome SPECIFICALLY to humiliate me. I can feel it.",
];

const ASSASSINATE_QUIPS = [
  "Surprise, motherf—",
  "Nobody expects the Spanish Inquisition. Or me. Mostly me.",
  "Target eliminated. Time for tacos.",
  "And THAT'S why they call me an assassin. Well, that and the whole... killing-for-money thing.",
  "Daddy needs to express some rage! ...And he DID.",
  "You know what's funnier than stabbing? Stabbing while making eye contact.",
];

const OFFHAND_QUIPS = [
  "Left hand doesn't know what the right hand is doing... but both are stabbing!",
  "Dual wielding: because one sword is for amateurs and cowards.",
  "Two weapons, twice the pain! It's basic math, people.",
  "Ambidextrous AND dangerous! My therapist calls it 'overcompensating.' I call it PREPARED.",
  "Stabbing, stabbing, quip, stabbing — I should mix up my routine.",
];

const GENERIC_QUIPS = [
  "Maximum effort!",
  "Nailed it. Add it to my highlight reel.",
  "Chimichangas for everyone!",
  "Good enough for government work. And significantly more violent.",
  "Is that a grenade? Why yes, yes it is. Catch!",
  "I've been stabbed, shot, blown up, and disintegrated. But THIS was special.",
  "You came here for violence and wisecracks. Delivering on both. You're welcome.",
];

function randomQuip(quips: string[]): string {
  return quips[Math.floor(Math.random() * quips.length)];
}

/**
 * Get a Deadpool-style quip based on the roll outcome.
 * Used by the desktop CombatTabScreen prompt generator.
 */
export function getDeadpoolQuip(
  rollType: string,
  total: number,
  isCrit: boolean,
  isFumble: boolean
): string {
  if (isCrit) return randomQuip(CRIT_QUIPS);
  if (isFumble) return randomQuip(FUMBLE_QUIPS);
  if (rollType === 'assassinate') return randomQuip(ASSASSINATE_QUIPS);
  if (total >= 18) return "Nailed it. Add it to my highlight reel.";
  if (total >= 12) return "Good enough for government work.";
  return "At least I'm pretty...";
}

/**
 * Generate a weapon attack RP prompt for the desktop combat HUD.
 * Uses 5e-compliant critical detection via roll mode.
 */
export function generateDesktopWeaponPrompt(
  rollType: 'normal' | 'sneak' | 'assassinate',
  weapon: WeaponAttack,
  roll: DiceRoll,
  damage: string,
  characterName: string
): string {
  const rollMode = inferRollMode(roll.rolls, roll.total, roll.modifier);
  const isCrit = isCriticalHit(roll.rolls, rollMode, roll.die);
  const isFumble = isCriticalMiss(roll.rolls, rollMode, roll.die);
  const hasAdvantage = roll.rolls.length > 1;
  const attackQuality = getD20RollQuality(roll.rolls, rollMode, roll.total);

  const title = rollType === 'assassinate'
    ? '💀 ASSASSINATION ATTEMPT'
    : rollType === 'sneak'
      ? '🗡️ SNEAK ATTACK'
      : '⚔️ ATTACK';

  const quip = getDeadpoolQuip(rollType, roll.total, isCrit, isFumble);

  return `## ${title}

**Character:** ${characterName || 'The Merc'}
**Weapon:** ${weapon.name}
**Roll:** ${hasAdvantage ? '2d20kh1' : '1d20'}+${roll.modifier} = [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL HIT!**' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL MISS!**' : ''}

**Damage on Hit:** ${damage}

---

### Narration Guide
${rollType === 'assassinate'
    ? 'Describe a devastating strike from the shadows. The target never saw it coming. The damage is automatically maximized - this is a killing blow.'
    : rollType === 'sneak'
      ? 'Describe a precise strike exploiting a momentary weakness or distraction. The extra damage represents finding a vital point.'
      : attackQuality.narrativeGuide}

${isCrit ? '**CRITICAL:** Double all damage dice. Describe something exceptionally brutal.' : ''}

*"${quip}"*`;
}

/**
 * Generate a weapon attack RP prompt for the mobile combat layout.
 * Supports target context and offhand attacks.
 */
export function generateMobileWeaponPrompt(
  rollType: 'normal' | 'sneak' | 'assassinate',
  weapon: WeaponAttack,
  roll: DiceRoll,
  damage: string,
  characterName: string,
  target?: TargetPromptInfo | null,
  isOffhand?: boolean
): string {
  const isCrit = roll.rolls.includes(20);
  const isFumble = roll.rolls.includes(1);
  const hasAdvantage = roll.rolls.length > 1;

  const title = isOffhand
    ? '⚡ OFFHAND ATTACK'
    : rollType === 'assassinate'
      ? '💀 ASSASSINATION ATTEMPT'
      : rollType === 'sneak'
        ? '🗡️ SNEAK ATTACK'
        : '⚔️ ATTACK';

  const quips = isOffhand ? OFFHAND_QUIPS : GENERIC_QUIPS;
  const quip = randomQuip(quips);

  const targetSection = target ? formatTargetForPrompt(target) : '';
  const offhandNote = isOffhand
    ? '\n**Note:** Offhand attack (bonus action) - no ability modifier to damage unless you have the Two-Weapon Fighting style.\n'
    : '';

  return `## ${title}

**Character:** ${characterName || 'The Merc'}
**Weapon:** ${weapon.name}${isOffhand ? ' (Offhand)' : ''}
**Roll:** ${hasAdvantage ? '2d20kh1' : '1d20'}+${roll.modifier} = [${roll.rolls.join(', ')}] = **${roll.total}**
${isCrit ? '\n🎯 **NATURAL 20! CRITICAL HIT!**' : ''}
${isFumble ? '\n💀 **NATURAL 1! CRITICAL MISS!**' : ''}
${targetSection ? `\n${targetSection}\n` : ''}
**Damage on Hit:** ${damage}${offhandNote}
*"${quip}"*`;
}
