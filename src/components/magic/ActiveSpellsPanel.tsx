import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Timer, X, ChevronDown, ChevronUp, Sparkles, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ActiveSpellEffect, formatDurationRemaining, getDurationLabel } from '@/lib/magic/durations';
import { getSpellById } from '@/lib/magic/spells';

interface ActiveSpellsPanelProps {
  activeSpells: ActiveSpellEffect[];
  onDismissSpell: (effectId: string) => void;
  onBreakConcentration: () => void;
  concentratingOn: string | null;
  className?: string;
}

export function ActiveSpellsPanel({
  activeSpells,
  onDismissSpell,
  onBreakConcentration,
  concentratingOn,
  className,
}: ActiveSpellsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (activeSpells.length === 0) {
    return null;
  }

  // Sort: concentration first, then by remaining time
  const sortedSpells = [...activeSpells].sort((a, b) => {
    if (a.isConcentration && !b.isConcentration) return -1;
    if (!a.isConcentration && b.isConcentration) return 1;
    if (!a.expiresAt && b.expiresAt) return 1;
    if (a.expiresAt && !b.expiresAt) return -1;
    if (a.expiresAt && b.expiresAt) return a.expiresAt - b.expiresAt;
    return 0;
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="bg-indigo-950/40 border-indigo-500/30">
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 flex items-center justify-between hover:bg-indigo-500/10 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="font-cinzel text-sm text-indigo-300">
                Active Spells ({activeSpells.length})
              </span>
            </div>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-2">
            {sortedSpells.map((effect) => (
              <ActiveSpellCard
                key={effect.id}
                effect={effect}
                now={now}
                isConcentrating={effect.spellId === concentratingOn}
                onDismiss={() => {
                  if (effect.isConcentration) {
                    onBreakConcentration();
                  }
                  onDismissSpell(effect.id);
                }}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface ActiveSpellCardProps {
  effect: ActiveSpellEffect;
  now: number;
  isConcentrating: boolean;
  onDismiss: () => void;
}

function ActiveSpellCard({ effect, now, isConcentrating, onDismiss }: ActiveSpellCardProps) {
  const spell = getSpellById(effect.spellId);
  const spellName = spell?.name || effect.spellName;
  
  // Calculate remaining time
  const remaining = effect.expiresAt ? Math.max(0, effect.expiresAt - now) : null;
  const remainingFormatted = formatDurationRemaining(remaining);
  
  // Calculate progress for timer bar
  const progress = effect.expiresAt && effect.durationMs
    ? Math.max(0, Math.min(100, ((effect.expiresAt - now) / effect.durationMs) * 100))
    : 100;
  
  // Determine color based on remaining time
  const getTimerColor = () => {
    if (!remaining) return 'text-violet-400';
    const seconds = remaining / 1000;
    if (seconds <= 10) return 'text-red-400 animate-pulse';
    if (seconds <= 30) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getBarColor = () => {
    if (!remaining) return 'bg-violet-500';
    const seconds = remaining / 1000;
    if (seconds <= 10) return 'bg-red-500';
    if (seconds <= 30) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={cn(
      "relative rounded-lg p-3 overflow-hidden",
      isConcentrating 
        ? "bg-violet-900/40 border border-violet-500/50" 
        : "bg-background/30 border border-white/10"
    )}>
      {/* Progress bar background */}
      {effect.expiresAt && (
        <div 
          className={cn(
            "absolute inset-0 opacity-20 transition-all duration-1000",
            getBarColor()
          )}
          style={{ width: `${progress}%` }}
        />
      )}
      
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isConcentrating && (
            <Eye className="w-4 h-4 text-violet-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">
              {spellName}
              {effect.castLevel > (spell?.level ?? 0) && (
                <span className="text-amber-400 text-xs ml-1">
                  (L{effect.castLevel})
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {getDurationLabel(effect.durationType)}
              {isConcentrating && ' • Concentrating'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {remaining !== null && (
            <div className={cn("flex items-center gap-1 font-mono text-sm", getTimerColor())}>
              <Timer className="w-3.5 h-3.5" />
              <span>{remainingFormatted}</span>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
