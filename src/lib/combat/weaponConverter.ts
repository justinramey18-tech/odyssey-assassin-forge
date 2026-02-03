// Converts equipped gear items to WeaponAttack combat objects
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { WeaponAttack } from './combatTypes';

// Weapon slot types that should appear in combat
const WEAPON_SLOTS: EquipmentSlotType[] = ['primary_weapon', 'secondary_weapon', 'ranged_weapon'];

// Map slot types to weapon characteristics
const SLOT_WEAPON_DEFAULTS: Record<EquipmentSlotType, Partial<WeaponAttack>> = {
  primary_weapon: {
    isFinesse: true,
    isRanged: false,
    damageType: 'slashing',
    properties: ['Finesse'],
  },
  secondary_weapon: {
    isFinesse: true,
    isRanged: false,
    damageType: 'piercing',
    properties: ['Finesse', 'Light'],
  },
  ranged_weapon: {
    isFinesse: false,
    isRanged: true,
    damageType: 'piercing',
    properties: ['Ammunition', 'Two-Handed'],
  },
  // Non-weapon slots (won't be used but needed for type safety)
  head: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  chest: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  arms: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  waist: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  legs: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  amulet: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  ring1: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
  ring2: { isFinesse: false, isRanged: false, damageType: 'bludgeoning', properties: [] },
};

// Parse weapon properties from item to determine characteristics
function parseWeaponProperties(item: EquipmentItem): { isFinesse: boolean; isRanged: boolean; damageType: string } {
  const props = item.properties?.map(p => p.toLowerCase()) || [];
  const name = item.name.toLowerCase();
  
  // Check for finesse
  const isFinesse = props.some(p => p.includes('finesse')) || 
    name.includes('dagger') || 
    name.includes('rapier') || 
    name.includes('shortsword') ||
    name.includes('scimitar');
  
  // Check for ranged
  const isRanged = props.some(p => p.includes('ammunition') || p.includes('thrown') || p.includes('ranged')) ||
    name.includes('bow') || 
    name.includes('crossbow') || 
    name.includes('sling') ||
    item.slotType === 'ranged_weapon';
  
  // Determine damage type
  let damageType = 'slashing';
  if (props.some(p => p.includes('piercing')) || name.includes('rapier') || name.includes('spear') || name.includes('arrow') || name.includes('dagger')) {
    damageType = 'piercing';
  } else if (props.some(p => p.includes('bludgeoning')) || name.includes('mace') || name.includes('hammer') || name.includes('club')) {
    damageType = 'bludgeoning';
  }
  
  return { isFinesse, isRanged, damageType };
}

/**
 * Converts an equipped EquipmentItem to a WeaponAttack object for combat use
 */
export function convertToWeaponAttack(item: EquipmentItem): WeaponAttack {
  const slotDefaults = SLOT_WEAPON_DEFAULTS[item.slotType];
  const parsedProps = parseWeaponProperties(item);
  
  // Get damage from item stats or use a default
  const damage = item.stats.damage?.toString() || '1d6';
  
  // Get attack bonus from item stats
  const attackBonus = item.stats.attackBonus || 0;
  
  // Merge properties from item with defaults
  const properties = item.properties || slotDefaults.properties || [];
  
  return {
    id: item.id,
    name: item.name,
    attackBonus,
    damage,
    damageType: parsedProps.damageType,
    properties,
    isFinesse: parsedProps.isFinesse,
    isRanged: parsedProps.isRanged,
  };
}

/**
 * Gets all equipped weapons from equipment slots and converts them to WeaponAttack objects
 */
export function getEquippedWeapons(
  slots: Record<EquipmentSlotType, EquipmentItem | null>
): WeaponAttack[] {
  const weapons: WeaponAttack[] = [];
  
  for (const slotType of WEAPON_SLOTS) {
    const item = slots[slotType];
    if (item) {
      weapons.push(convertToWeaponAttack(item));
    }
  }
  
  return weapons;
}

/**
 * Generates an AI DM prompt for a weapon attack
 */
export function generateWeaponDMPrompt(
  weapon: WeaponAttack,
  rollType: 'normal' | 'sneak' | 'assassinate',
  rollResult: number,
  isCrit: boolean,
  isFumble: boolean,
  damage: string,
  characterName: string
): string {
  const attackType = rollType === 'assassinate' 
    ? '💀 ASSASSINATION ATTEMPT' 
    : rollType === 'sneak' 
      ? '🗡️ SNEAK ATTACK'
      : '⚔️ ATTACK';

  const resultDescription = isCrit 
    ? '🎯 **CRITICAL HIT!** The strike lands with devastating precision.'
    : isFumble 
      ? '💀 **CRITICAL MISS!** Something goes terribly wrong...'
      : rollResult >= 18 
        ? 'A solid, well-aimed strike.'
        : rollResult >= 10 
          ? 'The attack connects adequately.'
          : 'The strike wavers but might still land.';

  const weaponFlavor = weapon.isRanged 
    ? `A projectile from ${weapon.name} streaks toward the target.`
    : `${weapon.name} arcs through the air toward the enemy.`;

  return `## ${attackType}

**Character:** ${characterName || 'The Assassin'}
**Weapon:** ${weapon.name}
**Properties:** ${weapon.properties.join(', ') || 'Standard'}
**Attack Roll:** ${rollResult}
**Damage on Hit:** ${damage} ${weapon.damageType}

---

### Scene Description
${weaponFlavor}

${resultDescription}

${rollType === 'assassinate' ? `
**ASSASSINATION:** The target never saw it coming. This is an automatic critical hit—describe a devastating, 
lethal strike from the shadows that maximizes the brutality of the moment.
` : rollType === 'sneak' ? `
**SNEAK ATTACK:** Exploiting a moment of distraction or vulnerability, the strike finds a vital point.
The extra damage represents surgical precision.
` : ''}

### Narration Hooks
- How does the weapon's ${weapon.damageType} damage manifest visually?
- What is the target's immediate reaction?
${isCrit ? '- Describe the critical hit with dramatic, cinematic flair.' : ''}
${isFumble ? '- What comedic or dramatic mishap occurs?' : ''}

---
*Roll: ${rollResult} | Weapon: ${weapon.name} | Damage: ${damage}*`;
}
