import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Swords, Gem, Zap, Heart, BookOpen } from 'lucide-react';
import { EdgeTriggerStack } from './EdgeDrawer';
import { CombatDrawer } from './CombatDrawer';
import { InfinityStoneDrawer } from './InfinityStoneDrawer';
import { AbilitiesDrawer } from './AbilitiesDrawer';
import { StatsDrawer } from './StatsDrawer';
import { ScribeDrawer } from './ScribeDrawer';
import { Character } from '@/lib/types';
import { XPPreset } from '@/lib/xpSystem';

interface PromptDrawerContextValue {
  openCombatDrawer: () => void;
  openInfinityDrawer: () => void;
  openAbilitiesDrawer: () => void;
  openStatsDrawer: () => void;
  openScribeDrawer: () => void;
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
}

export function PromptDrawerProvider({
  children,
  character,
  unlockedAbilities,
  enabled = true,
  currentXP = 0,
  xpPreset = 'standard',
  onAddXP = () => {},
}: PromptDrawerProviderProps) {
  const [combatOpen, setCombatOpen] = useState(false);
  const [infinityOpen, setInfinityOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  
  // Collapse state for edge triggers
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Close all drawers when opening a new one
  const closeAllDrawers = useCallback(() => {
    setCombatOpen(false);
    setInfinityOpen(false);
    setAbilitiesOpen(false);
    setStatsOpen(false);
    setScribeOpen(false);
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

      // Left edge swipe right → open combat/stats
      if (startX < EDGE_THRESHOLD && diffX > SWIPE_THRESHOLD) {
        closeAllDrawers();
        setCombatOpen(true);
      }
      // Right edge swipe left → open infinity/abilities
      if (startX > window.innerWidth - EDGE_THRESHOLD && diffX < -SWIPE_THRESHOLD) {
        closeAllDrawers();
        setInfinityOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, closeAllDrawers]);

  const contextValue: PromptDrawerContextValue = {
    openCombatDrawer: useCallback(() => { closeAllDrawers(); setCombatOpen(true); }, [closeAllDrawers]),
    openInfinityDrawer: useCallback(() => { closeAllDrawers(); setInfinityOpen(true); }, [closeAllDrawers]),
    openAbilitiesDrawer: useCallback(() => { closeAllDrawers(); setAbilitiesOpen(true); }, [closeAllDrawers]),
    openStatsDrawer: useCallback(() => { closeAllDrawers(); setStatsOpen(true); }, [closeAllDrawers]),
    openScribeDrawer: useCallback(() => { closeAllDrawers(); setScribeOpen(true); }, [closeAllDrawers]),
    closeAllDrawers,
  };

  // Check if any drawer is open
  const anyDrawerOpen = combatOpen || infinityOpen || abilitiesOpen || statsOpen || scribeOpen;

  // Left side triggers (Combat, Stats)
  const leftTriggers = [
    {
      id: 'combat',
      label: 'Combat',
      icon: <Swords className="w-4 h-4" />,
      accentColor: '#ef4444',
      onClick: () => { closeAllDrawers(); setCombatOpen(true); },
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: <Heart className="w-4 h-4" />,
      accentColor: '#22c55e',
      onClick: () => { closeAllDrawers(); setStatsOpen(true); },
    },
  ];

  // Right side triggers (Prompts, Abilities, Scribe)
  const rightTriggers = [
    {
      id: 'prompts',
      label: 'Prompts',
      icon: <Gem className="w-4 h-4" />,
      accentColor: '#eab308',
      onClick: () => { closeAllDrawers(); setInfinityOpen(true); },
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
          {/* Left Edge Triggers */}
          {!anyDrawerOpen && (
            <EdgeTriggerStack
              side="left"
              triggers={leftTriggers}
              collapsed={leftCollapsed}
              onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
            />
          )}
          
          {/* Right Edge Triggers */}
          {!anyDrawerOpen && (
            <EdgeTriggerStack
              side="right"
              triggers={rightTriggers}
              collapsed={rightCollapsed}
              onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
            />
          )}

          {/* Drawer Components */}
          <CombatDrawer
            open={combatOpen}
            onOpenChange={setCombatOpen}
            character={character}
            unlockedAbilities={unlockedAbilities}
          />

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
          />

          <ScribeDrawer
            open={scribeOpen}
            onOpenChange={setScribeOpen}
            characterName={character.name}
          />
        </>
      )}
    </PromptDrawerContext.Provider>
  );
}
