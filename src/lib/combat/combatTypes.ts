// Combat Tab Types

export interface CombatScenario {
  id: string;
  name: string;
  conditions: string[];
}

export interface CombatCondition {
  id: string;
  label: string;
  tooltip: string;
  mechanical: string;
}

export interface ActiveEffect {
  id: string;
  name: string;
  description: string;
}

export interface ActionEconomy {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  movementUsed: number;
  maxMovement: number;
}

export interface WeaponAttack {
  id: string;
  name: string;
  attackBonus: number;
  damage: string;
  damageType: string;
  properties: string[];
  isFinesse: boolean;
  isRanged: boolean;
}

export interface TurnAction {
  type: 'action' | 'bonus' | 'reaction' | 'movement';
  description: string;
  roll?: string;
}

export interface DamageBreakdown {
  baseDamage: string;
  sneakAttack?: string;
  poison?: string;
  other?: string;
  isCritical: boolean;
  total: string;
}

// Preset scenarios
export const COMBAT_SCENARIOS: CombatScenario[] = [
  { id: 'standard', name: 'Standard Combat', conditions: [] },
  { id: 'hidden', name: 'Hidden/Stealth Active', conditions: ['hidden', 'advantage'] },
  { id: 'surprise', name: 'Surprise Round', conditions: ['targetSurprised', 'advantage', 'targetUnaware'] },
  { id: 'flanking', name: 'Flanking Position', conditions: ['allyAdjacent', 'advantage'] },
  { id: 'defensive', name: 'Defensive/Escaping', conditions: ['disadvantage'] },
];

// Condition definitions
export const COMBAT_CONDITIONS: CombatCondition[] = [
  { id: 'hidden', label: 'Hidden/Invisible', tooltip: 'You are hidden from enemies', mechanical: 'Advantage on first attack, enemies have disadvantage to hit you' },
  { id: 'advantage', label: 'Have Advantage', tooltip: 'Roll 2d20 take highest', mechanical: 'Roll twice, take higher result. Enables Sneak Attack.' },
  { id: 'allyAdjacent', label: 'Ally within 5ft of Target', tooltip: 'An ally is in melee with your target', mechanical: 'Enables Sneak Attack even without advantage' },
  { id: 'targetSurprised', label: 'Target Surprised', tooltip: 'Target has not acted yet in combat', mechanical: 'Auto-crit on hit. Assassinate available.' },
  { id: 'targetUnaware', label: 'Target Unaware', tooltip: 'Target does not know you are there', mechanical: 'Advantage on attack rolls' },
  { id: 'disadvantage', label: 'Have Disadvantage', tooltip: 'Roll 2d20 take lowest', mechanical: 'Roll twice, take lower result. Blocks Sneak Attack.' },
  { id: 'dimLight', label: 'In Dim Light/Darkness', tooltip: 'Low visibility conditions', mechanical: 'Can attempt to hide. Advantage on stealth.' },
  { id: 'poisonedWeapon', label: 'Poisoned Weapon', tooltip: 'Weapon coated with poison', mechanical: 'Extra poison damage on hit' },
];

// Default weapons for assassin
export const DEFAULT_WEAPONS: WeaponAttack[] = [
  {
    id: 'shortsword',
    name: 'Shortsword',
    attackBonus: 0,
    damage: '1d6',
    damageType: 'piercing',
    properties: ['Finesse', 'Light'],
    isFinesse: true,
    isRanged: false,
  },
  {
    id: 'dagger',
    name: 'Dagger',
    attackBonus: 0,
    damage: '1d4',
    damageType: 'piercing',
    properties: ['Finesse', 'Light', 'Thrown (20/60)'],
    isFinesse: true,
    isRanged: false,
  },
  {
    id: 'shortbow',
    name: 'Shortbow',
    attackBonus: 0,
    damage: '1d6',
    damageType: 'piercing',
    properties: ['Ammunition', 'Two-Handed'],
    isFinesse: false,
    isRanged: true,
  },
  {
    id: 'hand_crossbow',
    name: 'Hand Crossbow',
    attackBonus: 0,
    damage: '1d6',
    damageType: 'piercing',
    properties: ['Ammunition', 'Light', 'Loading'],
    isFinesse: false,
    isRanged: true,
  },
];

// Calculate sneak attack dice by level
export function getSneakAttackDice(level: number): string {
  const dice = Math.ceil(level / 2);
  return `${dice}d6`;
}

// Check if sneak attack is eligible
export function isSneakAttackEligible(
  conditions: string[],
  weapon: WeaponAttack
): { eligible: boolean; reason: string } {
  // Must be finesse or ranged
  if (!weapon.isFinesse && !weapon.isRanged) {
    return { eligible: false, reason: 'Requires finesse or ranged weapon' };
  }
  
  // Cannot have disadvantage
  if (conditions.includes('disadvantage')) {
    return { eligible: false, reason: 'Cannot sneak attack with disadvantage' };
  }
  
  // Need advantage OR ally adjacent
  const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
  const hasAlly = conditions.includes('allyAdjacent');
  
  if (hasAdvantage) {
    return { eligible: true, reason: 'Advantage on attack' };
  }
  
  if (hasAlly) {
    return { eligible: true, reason: 'Ally adjacent to target' };
  }
  
  return { eligible: false, reason: 'Need advantage or ally adjacent to target' };
}

// Check if assassinate is available
export function isAssassinateAvailable(conditions: string[]): boolean {
  return conditions.includes('targetSurprised') && 
         (conditions.includes('advantage') || conditions.includes('hidden'));
}

// Format roll for AI DM communication
export function formatRollForAI(
  abilityName: string,
  conditions: string[],
  rollFormula: string,
  damageFormula?: string
): string {
  const conditionLabels = conditions.map(c => 
    COMBAT_CONDITIONS.find(cc => cc.id === c)?.label
  ).filter(Boolean);
  
  let output = `[${abilityName}]`;
  
  if (conditionLabels.length > 0) {
    output += ` (${conditionLabels.join(', ')})`;
  }
  
  output += `: ${rollFormula} to hit`;
  
  if (damageFormula) {
    output += ` | Damage: ${damageFormula}`;
  }
  
  return output;
}

// Format turn summary
export function formatTurnSummary(actions: TurnAction[]): string {
  const lines: string[] = [];
  
  const action = actions.find(a => a.type === 'action');
  const bonus = actions.find(a => a.type === 'bonus');
  const reaction = actions.find(a => a.type === 'reaction');
  const movement = actions.find(a => a.type === 'movement');
  
  if (action) lines.push(`ACTION: ${action.description}${action.roll ? ` (${action.roll})` : ''}`);
  if (bonus) lines.push(`BONUS ACTION: ${bonus.description}${bonus.roll ? ` (${bonus.roll})` : ''}`);
  if (reaction) lines.push(`REACTION: ${reaction.description}${reaction.roll ? ` (${reaction.roll})` : ''}`);
  if (movement) lines.push(`MOVEMENT: ${movement.description}`);
  
  return lines.join('\n');
}
