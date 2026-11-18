// Solo Empyrean: the short confirm before a trip the DM or an NPC offered.
// It shows where, how far, how long and at what pace; one tap sets out. Travel moves the
// campaign clock, so nothing starts without this sheet. The map does the travelling.
import { useEffect, useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { CampaignAtlas } from '@/lib/campaign-atlas';
import type { TravelPace } from '@/lib/campaign-map';
import { journeyPaces, previewJourney, travelTimeText, type TravelTarget } from '@/lib/travel-offers';

const TOUCH = { touchAction: 'manipulation' as const };
const PACE_LABEL: Record<TravelPace, string> = { slow: 'Slow', normal: 'On foot', fast: 'Fast', horseback: 'Horseback', flying: 'By dragon' };

export interface TravelRequest {
  target: TravelTarget;
  /** The words on the button that opened this. */
  label: string;
  /** An NPC who proposed the trip and comes along. */
  companion?: { key: string; name: string } | null;
}

export function SoloTravelSheet({ request, atlas, canFly, busy, onOpenChange, onGo }: {
  /** The trip to confirm; null = closed. */
  request: TravelRequest | null;
  atlas: CampaignAtlas | null;
  /** The rider is bonded: flying is offered. */
  canFly: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (pace?: TravelPace) => void;
}) {
  const target = request?.target ?? null;
  const paces = useMemo(() => (atlas && target ? journeyPaces(atlas, target, canFly) : []), [atlas, target, canFly]);
  const [pace, setPace] = useState<TravelPace | null>(null);
  useEffect(() => { setPace(paces[0] ?? null); }, [paces]);
  const isJourney = target?.kind === 'journey' || target?.kind === 'leave-journey';
  const preview = atlas && target && pace && isJourney ? previewJourney(atlas, target, pace) : null;
  const blocked = isJourney && !preview;

  return (
    <Sheet open={request != null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[67] border-primary/20 bg-background max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-cinzel text-primary flex items-center gap-2"><Compass className="w-5 h-5" /> {request?.label ?? 'Travel'}</SheetTitle>
          <SheetDescription className="text-foreground/80">
            {target?.kind === 'move' && `A short walk to ${target.name}. No time passes.`}
            {target?.kind === 'enter' && `You go into ${target.name}. No time passes.`}
            {target?.kind === 'leave' && `You leave for ${target.name}. No time passes.`}
            {target?.kind === 'journey' && `A journey to ${target.name}. Time passes on the road.`}
            {target?.kind === 'leave-journey' && `You leave this area and set out for ${target.name}. Time passes on the road.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-3">
          {request?.companion && (
            <p className="rounded-lg border border-border/40 px-3 py-2 text-sm">{request.companion.name} comes with you.</p>
          )}

          {isJourney && paces.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-muted-foreground">How you travel</p>
              <div className="flex flex-wrap gap-2">
                {paces.map(p => (
                  <Button key={p} type="button" variant={p === pace ? 'default' : 'outline'} onClick={() => setPace(p)} style={TOUCH} className="min-h-[48px] px-4">
                    {PACE_LABEL[p]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-border/40 px-3 py-2 text-sm space-y-1">
              <p>{pace === 'flying' ? 'A direct flight.' : `By way of ${preview.summary.locationNames.join(' → ')}.`}</p>
              <p>About {Math.max(1, Math.round(preview.summary.remainingMiles))} miles, {travelTimeText(preview.summary.remainingMinutes)}.</p>
            </div>
          )}
          {blocked && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">There is no way to make this trip right now. Open the Map to see what can be reached.</p>
          )}

          <div className="flex gap-2 pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy} style={TOUCH} className="flex-1 min-h-[52px]">Not now</Button>
            <Button type="button" onClick={() => onGo(isJourney ? pace ?? undefined : undefined)} disabled={busy || blocked} style={TOUCH} className="flex-1 min-h-[52px] gap-2">
              <Compass className="w-5 h-5 shrink-0" /> {busy ? 'Setting out…' : isJourney ? 'Set out' : 'Go'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}