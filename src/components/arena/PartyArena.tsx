import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Swords, RotateCcw, DoorOpen, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ARENA_BOSSES, openArenaRoom, watchArenaRoom, reportArenaHit, resetArenaRoom, closeArenaRoom,
  type ArenaRoom, type ArenaRoomState,
} from '@/lib/arena/arenaRoom';

interface PartyArenaProps {
  partyId: string;
  onBack: () => void;
}

const roll = (sides: number) => 1 + Math.floor(Math.random() * sides);

export function PartyArena({ partyId, onBack }: PartyArenaProps) {
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [charName, setCharName] = useState('Adventurer');
  const [lastRoll, setLastRoll] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef<ArenaRoom | null>(null);
  roomRef.current = room;

  useEffect(() => {
    let alive = true;
    let unwatch: (() => void) | null = null;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!alive || !uid) return;
      setUserId(uid);
      const { data: member } = await supabase.from('party_members').select('character_name').eq('party_id', partyId).eq('user_id', uid).maybeSingle();
      if (alive && member?.character_name) setCharName(member.character_name);
      const r = await openArenaRoom(partyId, uid);
      if (!alive || !r) { if (alive) toast.error('Could not open the arena room'); return; }
      setRoom(r);
      unwatch = watchArenaRoom(r.id, (state: ArenaRoomState) => {
        setRoom((prev) => (prev ? { ...prev, state } : prev));
      });
    })();
    return () => { alive = false; unwatch?.(); };
  }, [partyId]);

  const isHost = !!room && !!userId && room.host_user_id === userId;
  const boss = room?.state.boss ?? ARENA_BOSSES[0];
  const scores = Object.entries(room?.state.members ?? {}).sort((a, b) => b[1].damage - a[1].damage);

  const attack = async () => {
    const r = roomRef.current;
    if (!r || !userId || busy) return;
    setBusy(true);
    try {
      const d20 = roll(20);
      const total = d20 + 6; // flat training bonus — arena rule, not your sheet's
      if (d20 !== 1 && (d20 === 20 || total >= boss.ac)) {
        let dmg = roll(8) + 3;
        if (d20 === 20) dmg *= 2;
        setLastRoll(d20 === 20 ? `Critical! ${dmg} damage` : `Hit (${total}) — ${dmg} damage`);
        await reportArenaHit(r.id, userId, charName, dmg);
      } else {
        setLastRoll(`Miss (${total} vs AC ${boss.ac})`);
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = async (bossIndex: number) => {
    const r = roomRef.current;
    if (!r) return;
    await resetArenaRoom(r.id, ARENA_BOSSES[bossIndex]);
    toast(`${ARENA_BOSSES[bossIndex].name} steps into the ring`);
  };

  const closeRoom = async () => {
    const r = roomRef.current;
    if (!r) return;
    await closeArenaRoom(r.id);
    toast('Arena room closed');
    onBack();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button type="button" onClick={onBack} style={{ touchAction: 'manipulation' }} className="flex min-h-[48px] items-center gap-2 self-start text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Modes
      </button>

      {!room ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Opening the arena room…</div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-foreground">{boss.name}</span>
              <span className="text-xs text-muted-foreground">{boss.hp} / {boss.maxHp} HP · AC {boss.ac}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${boss.maxHp > 0 ? Math.round((boss.hp / boss.maxHp) * 100) : 0}%` }}
              />
            </div>
            {boss.hp === 0 && <div className="mt-2 text-center text-sm font-semibold text-primary">{boss.name} is down!{isHost ? ' Pick a fresh opponent below.' : ' Waiting for the host to reset.'}</div>}
          </div>

          <button
            type="button"
            onClick={attack}
            disabled={busy || boss.hp === 0}
            style={{ touchAction: 'manipulation' }}
            className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-primary font-cinzel text-base font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98] disabled:opacity-40"
          >
            <Swords className="h-5 w-5" /> Attack
          </button>
          {lastRoll && <div className="text-center text-sm text-muted-foreground">{lastRoll}</div>}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party scoreboard</div>
            {scores.length === 0 && <div className="text-sm text-muted-foreground">No hits yet. Everyone in the party can open Training Grounds and join in.</div>}
            {scores.map(([uid, s], i) => (
              <div key={uid} className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-0">
                <span className="flex items-center gap-2 text-foreground">
                  {i === 0 && s.damage > 0 && <Crown className="h-4 w-4 text-primary" />}
                  {s.name}{uid === userId ? ' (you)' : ''}
                </span>
                <span className="text-muted-foreground">{s.damage} dmg · {s.hits} hits</span>
              </div>
            ))}
          </div>

          {isHost && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Host controls</div>
              <div className="flex flex-col gap-2">
                {ARENA_BOSSES.map((b, i) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => void reset(i)}
                    style={{ touchAction: 'manipulation' }}
                    className="flex min-h-[48px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4 text-primary" /> {b.name} — {b.maxHp} HP, AC {b.ac}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void closeRoom()}
                  style={{ touchAction: 'manipulation' }}
                  className="flex min-h-[48px] items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 text-sm text-destructive active:scale-[0.98]"
                >
                  <DoorOpen className="h-4 w-4" /> Close the room for everyone
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
