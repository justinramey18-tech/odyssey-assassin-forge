import { Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterEquipment, getActiveSetBonuses, setDefinitions } from '@/lib/inventory/index';
import { Progress } from '@/components/ui/progress';

interface SetBonusPanelProps {
  equipment: CharacterEquipment;
  onViewMissing?: (setId: string) => void;
}

export function SetBonusPanel({ equipment, onViewMissing }: SetBonusPanelProps) {
  const activeSetBonuses = getActiveSetBonuses(equipment.slots);

  if (activeSetBonuses.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      {activeSetBonuses.map(({ setInfo, activePieces }) => {
        const progressPercent = (activePieces / setInfo.pieces.length) * 100;
        const missingPieces = setInfo.pieces.length - activePieces;

        return (
          <div 
            key={setInfo.id}
            className={cn(
              "rounded-lg border p-4 transition-all",
              activePieces >= 3 
                ? "border-amber-400/50 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.1)]"
                : "border-border bg-card"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className={cn(
                "w-4 h-4",
                activePieces >= 3 ? "text-amber-400 animate-pulse" : "text-muted-foreground"
              )} />
              <span className="font-bold text-sm">{setInfo.name}</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{activePieces}/{setInfo.pieces.length} pieces</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    activePieces >= 3 ? "bg-amber-400" : "bg-primary"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Bonuses List */}
            <div className="space-y-1.5">
              {setInfo.bonuses.map((bonus, idx) => {
                const isActive = activePieces >= bonus.piecesRequired;
                const isNext = activePieces === bonus.piecesRequired - 1;
                const piecesNeeded = bonus.piecesRequired - activePieces;

                return (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 text-sm py-1",
                      isActive ? "text-amber-400" : "text-muted-foreground"
                    )}
                  >
                    <span className="w-4">{isActive ? '✓' : '⏳'}</span>
                    <span className="font-medium">{bonus.piecesRequired}pc:</span>
                    <span className="flex-1">{bonus.bonus}</span>
                    {!isActive && (
                      <span className="text-xs opacity-60">
                        ({piecesNeeded} more)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* View Missing Button */}
            {missingPieces > 0 && (
              <button
                onClick={() => onViewMissing?.(setInfo.id)}
                className="flex items-center justify-center gap-1 w-full mt-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
              >
                View Missing Pieces
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
