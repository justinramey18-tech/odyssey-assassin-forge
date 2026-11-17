// Camp: the one place solo Empyrean's game rules show on screen. Rest, pass time, wounds and
// conditions, the dragon's needs, Signet Mastery, unlocks, and the random-events setting.
// Everything here comes from the server snapshot (use-empyrean-rules); nothing is decided on the phone.

import { useState } from 'react';
import { BedDouble, Clock, Compass, Feather, Flame, Lock, Map as MapIcon, Minus, Plus, ShieldAlert, Sparkles, Swords, Tent, Unlock } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EmpyreanRulesApi } from '@/hooks/use-empyrean-rules';
import type { EventLevel, PassActivity } from '@/lib/empyrean-rules-client';
import { EMPYREAN_SCENE_ART } from '@/lib/empyreanArt';
import { ASCENSION_TIERS, PRODIGY_NAME, describeTier, nextAscension, type ProdigyTier } from '@/lib/empyreanClasses/prodigy';

const TOUCH = { touchAction: 'manipulation' as const };
const SEVERITY = ['', 'Light', 'Serious', 'Severe'];
const ACTIVITIES: Array<{ id: PassActivity; label: string; hint: string; min: number; needsDragon?: boolean }> = [
  { id: 'wait', label: 'Wait', hint: 'Let time pass.', min: 1 },
  { id: 'train', label: 'Train your signet', hint: 'Builds Signet Mastery (a little each day).', min: 2, needsDragon: true },
  { id: 'hunt', label: 'Let your dragon hunt', hint: 'Meets its need to hunt.', min: 3, needsDragon: true },
  { id: 'fly', label: 'Fly together', hint: 'Meets its need to fly with you.', min: 1, needsDragon: true },
];
const EVENT_LEVELS: Array<{ id: EventLevel; label: string }> = [{ id: 'off', label: 'Off' }, { id: 'rare', label: 'Rare' }, { id: 'normal', label: 'Normal' }];

/** The two header buttons: the clock (opens Camp) and the map. Shown only while the rules engine is live. */
export function EmpyreanEngineButtons({ rules, onCamp, onMap, mapReady }: { rules: EmpyreanRulesApi; onCamp: () => void; onMap: () => void; mapReady: boolean }) {
  const snap = rules.snapshot;
  if (!rules.active || !snap) return null;
  const alert = snap.rules.injuries.length > 0 || snap.rules.conditions.length > 0 || snap.rules.unmetNeeds.length > 0;
  return (
    <>
      <Button variant="ghost" onClick={onCamp} style={TOUCH} aria-label={`Camp. ${snap.clock}`} title="Camp: rest, time, wounds, progress"
        className="empyrean-rune-btn gap-1 text-[11px] text-primary">
        <Tent className="w-5 h-5" />
        <span className="hidden min-[380px]:inline whitespace-nowrap">{snap.clock.replace(', ', ' · ')}</span>
        {alert && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />}
      </Button>
      {mapReady && (
        <Button variant="ghost" onClick={onMap} style={TOUCH} aria-label="Map" title="Map"
          className="empyrean-rune-btn text-primary">
          <MapIcon className="w-5 h-5" />
        </Button>
      )}
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h3>
      {children}
    </section>
  );
}

