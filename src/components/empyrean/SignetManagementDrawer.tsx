import { useCallback } from 'react';
import { Flame, Wind, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

interface SignetManagementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signetType: string;
  burnoutLevel: number;
  maxBurnout: number;
  /** Called when user taps Ground Yourself. Parent handles DM prompt + burnout reduction + close. */
  onGroundYourself: () => void;
  /** Called when user confirms Reset Strain. Parent sets burnoutLevel to 0 silently. */
  onResetStrain: () => void;
}

/** Flavor line that shifts with the strain level. */
function getStrainFlavor(level: number, max: number): string {
  if (max === 0) return 'No signet bonded.';
  const ratio = level / max;
  if (ratio === 0) return 'Fresh. Your signet is ready.';
  if (ratio < 0.3) return 'Warm. Running normal.';
  if (ratio < 0.6) return 'Strained. Push with care.';
  if (ratio < 0.85) return 'Burning. Each use bites deep.';
  return 'Critical. Ground yourself before the next channel.';
}

function getStrainTone(level: number, max: number) {
  if (max === 0) return { text: 'text-slate-300', ring: 'border-slate-500/30', bg: 'bg-slate-500/5', barFrom: 'from-slate-500', barTo: 'to-slate-400', label: '—' };
  const ratio = level / max;
  if (ratio === 0) return { text: 'text-emerald-300', ring: 'border-emerald-500/30', bg: 'bg-emerald-500/5', barFrom: 'from-emerald-500', barTo: 'to-emerald-400', label: 'Fresh' };
  if (ratio < 0.3) return { text: 'text-lime-300', ring: 'border-lime-500/30', bg: 'bg-lime-500/5', barFrom: 'from-lime-500', barTo: 'to-lime-400', label: 'Warm' };
  if (ratio < 0.6) return { text: 'text-yellow-300', ring: 'border-yellow-500/30', bg: 'bg-yellow-500/5', barFrom: 'from-yellow-500', barTo: 'to-amber-400', label: 'Strained' };
  if (ratio < 0.85) return { text: 'text-orange-300', ring: 'border-orange-500/30', bg: 'bg-orange-500/5', barFrom: 'from-orange-500', barTo: 'to-orange-400', label: 'Burning' };
  return { text: 'text-red-300', ring: 'border-red-500/40', bg: 'bg-red-500/5', barFrom: 'from-red-600', barTo: 'to-red-400', label: 'Critical' };
}

export function SignetManagementDrawer({
  open,
  onOpenChange,
  signetType,
  burnoutLevel,
  maxBurnout,
  onGroundYourself,
  onResetStrain,
}: SignetManagementDrawerProps) {
  const isUnbonded = maxBurnout === 0;
  const tone = getStrainTone(burnoutLevel, maxBurnout);
  const flavor = getStrainFlavor(burnoutLevel, maxBurnout);
  const pct = maxBurnout > 0 ? Math.min(100, (burnoutLevel / maxBurnout) * 100) : 0;
  const canGround = !isUnbonded && burnoutLevel > 0;
  const canReset = !isUnbonded && burnoutLevel > 0;

  const handleGround = useCallback(() => {
    onGroundYourself();
  }, [onGroundYourself]);

  const handleReset = useCallback(() => {
    onResetStrain();
  }, [onResetStrain]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-red-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-red-300 flex items-center gap-2">
            <Flame className="w-4 h-4" />
            Signet Management
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-5">
          {isUnbonded ? (
            <div className="py-12 px-4 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-red-400/40 mx-auto" />
              <p className="text-sm font-cinzel text-foreground">No signet bonded</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Unbonded riders have no signet to manage. Once you bond a dragon and your signet
                manifests, this screen will track your strain and offer grounding tools.
              </p>
            </div>
          ) : (
            <>
              {/* ─── Signet Identity ─── */}
              <section className="space-y-2">
                <h3 className="px-1 text-[10px] font-cinzel font-bold uppercase tracking-wider text-red-300/80">
                  Signet
                </h3>
                <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-red-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-cinzel font-semibold text-red-100 truncate">
                        {signetType || '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Edit from Settings → Reconfigure Campaign.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── Strain Tracker ─── */}
              <section className="space-y-2">
                <h3 className="px-1 text-[10px] font-cinzel font-bold uppercase tracking-wider text-red-300/80">
                  Signet Strain
                </h3>
                <div className={cn('rounded-lg border p-4', tone.ring, tone.bg)}>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <Flame className={cn('w-6 h-6 self-center', tone.text)} />
                      <span className={cn('text-3xl font-cinzel font-bold leading-none', tone.text)}>
                        {burnoutLevel}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {maxBurnout}</span>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border',
                        tone.text,
                        tone.ring,
                      )}
                    >
                      {tone.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-black/40 overflow-hidden">
                    <div
                      className={cn('h-full bg-gradient-to-r transition-all duration-300', tone.barFrom, tone.barTo)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className={cn('mt-3 text-xs leading-snug', tone.text)}>{flavor}</p>
                </div>
              </section>

              {/* ─── Actions ─── */}
              <section className="space-y-2">
                <Button
                  onClick={handleGround}
                  disabled={!canGround}
                  className="w-full h-12 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                >
                  <Wind className="w-4 h-4" />
                  Ground Yourself
                </Button>
                <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                  Sends a grounding beat to the DM and reduces strain by 2.
                </p>
              </section>

              <section className="space-y-2 pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!canReset}
                      className="w-full gap-2 h-10 text-xs border-white/15 hover:bg-white/5 text-muted-foreground"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Strain
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset signet strain?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sets your strain back to 0 silently — no DM beat. Use this between sessions
                        or after a long rest.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReset}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                  Between-session / long-rest use only.
                </p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
