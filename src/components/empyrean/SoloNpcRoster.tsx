// Solo Empyrean Live NPCs (D-38): the roster and each NPC's Mind screen.
// Met = people the rider has met in this campaign. Known = the rest of the canon cast present in
// the campaign's era (secret survivors stay off the list until the story names them).
// The Mind screen shows who they are, how they feel about the rider and what they remember;
// their secrets are never shown (they only shape how the NPC talks).

import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Search, Sparkles, Swords, Trash2, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ATTITUDE_WORDS, CANON_ERAS, CANON_ERA_LABELS, CAST_GROUP_LABELS, type CanonEra } from '@/lib/empyreanCanon/castNpcs';
import type { NpcStatus, RosterEntry } from '@/lib/solo-npcs';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';

const TOUCH = { touchAction: 'manipulation' as const };
const ERA_SHORT: Record<CanonEra, string> = { fw: 'Year 1', if: 'Year 2', os: 'Year 3' };
const STATUS_LABEL: Record<RosterEntry['status'], string> = { unmet: 'Not met', met: 'Met', knocked_out: 'Knocked out', dead: 'Dead', hidden: 'Removed' };

function attitudeColor(a: number): string {
  return a >= 1 ? 'text-primary' : a === 0 ? 'text-muted-foreground' : a === -1 ? 'text-accent-foreground' : 'text-destructive';
}

function Row({ e, onOpen }: { e: RosterEntry; onOpen: () => void }) {
  return (
    <Button variant="outline" type="button" onClick={onOpen} style={TOUCH}
      className="w-full h-auto min-h-[52px] flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/40 bg-card/40 text-left active:bg-muted/50">
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate">{e.name}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{e.mind.role || CAST_GROUP_LABELS[e.group as keyof typeof CAST_GROUP_LABELS] || 'Your NPC'}</span>
      </span>
      <span className={cn('text-[11px] shrink-0', e.status === 'dead' ? 'text-destructive' : e.status === 'knocked_out' ? 'text-accent-foreground' : attitudeColor(e.attitude))}>
        {e.status === 'met' || e.status === 'unmet' ? ATTITUDE_WORDS[e.attitude] : STATUS_LABEL[e.status]}
      </span>
    </Button>
  );
}

