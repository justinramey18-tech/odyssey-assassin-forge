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
  HelpCircle,
  Users,
} from 'lucide-react';
import { UseInitiativeReturn, InitiativeCombatant } from '@/hooks/use-initiative';
import { Enemy } from '@/lib/combat/targetTypes';
import { 
  rollInitiativeWithEstimate, 
  CREATURE_DEX_LABELS 
} from '@/lib/combat/initiativeUtils';
import { CombatPrimerDrawer } from './CombatPrimerDrawer';
import { PartyInitiativeState } from '@/hooks/use-party-sync';

interface InitiativeTrackerProps {
  initiative: UseInitiativeReturn;
  enemies: Enemy[];
  onUpdateEnemyInitiative: (id: string, initiative: number | undefined) => void;
  dexModifier?: number;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  characterLevel?: number;
  onBroadcastInitiative?: (order: Array<{ name: string; initiative: number; isCurrentTurn: boolean }>, round: number) => void;
  onClearInitiative?: () => void;
  partyInitiatives?: PartyInitiativeState[];
}

export function InitiativeTracker({
  initiative,
  enemies,
  onUpdateEnemyInitiative,
  dexModifier = 0,
  isCollapsed = false,
  onCollapsedChange,
  characterLevel = 1,
  onBroadcastInitiative,
  onClearInitiative,
  partyInitiatives = [],
}: InitiativeTrackerProps) {
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPrimerDrawer, setShowPrimerDrawer] = useState(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCollapsedChange?.(true)}
              className="flex items-center gap-2"
            >
              <Swords className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Initiative</span>
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </button>
            {/* Pulsing help icon */}
            <button
              onClick={() => setShowPrimerDrawer(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors animate-pulse"
              aria-label="Combat help"
            >
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
            </button>
          </div>
          
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
                  onClick={() => {
                    startCombat();
                    if (onBroadcastInitiative && initiativeOrder.length > 0) {
                      onBroadcastInitiative(
                        initiativeOrder.map(c => ({
                          name: c.name,
                          initiative: c.initiative,
                          isCurrentTurn: c.id === initiativeOrder[0]?.id,
                        })),
                        1
                      );
                    }
                  }}
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
                  onClick={() => {
                    endCombat();
                    onClearInitiative?.();
                  }}
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
            <div className="shrink-0 flex items-center gap-1">
              <button
                onClick={handleRollPlayerInitiative}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <User className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary">Roll Initiative</span>
                <span className="text-[10px] text-muted-foreground">+{dexModifier}</span>
              </button>
              {/* Help Icon with pulse animation */}
              <button
                onClick={() => setShowPrimerDrawer(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors animate-pulse"
                aria-label="Combat help"
              >
                <HelpCircle className="w-4 h-4 text-primary" />
              </button>
            </div>
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

        {/* Party Initiative Display */}
        {partyInitiatives.length > 0 && (
          <div className="border-t border-muted/20 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3 h-3 text-primary/70" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Party Initiative</span>
            </div>
            <div className="space-y-1">
              {partyInitiatives.map((pi) => (
                <div key={pi.broadcasterId} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {pi.broadcasterName}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                    R{pi.round}
                  </Badge>
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {pi.order.map((entry, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap",
                          entry.isCurrentTurn
                            ? "bg-primary/20 text-primary font-semibold border border-primary/40"
                            : "bg-muted/20 text-muted-foreground"
                        )}
                      >
                        {entry.name} <span className="font-mono">{entry.initiative}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* Combat Primer Drawer */}
      <CombatPrimerDrawer
        open={showPrimerDrawer}
        onOpenChange={setShowPrimerDrawer}
        characterLevel={characterLevel}
      />
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
