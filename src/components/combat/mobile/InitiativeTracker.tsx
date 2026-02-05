import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Play,
  Square,
  RotateCcw,
  User,
  Skull,
  ChevronDown,
  ChevronUp,
  Swords,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { UseInitiativeReturn, InitiativeCombatant } from '@/hooks/use-initiative';
import { Enemy } from '@/lib/combat/targetTypes';
import { 
  rollInitiativeWithEstimate, 
  CREATURE_DEX_LABELS 
} from '@/lib/combat/initiativeUtils';

interface InitiativeTrackerProps {
  initiative: UseInitiativeReturn;
  enemies: Enemy[];
  onUpdateEnemyInitiative: (id: string, initiative: number | undefined) => void;
  dexModifier?: number;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function InitiativeTracker({
  initiative,
  enemies,
  onUpdateEnemyInitiative,
  dexModifier = 0,
  isCollapsed = false,
  onCollapsedChange,
}: InitiativeTrackerProps) {
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editingEnemyId, setEditingEnemyId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const {
    playerInitiative,
    roundNumber,
    combatStarted,
    initiativeOrder,
    currentCombatant,
    isPlayerTurn,
    setPlayerInitiative,
    rollPlayerInitiative,
    nextTurn,
    prevTurn,
    goToTurn,
    startCombat,
    endCombat,
    resetRound,
  } = initiative;

  // Handle player initiative roll
  const handleRollPlayerInitiative = useCallback(() => {
    rollPlayerInitiative(dexModifier);
  }, [rollPlayerInitiative, dexModifier]);

  // Roll initiative for an enemy with creature type estimate
  const handleRollEnemyInitiative = useCallback((enemy: Enemy) => {
    const result = rollInitiativeWithEstimate(enemy.creatureType);
    onUpdateEnemyInitiative(enemy.id, result.total);
  }, [onUpdateEnemyInitiative]);

  // Roll all unset initiatives with smart DEX estimates
  const handleRollAllSmart = useCallback(() => {
    if (playerInitiative === null) {
      rollPlayerInitiative(dexModifier);
    }
    enemies.forEach(enemy => {
      if (enemy.initiative === undefined && enemy.currentHP > 0) {
        handleRollEnemyInitiative(enemy);
      }
    });
  }, [playerInitiative, enemies, rollPlayerInitiative, dexModifier, handleRollEnemyInitiative]);

  // Open edit sheet
  const handleEditInitiative = useCallback((combatant: InitiativeCombatant) => {
    setEditingEnemyId(combatant.isPlayer ? 'player' : combatant.id);
    setEditValue(combatant.initiative.toString());
    setShowEditSheet(true);
  }, []);

  // Save edited initiative
  const handleSaveInitiative = useCallback(() => {
    const value = parseInt(editValue, 10);
    if (isNaN(value)) return;

    if (editingEnemyId === 'player') {
      setPlayerInitiative(value);
    } else if (editingEnemyId) {
      onUpdateEnemyInitiative(editingEnemyId, value);
    }
    setShowEditSheet(false);
    setEditingEnemyId(null);
  }, [editValue, editingEnemyId, setPlayerInitiative, onUpdateEnemyInitiative]);

  // Collapsed view
  if (isCollapsed) {
    return (
      <button
        onClick={() => onCollapsedChange?.(false)}
        className="w-full bg-background/95 backdrop-blur-sm border-b border-primary/30 flex items-center justify-between px-4 py-2"
      >
        <div className="flex items-center gap-3">
          <Swords className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {combatStarted ? (
              <>
                Round {roundNumber} — {currentCombatant?.name ?? 'No Turn'}
                {isPlayerTurn && (
                  <span className="ml-2 text-emerald-400 text-xs">(Your Turn)</span>
                )}
              </>
            ) : (
              'Initiative Order'
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {initiativeOrder.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {initiativeOrder.length} combatants
            </Badge>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
    );
  }

  return (
    <>
      <div className="bg-background/95 backdrop-blur-sm border-b border-primary/30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-muted/20">
          <button
            onClick={() => onCollapsedChange?.(true)}
            className="flex items-center gap-2"
          >
            <Swords className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Initiative</span>
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-2">
            {!combatStarted ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRollAllSmart}
                        className="h-7 text-xs gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-primary" />
                        <Dices className="w-3 h-3" />
                        Roll All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <p className="text-xs">Uses creature type to estimate DEX modifiers for more realistic rolls</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="default"
                  size="sm"
                  onClick={startCombat}
                  disabled={initiativeOrder.length === 0}
                  className="h-7 text-xs gap-1"
                >
                  <Play className="w-3 h-3" />
                  Start
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-xs font-mono">
                  Round {roundNumber}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetRound}
                  className="h-7 text-xs gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endCombat}
                  className="h-7 text-xs gap-1"
                >
                  <Square className="w-3 h-3" />
                  End
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Initiative Order - Horizontal Scroll */}
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
          {/* Turn Navigation - Left */}
          {combatStarted && initiativeOrder.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={prevTurn}
              className="h-8 w-8 shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}

          {/* Player Initiative */}
          {playerInitiative === null ? (
            <button
              onClick={handleRollPlayerInitiative}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <User className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary">Roll Initiative</span>
              <span className="text-[10px] text-muted-foreground">+{dexModifier}</span>
            </button>
          ) : null}

          {/* Combatants */}
          {initiativeOrder.map((combatant, idx) => (
            <CombatantChip
              key={combatant.id}
              combatant={combatant}
              isCurrent={combatStarted && currentCombatant?.id === combatant.id}
              onClick={() => combatStarted && goToTurn(combatant.id)}
              onEdit={() => handleEditInitiative(combatant)}
            />
          ))}

          {/* Enemies without initiative */}
          {enemies
            .filter(e => e.initiative === undefined && e.currentHP > 0)
            .map(enemy => (
              <TooltipProvider key={enemy.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleRollEnemyInitiative(enemy)}
                      className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted/50 bg-muted/5 hover:bg-muted/10 transition-colors"
                    >
                      <Skull className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                        {enemy.name}
                      </span>
                      {enemy.creatureType && (
                        <Sparkles className="w-2.5 h-2.5 text-primary/60" />
                      )}
                      <Dices className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {enemy.creatureType 
                        ? `DEX estimate: ${CREATURE_DEX_LABELS[enemy.creatureType]}`
                        : 'No creature type set (+0 DEX)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

          {/* Turn Navigation - Right */}
          {combatStarted && initiativeOrder.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nextTurn}
              className="h-8 w-8 shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Initiative Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="bottom" className="h-[30vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader>
            <SheetTitle className="font-cinzel text-primary">Edit Initiative</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-3 mt-6">
            <Input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="text-2xl font-mono text-center h-14"
              autoFocus
            />
            <Button onClick={handleSaveInitiative} className="h-14 px-6">
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Individual combatant chip
function CombatantChip({
  combatant,
  isCurrent,
  onClick,
  onEdit,
}: {
  combatant: InitiativeCombatant;
  isCurrent: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  const isDefeated = !combatant.isActive;

  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
        isCurrent
          ? "border-primary bg-primary/20 ring-2 ring-primary/50 scale-105"
          : isDefeated
            ? "border-muted/30 bg-muted/10 opacity-50"
            : combatant.isPlayer
              ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
      )}
    >
      {combatant.isPlayer ? (
        <User className={cn("w-4 h-4", isCurrent ? "text-primary" : "text-emerald-400")} />
      ) : isDefeated ? (
        <Skull className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Skull className={cn("w-4 h-4", isCurrent ? "text-primary" : "text-red-400")} />
      )}
      <span className={cn(
        "text-xs font-medium truncate max-w-[80px]",
        isDefeated && "line-through"
      )}>
        {combatant.name}
      </span>
      <span className={cn(
        "text-sm font-mono font-bold",
        isCurrent ? "text-primary" : "text-muted-foreground"
      )}>
        {combatant.initiative}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="p-0.5 hover:bg-background/50 rounded"
      >
        <Edit2 className="w-3 h-3 text-muted-foreground" />
      </button>
    </button>
  );
}
