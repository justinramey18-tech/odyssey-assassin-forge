import { useState } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InfinityGauntletScreen } from './InfinityGauntletScreen';
import { useGameMode, shouldShowInfinityStones } from '@/hooks/use-game-mode';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActionWheelButtonProps {
  characterName: string;
  characterLevel: number;
  isEmbedded?: boolean;
}

export function ActionWheelButton({ characterName, characterLevel, isEmbedded = false }: ActionWheelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { infinityStonesLocked } = useGameMode();
  
  const stonesAccessible = shouldShowInfinityStones(characterLevel, infinityStonesLocked);

  const containerClass = isEmbedded 
    ? "relative z-50" 
    : "fixed bottom-6 right-6 z-50";

  // If stones are locked, show a disabled/locked button
  if (!stonesAccessible) {
    return (
      <div className={containerClass}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                disabled
                className={cn(
                  'w-14 h-14 rounded-full shadow-lg transition-all duration-300',
                  'bg-muted/50 cursor-not-allowed opacity-60'
                )}
              >
                <Lock className="w-6 h-6 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Infinity Stones unlock at Level 20</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <>
      {/* FAB Button */}
      <div className={containerClass}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className={cn(
            'w-14 h-14 rounded-full shadow-lg transition-all duration-300',
            'bg-primary hover:bg-primary/90 glow-gold'
          )}
        >
          <Sparkles className="w-6 h-6" />
        </Button>
      </div>

      {/* Fullscreen Infinity Gauntlet Screen */}
      <InfinityGauntletScreen
        characterName={characterName}
        open={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
