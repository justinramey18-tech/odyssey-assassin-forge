import { useState, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOracle } from '@/hooks/use-oracle';
import { Character } from '@/lib/types';
import { CharacterEquipment, EquipmentSlot } from '@/lib/inventory/types';
import { InventoryItem as ConsumableItem } from '@/lib/consumables/types';
import { AbilityCooldownState } from '@/lib/cooldowns/types';
import { LootItem } from '@/lib/loot/types';
import { allAbilities } from '@/lib/abilities';
import { getPersonalityConfig } from './personalities';
import { PersonalitySelector } from './PersonalitySelector';
import { ContextChipBar } from './ContextChipBar';
import { MessageList } from './MessageList';
import { QuickPromptBar } from './QuickPromptBar';
import { CharacterContext } from './types';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { getSpellById } from '@/lib/magic/spells';

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
  // Condition context
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
  // Spellcasting context
  spellcasting?: UseSpellcastingReturn;
  // Loot inventory context
  lootItems?: LootItem[];
  totalLootValue?: number;
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
}: OracleDrawerProps) {
  const [inputValue, setInputValue] = useState('');

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

    return {
      name: character.name,
      level: character.level,
      currentHP,
      maxHP,
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
    };
  }, [character, currentHP, maxHP, equipment, consumables, cooldowns, prestigeLevel, prestigeAbilities, getRemainingTime, activeConditions, activeBuffs, spellcasting, lootItems, totalLootValue]);

  const {
    messages,
    isLoading,
    personality,
    sendMessage,
    cancelRequest,
    clearMessages,
    switchPersonality,
  } = useOracle({ characterContext });

  const config = getPersonalityConfig(personality);

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handlePromptClick = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'w-[90vw] max-w-[400px] p-0 flex flex-col',
          'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
          'border-l-2'
        )}
        style={{
          borderColor: `${config.color}40`,
          boxShadow: `-4px 0 30px ${config.color}20`,
        }}
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg font-cinzel">
              <span className="text-2xl">{config.icon}</span>
              <span style={{ color: config.color }}>The Oracle</span>
            </SheetTitle>
            <div className="flex gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearMessages}
                  className="h-8 w-8 text-white/50 hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Personality Selector */}
        <PersonalitySelector
          selected={personality}
          onSelect={switchPersonality}
          disabled={isLoading}
        />

        {/* Context Chips */}
        <ContextChipBar
          context={characterContext}
          onChipClick={handlePromptClick}
          disabled={isLoading}
        />

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          currentPersonality={personality}
        />

        {/* Quick Prompts */}
        {messages.length === 0 && (
          <QuickPromptBar
            personality={personality}
            onPromptClick={handlePromptClick}
            disabled={isLoading}
          />
        )}

        {/* Input Area */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                personality === 'deadpool'
                  ? "Ask me anything. I triple-dog dare you."
                  : personality === 'jarvis'
                  ? "How may I assist you, Sir?"
                  : "Pose your query..."
              }
              className="flex-1 bg-black/30 border-white/20 focus:border-primary"
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                variant="outline"
                size="icon"
                onClick={cancelRequest}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="shrink-0"
                style={{
                  backgroundColor: inputValue.trim() ? config.color : undefined,
                }}
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
