// Host-launched Party Sparring: pick opponents from the quick-add roster, then
// fight them on the real Live Table in a safe bubble. Character resources are
// snapshotted on open and put back on close, so nothing reaches the campaign.
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { X, Minus, Plus, Swords, ShieldCheck } from 'lucide-react';
import { takeArenaSnapshot, restoreArenaSnapshot } from '@/lib/arena/arenaSnapshot';
import { SPARRING_ROSTER, MAX_SPARRING_FOES, buildSparringFoes } from '@/lib/arena/sparringRoster';
import { ArenaPartyDMScreen } from './ArenaPartyDMScreen';
import type { CharacterContext } from '@/components/oracle/types';
import type { PartyMember } from '@/hooks/use-party-sync';
import { cn } from '@/lib/utils';
import type { SparringNet } from '@/lib/arena/sparringNet';

type Props = {
  onClose: () => void;
  characterContext: CharacterContext;
  currentUserId?: string | null;
  member?: PartyMember | null;
  currentXP?: number;
  onManualLevelUp?: () => void;
  autoSyncCallbacks?: ComponentProps<typeof ArenaPartyDMScreen>['autoSyncCallbacks'];
  /** Fighting together: the host's link, or a member joining the host's ring. */
  net?: SparringNet | null;
  hostName?: string;
};

export default function PartySparring({ onClose, characterContext, currentUserId, member, currentXP, onManualLevelUp, autoSyncCallbacks, net = null, hostName }: Props) {
  const isMember = net?.role === 'member';
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [started, setStarted] = useState(() => (isMember ? 1 : 0));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const foes = useMemo(() => buildSparringFoes(counts), [counts]);
  const groups = useMemo(() => [...new Set(SPARRING_ROSTER.map((r) => r.group))], []);

  useEffect(() => { takeArenaSnapshot(); }, []);
  const close = () => { if (net?.role === 'host') net.send('end', {}); restoreArenaSnapshot(); onClose(); };
  // Host: keep inviting the party while the ring is open.
  useEffect(() => {
    if (net?.role !== 'host') return;
    const ping = () => net.send('invite', { hostId: net.me, hostName: characterContext.name || 'The host' });
    ping();
    const t = setInterval(ping, 3000);
    return () => clearInterval(t);
  }, [net, characterContext.name]);
  // Member: the host closed the ring.
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (net?.role !== 'member') return;
    return net.on('end', () => setEnded(true));
  }, [net]);
  useEffect(() => { if (ended) { restoreArenaSnapshot(); onClose(); } }, [ended, onClose]);
  const bump = (id: string, d: number) => setCounts((c) => {
    const next = Math.max(0, Math.min(MAX_SPARRING_FOES, (c[id] ?? 0) + d));
    if (d > 0 && total >= MAX_SPARRING_FOES) return c;
    return { ...c, [id]: next };
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Party Sparring" className="fixed inset-0 z-[62] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-cinzel text-lg font-bold uppercase tracking-[0.15em] text-primary">{isMember ? `Sparring with ${hostName || "the host"}` : "Party Sparring"}</h1>
        <button type="button" onClick={close} aria-label={isMember ? "Leave sparring" : "End sparring"} style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground active:scale-95">
          <X className="h-5 w-5" />
        </button>
      </div>

      {started > 0 ? (
        <ArenaPartyDMScreen key={started} characterContext={characterContext} foes={foes} net={net} onBack={() => (isMember ? close() : setStarted(0))} currentUserId={currentUserId} member={member} autoSyncCallbacks={autoSyncCallbacks} currentXP={currentXP} onManualLevelUp={onManualLevelUp} />
      ) : (
        <>
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Nothing here touches the story. Health, potions, spells and gold go back to how they were when sparring ends. Pick up to {MAX_SPARRING_FOES} opponents.</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            {groups.map((g) => (
              <div key={g} className="flex flex-col gap-2">
                <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
                {SPARRING_ROSTER.filter((r) => r.group === g).map((r) => {
                  const n = counts[r.id] ?? 0;
                  return (
                    <div key={r.id} className={cn('flex items-center gap-2 rounded-xl border bg-card p-3', n > 0 ? 'border-primary' : 'border-border')}>
                      <div className="min-w-0 flex-1">
                        <div className="font-cinzel text-sm font-bold text-foreground">{r.name}</div>
                        <div className="text-xs text-primary">{r.role} · {r.maxHp} HP · AC {r.ac}</div>
                        <div className="text-xs text-muted-foreground">{r.blurb}</div>
                      </div>
                      <button type="button" aria-label={`Remove ${r.name}`} disabled={n === 0} onClick={() => bump(r.id, -1)} style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center rounded-full border border-border disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                      <span className="w-5 text-center font-bold">{n}</span>
                      <button type="button" aria-label={`Add ${r.name}`} disabled={total >= MAX_SPARRING_FOES} onClick={() => bump(r.id, 1)} style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center rounded-full border border-border disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button type="button" disabled={total === 0} onClick={() => setStarted(Date.now())} style={{ touchAction: 'manipulation' }} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-primary font-cinzel font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
              <Swords className="h-5 w-5" /> Start Sparring ({total})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
