import { ActiveConditionInfo, SetBonusInfo } from '@/lib/combat/promptContext';
import { LootItem } from '@/lib/loot/types';
import { PartyMember } from '@/hooks/use-party-sync';
import { MobileItemsGrid } from './MobileItemsGrid';

interface ItemsSectionContentProps {
  characterName: string;
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onRemoveFromTurn: (description: string) => void;
  onNavigateToConsumables?: () => void;
  globalConditions?: ActiveConditionInfo[];
  activeSetBonuses?: SetBonusInfo[];
  concentrationSpell?: string | null;
  lootItemsWithDice?: LootItem[];
  onUseLootItem?: (item: LootItem) => void;
  onLogEntry: (entry: { actionType: 'item'; actionName: string; prompt: string }) => void;
  onRemoveLogEntry: (actionName: string) => void;
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, max: number, temp: number) => void;
  partyMembers?: PartyMember[];
  userId?: string;
  onSendHeal?: (targetUserId: string, actionData: { senderName?: string; itemName?: string; hpHealed?: number }) => Promise<void>;
}

export function ItemsSectionContent({
  characterName,
  onAddToTurn,
  onRemoveFromTurn,
  onNavigateToConsumables,
  globalConditions,
  activeSetBonuses,
  concentrationSpell,
  lootItemsWithDice,
  onUseLootItem,
  onLogEntry,
  onRemoveLogEntry,
  currentHP,
  maxHP,
  tempHP,
  onHPChange,
  partyMembers,
  userId,
  onSendHeal,
}: ItemsSectionContentProps): JSX.Element {
  const activeSetForItems = activeSetBonuses && activeSetBonuses.length > 0 ? {
    name: activeSetBonuses[0].name,
    effect: activeSetBonuses[0].effect,
  } : undefined;

  const concentrationForItems = concentrationSpell ? {
    name: concentrationSpell,
    level: undefined,
  } : undefined;

  return (
    <MobileItemsGrid
      onAddToTurn={onAddToTurn}
      onRemoveFromTurn={onRemoveFromTurn}
      onNavigateToConsumables={onNavigateToConsumables}
      globalConditions={globalConditions}
      activeSetBonus={activeSetForItems}
      concentrationSpell={concentrationForItems}
      lootItemsWithDice={lootItemsWithDice}
      onUseLootItem={onUseLootItem}
      characterName={characterName}
      onLogEntry={onLogEntry}
      onRemoveLogEntry={onRemoveLogEntry}
      currentHP={currentHP}
      maxHP={maxHP}
      tempHP={tempHP}
      onHPChange={onHPChange}
      partyMembers={partyMembers}
      userId={userId}
      onSendHeal={onSendHeal}
    />
  );
}
