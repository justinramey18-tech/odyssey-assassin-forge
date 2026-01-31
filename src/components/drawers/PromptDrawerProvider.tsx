import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Gem, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { InfinityStoneDrawer } from './InfinityStoneDrawer';
import { AbilitiesDrawer } from './AbilitiesDrawer';
import { StatsDrawer } from './StatsDrawer';
import { ScribeDrawer } from './ScribeDrawer';
import { ActiveSetBonusDrawer } from './ActiveSetBonusDrawer';
import { CooldownDrawer } from './CooldownDrawer';
import { OracleDrawer } from '@/components/oracle';
import { Character } from '@/lib/types';
import { XPPreset } from '@/lib/xpSystem';
import { CharacterEquipment } from '@/lib/inventory/types';
import { InventoryItem as ConsumableItem } from '@/lib/consumables/types';
import { useGameMode, shouldShowInfinityStones } from '@/hooks/use-game-mode';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useCooldowns } from '@/hooks/use-cooldowns';

interface PromptDrawerContextValue {
  openInfinityDrawer: () => void;
  openAbilitiesDrawer: () => void;
  openStatsDrawer: () => void;
  openScribeDrawer: () => void;
  openSetBonusDrawer: () => void;
  openCooldownDrawer: () => void;
  openOracleDrawer: () => void;
  closeAllDrawers: () => void;
  // Cooldown system exposure
  triggerCooldown: (abilityId: string) => void;
  isOnCooldown: (abilityId: string) => boolean;
  getRemainingTime: (abilityId: string) => number;
  formatRemainingTime: (seconds: number) => string;
  resetShortRestCooldowns: () => void;
  resetAllCooldowns: () => void;
}

const PromptDrawerContext = createContext<PromptDrawerContextValue | null>(null);

export function usePromptDrawers() {
  const context = useContext(PromptDrawerContext);
  if (!context) {
    throw new Error('usePromptDrawers must be used within PromptDrawerProvider');
  }
  return context;
}

interface PromptDrawerProviderProps {
  children: ReactNode;
  character: Character;
  unlockedAbilities: Map<string, number>;
  enabled?: boolean;
  // Stats drawer props
  currentXP?: number;
  xpPreset?: XPPreset;
  onAddXP?: (amount: number, source: string) => void;
  // Equipment for set bonus drawer
  equipment?: CharacterEquipment;
  // HP props for Oracle
  currentHP?: number;
  maxHP?: number;
  // Consumables for Oracle
  consumables?: ConsumableItem[];
  // Prestige for Oracle
  prestigeLevel?: number;
  prestigeAbilities?: string[];
}

