import { useState, useCallback, useEffect } from 'react';
import { Zap, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  getUnlockedAbilities,
  TREE_META,
  TIER_META,
  type EmpyreanAbility,
} from '@/lib/empyreanAbilities';
import type { NarrativeCooldownMap } from '@/lib/narrativeCooldowns';
import { getCooldownTurns, isOnNarrativeCooldown } from '@/lib/narrativeCooldowns';

interface EmpyreanAbilityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cooldowns: NarrativeCooldownMap;
  onUseAbility: (abilityId: string, generatedPrompt: string) => void;
  isLoading: boolean;
  onGoToAbilitiesScreen?: () => void;
}

export function EmpyreanAbilityPicker({
  open,
  onOpenChange,
  cooldowns,
  onUseAbility,
  isLoading,
  onGoToAbilitiesScreen,
}: EmpyreanAbilityPickerProps) {
  const [pending, setPending] = useState<EmpyreanAbility | null>(null);
  const [unlockedAbilities, setUnlockedAbilities] = useState<EmpyreanAbility[]>(() => getUnlockedAbilities());

  // Refresh on open so newly-unlocked abilities appear without remounting.
  useEffect(() => {
    if (open) {
      setUnlockedAbilities(getUnlockedAbilities());
    }
  }, [open]);

  const confirmUse = useCallback(() => {
    if (!pending) return;
    onUseAbility(pending.id, pending.prompt);
    setPending(null);
    onOpenChange(false);
  }, [pending, onUseAbility, onOpenChange]);

  // Group unlocked abilities by tree for display.
  const groupedByTree = unlockedAbilities.reduce<Record<string, EmpyreanAbility[]>>((acc, ab) => {
    (acc[ab.tree] ??= []).push(ab);
    return acc;
  }, {});

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border/40">
            <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Use Ability
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
            {unlockedAbilities.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-4">
                <Sparkles className="w-8 h-8 text-amber-400/40 mx-auto" />
                <div className="space-y-1.5">
                  <p className="text-sm font-cinzel text-foreground">No abilities unlocked</p>
                  <p className="text-xs text-muted-foreground">
                    Unlock abilities from the Combat, Bond, Channeling, or Mental trees using gold.
                  </p>
                </div>
                {onGoToAbilitiesScreen && (
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      setTimeout(onGoToAbilitiesScreen, 0);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2 mt-2"
                  >
                    <Zap className="w-4 h-4" />
                    Open Ability Trees
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(groupedByTree).map(treeKey => {
                  const tree = treeKey as keyof typeof TREE_META;
                  const treeMeta = TREE_META[tree];
                  const list = groupedByTree[treeKey];
                  return (
                    <div key={treeKey} className="space-y-1.5">
                      <div className="px-1 flex items-center gap-1.5">
                        <span className="text-sm">{treeMeta.emoji}</span>
                        <span
                          className="text-[10px] font-cinzel font-bold uppercase tracking-wider"
                          style={{ color: treeMeta.color }}
                        >
                          {treeMeta.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {list.map(ability => {
                          const onCooldown = isOnNarrativeCooldown(cooldowns, ability.id);
                          const turnsLeft = getCooldownTurns(cooldowns, ability.id);
                          const tierMeta = TIER_META[ability.tier];
                          return (
                            <button
                              key={ability.id}
                              onClick={() => setPending(ability)}
                              disabled={onCooldown || isLoading}
                              className={cn(
                                'w-full text-left rounded-lg border transition-colors p-3',
                                onCooldown
                                  ? 'border-slate-700/50 bg-slate-800/30 opacity-60 cursor-not-allowed'
                                  : 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/20'
                              )}
                              style={{ touchAction: 'manipulation' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={cn('text-sm font-cinzel font-semibold truncate', onCooldown ? 'text-slate-400' : 'text-amber-200')}>
                                      {ability.name}
                                    </p>
                                    <span
                                      className="text-[9px] font-bold uppercase tracking-wider shrink-0"
                                      style={{ color: tierMeta.color }}
                                    >
                                      {tierMeta.label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                                    {ability.description}
                                  </p>
                                </div>
                                {onCooldown && (
                                  <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/40 border border-slate-600/40">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span className="text-[11px] text-slate-300 whitespace-nowrap">
                                      Cooling down ({turnsLeft} {turnsLeft === 1 ? 'turn' : 'turns'})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the ability's narrative prompt to the DM and start a cooldown. You will not be able to use this ability again until the cooldown ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUse} className="bg-amber-600 hover:bg-amber-700 text-white">
              Use ability
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
