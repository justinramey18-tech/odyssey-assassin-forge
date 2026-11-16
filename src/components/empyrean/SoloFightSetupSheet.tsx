// Start a solo fight by hand: a match on the sparring mat, or a real fight the story has reached.
// (When the DM offers a fight, its own button starts it with the DM's settings; this sheet is
// for everything else.) The server decides what the choices mean.

import { useEffect, useState } from 'react';
import { Minus, Plus, Swords } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CHALLENGE_OPTIONS, FOE_OPTIONS, type FightChallenge, type FoeKind } from '@/lib/empyrean-rules-client';
import type { FightStart } from '@/hooks/use-solo-fight';

const TOUCH = { touchAction: 'manipulation' as const };
const MAT_FOES: FoeKind[] = ['cadet', 'rider'];
const CHALLENGE_HINT: Record<FightChallenge, string> = {
  easy: 'Slow and clumsy. A warm-up.', moderate: 'A fair fight.', hard: 'Fast and dangerous.', deadly: 'You may not walk away.',
};

export function SoloFightSetupSheet({ mode, onOpenChange, bonded, dragonName, dragonBody, flying, busy, onStart }: {
  /** 'spar' = the mat (never lethal, no dragon). 'fight' = a real fight. null = closed. */
  mode: 'spar' | 'fight' | null;
  onOpenChange: (open: boolean) => void;
  bonded: boolean; dragonName?: string;
  dragonBody?: { hp: number; maxHp: number } | null;
  flying: boolean; busy: boolean;
  onStart: (input: FightStart) => void;
}) {
  const spar = mode === 'spar';
  const [foe, setFoe] = useState<FoeKind>('cadet');
  const [count, setCount] = useState(1);
  const [challenge, setChallenge] = useState<FightChallenge>('moderate');
  useEffect(() => { if (mode) { setFoe(mode === 'spar' ? 'cadet' : 'soldier'); setCount(1); setChallenge('moderate'); } }, [mode]);
  const foes = FOE_OPTIONS.filter(f => !spar || MAT_FOES.includes(f.id));
  const dragon = dragonName || 'Your dragon';
  const dragonOut = bonded && !spar && !!dragonBody && dragonBody.hp <= 0;

  return (
    <Sheet open={mode != null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[67] border-primary/20 bg-background max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-cinzel text-primary flex items-center gap-2"><Swords className="w-5 h-5" /> {spar ? 'Spar on the mat' : 'Start a fight'}</SheetTitle>
          <SheetDescription className="text-foreground/80">
            {spar ? 'A match with rules. Nobody dies, your dragon stays out of it, and the first few wins of a day earn a little XP.'
              : 'A real fight, in real time. If you fall you roll death saves. If your dragon is killed, you die with it.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-4 pb-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Against</p>
            <div className="grid grid-cols-2 gap-2">
              {foes.map(f => (
                <Button key={f.id} variant={foe === f.id ? 'default' : 'outline'} onClick={() => setFoe(f.id)} style={TOUCH} className="min-h-[48px] text-xs">{f.label}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">How many</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Fewer" disabled={count <= 1} onClick={() => setCount(c => Math.max(1, c - 1))} style={TOUCH} className="min-w-[48px] min-h-[48px]"><Minus className="w-4 h-4" /></Button>
              <span className="flex-1 text-center text-sm">{count}</span>
              <Button variant="outline" size="icon" aria-label="More" disabled={count >= (spar ? 2 : 4)} onClick={() => setCount(c => Math.min(spar ? 2 : 4, c + 1))} style={TOUCH} className="min-w-[48px] min-h-[48px]"><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">How dangerous</p>
            <div className="grid grid-cols-4 gap-2">
              {CHALLENGE_OPTIONS.map(c => (
                <Button key={c} variant={challenge === c ? 'default' : 'outline'} onClick={() => setChallenge(c)} style={TOUCH} className="min-h-[48px] px-1 text-xs capitalize">{c}</Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{CHALLENGE_HINT[challenge]}</p>
          </div>

          {bonded && !spar && (
            <p className="text-xs text-muted-foreground">
              {dragonOut ? `${dragon} is too badly hurt to fight. Rest until dawn, or let it hunt, first.`
                : dragonBody ? `${dragon} fights beside you on its own (${dragonBody.hp}/${dragonBody.maxHp} HP).` : `${dragon} fights beside you on its own.`}
            </p>
          )}
          {flying && <p className="text-xs text-destructive">You are mid-flight. Stop the journey on the Map first.</p>}

          <Button disabled={busy || flying || dragonOut} style={TOUCH} className="w-full min-h-[52px] text-base gap-2"
            onClick={() => onStart({ foeKind: foe, count, challenge, lethal: !spar, arena: spar ? 'mat' : 'ground' })}>
            <Swords className="w-5 h-5" /> {spar ? 'Step onto the mat' : 'Fight'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}