import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Gem, Zap, Heart, BookOpen, Sparkles, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { EdgeTriggerStack } from './EdgeDrawer';
import { InfinityStoneDrawer } from './InfinityStoneDrawer';
import { AbilitiesDrawer } from './AbilitiesDrawer';
import { StatsDrawer } from './StatsDrawer';
import { ScribeDrawer } from './ScribeDrawer';
import { ActiveSetBonusDrawer } from './ActiveSetBonusDrawer';
import { Character } from '@/lib/types';
import { XPPreset } from '@/lib/xpSystem';
import { CharacterEquipment } from '@/lib/inventory/types';
import { useGameMode, shouldShowInfinityStones } from '@/hooks/use-game-mode';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';

interface PromptDrawerContextValue {
  openInfinityDrawer: () => void;
  openAbilitiesDrawer: () => void;
  openStatsDrawer: () => void;
  openScribeDrawer: () => void;
  openSetBonusDrawer: () => void;
  closeAllDrawers: () => void;
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
}: PromptDrawerProviderProps) {
  const [infinityOpen, setInfinityOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [setBonusOpen, setSetBonusOpen] = useState(false);
  
  // Game mode integration for Infinity Stones lock
  const { infinityStonesLocked } = useGameMode();
  const isInfinityLocked = !shouldShowInfinityStones(character.level, infinityStonesLocked);
  
  // Calculate equipment stats for real-time display
  const defaultEquipment: CharacterEquipment = { slots: {} as any, inventory: [] };
  const equipmentStats = useEquipmentStats(equipment || defaultEquipment);
  
  // Close all drawers when opening a new one
  const closeAllDrawers = useCallback(() => {
    setInfinityOpen(false);
    setAbilitiesOpen(false);
    setStatsOpen(false);
    setScribeOpen(false);
    setSetBonusOpen(false);
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
    closeAllDrawers,
  };

  // Check if any drawer is open
  const anyDrawerOpen = infinityOpen || abilitiesOpen || statsOpen || scribeOpen || setBonusOpen;

  // All 5 triggers on the left side
  const leftTriggers = [
    {
      id: 'stats',
      label: 'Stats',
      icon: <Heart className="w-4 h-4" />,
      accentColor: '#22c55e',
      onClick: () => { closeAllDrawers(); setStatsOpen(true); },
    },
    {
      id: 'setbonus',
      label: 'Set Bonus',
      icon: <Sparkles className="w-4 h-4" />,
      accentColor: '#f59e0b',
      onClick: () => { closeAllDrawers(); setSetBonusOpen(true); },
    },
    {
      id: 'prompts',
      label: isInfinityLocked ? 'Locked' : 'Prompts',
      icon: isInfinityLocked ? <Lock className="w-4 h-4" /> : <Gem className="w-4 h-4" />,
      accentColor: isInfinityLocked ? '#78716c' : '#eab308',
      onClick: handleOpenInfinityDrawer,
      disabled: isInfinityLocked,
    },
    {
      id: 'abilities',
      label: 'Abilities',
      icon: <Zap className="w-4 h-4" />,
      accentColor: '#a855f7',
      onClick: () => { closeAllDrawers(); setAbilitiesOpen(true); },
    },
    {
      id: 'scribe',
      label: 'Scribe',
      icon: <BookOpen className="w-4 h-4" />,
      accentColor: '#d97706',
      onClick: () => { closeAllDrawers(); setScribeOpen(true); },
    },
  ];

  return (
    <PromptDrawerContext.Provider value={contextValue}>
      {children}

      {enabled && (
        <>
          {/* Left Edge Triggers - All 5 drawers */}
          {!anyDrawerOpen && (
            <EdgeTriggerStack
              side="left"
              triggers={leftTriggers}
            />
          )}

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
        </>
      )}
    </PromptDrawerContext.Provider>
  );
}
