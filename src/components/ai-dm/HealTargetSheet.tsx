// Outside a Live NPC fight: after a healing spell is cast at the Party DM table, pick who it heals.
// One tap for a single-target heal; up to 3 picks for an area heal (e.g. "each ally within 10 feet").
import { useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export interface HealTargetMember {
  user_id: string;
  character_name: string;
  character_status?: Record<string, unknown> | null;
}

interface Props {
  open: boolean;
  spellName: string;
  amount: number;
  area: boolean;
  members: HealTargetMember[];
  currentUserId: string | null;
  onConfirm: (userIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

const tap = { touchAction: 'manipulation' as const };

function hpOf(m: HealTargetMember): string {
  const s = m.character_status ?? {};
  const cur = Number((s as Record<string, unknown>).currentHP);
  const max = Number((s as Record<string, unknown>).maxHP);
  return Number.isFinite(cur) && Number.isFinite(max) && max > 0 ? `${cur}/${max} HP` : '';
}

export function HealTargetSheet({ open, spellName, amount, area, members, currentUserId, onConfirm, onClose }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPicked([]); }, [open]);

  const go = async (ids: string[]) => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      await onConfirm(ids);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id]));
  const ordered = [...members].sort((a, b) => (a.user_id === currentUserId ? -1 : b.user_id === currentUserId ? 1 : 0));

  return (
    <Drawer open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DrawerContent className="bg-[#0d0d12] border-white/10">
        <DrawerHeader>
          <DrawerTitle className="text-amber-200 font-cinzel">{spellName}: heal who?</DrawerTitle>
          <p className="text-[13px] text-white/70">Heals {amount} HP{area ? ' each · pick up to 3' : ''}.</p>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
          {ordered.map(m => {
            const mine = m.user_id === currentUserId;
            const on = picked.includes(m.user_id);
            return (
              <button
                key={m.user_id}
                style={tap}
                disabled={busy}
                onClick={() => (area ? toggle(m.user_id) : void go([m.user_id]))}
                className={cn(
                  'w-full min-h-[48px] rounded-lg border px-3 flex items-center justify-between gap-3 text-[14px] disabled:opacity-40',
                  on ? 'border-amber-400 bg-amber-500/20 text-amber-50' : 'border-white/15 bg-white/[0.04] text-white/85',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Heart className="w-4 h-4 text-emerald-300/80 shrink-0" />
                  <span className="truncate">{mine ? `${m.character_name} (you)` : m.character_name}</span>
                </span>
                <span className="text-[12px] text-white/50 shrink-0">{hpOf(m)}</span>
              </button>
            );
          })}
          {area && (
            <button
              style={tap}
              disabled={busy || picked.length === 0}
              onClick={() => { void go(picked); }}
              className="w-full min-h-[48px] rounded-lg border border-amber-400/60 bg-amber-500/25 text-[14px] text-amber-50 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Heal {picked.length || ''}
            </button>
          )}
          <button style={tap} disabled={busy} onClick={onClose} className="w-full min-h-[44px] rounded-lg border border-white/10 text-[13px] text-white/60">
            Nobody (the DM narrates it)
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
