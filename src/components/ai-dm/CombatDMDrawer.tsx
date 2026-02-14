import { X, Swords } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { MobileCombatLayout } from '@/components/combat/mobile/MobileCombatLayout';
import { Character } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory/types';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { BaseAbilityScores } from '@/lib/abilityScores/types';
import { UseActionEconomyReturn } from '@/hooks/use-action-economy';
import { ActiveConditionInfo, SetBonusInfo } from '@/lib/combat/promptContext';

interface CombatDMDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  equipment?: CharacterEquipment;
  spellcasting?: UseSpellcastingReturn;
  equipmentStats?: AggregatedStats;
  abilityModifiers?: BaseAbilityScores;
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  actionEconomyState?: UseActionEconomyReturn;
  globalConditions?: ActiveConditionInfo[];
  activeSetBonuses?: SetBonusInfo[];
  concentrationSpell?: string | null;
  userId?: string;
  characterName?: string;
}

export function CombatDMDrawer({
  open,
  onOpenChange,
  character,
  equipment,
  spellcasting,
  equipmentStats,
  abilityModifiers,
  currentHP,
  maxHP,
  tempHP,
  actionEconomyState,
  globalConditions = [],
  activeSetBonuses = [],
  concentrationSpell,
  userId,
  characterName,
}: CombatDMDrawerProps) {
  return (
    <>
      {/* Global style override for overlay z-index when inside DM screens (z-60) */}
      {open && <style>{`[data-vaul-overlay] { z-index: 9998 !important; } [vaul-drawer] { z-index: 9999 !important; }`}</style>}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh] bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f] border-amber-900/30 !z-[9999]">
          {/* Header */}
          <DrawerHeader className="px-4 pt-2 pb-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-amber-200 font-cinzel">
                <Swords className="w-5 h-5 text-red-400" />
                Combat
              </DrawerTitle>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </DrawerHeader>

          {/* Scrollable combat content */}
          <div className="flex-1 overflow-y-auto pb-8">
            <MobileCombatLayout
              character={character}
              spellcasting={spellcasting}
              equipment={equipment}
              equipmentStats={equipmentStats}
              abilityModifiers={abilityModifiers}
              currentHP={currentHP}
              maxHP={maxHP}
              tempHP={tempHP}
              actionEconomyState={actionEconomyState}
              globalConditions={globalConditions}
              activeSetBonuses={activeSetBonuses}
              concentrationSpell={concentrationSpell}
              userId={userId}
              characterName={characterName}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