export function SoloNpcRoster({ open, onOpenChange, npcs, riderName, onTalk, onFight }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  npcs: SoloNpcs;
  riderName: string;
  onTalk: (name: string) => void;
  onFight?: (entry: RosterEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [describe, setDescribe] = useState('');
  const selected = openKey ? npcs.entry(openKey) : undefined;

  const { met, known } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (e: RosterEntry) => !q || e.name.toLowerCase().includes(q) || e.mind.role.toLowerCase().includes(q);
    const metList = npcs.roster.filter(e => e.status !== 'unmet' && e.status !== 'hidden' && match(e));
    const knownList = npcs.roster.filter(e => e.status === 'unmet' && e.listed && match(e));
    const groups = new Map<string, RosterEntry[]>();
    for (const e of knownList) {
      const label = CAST_GROUP_LABELS[e.group as keyof typeof CAST_GROUP_LABELS] ?? 'Other';
      groups.set(label, [...(groups.get(label) ?? []), e]);
    }
    return { met: metList, known: [...groups.entries()] };
  }, [npcs.roster, query]);

  const close = (next: boolean) => { if (!next) setOpenKey(null); onOpenChange(next); };
  const setStatus = (status: NpcStatus) => { if (selected) void npcs.setStatus(selected.key, status); };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="z-[67] border-primary/20 bg-background h-[88vh] overflow-y-auto">
        {selected ? (
          <div className="space-y-4 pb-8">
            <SheetHeader className="text-left">
              <Button variant="ghost" onClick={() => setOpenKey(null)} style={TOUCH} className="w-fit min-h-[48px] px-2 gap-1 text-muted-foreground"><ArrowLeft className="w-4 h-4" /> People</Button>
              <SheetTitle className="font-cinzel text-primary text-xl">{selected.name}</SheetTitle>
              <SheetDescription className="text-foreground/80">{selected.mind.role || 'Your NPC'}</SheetDescription>
            </SheetHeader>

            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>How they feel about {riderName || 'you'}</span>
                <span className={attitudeColor(selected.attitude)}>{ATTITUDE_WORDS[selected.attitude]}</span>
              </div>
              <div className="flex gap-1" aria-label={`Attitude ${selected.attitude} of 3`}>
                {[-3, -2, -1, 0, 1, 2, 3].map(n => (
                  <span key={n} className={cn('h-2 flex-1 rounded-full', n === 0 ? 'bg-muted' : (n < 0 ? n >= selected.attitude : n <= selected.attitude) ? (n < 0 ? 'bg-destructive/80' : 'bg-primary/80') : 'bg-muted/40')} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[selected.status]}</p>
            </div>

            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Looks: </span>{selected.mind.look}</p>
              <p><span className="text-muted-foreground">Personality: </span>{selected.mind.personality}</p>
              <p><span className="text-muted-foreground">Voice: </span>{selected.mind.voice}</p>
              <p><span className="text-muted-foreground">Wants: </span>{selected.mind.wants}</p>
              {selected.mind.facts.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-foreground/90">{selected.mind.facts.map(x => <li key={x}>{x}</li>)}</ul>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold">What they remember</p>
              {selected.memories.length
                ? <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">{selected.memories.map(m => <li key={m}>{m}</li>)}</ul>
                : <p className="text-xs text-muted-foreground">Nothing yet. They remember what happens when they're in a scene with you.</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button disabled={selected.status === 'dead'} onClick={() => { onTalk(selected.name); close(false); }} style={TOUCH} className="min-h-[52px] gap-2"><MessageCircle className="w-4 h-4" /> Talk</Button>
              <Button variant="outline" disabled={!onFight || !selected.fight || selected.status === 'dead'} onClick={() => { onFight?.(selected); close(false); }} style={TOUCH} className="min-h-[52px] gap-2"><Swords className="w-4 h-4" /> Fight</Button>
            </div>
            {!selected.fight && <p className="text-[11px] text-muted-foreground">{selected.name} won't fight.</p>}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Status</p>
              <div className="grid grid-cols-3 gap-2">
                {(['met', 'knocked_out', 'dead'] as NpcStatus[]).map(s => (
                  <Button key={s} variant={selected.status === s ? 'default' : 'outline'} onClick={() => setStatus(s)} style={TOUCH} className="min-h-[48px] text-xs">{STATUS_LABEL[s]}</Button>
                ))}
              </div>
              {selected.status !== 'unmet' && (
                <Button variant="ghost" onClick={() => { void npcs.remove(selected.key); setOpenKey(null); }} style={TOUCH} className="w-full min-h-[48px] gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> {selected.custom ? 'Delete this NPC' : 'Remove from Met'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            <SheetHeader className="text-left">
              <SheetTitle className="font-cinzel text-primary flex items-center gap-2"><Users className="w-5 h-5" /> People</SheetTitle>
              <SheetDescription className="text-foreground/80">Everyone you can meet. Tap a name to see their mind. Type @ and a name in the message box to talk to them.</SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Set during {CANON_ERA_LABELS[npcs.era]}</p>
              <div className="grid grid-cols-3 gap-2">
                {CANON_ERAS.map(e => (
                  <Button key={e} variant={npcs.era === e ? 'default' : 'outline'} onClick={() => npcs.setEra(e)} style={TOUCH} className="min-h-[48px] text-xs">{ERA_SHORT[e]}</Button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people" className="pl-9 min-h-[48px] text-base" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Met ({met.length})</p>
              {met.length ? met.map(e => <Row key={e.key} e={e} onOpen={() => setOpenKey(e.key)} />)
                : <p className="text-xs text-muted-foreground">Nobody yet. People the DM introduces show up here.</p>}
            </div>

            <div className="rounded-lg border border-primary/20 p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Quick Build</p>
              <Textarea value={describe} onChange={e => setDescribe(e.target.value)} placeholder="A gruff second-year from Calldyr who owes Dain a favor…" className="min-h-[80px] text-base" />
              <Button disabled={npcs.building || describe.trim().length < 3} style={TOUCH} className="w-full min-h-[48px] gap-2"
                onClick={async () => { const made = await npcs.build(describe.trim()); if (made) { setDescribe(''); setOpenKey(made.key); } }}>
                {npcs.building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Build this NPC
              </Button>
            </div>

            {known.map(([label, list]) => (
              <div key={label} className="space-y-2">
                <p className="text-sm font-semibold">{label} <span className="text-muted-foreground font-normal">({list.length})</span></p>
                {list.map(e => <Row key={e.key} e={e} onOpen={() => setOpenKey(e.key)} />)}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
