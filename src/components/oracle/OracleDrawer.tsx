import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Character } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory/types';
import { InventoryItem as ConsumableItem } from '@/lib/consumables/types';
import { AbilityCooldownState } from '@/lib/cooldowns/types';
import { PartyMember } from '@/hooks/use-party-sync';
import { LootItem } from '@/lib/loot/types';
import { allAbilities } from '@/lib/abilities';
import { getPersonalityConfig } from './personalities';
import { CharacterContext } from './types';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { getSpellById } from '@/lib/magic/spells';
import { CombatLogEntry } from '@/hooks/use-combat-log';
import { Enemy } from '@/lib/combat/targetTypes';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { OraclePanel } from './OraclePanel';

interface CombatContextInput {
  isInCombat: boolean;
  roundNumber: number;
  isPlayerTurn: boolean;
  economy: ActionEconomy;
  currentTarget: Enemy | null;
  enemies: Enemy[];
  recentLogEntries: CombatLogEntry[];
}

interface OracleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  currentHP: number;
  maxHP: number;
  equipment?: CharacterEquipment;
  consumables?: ConsumableItem[];
  cooldowns?: Map<string, AbilityCooldownState>;
  prestigeLevel?: number;
  prestigeAbilities?: string[];
  getRemainingTime?: (abilityId: string) => number;
  activeConditions?: Array<{
    name: string;
    remainingRounds: number;
    source?: string;
    severity: string;
    saveType?: string;
  }>;
  activeBuffs?: Array<{
    name: string;
    remainingMinutes: number;
    concentration: boolean;
  }>;
  spellcasting?: UseSpellcastingReturn;
  lootItems?: LootItem[];
  totalLootValue?: number;
  combatContext?: CombatContextInput;
  partyMembers?: PartyMember[];
  subclass?: string;
}

