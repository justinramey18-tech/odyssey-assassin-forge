// D&D 5e Dice Roller Configuration
// Skills, Saving Throws, and AI DM Prompts

export type DieSize = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DieConfig {
  die: DieSize;
  sides: number;
  color: string;
  icon: string;
}

export const DICE_CONFIG: Record<DieSize, DieConfig> = {
  d4: { die: 'd4', sides: 4, color: 'text-emerald-400', icon: '🎲' },
  d6: { die: 'd6', sides: 6, color: 'text-blue-400', icon: '🎲' },
  d8: { die: 'd8', sides: 8, color: 'text-violet-400', icon: '🎲' },
  d10: { die: 'd10', sides: 10, color: 'text-amber-400', icon: '🎲' },
  d12: { die: 'd12', sides: 12, color: 'text-rose-400', icon: '🎲' },
  d20: { die: 'd20', sides: 20, color: 'text-red-400', icon: '🎲' },
  d100: { die: 'd100', sides: 100, color: 'text-purple-400', icon: '🎲' },
};

export const DICE_ORDER: DieSize[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

// D&D 5e Ability Scores
export type AbilityScore = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_SCORES: Record<AbilityScore, { name: string; abbr: string; color: string }> = {
  str: { name: 'Strength', abbr: 'STR', color: 'text-red-400' },
  dex: { name: 'Dexterity', abbr: 'DEX', color: 'text-green-400' },
  con: { name: 'Constitution', abbr: 'CON', color: 'text-amber-400' },
  int: { name: 'Intelligence', abbr: 'INT', color: 'text-blue-400' },
  wis: { name: 'Wisdom', abbr: 'WIS', color: 'text-purple-400' },
  cha: { name: 'Charisma', abbr: 'CHA', color: 'text-pink-400' },
};

// D&D 5e Skills
export interface Skill {
  id: string;
  name: string;
  ability: AbilityScore;
}

export const SKILLS: Skill[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { id: 'animal_handling', name: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', name: 'Arcana', ability: 'int' },
  { id: 'athletics', name: 'Athletics', ability: 'str' },
  { id: 'deception', name: 'Deception', ability: 'cha' },
  { id: 'history', name: 'History', ability: 'int' },
  { id: 'insight', name: 'Insight', ability: 'wis' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { id: 'investigation', name: 'Investigation', ability: 'int' },
  { id: 'medicine', name: 'Medicine', ability: 'wis' },
  { id: 'nature', name: 'Nature', ability: 'int' },
  { id: 'perception', name: 'Perception', ability: 'wis' },
  { id: 'performance', name: 'Performance', ability: 'cha' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { id: 'religion', name: 'Religion', ability: 'int' },
  { id: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', name: 'Stealth', ability: 'dex' },
  { id: 'survival', name: 'Survival', ability: 'wis' },
];

// AI DM Prompt Templates (System-Agnostic)
export interface AIPromptTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'combat' | 'exploration' | 'social' | 'utility';
  prompt: string;
  color: string;
}

export const AI_DM_PROMPTS: AIPromptTemplate[] = [
  // Combat Prompts
  {
    id: 'describe_attack',
    name: 'Describe Attack',
    icon: 'Swords',
    category: 'combat',
    color: 'text-red-400',
    prompt: `I rolled a {ROLL} on my attack roll.

Please describe the outcome of this attack in vivid detail:
- If it hits, describe the strike and the damage dealt
- If it misses or is a low roll, describe a near-miss or the enemy's defense
- If it's a critical hit (natural 20), make it dramatic and devastating
- If it's a critical fail (natural 1), describe an embarrassing or dangerous fumble

Keep the description to 2-3 sentences, action-packed and cinematic.`,
  },
  {
    id: 'describe_damage',
    name: 'Describe Damage',
    icon: 'Flame',
    category: 'combat',
    color: 'text-orange-400',
    prompt: `I dealt {ROLL} points of damage to my enemy.

Describe the impact of this damage:
- For low damage (1-5): A glancing blow or minor wound
- For medium damage (6-15): A solid hit with visible effect
- For high damage (16+): A devastating strike

Make it visceral and satisfying. 2-3 sentences.`,
  },
  {
    id: 'enemy_reaction',
    name: 'Enemy Reaction',
    icon: 'Users',
    category: 'combat',
    color: 'text-rose-400',
    prompt: `I'm in combat and need you to describe how my enemy reacts to the current situation.

Roll result: {ROLL}

- High roll: The enemy is intimidated, hesitant, or makes a tactical mistake
- Low roll: The enemy seems confident and presses the advantage
- Critical: Either total demoralization or renewed fury

Describe their body language, expression, and any words they might speak. 2-3 sentences.`,
  },
  
  // Exploration Prompts
  {
    id: 'perception_check',
    name: 'Perception Check',
    icon: 'Eye',
    category: 'exploration',
    color: 'text-blue-400',
    prompt: `I rolled a {ROLL} on my Perception check.

What do I notice in my surroundings?
- Low roll (1-9): Only the obvious, might miss important details
- Medium roll (10-15): Notice standard details and some hidden elements
- High roll (16-19): Catch subtle clues and hidden threats
- Critical (20): Notice everything, including well-hidden secrets

Describe what I perceive without giving away solutions. 2-4 sentences.`,
  },
  {
    id: 'investigate_area',
    name: 'Investigate Area',
    icon: 'Search',
    category: 'exploration',
    color: 'text-cyan-400',
    prompt: `I rolled a {ROLL} on my Investigation check while searching this area.

What do I discover through careful examination?
- Describe physical clues, hidden compartments, or useful information
- Scale the discovery to the roll result
- Include one actionable piece of information for higher rolls

Keep mystery intact while rewarding good rolls. 2-4 sentences.`,
  },
  {
    id: 'environment_description',
    name: 'Describe Environment',
    icon: 'Map',
    category: 'exploration',
    color: 'text-emerald-400',
    prompt: `I'm entering a new area and rolled {ROLL} on my general awareness.

Paint a picture of this environment:
- Include sensory details: sights, sounds, smells
- Hint at potential dangers or points of interest
- Set the mood and atmosphere
- Scale detail level to the roll

Immersive description, 3-5 sentences.`,
  },
  
  // Social Prompts
  {
    id: 'persuasion_outcome',
    name: 'Persuasion Outcome',
    icon: 'MessageCircle',
    category: 'social',
    color: 'text-pink-400',
    prompt: `I rolled a {ROLL} on my Persuasion check.

Describe the NPC's reaction to my argument:
- Low roll: They're unconvinced, possibly annoyed
- Medium roll: They're considering it, maybe with conditions
- High roll: They're swayed, willing to help
- Critical: They're enthusiastic supporters

Include their dialogue and body language. 2-3 sentences.`,
  },
  {
    id: 'deception_outcome',
    name: 'Deception Outcome',
    icon: 'EyeOff',
    category: 'social',
    color: 'text-violet-400',
    prompt: `I rolled a {ROLL} on my Deception check.

Did my lie succeed?
- Low roll: They see right through it, describe their suspicion
- Medium roll: They have doubts but can't prove anything
- High roll: They believe the lie completely
- Critical: They believe it AND add their own embellishments

Show their reaction without revealing internal thoughts. 2-3 sentences.`,
  },
  {
    id: 'intimidation_outcome',
    name: 'Intimidation Outcome',
    icon: 'Skull',
    category: 'social',
    color: 'text-red-500',
    prompt: `I rolled a {ROLL} on my Intimidation check.

How does my target respond to my threat?
- Low roll: They're unimpressed or defiant
- Medium roll: They're nervous but holding ground
- High roll: They're genuinely frightened, may comply
- Critical: They're terrified, will do anything to avoid conflict

Describe physical signs of fear or lack thereof. 2-3 sentences.`,
  },
  
  // Utility Prompts
  {
    id: 'stealth_result',
    name: 'Stealth Result',
    icon: 'Ghost',
    category: 'utility',
    color: 'text-slate-400',
    prompt: `I rolled a {ROLL} on my Stealth check.

Describe how well I'm hidden:
- Low roll: I've made noise, cast a shadow, or been spotted
- Medium roll: I'm hidden but it's precarious
- High roll: I'm a shadow, completely undetected
- Critical: I could walk up and tie their shoelaces

Describe the environment and my position. 2-3 sentences.`,
  },
  {
    id: 'luck_moment',
    name: 'Lucky Moment',
    icon: 'Sparkles',
    category: 'utility',
    color: 'text-yellow-400',
    prompt: `I rolled a {ROLL} and need a moment of fortune (good or bad).

Describe what happens:
- Low roll: Bad luck strikes—something goes wrong
- Medium roll: Mixed fortune—trade-offs occur
- High roll: Good luck—something fortunate happens
- Critical: Incredible luck—fate itself intervenes

Make it memorable and plot-relevant if possible. 2-3 sentences.`,
  },
  {
    id: 'generic_outcome',
    name: 'Generic Outcome',
    icon: 'Dices',
    category: 'utility',
    color: 'text-white',
    prompt: `I rolled a {ROLL} on a general check.

Describe the outcome in a creative and engaging way:
- Scale success or failure to the roll result
- Add a small narrative detail or consequence
- Keep it applicable to any situation

Brief but memorable. 2-3 sentences.`,
  },
];

// Get prompts by category
export function getPromptsByCategory(category: AIPromptTemplate['category']): AIPromptTemplate[] {
  return AI_DM_PROMPTS.filter(p => p.category === category);
}

// Format a prompt with the roll result
export function formatPromptWithRoll(prompt: string, roll: number): string {
  return prompt.replace(/{ROLL}/g, roll.toString());
}