export function EmpyreanCampSheet({ open, onOpenChange, rules, bonded, dragonName, placeName, onOpenMap, onFight, prodigy, onBattleBrief, questUnlocks }: {
  open: boolean; onOpenChange: (open: boolean) => void; rules: EmpyreanRulesApi; bonded: boolean;
  /** Quest Hub unlocks (hubUnlocks): shown with the server's list, bonded or not. */
  questUnlocks?: Array<{ id: string; label: string; source: string; unlocked: boolean }>;
  dragonName?: string; placeName?: string; onOpenMap?: () => void;
  /** Open the fight setup: a match on the mat, or a real fight. */
  onFight?: (mode: 'spar' | 'fight') => void;
  /** The Prodigy (D-37): its Ascension and Battle Briefs. Null for every other rider. */
  prodigy?: { tier: ProdigyTier; level: number; briefsLeft: number } | null;
  /** Use a Battle Brief (the line goes into the message box). */
  onBattleBrief?: () => void;
}) {
  const snap = rules.snapshot;
  const [hours, setHours] = useState(2);
  const [activity, setActivity] = useState<PassActivity>('wait');
  if (!snap) return null;
  const r = snap.rules;
  const busy = rules.busy;
  const flying = snap.traveling;
  const act = ACTIVITIES.find(a => a.id === activity) ?? ACTIVITIES[0];
  const dragon = dragonName || 'Your dragon';
  const m = snap.mastery;
  const span = m.next != null ? Math.max(1, m.next - [0, 15, 40, 80, 140][m.rank]) : 1;
  const into = m.next != null ? m.xp - [0, 15, 40, 80, 140][m.rank] : 1;
  const pick = (id: PassActivity) => { setActivity(id); const min = ACTIVITIES.find(a => a.id === id)?.min ?? 1; if (hours < min) setHours(min); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[66] border-primary/20 bg-background max-h-[88vh] overflow-y-auto">
        <div className="relative -mx-6 -mt-6 mb-1 h-36 overflow-hidden">
          <img src={EMPYREAN_SCENE_ART.campQuarters} alt="" aria-hidden className="w-full h-full object-cover" width={1024} height={768} />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <SheetHeader className="text-left">
          <SheetTitle className="font-cinzel text-primary flex items-center gap-2"><img src={EMPYREAN_SCENE_ART.flameDagger} alt="" aria-hidden className="w-7 h-7" /> Camp</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground/80">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {snap.clock} ({snap.timeOfDay})</span>
            {placeName && <span className="flex items-center gap-1"><Compass className="w-3.5 h-3.5" /> {flying ? 'Traveling' : placeName}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-3 pb-6">
          {!snap.hasMap && (
            <p className="text-xs text-muted-foreground">The campaign clock starts when the map is ready. Open the Map once, then come back.</p>
          )}

          {prodigy && prodigy.tier > 0 && (() => {
            const now = ASCENSION_TIERS[prodigy.tier - 1];
            const next = nextAscension(prodigy.level);
            return (
              <Section icon={<Flame className="w-4 h-4 text-primary" />} title={`${PRODIGY_NAME}: ${now.name}`}>
                <p className="text-xs italic text-muted-foreground">{now.motto}</p>
                <ul className="space-y-1 text-xs">
                  {describeTier(now.tier).map(line => <li key={line}>{line}</li>)}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  {next ? `Next Ascension: ${next.name} at level ${next.fromLevel}.` : 'The final Ascension.'}
                </p>
                {onBattleBrief && (
                  <Button variant="outline" disabled={busy || prodigy.briefsLeft <= 0} onClick={onBattleBrief} style={TOUCH}
                    className="w-full min-h-[48px] h-auto py-2 flex-col gap-0.5">
                    <span>Battle Brief</span>
                    <span className="text-[11px] text-muted-foreground">
                      {prodigy.briefsLeft > 0 ? `The DM gives you one true tactical fact. ${prodigy.briefsLeft} left today.` : 'None left today.'}
                    </span>
                  </Button>
                )}
              </Section>
            );
          })()}

          <Section icon={<BedDouble className="w-4 h-4 text-primary" />} title="Rest">
            {flying ? (
              <p className="text-xs text-muted-foreground">You can't rest during a journey. Stop on the Map first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy || r.shortRestsLeft <= 0 || !snap.hasMap} onClick={() => void rules.rest('short')} style={TOUCH} className="min-h-[56px] flex-col gap-0.5 h-auto py-2">
                  <span>Short rest</span>
                  <span className="text-[11px] text-muted-foreground">1 hour · {r.shortRestsLeft} left today</span>
                </Button>
                <Button variant="outline" disabled={busy || !r.longRestReady || !snap.hasMap} onClick={() => void rules.rest('long')} style={TOUCH} className="min-h-[56px] flex-col gap-0.5 h-auto py-2">
                  <span>Long rest</span>
                  <span className="text-[11px] text-muted-foreground">{r.longRestReady ? 'Sleep until dawn' : 'Not tired yet'}</span>
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">A short rest eases Signet Strain by 2. A long rest restores you, clears strain and eases each injury one step.</p>
          </Section>

          {!flying && (
            <Section icon={<Clock className="w-4 h-4 text-primary" />} title="Pass time">
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITIES.filter(a => bonded || !a.needsDragon).map(a => (
                  <Button key={a.id} variant={activity === a.id ? 'default' : 'outline'} onClick={() => pick(a.id)} style={TOUCH} className="min-h-[48px] h-auto py-2 text-xs whitespace-normal">
                    {a.id === 'hunt' ? `Let ${dragon} hunt` : a.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{act.hint} At least {act.min} hour{act.min === 1 ? '' : 's'}.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Fewer hours" disabled={hours <= act.min} onClick={() => setHours(h => Math.max(act.min, h - 1))} style={TOUCH} className="min-w-[48px] min-h-[48px]"><Minus className="w-4 h-4" /></Button>
                <span className="flex-1 text-center text-sm">{hours} hour{hours === 1 ? '' : 's'}</span>
                <Button variant="outline" size="icon" aria-label="More hours" disabled={hours >= 12} onClick={() => setHours(h => Math.min(12, h + 1))} style={TOUCH} className="min-w-[48px] min-h-[48px]"><Plus className="w-4 h-4" /></Button>
                <Button disabled={busy || !snap.hasMap} onClick={() => void rules.passTime(hours, activity)} style={TOUCH} className="min-h-[48px] px-5">Go</Button>
              </div>
            </Section>
          )}

          {onFight && !flying && (
            <Section icon={<Swords className="w-4 h-4 text-primary" />} title="Fight">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => onFight('spar')} style={TOUCH} className="min-h-[56px] flex-col gap-0.5 h-auto py-2">
                  <span>Spar on the mat</span>
                  <span className="text-[11px] text-muted-foreground">Practice. Nobody dies.</span>
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => onFight('fight')} style={TOUCH} className="min-h-[56px] flex-col gap-0.5 h-auto py-2">
                  <span>Start a fight</span>
                  <span className="text-[11px] text-muted-foreground">For real.</span>
                </Button>
              </div>
              {bonded && snap.dragonBody && snap.dragonBody.hp < snap.dragonBody.maxHp && (
                <p className="text-[11px] text-muted-foreground">{dragon} is hurt ({snap.dragonBody.hp}/{snap.dragonBody.maxHp} HP). A long rest mends half; a hunt mends a quarter.</p>
              )}
              <p className="text-[11px] text-muted-foreground">When the story reaches a fight, the DM also puts a Fight button under its reply.</p>
            </Section>
          )}

          <Section icon={<ShieldAlert className="w-4 h-4 text-primary" />} title="Wounds and conditions">
            {r.injuries.length === 0 && r.conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing is slowing you down.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {r.injuries.map(i => <li key={i.id} className="flex justify-between gap-2"><span>{i.name}</span><span className="text-destructive">{SEVERITY[i.severity] || 'Injury'} · -{i.severity} to checks</span></li>)}
                {r.conditions.map(c => <li key={c.id} className="flex justify-between gap-2"><span>{c.name}</span><span className="text-muted-foreground">-{c.penalty} until {c.until}</span></li>)}
              </ul>
            )}
            {r.checkPenalty > 0 && <p className="text-[11px] text-muted-foreground">Right now your checks take -{r.checkPenalty}. Injuries ease one step with each long rest.</p>}
          </Section>

          {bonded && (
            <Section icon={<Feather className="w-4 h-4 text-primary" />} title={`${dragon}'s needs`}>
              {r.unmetNeeds.length === 0 ? (
                <p className="text-xs text-muted-foreground">Fed and flown. {dragon} is content.{snap.dragonAssist > 0 ? ` It lends +${snap.dragonAssist} to your checks.` : ''}</p>
              ) : (
                <p className="text-xs text-destructive">
                  {r.unmetNeeds.includes('hunt') ? `${dragon} has not hunted in days. ` : ''}{r.unmetNeeds.includes('fly') ? `${dragon} has not flown with you in days. ` : ''}
                  Each day this goes on costs a little trust. Use Pass time, or fly somewhere on the Map.
                </p>
              )}
            </Section>
          )}

          {bonded && (
            <Section icon={<Flame className="w-4 h-4 text-primary" />} title="Signet Mastery">
              <div className="flex items-baseline justify-between text-xs"><span className="font-semibold">{m.name}</span><span className="text-muted-foreground">{m.next != null ? `${m.xp} / ${m.next}` : 'Mastered'}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, (into / span) * 100))}%` }} /></div>
              <p className="text-[11px] text-muted-foreground">Channeling your signet and training build mastery, a little each day.{m.checkBonus > 0 ? ` You add +${m.checkBonus} to signet checks.` : ''}</p>
            </Section>
          )}

          <Section icon={<Sparkles className="w-4 h-4 text-primary" />} title="Unlocked by your progress">
            {!bonded && <p className="text-xs text-muted-foreground">Signet and dragon unlocks open once a dragon bonds you.</p>}
            <ul className="space-y-1.5 text-xs">
              {[...snap.unlocks.filter(() => bonded), ...(questUnlocks ?? [])].map(u => (
                <li key={u.id} className={cn('flex gap-2', !u.unlocked && 'opacity-50')}>
                  {u.unlocked ? <Unlock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" /> : <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  <span>{u.label}<span className="block text-[10px] text-muted-foreground">{u.source}</span></span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={<Compass className="w-4 h-4 text-primary" />} title="Random events">
            <div className="grid grid-cols-3 gap-2">
              {EVENT_LEVELS.map(l => (
                <Button key={l.id} variant={r.eventLevel === l.id ? 'default' : 'outline'} disabled={busy} onClick={() => void rules.setEvents(l.id)} style={TOUCH} className="min-h-[48px]">{l.label}</Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Things that can happen when you rest, pass time or travel. At most one a day, and at most one per journey.</p>
          </Section>

          {onOpenMap && snap.hasMap && (
            <Button variant="outline" onClick={onOpenMap} style={TOUCH} className="w-full min-h-[48px] gap-2"><MapIcon className="w-4 h-4" /> Open the Map</Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