export function OracleDrawer({
  open,
  onOpenChange,
  character,
  currentHP,
  maxHP,
  equipment,
  consumables = [],
  cooldowns,
  prestigeLevel = 0,
  prestigeAbilities = [],
  getRemainingTime,
  activeConditions = [],
  activeBuffs = [],
  spellcasting,
  lootItems = [],
  totalLootValue = 0,
  combatContext,
  partyMembers = [],
}: OracleDrawerProps) {
  // Build character context for the AI
  const characterContext = useMemo<CharacterContext>(() => {
    // Map abilities with names
    const abilitiesList = character.abilities
      .filter(a => a.currentTier > 0)
      .map(a => {
        const ability = allAbilities.find(ab => ab.id === a.abilityId);
        return {
          name: ability?.name || a.abilityId,
          tier: a.currentTier,
          tree: ability?.tree || 'unknown',
        };
      });

    // Get equipped ability names
    const equippedAbilitiesList = character.equippedAbilities
      .map(id => allAbilities.find(a => a.id === id)?.name || id)
      .filter(Boolean);

    // Map equipment
    const equipmentList: Array<{ slot: string; name: string; rarity: string }> = [];
    const activeSetBonuses: string[] = [];
    
    if (equipment) {
      Object.entries(equipment.slots).forEach(([slot, item]) => {
        if (item) {
          equipmentList.push({
            slot,
            name: item.name,
            rarity: item.rarity,
          });
        }
      });
    }

    // Map consumables
    const consumablesList = consumables.map(c => ({
      name: c.consumable.name,
      quantity: c.quantity,
      type: c.consumable.type,
    }));

    // Map cooldowns
    const activeCooldowns: Array<{ name: string; remainingSeconds: number }> = [];
    const readyCooldowns: string[] = [];

    if (cooldowns && getRemainingTime) {
      cooldowns.forEach((state, abilityId) => {
        const ability = allAbilities.find(a => a.id === abilityId);
        const name = ability?.name || abilityId;
        const remaining = getRemainingTime(abilityId);

        if (remaining > 0) {
          activeCooldowns.push({ name, remainingSeconds: remaining });
        } else if (state.lastUsed) {
          readyCooldowns.push(name);
        }
      });
    }

    // Add abilities that have usage limits but aren't on cooldown
    character.abilities
      .filter(a => a.currentTier > 0)
      .forEach(a => {
        const ability = allAbilities.find(ab => ab.id === a.abilityId);
        if (ability && ability.usageType !== 'at_will') {
          const isTracked = cooldowns?.has(a.abilityId);
          if (!isTracked) {
            readyCooldowns.push(ability.name);
          }
        }
      });

    // Build spellcasting context
    let spellcastingContext: CharacterContext['spellcasting'] = undefined;
    if (spellcasting?.state.path) {
      const { state, spellAttackBonus, spellSaveDC, totalSlotsRemaining } = spellcasting;
      
      // Get spell names for prepared spells
      const preparedSpellNames = state.preparedSpells
        .map(id => getSpellById(id)?.name || id)
        .filter(Boolean);
      
      // Get concentration spell name
      const concentrationName = state.concentratingOn 
        ? getSpellById(state.concentratingOn)?.name || state.concentratingOn
        : null;
      
      // Build slots array
      const slotsArray = Object.entries(state.spellSlots)
        .filter(([_, slot]) => slot.max > 0)
        .map(([level, slot]) => ({
          level: parseInt(level),
          current: slot.current,
          max: slot.max,
        }));

      spellcastingContext = {
        path: state.path,
        spellAttackBonus,
        spellSaveDC,
        totalSlotsRemaining,
        concentratingOn: concentrationName,
        preparedSpells: preparedSpellNames,
        slots: slotsArray,
        pactSlots: state.pactSlots ? {
          current: state.pactSlots.current,
          max: state.pactSlots.max,
          level: state.pactSlots.level,
        } : undefined,
      };
    }

    // Build loot context
    const lootContext: CharacterContext['loot'] = lootItems.length > 0 ? {
      items: lootItems.map(item => ({
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        goldValue: item.goldValue,
        hasDiceMechanics: item.hasDiceMechanics,
      })),
      totalValue: totalLootValue,
      usableCount: lootItems.filter(i => i.category === 'usable').length,
      diceMechanicsCount: lootItems.filter(i => i.hasDiceMechanics).length,
    } : undefined;

    // Build combat context for tactical awareness
    let combatContextData: CharacterContext['combat'] = undefined;
    if (combatContext?.isInCombat) {
      combatContextData = {
        isInCombat: combatContext.isInCombat,
        roundNumber: combatContext.roundNumber,
        isPlayerTurn: combatContext.isPlayerTurn,
        actionUsed: combatContext.economy.actionUsed,
        bonusActionUsed: combatContext.economy.bonusActionUsed,
        reactionUsed: combatContext.economy.reactionUsed,
        movementUsed: combatContext.economy.movementUsed,
        maxMovement: combatContext.economy.maxMovement,
        currentTarget: combatContext.currentTarget ? {
          name: combatContext.currentTarget.name,
          ac: combatContext.currentTarget.ac,
          currentHP: combatContext.currentTarget.currentHP,
          maxHP: combatContext.currentTarget.maxHP,
          conditions: combatContext.currentTarget.conditions || [],
          resistances: combatContext.currentTarget.resistances || [],
          vulnerabilities: combatContext.currentTarget.vulnerabilities || [],
          immunities: combatContext.currentTarget.immunities || [],
        } : null,
        enemies: combatContext.enemies.map(e => ({
          name: e.name,
          currentHP: e.currentHP,
          maxHP: e.maxHP,
          isDefeated: e.currentHP <= 0,
          conditions: e.conditions || [],
        })),
        recentActions: combatContext.recentLogEntries.slice(0, 5).map(entry => ({
          actionType: entry.actionType,
          actionName: entry.actionName,
          timestamp: entry.timestamp.toISOString(),
          damage: entry.damage,
          wasHit: entry.roll ? entry.roll.total > 0 : undefined,
          wasCrit: entry.roll?.isCrit,
        })),
      };
    }

    // Build party members context
    const partyMembersContext = partyMembers
      .filter(m => m.character_name)
      .map(m => ({
        name: m.character_name,
        level: m.character_status.level,
        className: m.character_status.className,
        currentHP: m.character_status.currentHP,
        maxHP: m.character_status.maxHP,
        ac: m.character_status.ac,
        conditions: m.character_status.conditions,
      }));

    const characterClass = character.primaryClass || 'rogue';
    const multiclassBreakdown: Record<string, number> | undefined =
      character.multiclassLevels && Object.keys(character.multiclassLevels).length > 0
        ? { [characterClass]: character.level, ...character.multiclassLevels }
        : undefined;

    return {
      name: character.name,
      level: character.level,
      currentHP,
      maxHP,
      characterClass,
      multiclassBreakdown,
      abilities: abilitiesList,
      equippedAbilities: equippedAbilitiesList as string[],
      equipment: equipmentList,
      activeSetBonuses,
      consumables: consumablesList,
      cooldowns: {
        active: activeCooldowns,
        ready: readyCooldowns,
      },
      prestigeLevel,
      prestigeAbilities,
      activeConditions,
      activeBuffs,
      spellcasting: spellcastingContext,
      loot: lootContext,
      combat: combatContextData,
      partyMembers: partyMembersContext.length > 0 ? partyMembersContext : undefined,
    };
  }, [character, currentHP, maxHP, equipment, consumables, cooldowns, prestigeLevel, prestigeAbilities, getRemainingTime, activeConditions, activeBuffs, spellcasting, lootItems, totalLootValue, combatContext, partyMembers]);

  const config = getPersonalityConfig('deadpool');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'w-full sm:w-[90vw] sm:max-w-[400px] p-0 flex flex-col',
          'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
          'border-l-2'
        )}
        style={{
          borderColor: `${config.color}40`,
          boxShadow: `-4px 0 30px ${config.color}20`,
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>The Oracle</SheetTitle>
        </SheetHeader>
        <OraclePanel characterContext={characterContext} />
      </SheetContent>
    </Sheet>
  );
}
