import { useState, useCallback, useEffect } from 'react';
import { Zap, Clock, Sparkles, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  // Also CLEAR any stale pending state from a previous session.
  useEffect(() => {
    if (open) {
      setUnlockedAbilities(getUnlockedAbilities());
      setPending(null);
    }
  }, [open]);

  // Single Radix modal: confirming an ability fires the handler AND closes the
  // sheet in the same synchronous pass. Only one modal participates in Radix's
  // global stack, so there is no pointer-events race on body.
  const confirmUse = useCallback(() => {
    if (!pending) return;
    const captured = pending;
    setPending(null);
    onUseAbility(captured.id, captured.prompt);
    onOpenChange(false);
  }, [pending, onUseAbility, onOpenChange]);

  const cancelConfirm = useCallback(() => {
    setPending(null);
  }, []);

  // Group unlocked abilities by tree for display.
  const groupedByTree = unlockedAbilities.reduce<Record<string, EmpyreanAbility[]>>((acc, ab) => {
    (acc[ab.tree] ??= []).push(ab);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
            {pending ? (
              <>
                <button
                  onClick={cancelConfirm}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-amber-500/10 active:bg-amber-500/20 text-amber-300"
                  aria-label="Back to ability list"
                  style={{ touchAction: 'manipulation' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span>Confirm</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Use Ability</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
          {pending ? (
            // ─── Inline confirmation view ────────────────────────────────
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div
                  className="text-[10px] font-cinzel font-bold uppercase tracking-wider"
                  style={{ color: TIER_META[pending.tier].color }}
                >
                  {TIER_META[pending.tier].label} · {TREE_META[pending.tree].label}
                </div>
                <div className="text-base font-cinzel font-semibold text-amber-200">
                  {pending.name}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {pending.description}
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-1">
                <div className="text-[11px] font-cinzel font-bold uppercase tracking-wider text-muted-foreground">
                  What happens
                </div>
                <div className="text-xs text-foreground/80 leading-relaxed">
                  The ability's narrative prompt is sent to the DM. A cooldown begins — you won't be able to use this ability again until it ends.
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={confirmUse}
                  disabled={isLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 h-12"
                >
                  <Zap className="w-4 h-4" />
                  Use ability
                </Button>
                <Button
                  onClick={cancelConfirm}
                  variant="outline"
                  className="w-full h-11"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : unlockedAbilities.length === 0 ? (
            // ─── Empty state ─────────────────────────────────────────────
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
            // ─── Ability list ────────────────────────────────────────────
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
  );
}
