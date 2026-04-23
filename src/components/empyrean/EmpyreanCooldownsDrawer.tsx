import { useCallback } from 'react';
import { Clock, Zap, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  getUnlockedAbilities,
  TREE_META,
  TIER_META,
  type EmpyreanAbility,
} from '@/lib/empyreanAbilities';
import {
  clearNarrativeCooldowns,
  getCooldownTurns,
  isOnNarrativeCooldown,
  type NarrativeCooldownMap,
} from '@/lib/narrativeCooldowns';

interface EmpyreanCooldownsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cooldowns: NarrativeCooldownMap;
  /** Called after the user confirms "Reset all cooldowns" so the parent reloads its state. */
  onCooldownsCleared: () => void;
}

export function EmpyreanCooldownsDrawer({ open, onOpenChange, cooldowns, onCooldownsCleared }: EmpyreanCooldownsDrawerProps) {
  const unlocked = getUnlockedAbilities();

  // Split into cooling-down vs ready.
  const coolingDown: EmpyreanAbility[] = [];
  const ready: EmpyreanAbility[] = [];
  for (const ab of unlocked) {
    if (isOnNarrativeCooldown(cooldowns, ab.id)) {
      coolingDown.push(ab);
    } else {
      ready.push(ab);
    }
  }

  // Sort cooling-down by turns remaining (ascending — closest to ready first).
  coolingDown.sort((a, b) => getCooldownTurns(cooldowns, a.id) - getCooldownTurns(cooldowns, b.id));

  const handleResetAll = useCallback(() => {
    clearNarrativeCooldowns();
    onCooldownsCleared();
    toast.success('All cooldowns cleared');
  }, [onCooldownsCleared]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-emerald-500/30 rounded-t-2xl overflow-hidden flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-emerald-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Cooldowns
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-5">
          {unlocked.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <Zap className="w-8 h-8 text-amber-400/40 mx-auto" />
              <p className="text-sm font-cinzel text-foreground">No abilities unlocked</p>
              <p className="text-xs text-muted-foreground">Unlock abilities from the Ability Trees screen to see their cooldowns here.</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/25">
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  Empyrean cooldowns count down by <strong>one per DM response</strong>, not by real time. Closing the app does not advance them.
                </p>
              </div>

              {coolingDown.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-amber-300">
                      Cooling Down ({coolingDown.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {coolingDown.map(ab => (
                      <CooldownRow key={ab.id} ability={ab} turnsRemaining={getCooldownTurns(cooldowns, ab.id)} state="cooling" />
                    ))}
                  </div>
                </section>
              )}

              {ready.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-emerald-300">
                      Ready ({ready.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {ready.map(ab => (
                      <CooldownRow key={ab.id} ability={ab} turnsRemaining={0} state="ready" />
                    ))}
                  </div>
                </section>
              )}

              {coolingDown.length > 0 && (
                <div className="pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2 h-10 text-xs border-white/15 hover:bg-white/5 text-muted-foreground">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset all cooldowns
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset all cooldowns?</AlertDialogTitle>
                        <AlertDialogDescription>
                          All {coolingDown.length} cooling abilities will be immediately available again. Useful between sessions or after a long rest.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAll} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────

function CooldownRow({ ability, turnsRemaining, state }: {
  ability: EmpyreanAbility;
  turnsRemaining: number;
  state: 'cooling' | 'ready';
}) {
  const treeMeta = TREE_META[ability.tree];
  const tierMeta = TIER_META[ability.tier];
  const isCooling = state === 'cooling';

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isCooling ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/25 bg-emerald-500/[0.04]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{treeMeta.emoji}</span>
            <p className={cn('text-sm font-cinzel font-semibold truncate', isCooling ? 'text-amber-200' : 'text-emerald-200')}>
              {ability.name}
            </p>
            <span
              className="text-[9px] font-bold uppercase tracking-wider shrink-0"
              style={{ color: tierMeta.color }}
            >
              {tierMeta.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {treeMeta.label}
          </p>
        </div>
        {isCooling ? (
          <div className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-semibold text-amber-200 whitespace-nowrap">
              {turnsRemaining} {turnsRemaining === 1 ? 'turn' : 'turns'}
            </span>
          </div>
        ) : (
          <div className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-200 whitespace-nowrap">Ready</span>
          </div>
        )}
      </div>
    </div>
  );
}
