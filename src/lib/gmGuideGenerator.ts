import { Character, CharacterAbility, getActiveSlotsByLevel, getTotalPointsSpent, getPointsSpentInTree } from '@/lib/types';
import { Ability } from '@/lib/types';
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { legendarySetDefinitions } from '@/lib/inventory/legendarySets';
import { prestigeAbilities } from '@/lib/prestigeTree/abilities';
import { PrestigeTreeProgress } from '@/lib/prestigeTree/types';
import { getCombinedGMGuide, stripGuideFormatting } from '@/lib/gmGuidePrompts';
export interface CharacterBuildData {
  character: Character;
  abilities: Ability[];
  unlockedAbilities: Map<string, number>;
  equippedGear: Record<EquipmentSlotType, EquipmentItem | null>;
  prestigeLevel?: number;
  totalPrestigePoints?: number;
  prestigeTreeProgress?: PrestigeTreeProgress;
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
  const { character, abilities, unlockedAbilities, equippedGear, prestigeLevel, totalPrestigePoints, prestigeTreeProgress } = data;
  
  const sections: string[] = [];
  
  // Header
  sections.push(`# CURRENT CHARACTER STATE
Updated: ${new Date().toLocaleString()}
Player: ${character.name || 'Unnamed Assassin'}

---`);

  // Core Stats Section
  sections.push(generateCoreStatsSection(character, prestigeLevel, totalPrestigePoints));
  
  // Equipped Abilities Section
  sections.push(generateAbilitiesSection(character, abilities, unlockedAbilities));
  
  // Equipped Gear Section
  sections.push(generateGearSection(equippedGear));
  
  // Active Set Bonuses Section
  sections.push(generateSetBonusSection(equippedGear));
  
  // Prestige Tree Section (if unlocked)
  if (prestigeTreeProgress && prestigeTreeProgress.unlockedAbilities.length > 0) {
    sections.push(generatePrestigeTreeSection(prestigeTreeProgress));
  }
  
  // Build Summary for Quick Reference
  sections.push(generateBuildSummary(character, abilities, unlockedAbilities, equippedGear));
  
  return sections.join('\n\n');
}

