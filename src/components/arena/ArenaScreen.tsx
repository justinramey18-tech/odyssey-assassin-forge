import { useEffect, useState } from 'react';
import { Swords, Infinity as InfinityIcon, Users, X, ShieldCheck, ArrowLeft, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { takeArenaSnapshot, restoreArenaSnapshot } from '@/lib/arena/arenaSnapshot';
import { ArenaPractice, OPPONENTS, emptyStats, type ArenaStats, type Opponent, type Foe } from './ArenaPractice';
import { PartyArena } from './PartyArena';
import { supabase } from '@/integrations/supabase/client';
import { foeFromNpc } from '@/lib/arena/arenaFoe';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import { mergeBests, type ArenaBests } from '@/lib/arena/arenaBests';

interface ArenaScreenProps {
  open: boolean;
  onClose: () => void;
}

const BESTS_KEY = 'odyssey-arena-bests';

const MODES = [
  { id: 'solo', label: 'Solo Training', blurb: 'Dummy, sparring partner, drill masters and your campaign NPCs.', icon: Swords },
  { id: 'gauntlet', label: 'Endless Gauntlet', blurb: 'Waves that get tougher until you fall.', icon: InfinityIcon },
  { id: 'party', label: 'Party Arena', blurb: 'Train with your party or spar each other.', icon: Users },
] as const;

function loadBests(): ArenaBests | null {
  migrateToScoped(BESTS_KEY);
  try { return JSON.parse(getScopedItem(BESTS_KEY) ?? 'null'); } catch { return null; }
}

type View = 'menu' | 'opponents' | { opponent: Opponent; foe?: Foe } | 'scorecard' | 'party';

export function ArenaScreen({ open, onClose }: ArenaScreenProps) {
  const [view, setView] = useState<View>('menu');
  const [stats, setStats] = useState<ArenaStats>(emptyStats);
  const [bests, setBests] = useState<ArenaBests | null>(null);
  const [npcFoes, setNpcFoes] = useState<Foe[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setPartyId(localStorage.getItem('odyssey-active-party-id'));
  }, [open]);

  // Saved party NPCs with fight stats become practice opponents (read only).
  useEffect(() => {
    if (!open) return;
    const partyId = localStorage.getItem('odyssey-active-party-id');
    if (!partyId) { setNpcFoes([]); return; }
    let alive = true;
    supabase.from('party_npcs').select('name, combat_stats').eq('party_id', partyId).eq('archived', false).order('sort_order')
      .then(({ data }) => {
        if (!alive || !data) return;
        setNpcFoes(data.map((n) => foeFromNpc(n.name, n.combat_stats)).filter((f): f is Foe => !!f).slice(0, 30));
      });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    takeArenaSnapshot();
    setView('menu');
    setStats(emptyStats());
    setBests(loadBests());
  }, [open]);

  if (!open) return null;

  const finish = () => {
    restoreArenaSnapshot();
    onClose();
  };

  const leave = () => {
    const did = stats.hits + stats.taps + stats.pinEscapes + stats.duels > 0;
    if (!did || view === 'scorecard') return finish();
    const merged = mergeBests(loadBests(), stats);
    // Save bests after restoring so the restore never wipes them.
    restoreArenaSnapshot();
    setScopedItem(BESTS_KEY, JSON.stringify(merged));
    setBests(merged);
    setView('scorecard');
  };

  const rows: Array<[string, string]> = [
    ['Hits landed', String(stats.hits)],
    ['Damage dealt', String(stats.damage)],
    ['Perfect taps', `${stats.perfects} of ${stats.taps}`],
    ['Best perfect chain', String(stats.bestChain)],
    ['Pins escaped', String(stats.pinEscapes)],
    ['Fastest escape', stats.bestEscapeMs === null ? '—' : `${(stats.bestEscapeMs / 1000).toFixed(1)}s`],
    ['Duels won', `${stats.duelsWon} of ${stats.duels}`],
    ['Gauntlet waves cleared', String(stats.bestWave)],
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Training Grounds" className="fixed inset-0 z-[62] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-cinzel text-lg font-bold uppercase tracking-[0.15em] text-primary">Training Grounds</h1>
        <button
          type="button"
          onClick={leave}
          aria-label="Leave the arena"
          style={{ touchAction: 'manipulation' }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {view === 'menu' && (
        <>
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Practice is free. Health, potions, spells and gold go back to exactly how they were when you leave.</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => (m.id === 'solo' ? setView('opponents') : m.id === 'gauntlet' ? setView({ opponent: 'gauntlet' }) : (partyId ? setView('party') : toast('Join a party first to use Party Arena')))}
                style={{ touchAction: 'manipulation' }}
                className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:scale-[0.98]"
              >
                <m.icon className="h-6 w-6 shrink-0 text-primary" />
                <span className="flex flex-col">
                  <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {view === 'opponents' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setView('menu')} style={{ touchAction: 'manipulation' }} className="flex min-h-[48px] items-center gap-2 self-start text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Modes
          </button>
          {OPPONENTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setView({ opponent: o.id })}
              style={{ touchAction: 'manipulation' }}
              className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:scale-[0.98]"
            >
              <o.icon className="h-6 w-6 shrink-0 text-primary" />
              <span className="flex flex-col">
                <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{o.name}</span>
                <span className="text-xs text-muted-foreground">{o.blurb}</span>
              </span>
            </button>
          ))}
          {npcFoes.length > 0 && <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your campaign NPCs</div>}
          {npcFoes.map((f, i) => (
            <button
              key={`${f.name}-${i}`}
              type="button"
              onClick={() => setView({ opponent: 'npc', foe: f })}
              style={{ touchAction: 'manipulation' }}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:scale-[0.98]"
            >
              <Swords className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex flex-col">
                <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.maxHp} HP · AC {f.ac}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {view === 'party' && partyId && (
        <PartyArena partyId={partyId} onBack={() => setView('menu')} />
      )}

      {typeof view === 'object' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ArenaPractice key={view.opponent + (view.foe?.name ?? '')} opponent={view.opponent} foe={view.foe} stats={stats} onStats={setStats} onBack={() => setView(view.opponent === 'gauntlet' ? 'menu' : 'opponents')} />
        </div>
      )}

      {view === 'scorecard' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-cinzel text-sm font-bold uppercase tracking-wider text-primary">
              <Trophy className="h-4 w-4" /> Scorecard
            </div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border/50 py-2 text-sm last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold text-foreground">{v}</span>
              </div>
            ))}
          </div>
          {bests && (
            <div className="rounded-xl border border-border bg-card/60 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal bests</div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Best perfect chain</span><span>{bests.bestChain}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Fastest escape</span><span>{bests.bestEscapeMs === null ? '—' : `${(bests.bestEscapeMs / 1000).toFixed(1)}s`}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Most damage in a session</span><span>{bests.mostDamage}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Best Gauntlet wave</span><span>{bests.bestWave ?? 0}</span></div>
            </div>
          )}
          <button type="button" onClick={finish} style={{ touchAction: 'manipulation' }} className="min-h-[56px] w-full rounded-xl bg-primary font-cinzel font-bold uppercase tracking-wider text-primary-foreground">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
