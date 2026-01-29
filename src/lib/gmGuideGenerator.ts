import { Character, CharacterAbility, getActiveSlotsByLevel, getTotalPointsSpent, getPointsSpentInTree } from '@/lib/types';
import { Ability } from '@/lib/types';
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { legendarySetDefinitions } from '@/lib/inventory/legendarySets';

export interface CharacterBuildData {
  character: Character;
  abilities: Ability[];
  unlockedAbilities: Map<string, number>;
  equippedGear: Record<EquipmentSlotType, EquipmentItem | null>;
  prestigeLevel?: number;
  // Optional additional stats for summary
  aggregatedStats?: {
    totalAC?: number;
    totalAttackBonus?: number;
    damage?: string | null;
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
}

export function generateDynamicGMGuide(data: CharacterBuildData): string {
  const { character, abilities, unlockedAbilities, equippedGear, prestigeLevel } = data;
  
  const sections: string[] = [];
  
  // Header
  sections.push(`# CURRENT CHARACTER STATE
Updated: ${new Date().toLocaleString()}
Player: ${character.name || 'Unnamed Assassin'}

---`);

  // Core Stats Section
  sections.push(generateCoreStatsSection(character, prestigeLevel));
  
  // Equipped Abilities Section
  sections.push(generateAbilitiesSection(character, abilities, unlockedAbilities));
  
  // Equipped Gear Section
  sections.push(generateGearSection(equippedGear));
  
  // Active Set Bonuses Section
  sections.push(generateSetBonusSection(equippedGear));
  
  // Build Summary for Quick Reference
  sections.push(generateBuildSummary(character, abilities, unlockedAbilities, equippedGear));
  
  return sections.join('\n\n');
}

function generateCoreStatsSection(character: Character, prestigeLevel?: number): string {
  const activeSlots = getActiveSlotsByLevel(character.level);
  const prestigeInfo = prestigeLevel && prestigeLevel > 0 
    ? `\n- **Prestige Level**: P${prestigeLevel} (Post-cap progression active)` 
    : '';
  
  return `## CORE STATS

- **Name**: ${character.name || 'Unnamed'}
- **Level**: ${character.level}
- **Active Ability Slots**: ${activeSlots}${prestigeInfo}

### Sneak Attack Damage
- **Dice**: ${getSneakAttackDice(character.level)}
- Applies when: Advantage OR ally within 5ft of target`;
}

function getSneakAttackDice(level: number): string {
  if (level >= 19) return '10d6';
  if (level >= 17) return '9d6';
  if (level >= 15) return '8d6';
  if (level >= 13) return '7d6';
  if (level >= 11) return '6d6';
  if (level >= 9) return '5d6';
  if (level >= 7) return '4d6';
  if (level >= 5) return '3d6';
  if (level >= 3) return '2d6';
  return '1d6';
}

function generateAbilitiesSection(
  character: Character, 
  allAbilities: Ability[], 
  unlockedAbilities: Map<string, number>
): string {
  const equippedIds = character.equippedAbilities || [];
  const equipped = equippedIds
    .map(id => allAbilities.find(a => a.id === id))
    .filter((a): a is Ability => a !== undefined);
  
  if (equipped.length === 0) {
    return `## EQUIPPED ABILITIES (Loadout)

*No abilities currently equipped in loadout slots.*`;
  }
  
  const abilityLines = equipped.map(ability => {
    const tier = unlockedAbilities.get(ability.id) || 1;
    const tierEffect = ability.tierEffects.find(t => t.tier === tier);
    const actionLabel = ability.actionType.replace('_', ' ').toUpperCase();
    const usageLabel = ability.usageType.replace('_', ' ').toUpperCase();
    
    return `### ${ability.name} (Tier ${tier})
- **Tree**: ${ability.tree.charAt(0).toUpperCase() + ability.tree.slice(1)}
- **Action**: ${actionLabel}
- **Usage**: ${usageLabel}
- **Effect**: ${tierEffect?.description || 'Unknown effect'}`;
  });
  
  // Also list all unlocked abilities not in loadout
  const unlockedList = Array.from(unlockedAbilities.entries())
    .map(([id, tier]) => {
      const ability = allAbilities.find(a => a.id === id);
      if (!ability) return null;
      const isEquipped = equippedIds.includes(id);
      return { ability, tier, isEquipped };
    })
    .filter((item): item is { ability: Ability; tier: number; isEquipped: boolean } => item !== null);
  
  const notEquipped = unlockedList.filter(item => !item.isEquipped);
  
  let additionalSection = '';
  if (notEquipped.length > 0) {
    const otherAbilities = notEquipped.map(item => 
      `- ${item.ability.name} (${item.ability.tree}, T${item.tier})`
    ).join('\n');
    additionalSection = `\n\n### Other Unlocked Abilities (Not in Loadout)\n${otherAbilities}`;
  }
  
  return `## EQUIPPED ABILITIES (Loadout)

${abilityLines.join('\n\n')}${additionalSection}`;
}

function generateGearSection(equippedGear: Record<EquipmentSlotType, EquipmentItem | null>): string {
  const slots: { type: EquipmentSlotType; label: string }[] = [
    { type: 'head', label: 'Head' },
    { type: 'chest', label: 'Chest' },
    { type: 'arms', label: 'Arms' },
    { type: 'waist', label: 'Waist' },
    { type: 'legs', label: 'Legs' },
    { type: 'primary_weapon', label: 'Primary Weapon' },
    { type: 'secondary_weapon', label: 'Secondary Weapon' },
    { type: 'ranged_weapon', label: 'Ranged Weapon' },
    { type: 'amulet', label: 'Amulet' },
    { type: 'ring1', label: 'Ring 1' },
    { type: 'ring2', label: 'Ring 2' },
  ];
  
  const gearLines = slots.map(slot => {
    const item = equippedGear[slot.type];
    if (!item) {
      return `- **${slot.label}**: Empty`;
    }
    
    const stats: string[] = [];
    if (item.stats.ac) stats.push(`AC +${item.stats.ac}`);
    if (item.stats.damage) stats.push(`Damage: ${item.stats.damage}`);
    if (item.stats.attackBonus) stats.push(`Attack +${item.stats.attackBonus}`);
    
    const statStr = stats.length > 0 ? ` (${stats.join(', ')})` : '';
    const setInfo = item.setName ? ` [${item.setName}]` : '';
    
    return `- **${slot.label}**: ${item.name}${statStr}${setInfo}`;
  });
  
  return `## EQUIPPED GEAR

${gearLines.join('\n')}`;
}

function generateSetBonusSection(equippedGear: Record<EquipmentSlotType, EquipmentItem | null>): string {
  // Count pieces per set
  const setCounts: Record<string, { count: number; name: string }> = {};
  
  Object.values(equippedGear).forEach(item => {
    if (item?.setId) {
      if (!setCounts[item.setId]) {
        setCounts[item.setId] = { count: 0, name: item.setName || item.setId };
      }
      setCounts[item.setId].count++;
    }
  });
  
  const activeSets = Object.entries(setCounts).filter(([, data]) => data.count >= 2);
  
  if (activeSets.length === 0) {
    return `## ACTIVE SET BONUSES

*No set bonuses active. Equip 2+ pieces from the same legendary set to activate bonuses.*`;
  }
  
  const setBonusLines = activeSets.map(([setId, data]) => {
    const setDef = legendarySetDefinitions.find(s => s.id === setId);
    if (!setDef) return `### ${data.name} (${data.count}/8 pieces)\n*Set definition not found.*`;
    
    const activeBonuses = setDef.bonuses
      .filter(b => data.count >= b.piecesRequired)
      .map(b => `- **(${b.piecesRequired} pieces)**: ${b.bonus}`);
    
    const nextBonus = setDef.bonuses.find(b => data.count < b.piecesRequired);
    const nextBonusLine = nextBonus 
      ? `\n- *(Next at ${nextBonus.piecesRequired} pieces)*` 
      : '';
    
    return `### ${data.name} (${data.count}/8 pieces)

${activeBonuses.join('\n')}${nextBonusLine}`;
  });
  
  return `## ACTIVE SET BONUSES

${setBonusLines.join('\n\n')}`;
}

function generateBuildSummary(
  character: Character,
  allAbilities: Ability[],
  unlockedAbilities: Map<string, number>,
  equippedGear: Record<EquipmentSlotType, EquipmentItem | null>
): string {
  // Tree distribution
  const hunterPoints = getTreePoints(allAbilities, unlockedAbilities, 'hunter');
  const warriorPoints = getTreePoints(allAbilities, unlockedAbilities, 'warrior');
  const assassinPoints = getTreePoints(allAbilities, unlockedAbilities, 'assassin');
  
  // Determine primary build archetype
  const maxTree = Math.max(hunterPoints, warriorPoints, assassinPoints);
  let primaryArchetype = 'Balanced';
  if (maxTree > 0) {
    if (hunterPoints === maxTree) primaryArchetype = 'Hunter';
    else if (warriorPoints === maxTree) primaryArchetype = 'Warrior';
    else if (assassinPoints === maxTree) primaryArchetype = 'Assassin';
  }
  
  // Count legendary pieces
  const legendaryCount = Object.values(equippedGear)
    .filter(item => item?.rarity === 'legendary').length;
  
  // Equipped abilities summary
  const equippedAbilityNames = (character.equippedAbilities || [])
    .map(id => allAbilities.find(a => a.id === id)?.name)
    .filter(Boolean)
    .join(', ') || 'None';
  
  return `## QUICK BUILD SUMMARY (For GM Reference)

| Attribute | Value |
|-----------|-------|
| Character | ${character.name || 'Unnamed'} |
| Level | ${character.level} |
| Primary Archetype | ${primaryArchetype} |
| Tree Distribution | Hunter: ${hunterPoints} / Warrior: ${warriorPoints} / Assassin: ${assassinPoints} |
| Sneak Attack | ${getSneakAttackDice(character.level)} |
| Legendary Gear | ${legendaryCount}/11 slots |
| Active Loadout | ${equippedAbilityNames} |

---

**Narrative Guidance**: This character leans ${primaryArchetype.toLowerCase()}, emphasizing ${
  primaryArchetype === 'Hunter' ? 'ranged tactics, traps, and environmental awareness' :
  primaryArchetype === 'Warrior' ? 'melee dominance, crowd control, and raw power' :
  primaryArchetype === 'Assassin' ? 'stealth, critical strikes, and surgical precision' :
  'versatility across all combat styles'
}. Reference their equipped abilities and gear effects when narrating their actions.`;
}

function getTreePoints(
  allAbilities: Ability[], 
  unlockedAbilities: Map<string, number>, 
  tree: 'hunter' | 'warrior' | 'assassin'
): number {
  let points = 0;
  unlockedAbilities.forEach((tier, id) => {
    const ability = allAbilities.find(a => a.id === id);
    if (ability?.tree === tree) {
      points += tier;
    }
  });
  return points;
}

/**
 * Generates a compact, paste-ready snapshot of the current character state
 * Designed for quick session updates to an AI DM
 */
export function generateCurrentStateSummary(data: CharacterBuildData): string {
  const { character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats } = data;
  
  const timestamp = new Date().toLocaleString();
  const lines: string[] = [];
  
  // Header
  lines.push(`📋 CHARACTER STATE SNAPSHOT`);
  lines.push(`Generated: ${timestamp}`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push('');
  
  // Core Identity
  lines.push(`👤 ${character.name || 'Unnamed Assassin'} | Level ${character.level}${prestigeLevel ? ` (P${prestigeLevel})` : ''}`);
  lines.push(`⚔️ Sneak Attack: ${getSneakAttackDice(character.level)}`);
  lines.push('');
  
  // Combat Stats (if available)
  if (aggregatedStats) {
    const statsLine: string[] = [];
    if (aggregatedStats.totalAC) statsLine.push(`AC ${aggregatedStats.totalAC}`);
    if (aggregatedStats.totalAttackBonus) statsLine.push(`ATK +${aggregatedStats.totalAttackBonus}`);
    if (aggregatedStats.damage) statsLine.push(`DMG ${aggregatedStats.damage}`);
    if (statsLine.length > 0) {
      lines.push(`🛡️ ${statsLine.join(' | ')}`);
    }
    
    // Attributes
    const attrs: string[] = [];
    if (aggregatedStats.strength) attrs.push(`STR+${aggregatedStats.strength}`);
    if (aggregatedStats.dexterity) attrs.push(`DEX+${aggregatedStats.dexterity}`);
    if (aggregatedStats.constitution) attrs.push(`CON+${aggregatedStats.constitution}`);
    if (aggregatedStats.intelligence) attrs.push(`INT+${aggregatedStats.intelligence}`);
    if (aggregatedStats.wisdom) attrs.push(`WIS+${aggregatedStats.wisdom}`);
    if (aggregatedStats.charisma) attrs.push(`CHA+${aggregatedStats.charisma}`);
    if (attrs.length > 0) {
      lines.push(`📊 Gear Bonuses: ${attrs.join(', ')}`);
    }
    lines.push('');
  }
  
  // Active Loadout
  const equippedIds = character.equippedAbilities || [];
  const equippedAbilities = equippedIds
    .map(id => {
      const ability = abilities.find(a => a.id === id);
      if (!ability) return null;
      const tier = unlockedAbilities.get(ability.id) || 1;
      const actionIcon = ability.actionType === 'action' ? '🔴' : 
                         ability.actionType === 'bonus_action' ? '🟡' : 
                         ability.actionType === 'reaction' ? '🔵' : '⚪';
      return `${actionIcon} ${ability.name} (T${tier})`;
    })
    .filter(Boolean);
  
  if (equippedAbilities.length > 0) {
    lines.push(`🎯 ACTIVE ABILITIES:`);
    equippedAbilities.forEach(a => lines.push(`   ${a}`));
    lines.push('');
  }
  
  // Key Gear (non-empty slots with notable items)
  const keyGear: string[] = [];
  const weaponSlots: EquipmentSlotType[] = ['primary_weapon', 'secondary_weapon', 'ranged_weapon'];
  const armorSlots: EquipmentSlotType[] = ['head', 'chest', 'arms', 'waist', 'legs'];
  const accessorySlots: EquipmentSlotType[] = ['amulet', 'ring1', 'ring2'];
  
  // Weapons
  weaponSlots.forEach(slot => {
    const item = equippedGear[slot];
    if (item) {
      const dmg = item.stats.damage ? ` (${item.stats.damage})` : '';
      keyGear.push(`⚔️ ${item.name}${dmg}`);
    }
  });
  
  // Count armor pieces
  const armorPieces = armorSlots.filter(slot => equippedGear[slot]).length;
  const legendaryArmor = armorSlots.filter(slot => equippedGear[slot]?.rarity === 'legendary').length;
  if (armorPieces > 0) {
    keyGear.push(`🛡️ ${armorPieces}/5 armor slots filled (${legendaryArmor} legendary)`);
  }
  
  // Accessories
  accessorySlots.forEach(slot => {
    const item = equippedGear[slot];
    if (item && item.rarity === 'legendary') {
      keyGear.push(`💎 ${item.name}`);
    }
  });
  
  if (keyGear.length > 0) {
    lines.push(`🎒 KEY GEAR:`);
    keyGear.forEach(g => lines.push(`   ${g}`));
    lines.push('');
  }
  
  // Active Set Bonuses
  const setCounts: Record<string, { count: number; name: string }> = {};
  Object.values(equippedGear).forEach(item => {
    if (item?.setId) {
      if (!setCounts[item.setId]) {
        setCounts[item.setId] = { count: 0, name: item.setName || item.setId };
      }
      setCounts[item.setId].count++;
    }
  });
  
  const activeSets = Object.entries(setCounts)
    .filter(([, data]) => data.count >= 2)
    .map(([setId, data]) => {
      const setDef = legendarySetDefinitions.find(s => s.id === setId);
      const highestBonus = setDef?.bonuses
        .filter(b => data.count >= b.piecesRequired)
        .sort((a, b) => b.piecesRequired - a.piecesRequired)[0];
      return `✨ ${data.name} (${data.count}/8): ${highestBonus?.bonus || 'Bonus active'}`;
    });
  
  if (activeSets.length > 0) {
    lines.push(`🌟 SET BONUSES:`);
    activeSets.forEach(s => lines.push(`   ${s}`));
    lines.push('');
  }
  
  // Build Archetype
  const hunterPoints = getTreePoints(abilities, unlockedAbilities, 'hunter');
  const warriorPoints = getTreePoints(abilities, unlockedAbilities, 'warrior');
  const assassinPoints = getTreePoints(abilities, unlockedAbilities, 'assassin');
  const totalPoints = hunterPoints + warriorPoints + assassinPoints;
  
  if (totalPoints > 0) {
    lines.push(`📈 BUILD: Hunter ${hunterPoints} / Warrior ${warriorPoints} / Assassin ${assassinPoints}`);
  }
  
  lines.push('');
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`Use this snapshot to inform ability checks, combat narration, and gear effects.`);
  
  return lines.join('\n');
}

// Static guide that doesn't change
export const STATIC_GM_GUIDE = `# ODYSSEY ASSASSIN - AI GM SYNCHRONIZATION GUIDE
Version 2.0 | For AI Dungeon Masters

## OVERVIEW
You are GMing for a player using the "Odyssey Assassin" digital character sheet. This guide bridges communication between the sheet's mechanics and your narrative. The player will report their stats, abilities, and roll results—your role is to interpret these within the fiction.

---

## CHARACTER STRUCTURE

### Level & XP System
- **Max Level**: 20
- **XP per Level**: Varies by progression mode (Standard/Accelerated/Relaxed)
- **Ability Points**: 1 per level + bonus at levels 4, 8, 12, 16, 19
- **Active Ability Slots**: 2 (Lv1-4) → 3 (Lv5-10) → 4 (Lv11-16) → 5 (Lv17-20)

### Three Ability Trees
1. **HUNTER** (Ranged/Tactical) - Bow mastery, traps, beast companions, environmental exploitation
2. **WARRIOR** (Melee/Tank) - Heavy weapons, shields, berserker rage, crowd control
3. **ASSASSIN** (Stealth/Precision) - Critical strikes, poison, invisibility, instant kills

### Ability Tiers (1-3)
Each ability can be upgraded through 3 tiers:
- **Tier 1**: Basic effect, foundational
- **Tier 2**: Enhanced effect, additional utility
- **Tier 3**: Mastery effect, dramatic power spike

---

## ACTION ECONOMY (Per Turn)

| Action Type | Count | Examples |
|-------------|-------|----------|
| Action | 1 | Attack, Ability, Interact |
| Bonus Action | 1 | Off-hand attack, Quick ability |
| Reaction | 1 | Counter, Parry, Opportunity |
| Movement | 30ft | Can split before/after actions |
| Free Action | Unlimited | Speak, drop item, simple gesture |

### Usage Types
- **At-Will**: Unlimited use
- **Short Rest**: Recharges after 1-hour rest
- **Long Rest**: Recharges after 8-hour rest

---

## DICE SYSTEM

### Standard Roll Format
Player reports: "[Ability/Skill] roll: [Result] (natural [d20 value])"

### Critical Thresholds
- **Natural 1**: Critical failure - something goes dramatically wrong
- **Natural 20**: Critical success - maximum effect + narrative bonus
- **DC Ranges**: Easy (10), Medium (15), Hard (20), Very Hard (25), Nearly Impossible (30)

### Advantage/Disadvantage
- **Advantage**: Roll 2d20, take higher
- **Disadvantage**: Roll 2d20, take lower
- Player will specify when reporting rolls

---

## LEGENDARY GEAR SYSTEM

### 8 Legendary Sets (8 pieces each)
Each set has a thematic identity. Players unlock gear by completing FEATS (tracked achievements).

**Set Bonuses:**
- 2 pieces: Minor passive bonus
- 3 pieces: Moderate ability enhancement
- 5 pieces: Significant power boost
- 8 pieces: Ultimate set effect (build-defining)

### Equipment Slots
- **Head**: Perception, awareness, mental effects
- **Chest**: Defense, health, regeneration
- **Arms**: Attack, manipulation, crafting
- **Waist**: Utility, storage, resource management
- **Legs**: Movement, agility, positioning
- **Primary/Secondary/Ranged Weapons**: Combat options
- **Amulet & Rings**: Magical enhancements

### Gear Unlock Status
Player will report: "[Item Name] - LOCKED (Progress: X/Y)" or "[Item Name] - EQUIPPED"
- Locked gear cannot be used until feat requirement is met
- Interpret equipped gear's effects in your narration

---

## FEAT SYSTEM (Achievement Tracking)

Feats track specific in-game accomplishments. When a player performs a feat-worthy action, they'll increment their progress. Examples:

| Feat Category | Trigger Actions |
|--------------|-----------------|
| Distracting Enemies with Dialogue | Talking during combat to create openings |
| Surviving After 0 HP | Death saves, clutch heals, regeneration |
| Overkill Strikes | Dealing 2x+ lethal damage |
| Delivering One-Liners | Quips after kills |
| Breaking Fourth Wall | Meta-humor, genre awareness |
| Befriending Enemies | Diplomacy with hostiles |
| Dramatic Entrances | Theatrical battle arrivals |

**Your Role**: Acknowledge feat-worthy moments. Say "That sounds like a [Feat Name] moment!" to prompt the player to track progress.

---

## COMBAT FLOW

### Initiative
Player reports their initiative roll. You determine enemy initiatives and turn order.

### Attack Resolution
1. Player declares action + target
2. Player rolls attack (reports result + natural value)
3. If hit, player rolls damage
4. You narrate the outcome, incorporating their gear/abilities

### Damage Types
Physical: Slashing, Piercing, Bludgeoning
Elemental: Fire, Cold, Lightning, Poison, Acid
Special: Psychic, Necrotic, Radiant, Force

### Status Effects to Track
- **Bleeding**: Ongoing damage each turn
- **Poisoned**: Disadvantage on attacks/ability checks
- **Stunned**: Skip turn, auto-fail Dex saves
- **Invisible**: Advantage on attacks, enemies have disadvantage
- **Marked**: Hunter's Focus - extra damage from marker

---

## SITUATIONAL MODIFIERS

The player's sheet tracks active situations. They may report:
- "I have HIGH GROUND" (+2 to ranged attacks)
- "Enemy is FLANKED" (Advantage on melee)
- "I'm in STEALTH" (Advantage on first attack)
- "Combat started with SURPRISE" (Extra turn for ambushers)

Acknowledge these in your DC settings and narrative.

---

## PRESTIGE SYSTEM (Post-Level 20)

If player mentions Prestige:
- **Prestige Points**: Earned after max level, spent on permanent bonuses
- **Prestige Level**: Indicates how many times they've "prestiged"
- These represent mastery beyond normal limits

---

## INFINITY STONES (Optional Endgame)

If the player has collected Infinity Stones:
- **Power**: Raw damage amplification
- **Space**: Teleportation, positioning
- **Time**: Action economy manipulation
- **Reality**: Environment alteration
- **Soul**: Life/death manipulation
- **Mind**: Mental domination

Each stone grants reality-bending abilities. Treat with appropriate narrative weight.

---

## COMMUNICATION PROTOCOL

### What the Player Reports
- Current HP / Max HP
- Active abilities in loadout (up to 5)
- Equipped gear and set bonuses
- Roll results with natural values
- Active situational modifiers
- Feat progress (when relevant)

### What You Provide
- Enemy stats and behaviors (hidden)
- Environmental descriptions and hazards
- DC values for checks
- Narrative consequences of actions
- XP rewards (if tracking)
- Loot and treasure

---

## NARRATIVE INTEGRATION TIPS

1. **Reference Their Gear**: "Your Mask of Perpetual Commentary whispers a quip as you..."
2. **Honor Their Build**: Hunter → describe tactical positioning; Warrior → emphasize raw power; Assassin → highlight precision
3. **Acknowledge Tier Upgrades**: Higher tiers = more dramatic effect descriptions
4. **Track Ability Cooldowns**: If they used a Short Rest ability, it's unavailable until rest
5. **Celebrate Feats**: When they unlock gear, describe it manifesting or being discovered

---

## QUICK REFERENCE

**Ability Points by Level**: Level + bonuses at 4/8/12/16/19
**Active Slots**: 2→3→4→5 at levels 1/5/11/17
**Critical Hit**: Natural 20 = max damage + bonus effect
**Death Saves**: 3 successes = stabilize, 3 failures = death
**Short Rest**: 1 hour, recover some abilities
**Long Rest**: 8 hours, recover all abilities + HP

---

## FINAL NOTE

This character sheet emphasizes player agency and mechanical depth. Your role is to create a world that responds meaningfully to their choices. When in doubt, ask the player to clarify their sheet's current state—they have all the data, you have the narrative authority.

**Let the hunt begin.**`;