export function PromptDrawerProvider({
  children,
  character,
  unlockedAbilities,
  enabled = true,
  currentXP = 0,
  xpPreset = 'standard',
  onAddXP = () => {},
  equipment,
  currentHP,
  maxHP,
  consumables = [],
  prestigeLevel = 0,
  prestigeAbilities = [],
}: PromptDrawerProviderProps) {
  const [infinityOpen, setInfinityOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [setBonusOpen, setSetBonusOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [oracleOpen, setOracleOpen] = useState(false);
  
  // Game mode integration for Infinity Stones lock and cooldown enforcement
  const { infinityStonesLocked, isHonestMode, enforceCooldowns } = useGameMode();
  const isInfinityLocked = !shouldShowInfinityStones(character.level, infinityStonesLocked);
  
  // Calculate equipment stats for real-time display
  const defaultEquipment: CharacterEquipment = { slots: {} as any, inventory: [] };
  const equipmentStats = useEquipmentStats(equipment || defaultEquipment);
  
  // Cooldown system
  const cooldownSystem = useCooldowns({
    characterAbilities: character.abilities,
    isHonestMode,
    enforceCooldowns,
  });
  
  // Close all drawers when opening a new one
  const closeAllDrawers = useCallback(() => {
    setInfinityOpen(false);
    setAbilitiesOpen(false);
    setStatsOpen(false);
    setScribeOpen(false);
    setSetBonusOpen(false);
    setCooldownOpen(false);
    setOracleOpen(false);
  }, []);

  // Edge swipe detection
  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    const EDGE_THRESHOLD = 30;
    const SWIPE_THRESHOLD = 60;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = Math.abs(endY - startY);
      
      if (diffY > Math.abs(diffX) * 0.5) return;

      // Left edge swipe right → open stats (first drawer)
      if (startX < EDGE_THRESHOLD && diffX > SWIPE_THRESHOLD) {
        closeAllDrawers();
        setStatsOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, closeAllDrawers, isInfinityLocked, character.level]);

  // Handle opening infinity drawer with lock check
  const handleOpenInfinityDrawer = useCallback(() => {
    if (isInfinityLocked) {
      toast.error(`RP Prompts locked until Level 20 (Current: ${character.level})`);
      return;
    }
    closeAllDrawers();
    setInfinityOpen(true);
  }, [isInfinityLocked, character.level, closeAllDrawers]);

  const contextValue: PromptDrawerContextValue = {
    openInfinityDrawer: handleOpenInfinityDrawer,
    openAbilitiesDrawer: useCallback(() => { closeAllDrawers(); setAbilitiesOpen(true); }, [closeAllDrawers]),
    openStatsDrawer: useCallback(() => { closeAllDrawers(); setStatsOpen(true); }, [closeAllDrawers]),
    openScribeDrawer: useCallback(() => { closeAllDrawers(); setScribeOpen(true); }, [closeAllDrawers]),
    openSetBonusDrawer: useCallback(() => { closeAllDrawers(); setSetBonusOpen(true); }, [closeAllDrawers]),
    openCooldownDrawer: useCallback(() => { closeAllDrawers(); setCooldownOpen(true); }, [closeAllDrawers]),
    openOracleDrawer: useCallback(() => { closeAllDrawers(); setOracleOpen(true); }, [closeAllDrawers]),
    closeAllDrawers,
    // Cooldown system exposure
    triggerCooldown: cooldownSystem.triggerCooldown,
    isOnCooldown: cooldownSystem.isOnCooldown,
    getRemainingTime: cooldownSystem.getRemainingTime,
    formatRemainingTime: cooldownSystem.formatRemainingTime,
    resetShortRestCooldowns: cooldownSystem.resetShortRestCooldowns,
    resetAllCooldowns: cooldownSystem.resetAllCooldowns,
  };

  return (
    <PromptDrawerContext.Provider value={contextValue}>
      {children}

      {enabled && (
        <>

          {/* Drawer Components */}
          <InfinityStoneDrawer
            open={infinityOpen}
            onOpenChange={setInfinityOpen}
            characterName={character.name}
          />

          <AbilitiesDrawer
            open={abilitiesOpen}
            onOpenChange={setAbilitiesOpen}
            character={character}
            unlockedAbilities={unlockedAbilities}
          />

          <StatsDrawer
            open={statsOpen}
            onOpenChange={setStatsOpen}
            characterName={character.name}
            level={character.level}
            currentXP={currentXP}
            xpPreset={xpPreset}
            onAddXP={onAddXP}
            equipmentStats={equipment ? equipmentStats : undefined}
          />

          <ScribeDrawer
            open={scribeOpen}
            onOpenChange={setScribeOpen}
            characterName={character.name}
          />

          {equipment && (
            <ActiveSetBonusDrawer
              open={setBonusOpen}
              onOpenChange={setSetBonusOpen}
              equipment={equipment}
              characterName={character.name}
            />
          )}

          <CooldownDrawer
            open={cooldownOpen}
            onOpenChange={setCooldownOpen}
            cooldowns={cooldownSystem.cooldowns}
            sessionState={cooldownSystem.sessionState}
            settings={cooldownSystem.settings}
            isHonestMode={isHonestMode}
            enforceCooldowns={enforceCooldowns}
            onPause={cooldownSystem.pauseAllCooldowns}
            onResume={cooldownSystem.resumeAllCooldowns}
            onResetAll={cooldownSystem.resetAllCooldowns}
            onGenerateStats={cooldownSystem.generateSessionStats}
            getRemainingTime={cooldownSystem.getRemainingTime}
            getEffectiveCooldown={cooldownSystem.getEffectiveCooldown}
          />

          <OracleDrawer
            open={oracleOpen}
            onOpenChange={setOracleOpen}
            character={character}
            currentHP={currentHP ?? character.level * 8 + 10}
            maxHP={maxHP ?? character.level * 8 + 10}
            equipment={equipment}
            consumables={consumables}
            cooldowns={cooldownSystem.cooldowns}
            prestigeLevel={prestigeLevel}
            prestigeAbilities={prestigeAbilities}
            getRemainingTime={cooldownSystem.getRemainingTime}
          />
        </>
      )}
    </PromptDrawerContext.Provider>
  );
}
