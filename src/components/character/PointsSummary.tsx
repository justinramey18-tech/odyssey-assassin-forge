import { Character } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, RotateCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsSummaryProps {
  character: Character;
  totalPoints: number;
  spentPoints: number;
  remainingPoints: number;
  onBack: () => void;
  onReset: () => void;
  onExport: () => void;
}

export function PointsSummary({
  character,
  totalPoints,
  spentPoints,
  remainingPoints,
  onBack,
  onReset,
  onExport,
}: PointsSummaryProps) {
  const getPointsInTree = (tree: 'hunter' | 'warrior' | 'assassin') => {
    return character.abilities
      .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === tree)
      .reduce((sum, ca) => sum + ca.currentTier, 0);
  };

  const hunterPoints = getPointsInTree('hunter');
  const warriorPoints = getPointsInTree('warrior');
  const assassinPoints = getPointsInTree('assassin');

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container max-w-2xl mx-auto px-4 py-3">
        {/* Top Row: Name & Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="font-display font-semibold text-lg leading-tight">
                {character.name}
              </h2>
              <p className="text-xs text-muted-foreground font-body">
                Level {character.level} Assassin
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onReset}
              title="Reset all abilities"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExport}
              title="Export build as JSON"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Points Display */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-body">Points Spent</span>
              <span className="font-display font-semibold">
                <span className="text-primary">{spentPoints}</span>
                <span className="text-muted-foreground"> / {totalPoints}</span>
              </span>
            </div>
            <Progress value={(spentPoints / totalPoints) * 100} className="h-2" />
          </div>
          <div className="text-center px-3 py-1 rounded-md bg-primary/10 border border-primary/30">
            <p className="text-2xl font-display font-bold text-primary leading-none">
              {remainingPoints}
            </p>
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">
              Left
            </p>
          </div>
        </div>

        {/* Tree Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className={cn(
            'text-center py-1.5 px-2 rounded-md border',
            hunterPoints > 0 ? 'border-hunter/50 bg-hunter-dim/20' : 'border-border bg-muted/20'
          )}>
            <p className={cn(
              'text-lg font-display font-bold leading-none',
              hunterPoints > 0 ? 'text-hunter-glow' : 'text-muted-foreground'
            )}>
              {hunterPoints}
            </p>
            <p className="text-[10px] text-muted-foreground font-body">🏹 Hunter</p>
          </div>
          <div className={cn(
            'text-center py-1.5 px-2 rounded-md border',
            warriorPoints > 0 ? 'border-warrior/50 bg-warrior-dim/20' : 'border-border bg-muted/20'
          )}>
            <p className={cn(
              'text-lg font-display font-bold leading-none',
              warriorPoints > 0 ? 'text-warrior-glow' : 'text-muted-foreground'
            )}>
              {warriorPoints}
            </p>
            <p className="text-[10px] text-muted-foreground font-body">⚔️ Warrior</p>
          </div>
          <div className={cn(
            'text-center py-1.5 px-2 rounded-md border',
            assassinPoints > 0 ? 'border-assassin/50 bg-assassin-dim/20' : 'border-border bg-muted/20'
          )}>
            <p className={cn(
              'text-lg font-display font-bold leading-none',
              assassinPoints > 0 ? 'text-assassin-glow' : 'text-muted-foreground'
            )}>
              {assassinPoints}
            </p>
            <p className="text-[10px] text-muted-foreground font-body">🗡️ Assassin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
