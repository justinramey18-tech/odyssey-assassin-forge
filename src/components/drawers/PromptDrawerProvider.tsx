import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Swords, Gem } from 'lucide-react';
import { EdgeTrigger } from './EdgeDrawer';
import { CombatDrawer } from './CombatDrawer';
import { InfinityStoneDrawer } from './InfinityStoneDrawer';
import { Character } from '@/lib/types';

interface PromptDrawerContextValue {
  openCombatDrawer: () => void;
  openInfinityDrawer: () => void;
  closeCombatDrawer: () => void;
  closeInfinityDrawer: () => void;
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
}

export function PromptDrawerProvider({
  children,
  character,
  unlockedAbilities,
  enabled = true,
}: PromptDrawerProviderProps) {
  const [combatOpen, setCombatOpen] = useState(false);
  const [infinityOpen, setInfinityOpen] = useState(false);

  // Edge swipe detection
  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    const EDGE_THRESHOLD = 30; // pixels from edge
    const SWIPE_THRESHOLD = 60; // minimum swipe distance

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = Math.abs(endY - startY);
      
      // Only trigger if mostly horizontal swipe
      if (diffY > Math.abs(diffX) * 0.5) return;

      // Left edge swipe right → open combat drawer
      if (startX < EDGE_THRESHOLD && diffX > SWIPE_THRESHOLD) {
        setCombatOpen(true);
      }
      // Right edge swipe left → open infinity drawer
      if (startX > window.innerWidth - EDGE_THRESHOLD && diffX < -SWIPE_THRESHOLD) {
        setInfinityOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled]);

  const contextValue: PromptDrawerContextValue = {
    openCombatDrawer: useCallback(() => setCombatOpen(true), []),
    openInfinityDrawer: useCallback(() => setInfinityOpen(true), []),
    closeCombatDrawer: useCallback(() => setCombatOpen(false), []),
    closeInfinityDrawer: useCallback(() => setInfinityOpen(false), []),
  };

  return (
    <PromptDrawerContext.Provider value={contextValue}>
      {children}

      {enabled && (
        <>
          {/* Edge Triggers - visible tabs on screen edges */}
          {!combatOpen && (
            <EdgeTrigger
              side="left"
              label="Combat"
              icon={<Swords className="w-4 h-4" />}
              accentColor="#ef4444"
              onClick={() => setCombatOpen(true)}
            />
          )}
          
          {!infinityOpen && (
            <EdgeTrigger
              side="right"
              label="Prompts"
              icon={<Gem className="w-4 h-4" />}
              accentColor="#eab308"
              onClick={() => setInfinityOpen(true)}
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
        </>
      )}
    </PromptDrawerContext.Provider>
  );
}
