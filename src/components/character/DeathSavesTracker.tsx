import { useState } from 'react';
import { Skull, Heart, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface DeathSavesState {
  successes: number;
  failures: number;
}

interface DeathSavesTrackerProps {
  deathSaves: DeathSavesState;
  onDeathSavesChange: (saves: DeathSavesState) => void;
  onRegainHP: (amount: number) => void;
}

export function DeathSavesTracker({ 
  deathSaves, 
  onDeathSavesChange,
  onRegainHP 
}: DeathSavesTrackerProps) {
  const { toast } = useToast();
  const [isRolling, setIsRolling] = useState(false);

  const handleRollDeathSave = () => {
    setIsRolling(true);
    
    // Simulate dice roll animation
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      let newSuccesses = deathSaves.successes;
      let newFailures = deathSaves.failures;

      if (roll === 20) {
        // Natural 20: Regain 1 HP
        toast({
          title: "🎉 Natural 20!",
          description: "You regain 1 HP and become conscious!",
          className: "border-emerald-500/30 bg-emerald-500/10",
        });
        onDeathSavesChange({ successes: 0, failures: 0 });
        onRegainHP(1);
        setIsRolling(false);
        return;
      } else if (roll === 1) {
        // Natural 1: Two failures
        newFailures = Math.min(3, newFailures + 2);
        toast({
          title: `💀 Natural 1! (2 failures)`,
          description: newFailures >= 3 
            ? "You have died..." 
            : `Failures: ${newFailures}/3`,
          className: "border-rose-500/30 bg-rose-500/10",
        });
      } else if (roll >= 10) {
        // Success
        newSuccesses = Math.min(3, newSuccesses + 1);
        toast({
          title: `✓ Rolled ${roll} - Success!`,
          description: newSuccesses >= 3 
            ? "You are stabilized!" 
            : `Successes: ${newSuccesses}/3`,
          className: "border-emerald-500/30 bg-emerald-500/10",
        });
      } else {
        // Failure
        newFailures = Math.min(3, newFailures + 1);
        toast({
          title: `✗ Rolled ${roll} - Failure`,
          description: newFailures >= 3 
            ? "You have died..." 
            : `Failures: ${newFailures}/3`,
          className: "border-rose-500/30 bg-rose-500/10",
        });
      }

      onDeathSavesChange({ successes: newSuccesses, failures: newFailures });
      setIsRolling(false);
    }, 500);
  };

  const handleReset = () => {
    onDeathSavesChange({ successes: 0, failures: 0 });
    toast({
      title: "Death Saves Reset",
      description: "Ready for a new encounter.",
    });
  };

  const isStabilized = deathSaves.successes >= 3;
  const isDead = deathSaves.failures >= 3;

  return (
    <div className="p-4 rounded-lg bg-rose-950/50 border border-rose-500/30 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5 text-rose-400" />
          <span className="font-semibold text-rose-300">Death Saving Throws</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Display */}
      {isDead && (
        <div className="text-center py-2 text-rose-400 font-bold animate-pulse">
          💀 You have died...
        </div>
      )}
      {isStabilized && !isDead && (
        <div className="text-center py-2 text-emerald-400 font-bold">
          ✓ Stabilized - Unconscious but alive
        </div>
      )}

      {/* Saves Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Successes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Heart className="w-4 h-4" />
            <span>Successes</span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <button
                key={`success-${i}`}
                onClick={() => {
                  const newSuccesses = i < deathSaves.successes 
                    ? i 
                    : Math.min(3, i + 1);
                  onDeathSavesChange({ ...deathSaves, successes: newSuccesses });
                }}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  i < deathSaves.successes
                    ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/30"
                    : "bg-transparent border-emerald-500/30 hover:border-emerald-500/60"
                )}
              />
            ))}
          </div>
        </div>

        {/* Failures */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-rose-400">
            <Skull className="w-4 h-4" />
            <span>Failures</span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <button
                key={`failure-${i}`}
                onClick={() => {
                  const newFailures = i < deathSaves.failures 
                    ? i 
                    : Math.min(3, i + 1);
                  onDeathSavesChange({ ...deathSaves, failures: newFailures });
                }}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  i < deathSaves.failures
                    ? "bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/30"
                    : "bg-transparent border-rose-500/30 hover:border-rose-500/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Roll Button */}
      {!isStabilized && !isDead && (
        <Button
          className="w-full bg-rose-600 hover:bg-rose-700 text-white"
          onClick={handleRollDeathSave}
          disabled={isRolling}
        >
          {isRolling ? (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              Rolling...
            </div>
          ) : (
            "Roll Death Save (d20)"
          )}
        </Button>
      )}

      {/* Quick Reference */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/30">
        <p>• Roll 10+ = Success | Roll 1-9 = Failure</p>
        <p>• Natural 20 = Regain 1 HP | Natural 1 = 2 Failures</p>
        <p>• 3 Successes = Stabilized | 3 Failures = Death</p>
      </div>
    </div>
  );
}
