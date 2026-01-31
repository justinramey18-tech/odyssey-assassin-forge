// Unlock Progress Gate - Shows progress toward unlocking Drizzt's Legacy

import { Lock, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useGameMode } from '@/hooks/use-game-mode';

interface UnlockProgressGateProps {
  current: number;
  required: number;
  isUnlocked: boolean;
  isLevelBased?: boolean;
}

export function UnlockProgressGate({ current, required, isUnlocked, isLevelBased }: UnlockProgressGateProps) {
  const progress = Math.min(100, (current / required) * 100);
  const { isHonestMode } = useGameMode();

  if (isUnlocked) {
    return null; // Don't show gate when unlocked
  }

  // Determine messaging based on game mode
  const isLevelRequirement = isLevelBased || isHonestMode;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      {/* Lock Icon with Glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-2xl bg-purple-500/20 rounded-full" />
        <div className="relative p-6 rounded-full border-2 border-purple-500/40 bg-gradient-to-b from-purple-900/40 to-black/60">
          <Lock className="w-16 h-16 text-purple-400" />
        </div>
      </div>

      {/* Title */}
      <h2 className="font-cinzel text-2xl md:text-3xl text-purple-300 mb-2">
        Drizzt's Legacy
      </h2>
      <p className="text-muted-foreground text-sm md:text-base max-w-md mb-6">
        {isLevelRequirement 
          ? "Reach Level 20 to unlock the legendary powers of Drizzt Do'Urden."
          : "Master all 24 base abilities across Hunter, Warrior, and Assassin trees to unlock the legendary powers of Drizzt Do'Urden."
        }
      </p>

      {/* Progress Bar */}
      <div className="w-full max-w-sm mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-purple-400 font-mono">
            {isLevelRequirement 
              ? `Level ${current}/${required}`
              : `${current}/${required} points`
            }
          </span>
        </div>
        <Progress 
          value={progress} 
          className="h-3 bg-purple-900/30"
        />
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground/60 max-w-xs">
        {isLevelRequirement 
          ? `Gain ${required - current} more level${required - current === 1 ? '' : 's'} to unlock this legendary skill tree.`
          : `Spend ${required - current} more ability points to unlock this legendary skill tree.`
        }
      </p>

      {/* Decorative Elements */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
    </div>
  );
}