function generateCoreStatsSection(character: Character, prestigeLevel?: number, totalPrestigePoints?: number): string {
  const activeSlots = getActiveSlotsByLevel(character.level, totalPrestigePoints || 0);
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
    { type: 'primary_weapon', label: 'Main Hand' },
    { type: 'secondary_weapon', label: 'Offhand' },
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

function generatePrestigeTreeSection(progress: PrestigeTreeProgress): string {
  const unlockedIds = new Set(progress.unlockedAbilities);
  const unlockedPrestigeAbilities = prestigeAbilities.filter(a => unlockedIds.has(a.id));
  
  if (unlockedPrestigeAbilities.length === 0) {
    return '';
  }
  
  // Group by branch
  const byBranch: Record<string, typeof unlockedPrestigeAbilities> = {
    dual_wielding: [],
    guenhwyvar: [],
    drow_abilities: [],
    monk_abilities: [],
  };
  
  unlockedPrestigeAbilities.forEach(ability => {
    byBranch[ability.branch].push(ability);
  });
  
  const branchSections: string[] = [];
  
  if (byBranch.dual_wielding.length > 0) {
    const abilities = byBranch.dual_wielding.map(a => 
      `- **${a.name}** (T${a.tier}): ${a.description}\n  *Prompt*: ${a.aiPrompt}\n  *Mechanics*: ${a.mechanicalContext}`
    ).join('\n');
    branchSections.push(`### Dual Wielding Branch (Scimitar Mastery)\n${abilities}`);
  }
  
  if (byBranch.guenhwyvar.length > 0) {
    const abilities = byBranch.guenhwyvar.map(a => 
      `- **${a.name}** (T${a.tier}): ${a.description}\n  *Prompt*: ${a.aiPrompt}\n  *Mechanics*: ${a.mechanicalContext}`
    ).join('\n');
    branchSections.push(`### Guenhwyvar Branch (Astral Companion)\n${abilities}`);
  }
  
  if (byBranch.drow_abilities.length > 0) {
    const abilities = byBranch.drow_abilities.map(a => 
      `- **${a.name}** (T${a.tier}): ${a.description}\n  *Prompt*: ${a.aiPrompt}\n  *Mechanics*: ${a.mechanicalContext}`
    ).join('\n');
    branchSections.push(`### Drow Abilities Branch (Shadow Magic)\n${abilities}`);
  }
  
  if (byBranch.monk_abilities.length > 0) {
    const abilities = byBranch.monk_abilities.map(a => 
      `- **${a.name}** (T${a.tier}): ${a.description}\n  *Prompt*: ${a.aiPrompt}\n  *Mechanics*: ${a.mechanicalContext}`
    ).join('\n');
    branchSections.push(`### Monk Abilities Branch (Spiritual Discipline)\n${abilities}`);
  }
  
  return `## DRIZZT'S LEGACY (Prestige Abilities)

*Legendary abilities unlocked through mastery of all base skills.*

${branchSections.join('\n\n')}`;
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
  const { character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats, prestigeTreeProgress } = data;
  
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
  
  // Prestige abilities (if any)
  if (prestigeTreeProgress && prestigeTreeProgress.unlockedAbilities.length > 0) {
    const prestigeNames = prestigeTreeProgress.unlockedAbilities
      .map(id => prestigeAbilities.find(a => a.id === id)?.name)
      .filter(Boolean)
      .slice(0, 5);
    lines.push(`👑 LEGACY ABILITIES:`);
    prestigeNames.forEach(name => lines.push(`   ✨ ${name}`));
    if (prestigeTreeProgress.unlockedAbilities.length > 5) {
      lines.push(`   ... and ${prestigeTreeProgress.unlockedAbilities.length - 5} more`);
    }
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

// Static guide that doesn't change - EXPANDED TO ~29,000 characters
export const STATIC_GM_GUIDE = `# ODYSSEY ASSASSIN - AI GM SYNCHRONIZATION GUIDE
Version 3.0 | Comprehensive Edition for AI Dungeon Masters
Target Length: ~29,000 characters

═══════════════════════════════════════════════════════════════════════════════
OVERVIEW & PURPOSE
═══════════════════════════════════════════════════════════════════════════════

You are GMing for a player using the "Odyssey Assassin" digital character sheet—a custom D&D 5e Assassin class implementation with extensive homebrew abilities, legendary gear, achievement tracking, and post-endgame prestige progression. This guide bridges communication between the sheet's mechanics and your narrative, ensuring seamless integration between digital tracking and tabletop roleplay.

The player will report their stats, abilities, roll results, and equipment. Your role is to interpret these within the fiction while respecting the mechanical framework. The character sheet tracks everything; you provide the world, enemies, and story.

**Core Philosophy**: This system emphasizes player agency, mechanical depth, and narrative integration. Every ability has been designed with both mechanical effects AND roleplay prompts. When the player uses an ability, they may share the associated prompt to guide your narration.

═══════════════════════════════════════════════════════════════════════════════
SECTION 1: CHARACTER STRUCTURE & PROGRESSION
═══════════════════════════════════════════════════════════════════════════════

### 1.1 Level & XP System

| Attribute | Standard Value |
|-----------|----------------|
| Max Base Level | 20 |
| XP per Level | Varies by progression mode |
| Ability Points | 1 per level + bonus at 4, 8, 12, 16, 19 |
| Total Ability Points | 25 by level 20 |

**Active Ability Slots by Level:**
- Levels 1-4: 2 slots
- Levels 5-10: 3 slots
- Levels 11-16: 4 slots
- Levels 17-20: 5 slots

**Progression Modes:**
- **Standard**: Default XP curve, balanced for normal campaigns
- **Accelerated**: 75% XP required, faster leveling
- **Relaxed**: 125% XP required, extended progression

### 1.2 Three Ability Trees

The Odyssey Assassin has THREE distinct ability trees, each with 8 abilities (24 total). Players invest ability points to unlock and upgrade abilities within these trees.

#### 🏹 HUNTER TREE (Ranged/Tactical)
*Theme: Precision archery, traps, beast companions, environmental awareness*

**Active Abilities:**
1. **Devastating Shot** (Bonus Action, At-Will)
   - T1: +1d8 ranged damage on next attack
   - T2: +2d8, ignores half cover
   - T3: +3d8, ignores all cover

2. **Multi-Shot** (Action, At-Will)
   - T1: Target up to 2 enemies within 10ft of each other
   - T2: Target up to 3 enemies, add ability modifier to damage
   - T3: Target up to 4 enemies, each takes +1d6 damage

3. **Predator Shot** (Action, Short Rest)
   - T1: Mark target for 1 minute, attacks have advantage
   - T2: Target cannot benefit from invisibility
   - T3: Marked target takes +2d6 damage from your attacks

4. **Ghost Arrows** (Bonus Action, Short Rest, Lv9+)
   - T1: Arrows become ethereal for 1 minute, pass through barriers
   - T2: Deal force damage instead of piercing
   - T3: Can hit creatures on the Ethereal Plane

5. **Rain of Destruction** (Action, Long Rest, Lv9+, requires Multi-Shot T3)
   - T1: 20ft radius, DEX save or 4d8 piercing
   - T2: 6d8 damage, failed saves halve movement
   - T3: 8d8 damage, area becomes difficult terrain

**Passive Abilities:**
6. **Archery Master**
   - T1: +1 to ranged attack rolls
   - T2: +2 attack, +1 damage
   - T3: +2 attack, +2 damage

7. **Hunter's Instinct**
   - T1: Advantage on Perception to spot hidden creatures
   - T2: Blindsight 10ft
   - T3: Blindsight 30ft, cannot be surprised

8. **Arrow Retrieval**
   - T1: Retrieve 50% ammunition after combat
   - T2: Retrieve 75%, can retrieve from corpses as bonus action
   - T3: 100% retrieval, arrows magically return

#### ⚔️ WARRIOR TREE (Melee/Tank)
*Theme: Heavy weapons, shields, berserker rage, crowd control*

**Active Abilities:**
1. **Ring of Chaos** (Action, At-Will)
   - T1: All creatures within 5ft DEX save or 2d6 slashing
   - T2: 3d6 damage, failed saves pushed 5ft
   - T3: 4d6 damage, radius increases to 10ft

2. **Shield Breaker** (Action, At-Will)
   - T1: Strike ignores shield AC bonuses
   - T2: Target cannot use shield until end of next turn
   - T3: Non-magical shields are destroyed

3. **Battlecry** (Bonus Action, Short Rest, Lv9+)
   - T1: Allies within 30ft gain +1d4 to next attack
   - T2: +1d6 bonus, allies gain temp HP = your level
   - T3: +1d8 bonus, enemies must WIS save or be frightened

4. **Spartan Rage** (Bonus Action, Long Rest)
   - T1: 1 minute rage: +2 melee damage, resistance to B/P/S
   - T2: +4 damage, advantage on STR checks/saves
   - T3: +6 damage, drop to 1 HP instead of 0 once

5. **Hero Strike** (Action, Short Rest, Lv9+)
   - T1: Weapon damage + 3d10
   - T2: Weapon + 5d10, target staggered (disadvantage next attack)
   - T3: Weapon + 7d10, this attack automatically hits

**Passive Abilities:**
6. **Weapon Master**
   - T1: +1 to melee attack rolls
   - T2: +2 attack, +1 damage
   - T3: +2 attack, +2 damage, crit range 19-20

7. **Warrior's Resilience**
   - T1: +1 AC in medium/heavy armor
   - T2: +2 AC, reduce crits to normal hits
   - T3: Reduce incoming damage by proficiency bonus

8. **Second Wind Mastery**
   - T1: Second Wind heals +1d10
   - T2: Heals +2d10, removes one condition
   - T3: Gain extra Second Wind use per short rest

#### 🗡️ ASSASSIN TREE (Stealth/Precision)
*Theme: Critical strikes, poison, invisibility, instant kills*

**Active Abilities:**
1. **Critical Assassination** (Passive, At-Will)
   - T1: +2d6 damage vs surprised creatures
   - T2: +4d6, auto-crit on surprised targets
   - T3: +6d6, Sneak Attack without advantage if surprised

2. **Shadow Step** (Bonus Action, At-Will)
   - T1: Teleport 30ft to dim light/darkness
   - T2: 60ft range, advantage on next attack
   - T3: Pass through solid objects, leave shadow decoy

3. **Venomous Attacks** (Bonus Action, Short Rest)
   - T1: Coat weapon for 1 minute, +1d6 poison on hit
   - T2: +2d6 poison, CON save or poisoned 1 round
   - T3: +3d6 poison, poisoned targets have disadvantage on all saves

4. **Vanish** (Bonus Action, Short Rest)
   - T1: Invisible until end of next turn or attack
   - T2: 1 minute duration, attacking while hidden doesn't break it
   - T3: Leave no tracks, immune to scent/tremorsense detection

5. **Death's Veil** (Reaction, Long Rest, Lv9+)
   - T1: When dropping to 0 HP, instead drop to 1 and become invisible
   - T2: Also teleport 30ft when activating
   - T3: Regain half max HP instead of dropping to 1

**Passive Abilities:**
6. **Shadow Dancer**
   - T1: +5ft movement, Hide as bonus action
   - T2: +10ft movement, move through enemies as difficult terrain
   - T3: +15ft movement, move through walls if ending outside

7. **Poison Tolerance**
   - T1: Resistance to poison, advantage vs poisoned
   - T2: Immunity to poison damage and poisoned condition
   - T3: When poisoned, instead heal 1d10 HP

8. **Sixth Sense** (Lv15+)
   - T1: +2 Initiative, cannot be surprised
   - T2: +5 Initiative, act normally on surprise rounds
   - T3: Always act first in initiative, immune to divination

### 1.3 Ability Tiers (1-3)

Each ability can be upgraded through 3 tiers by spending additional ability points:
- **Tier 1**: Basic effect, foundational capability
- **Tier 2**: Enhanced effect, additional utility or power
- **Tier 3**: Mastery effect, dramatic power spike with unique benefits

**Tier Upgrade Cost**: 1 ability point per tier (3 points to max an ability)

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: ACTION ECONOMY & COMBAT FLOW
═══════════════════════════════════════════════════════════════════════════════

### 2.1 Action Economy (Per Turn)

| Action Type | Count | Examples |
|-------------|-------|----------|
| Action | 1 | Attack, Cast Spell, Dash, Dodge, Use Ability |
| Bonus Action | 1 | Off-hand attack, Quick ability, Cunning Action |
| Reaction | 1 | Attack of Opportunity, Counter, Parry |
| Movement | 30ft base | Can split before/after actions |
| Free Action | Unlimited | Speak, drop item, simple gesture |
| Object Interaction | 1 | Draw weapon, open door, pick up item |

### 2.2 Usage Types

- **At-Will**: Unlimited use, no resource cost
- **Short Rest**: Recharges after 1-hour rest (typically 2-3 uses)
- **Long Rest**: Recharges after 8-hour rest (typically 1 use)
- **Per Turn**: Can only be used once per turn

### 2.3 Combat Flow

**Initiative**: Player reports their roll. You determine enemy initiatives.

**Attack Resolution:**
1. Player declares action + target
2. Player rolls attack (reports total + natural d20 value)
3. You confirm hit/miss against target's AC
4. On hit, player rolls damage
5. You narrate outcome, incorporating abilities and gear

**Sneak Attack Conditions:**
- Advantage on the attack roll, OR
- An ally is within 5ft of the target and you don't have disadvantage
- Once per turn, adds dice based on level (1d6 at level 1, scaling to 10d6 at level 19)

### 2.4 Damage Types

**Physical**: Slashing, Piercing, Bludgeoning
**Elemental**: Fire, Cold, Lightning, Poison, Acid, Thunder
**Special**: Psychic, Necrotic, Radiant, Force

### 2.5 Common Status Effects

| Condition | Effect |
|-----------|--------|
| Blinded | Auto-fail sight checks, disadvantage on attacks, attacks against have advantage |
| Charmed | Can't attack charmer, charmer has advantage on social checks |
| Frightened | Disadvantage on checks/attacks while source visible, can't approach |
| Grappled | Speed 0, ends if grappler incapacitated or forcibly moved |
| Incapacitated | Can't take actions or reactions |
| Invisible | Attacks have advantage, attacks against have disadvantage |
| Paralyzed | Incapacitated, auto-fail STR/DEX saves, attacks have advantage, melee hits crit |
| Poisoned | Disadvantage on attacks and ability checks |
| Prone | Disadvantage on attacks, melee against has advantage, ranged has disadvantage |
| Restrained | Speed 0, disadvantage on attacks/DEX saves, attacks have advantage |
| Stunned | Incapacitated, auto-fail STR/DEX saves, attacks have advantage |
| Unconscious | Incapacitated, drop items, fall prone, auto-fail STR/DEX, attacks advantage, melee crits |

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: DICE SYSTEM & CRITICAL MECHANICS
═══════════════════════════════════════════════════════════════════════════════

### 3.1 Standard Roll Format

Player reports: "[Ability/Skill] roll: [Total] (natural [d20 value])"

Example: "Stealth check: 23 (natural 18)"

### 3.2 Critical Thresholds

| Result | Effect |
|--------|--------|
| Natural 1 | Critical failure - automatic miss, potential complication |
| Natural 20 | Critical success - automatic hit, double damage dice |

**Expanded Crit Range**: Some abilities (Weapon Master T3) expand crit range to 19-20.

### 3.3 Difficulty Classes

| Difficulty | DC | Examples |
|------------|-----|----------|
| Very Easy | 5 | Climbing a knotted rope |
| Easy | 10 | Hearing an approaching guard |
| Medium | 15 | Breaking down a wooden door |
| Hard | 20 | Leaping across a 20ft chasm |
| Very Hard | 25 | Picking a masterwork lock |
| Nearly Impossible | 30 | Climbing a sheer surface in a hurricane |

### 3.4 Advantage/Disadvantage

- **Advantage**: Roll 2d20, take higher
- **Disadvantage**: Roll 2d20, take lower
- They cancel each other out (any amount of each = normal roll)
- Player will specify when reporting rolls

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: LEGENDARY GEAR SYSTEM
═══════════════════════════════════════════════════════════════════════════════

### 4.1 Equipment Slots

| Slot | Primary Function |
|------|------------------|
| Head | Perception, awareness, mental effects |
| Chest | Defense, health, regeneration |
| Arms | Attack, manipulation, crafting |
| Waist | Utility, storage, resource management |
| Legs | Movement, agility, positioning |
| Primary Weapon | Main melee weapon |
| Secondary Weapon | Off-hand weapon or shield |
| Ranged Weapon | Bow, crossbow, or throwing weapons |
| Amulet | Magical enhancement (typically saves or abilities) |
| Ring 1 | Magical enhancement (typically stats or effects) |
| Ring 2 | Magical enhancement (typically stats or effects) |

### 4.2 The 8 Legendary Sets

Each set has 8 pieces and a distinct thematic identity. Set bonuses activate at thresholds:

**Set Bonus Thresholds:**
- 2 pieces: Minor passive bonus
- 3 pieces: Moderate ability enhancement
- 5 pieces: Significant power boost
- 8 pieces: Ultimate set effect (build-defining)

**The Legendary Sets:**

1. **Merc with a Mouth** - Fourth-wall breaking, comedic chaos
2. **Unkillable Merc** - Regeneration and survivability
3. **Self-Aware Slayer** - Meta-narrative manipulation
4. **Chaotic Contracts** - Mercenary work and gold generation
5. **Violent Comedy** - Damage through humor
6. **Regenerative Ridiculousness** - Healing and resurrection
7. **Absolute Absurdity** - Reality-breaking effects
8. **Self-Aware Arsenal** - Weapon-focused effects

### 4.3 Gear Unlock System (FEATS)

Legendary gear is LOCKED until the player completes related FEATS (achievements). The player will report gear status:

- **LOCKED (Progress: X/Y)**: Cannot be used yet
- **UNLOCKED**: Available to equip
- **EQUIPPED**: Currently worn/wielded

When narrating gear effects, only reference EQUIPPED items. Acknowledge progress toward locked items when relevant to encourage the player.

═══════════════════════════════════════════════════════════════════════════════
SECTION 5: FEAT/ACHIEVEMENT SYSTEM
═══════════════════════════════════════════════════════════════════════════════

### 5.1 Feat Categories (40 Total)

Feats track specific in-game accomplishments. When a player performs a feat-worthy action, they increment their progress. Reaching milestones (25%, 50%, 75%, 100%) grants XP rewards.

**Combat Feats:**
| Feat | Trigger | Max |
|------|---------|-----|
| Distracting Enemies with Dialogue | Talk during combat to create openings | 100 |
| Surviving After 0 HP | Death saves, clutch heals, regeneration | 50 |
| Overkill Strikes | Deal 2x+ lethal damage | 100 |
| Firing Shots Without Missing | Consecutive hits | 1000 |
| Counterattacking After Being Hit | Successful ripostes | 100 |

**Roleplay Feats:**
| Feat | Trigger | Max |
|------|---------|-----|
| Delivering Post-Kill One-Liners | Quips after kills | 200 |
| Breaking the Fourth Wall | Meta-humor, genre awareness | 100 |
| Befriending Enemies | Diplomacy with hostiles | 50 |
| Dramatic Entrances | Theatrical battle arrivals | 50 |
| Defusing Tension with Humor | Comedy in serious moments | 100 |

**Meta-Narrative Feats:**
| Feat | Trigger | Max |
|------|---------|-----|
| Predicting Plot Twists | Correctly calling story beats | 50 |
| Recognizing Narrative Tropes | Genre awareness moments | 50 |
| Perceiving Meta-Narrative Elements | Noticing story structure | 30 |
| Influencing Story Outcomes | Player agency moments | 50 |

**Survival Feats:**
| Feat | Trigger | Max |
|------|---------|-----|
| Healing from 0 to Full HP | Single session full recovery | 30 |
| Surviving Lethal Damage | Avoid death from killing blow | 50 |
| Coming Back from Death | Resurrection or death save recovery | 20 |
| Escaping at the Last Second | Narrow escapes | 50 |
| Surviving Impossible Odds | Against overwhelming enemies | 30 |

### 5.2 Your Role as GM

**Acknowledge Feat-Worthy Moments**: When the player does something feat-worthy, say "That sounds like a [Feat Name] moment!" This prompts them to track progress.

**Examples:**
- Player delivers witty quip after kill → "That's definitely a 'Delivering Post-Kill One-Liners' moment!"
- Player survives at 1 HP → "Surviving After 0 HP feat progress!"
- Player predicts the villain's plan → "Predicting Plot Twists achieved!"

═══════════════════════════════════════════════════════════════════════════════
SECTION 6: PRESTIGE SYSTEM (POST-LEVEL 20)
═══════════════════════════════════════════════════════════════════════════════

### 6.1 Base Prestige Progression

After reaching Level 20, players enter the Prestige system:

- **Prestige XP**: Earned from challenging encounters, achievements, and milestones
- **Prestige Levels**: 1-50, each granting 1 Prestige Point
- **Prestige Points**: Spent on permanent bonuses or Drizzt's Legacy abilities

### 6.2 Drizzt's Legacy (Prestige Skill Tree)

**Unlock Requirement**: Master ALL 24 base abilities to Tier 3 (72 total ability points spent)

Once unlocked, players access a new skill tree based on Drizzt Do'Urden's legendary abilities across 4 branches:

#### 🗡️ DUAL WIELDING BRANCH (Scimitar Mastery)
*12 abilities themed around Drizzt's famous fighting style with Icingdeath and Twinkle*

**Tier 1 (Foundation):**
- **Scimitar Mastery** (2 pts): +2 attack with scimitars
- **Twin Blade Grip** (2 pts): Bonus action off-hand attack
- **Icingdeath Bond** (3 pts): +1d4 cold damage, fire resistance
- **Twinkle Bond** (3 pts): +1d4 radiant damage, danger sense

**Tier 2 (Intermediate, requires Prestige 5+):**
- **Dance of Blades** (4 pts): +1 AC when dual-wielding
- **Whirlwind Assault** (5 pts): Spin attack hitting all adjacent enemies
- **Perfect Parry** (4 pts): Deflect ranged attacks
- **Riposte Mastery** (4 pts): Counter-attack after parry

**Tier 3 (Advanced, requires Prestige 8-15+):**
- **Form of the Crow** (8 pts): Legendary stance, advantage on DEX saves, +10 movement
- **Blade Echo** (8 pts): Both scimitars can hit same target twice
- **Legacy of Lolth's Nemesis** (12 pts): Once/day auto-crit
- **Symphony of Steel** (10 pts): Four attacks in one action

#### 🐆 GUENHWYVAR BRANCH (Astral Companion)
*12 abilities themed around Drizzt's magical panther companion*

**Tier 1:**
- **Call Guenhwyvar** (3 pts): Summon astral panther companion
- **Guenhwyvar's Bond** (2 pts): Telepathic link, complex commands
- **Panther's Pounce** (2 pts): Companion advantage after you hit
- **Guenhwyvar's Grace** (2 pts): +1 AC/attack for companion

**Tier 2:**
- **Shared Senses** (4 pts): See through Guenhwyvar's eyes, 120ft darkvision
- **Coordinated Strike** (5 pts): Both hit = disadvantage on target's DEX saves
- **Spectral Guardianship** (4 pts): Guenhwyvar blocks attacks
- **Guenhwyvar's Roar** (4 pts): Frightening roar, WIS save DC 14

**Tier 3:**
- **Guenhwyvar Ascension** (8 pts): Two attacks, +2d6 force damage
- **Soul Link** (8 pts): Redirect half lethal damage to Guenhwyvar
- **Eternal Companion** (10 pts): No summon time limit, 6hr recovery
- **Avatar of the Panther** (10 pts): Position swap teleportation

#### 👁️ DROW ABILITIES BRANCH (Shadow Magic)
*12 abilities themed around drow heritage and Underdark magic*

**Tier 1:**
- **Superior Darkvision** (2 pts): 120ft darkvision, see through magical darkness
- **Drow Magic Attunement** (2 pts): Cast Faerie Fire 1/day (DC 16)
- **Dancing Lights** (2 pts): Cantrip, no action cost
- **Shadow Affinity** (3 pts): Advantage on Stealth in dim light/darkness

**Tier 2:**
- **Darkness Veil** (5 pts): Cast Darkness 1/day, you can see through it
- **Fey Ancestry** (4 pts): Advantage vs charm, immunity to sleep magic
- **Drow Resilience** (4 pts): Poison resistance and advantage
- **Shadow Step** (5 pts): Bonus action invisibility in dim light

**Tier 3:**
- **Lolth's Endurance** (10 pts): Auto-succeed one death save/day
- **Web of Shadows** (8 pts): Cast Web 1/day without components
- **Seldarine's Grace** (8 pts): +2 spell DC/attack for 1 minute
- **Drow Lord's Authority** (10 pts): Lower CR creatures frightened on sight

#### 🔥 MONK ABILITIES BRANCH (Spiritual Discipline)
*12 abilities themed around Drizzt's training at Melee-Magthere and beyond*

**Tier 1:**
- **Monastic Discipline** (2 pts): +1d6 magical unarmed damage
- **Flurry of Blows** (2 pts): Two bonus action unarmed strikes
- **Unarmored Defense** (3 pts): AC = 10 + DEX + WIS
- **Deflect Missiles** (2 pts): Reduce ranged damage, catch and throw back

**Tier 2:**
- **Patient Defense** (4 pts): Bonus action Dodge, advantage on DEX saves
- **Step of the Wind** (4 pts): Bonus action Dash/Disengage, ignore terrain
- **Slow Fall** (3 pts): Reduce fall damage by 5× level
- **Stunning Strike** (5 pts): CON save or stunned (DC 16)

**Tier 3:**
- **Diamond Soul** (8 pts): Proficiency in all saves, reroll failed saves
- **Timeless Body** (6 pts): Ageless, disease immunity, poison resistance
- **Empty Body** (10 pts): Invisible 1 minute, resistance to all but force
- **Perfect Consciousness** (10 pts): Truesight 120ft, always act first

### 6.3 Using Prestige Abilities

When the player uses a prestige ability, they may share both:
1. **AI Prompt**: Narrative description for your narration
2. **Mechanical Context**: Exact rules in brackets [like this]

**Example:**
Player: "I use Form of the Crow"
*Shares prompt*: "I shift into the Form of the Crow, a legendary drow fighting stance that makes me as swift and elusive as the shadow itself."
*Mechanics*: [Bonus action to enter stance. While active: Advantage on DEX saves, +10 feet movement, attacks of opportunity against you have disadvantage. Lasts 1 minute, recharges on short rest.]

Use the prompt to flavor your narration while respecting the mechanical effects.

═══════════════════════════════════════════════════════════════════════════════
SECTION 7: INFINITY STONES (OPTIONAL ENDGAME)
═══════════════════════════════════════════════════════════════════════════════

If the campaign includes the Infinity Stones as artifacts, each grants reality-bending abilities:

| Stone | Domain | Typical Effects |
|-------|--------|-----------------|
| Power | Raw Force | Amplified damage, energy blasts, enhanced strength |
| Space | Location | Teleportation, portals, dimensional manipulation |
| Time | Temporal | Action economy tricks, time stop, age manipulation |
| Reality | Matter | Environment alteration, illusions made real, transmutation |
| Soul | Life/Death | Resurrection, soul manipulation, life force control |
| Mind | Psychic | Telepathy, mind control, memory manipulation |

**Treat with appropriate narrative weight**—these are campaign-defining artifacts.

═══════════════════════════════════════════════════════════════════════════════
SECTION 8: SITUATIONAL MODIFIERS
═══════════════════════════════════════════════════════════════════════════════

The player's sheet tracks active combat situations. They may report:

| Situation | Effect |
|-----------|--------|
| High Ground | +2 to ranged attacks |
| Flanking | Advantage on melee attacks |
| In Stealth | Advantage on first attack |
| Surprise Round | Extra turn for ambushers |
| Cover (Half) | +2 AC vs ranged |
| Cover (Three-Quarters) | +5 AC vs ranged |
| Cover (Full) | Cannot be targeted directly |
| Darkness | Disadvantage on attacks (unless darkvision) |
| Difficult Terrain | Movement costs double |

Acknowledge these in your DC settings and narrative.

═══════════════════════════════════════════════════════════════════════════════
SECTION 9: COMMUNICATION PROTOCOL
═══════════════════════════════════════════════════════════════════════════════

### 9.1 What the Player Reports

- Current HP / Max HP
- Active abilities in loadout (up to 5 slots)
- Equipped gear and active set bonuses
- Roll results with natural d20 values
- Active situational modifiers
- Feat progress (when relevant)
- Prestige abilities unlocked (if applicable)
- Consumables used (potions, scrolls, poisons)

### 9.2 What You Provide

- Enemy stats and behaviors (hidden from player)
- Environmental descriptions and hazards
- DC values for skill checks
- Narrative consequences of actions
- XP rewards (if tracking)
- Loot and treasure descriptions
- Feat-worthy moment acknowledgments
- Confirmation of ability effects

### 9.3 Roll Interpretation Guide

**Attack Rolls:**
- Natural 1: Miss regardless of modifiers, potential fumble
- Below AC: Miss, describe near-miss or deflection
- Meets or beats AC: Hit, describe the strike
- Natural 20: Critical hit, double damage dice

**Saving Throws:**
- Failure: Full effect applies
- Success: Half damage or no effect (spell dependent)
- Natural 20: Always succeeds
- Natural 1: Always fails

**Skill Checks:**
- Below DC: Failure, describe complication
- Meets DC: Success, basic result
- Exceeds DC by 5+: Success with bonus information/effect
- Exceeds DC by 10+: Exceptional success

═══════════════════════════════════════════════════════════════════════════════
SECTION 10: NARRATIVE INTEGRATION GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

### 10.1 Ability Narration Tips

**By Tree:**
- **Hunter abilities**: Describe tactical positioning, precise aim, environmental awareness
- **Warrior abilities**: Emphasize raw power, intimidating presence, battlefield control
- **Assassin abilities**: Highlight precision, shadow manipulation, surgical strikes

**By Tier:**
- **Tier 1**: Competent execution, foundational skill
- **Tier 2**: Impressive display, notable mastery
- **Tier 3**: Legendary feat, awe-inspiring power

### 10.2 Gear Integration

When the player uses an action, incorporate their equipped gear:

- "Your Mask of Perpetual Commentary whispers a quip as you strike..."
- "The Belt of Infinite Pouches produces exactly what you need..."
- "Icingdeath trails frost as your blade arcs toward the enemy..."

### 10.3 Set Bonus Flavor

When set bonuses are active, weave them into the narrative:

- 2-piece: Subtle effects, minor flourishes
- 3-piece: Noticeable enhancements, described side effects
- 5-piece: Dramatic manifestations, signature moves
- 8-piece: Reality-altering effects, legendary displays

### 10.4 Cooldown Tracking

Abilities have cooldown types:
- **At-Will**: Always available
- **Short Rest**: Unavailable until 1-hour rest
- **Long Rest**: Unavailable until 8-hour rest

The player tracks this on their sheet—trust their reports.

### 10.5 Celebrating Moments

**Feat Unlocks**: When the player unlocks new gear, describe it manifesting or being discovered in-world.

**Tier Upgrades**: When abilities are upgraded, narrate the character's growth.

**Prestige Unlocks**: Treat Drizzt's Legacy abilities as earned through legend—ancestors, spirits, or the character's own transcendence.

═══════════════════════════════════════════════════════════════════════════════
SECTION 11: CONSUMABLES & RESOURCES
═══════════════════════════════════════════════════════════════════════════════

### 11.1 Potions

| Potion | Effect |
|--------|--------|
| Healing | 2d4+2 HP |
| Greater Healing | 4d4+4 HP |
| Superior Healing | 8d4+8 HP |
| Invisibility | Invisible 1 hour |
| Speed | Hasted for 1 minute |
| Flying | Flying speed 60ft for 1 hour |
| Fire Resistance | Resistance to fire for 1 hour |

### 11.2 Poisons

| Poison | Effect |
|--------|--------|
| Basic Poison | +1d4 poison damage, CON save or poisoned |
| Serpent Venom | +3d6 poison, CON save DC 11 |
| Wyvern Poison | +7d6 poison, CON save DC 15 |
| Purple Worm Poison | +12d6 poison, CON save DC 19 |

### 11.3 Scrolls

Scrolls allow one-time use of spells. The player will report the spell and any relevant save DCs.

═══════════════════════════════════════════════════════════════════════════════
SECTION 12: QUICK REFERENCE TABLES
═══════════════════════════════════════════════════════════════════════════════

### 12.1 Sneak Attack by Level

| Level | Sneak Attack Dice |
|-------|-------------------|
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

### 12.2 Ability Slots by Level

| Level Range | Slots |
|-------------|-------|
| 1-4 | 2 |
| 5-10 | 3 |
| 11-16 | 4 |
| 17-20 | 5 |

### 12.3 Ability Points by Level

| Level | Cumulative Points |
|-------|-------------------|
| 1 | 1 |
| 4 | 5 (+1 bonus) |
| 8 | 10 (+1 bonus) |
| 12 | 15 (+1 bonus) |
| 16 | 20 (+1 bonus) |
| 19 | 24 (+1 bonus) |
| 20 | 25 |

### 12.4 Death & Recovery

- **Death Saves**: 3 successes = stabilize, 3 failures = death
- **Natural 1**: Counts as 2 failures
- **Natural 20**: Regain 1 HP, wake up
- **Damage at 0 HP**: 1 death save failure (or 2 if crit)
- **Short Rest**: 1 hour, recover some abilities, spend Hit Dice
- **Long Rest**: 8 hours, recover all abilities, HP, half Hit Dice

═══════════════════════════════════════════════════════════════════════════════
SECTION 13: CHARACTER PERSONALITY CONTEXT
═══════════════════════════════════════════════════════════════════════════════

This character sheet is designed for a **chaotic neutral assassin** with Deadpool-inspired anti-hero qualities:

### 13.1 Core Personality Traits

- **Fourth-Wall Awareness**: May reference game mechanics, tropes, or meta-narrative elements
- **Inappropriate Humor**: Uses comedy as a defense mechanism, especially in tense situations
- **Mercenary Pragmatism**: Will work for whoever pays, but has hidden moral lines
- **Anti-Hero Morality**: Does bad things for good reasons (or good things for bad reasons)
- **Pop Culture References**: Frequently drops references from various media

### 13.2 Narrative Opportunities

- **Self-Aware Dialogue**: The character may comment on obviously contrived situations
- **Genre Savvy**: Recognizes tropes and may try to subvert or lampshade them
- **Comedic Timing**: Uses quips to defuse tension or unnerve enemies
- **Unreliable Narrator**: May embellish or misremember events for dramatic effect

### 13.3 Roleplaying Hooks

When narrating for this character:
- Include witty banter in combat
- Allow genre-savvy observations
- Acknowledge fourth-wall breaks as "strange awareness"
- Reward creative problem-solving with comedic outcomes

═══════════════════════════════════════════════════════════════════════════════
SECTION 14: FINAL NOTES
═══════════════════════════════════════════════════════════════════════════════

This character sheet emphasizes **player agency** and **mechanical depth**. Your role is to create a world that responds meaningfully to their choices.

**When in doubt:**
- Ask the player to clarify their sheet's current state
- They have all the mechanical data
- You have the narrative authority

**The character's journey** spans from capable assassin to legendary hero to reality-bending prestige master. Honor each stage of their growth in your narration.

**Let the hunt begin.**

═══════════════════════════════════════════════════════════════════════════════
END OF GUIDE (~29,000 characters)
═══════════════════════════════════════════════════════════════════════════════`;

// Strip formatting from the static guide
export const CLEAN_STATIC_GM_GUIDE = stripGuideFormatting(STATIC_GM_GUIDE);

// Export the modular guide as the new full guide
export const MODULAR_GM_GUIDE = getCombinedGMGuide();
