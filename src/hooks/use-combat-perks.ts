import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { readableFunctionError } from '@/lib/live-npcs';
import { COMBAT_PERKS, EXTRA_PERK_SLOT_COST, type CombatPerkId } from '@/lib/combat-perks';

type PerkState = { owned: string[]; equipped: string[]; slots: number };

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const asSlots = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 2 && n <= 3 ? n : 2;
};

/** The signed-in player's combat perks. The server owns them; gold is spent only after it says yes. */
export function useCombatPerks(characterName: string) {
  const [state, setState] = useState<PerkState>({ owned: [], equipped: [], slots: 2 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const busyRef = useRef(false);

  const apply = (d: Record<string, unknown> | null | undefined) => {
    if (!d) return;
    setState({ owned: asList(d.owned), equipped: asList(d.equipped), slots: asSlots(d.slots) });
  };

  const reload = useCallback(async () => {
    if (!characterName) { setLoading(false); return; }
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { setSignedOut(true); setState({ owned: [], equipped: [], slots: 2 }); setLoading(false); return; }
    const { data, error } = await supabase.functions.invoke('npc-combat', { body: { action: 'perks', characterName } });
    if (error) {
      const { status } = await readableFunctionError(error, '');
      if (status === 401) setSignedOut(true);
      setState({ owned: [], equipped: [], slots: 2 });
    } else {
      setSignedOut(false);
      apply(data);
    }
    setLoading(false);
  }, [characterName]);

  useEffect(() => { void reload(); }, [reload]);

  const buy = useCallback(async (perk: CombatPerkId | 'slot', currentGold: number, spend: (amount: number) => void) => {
    if (busyRef.current) return;
    const def = perk === 'slot' ? null : COMBAT_PERKS.find(p => p.id === perk);
    const name = perk === 'slot' ? 'Extra perk slot' : def?.name ?? perk;
    const cost = perk === 'slot' ? EXTRA_PERK_SLOT_COST : def?.cost ?? Infinity;
    if (!(currentGold >= cost)) { toast.error('Not enough gold'); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('npc-combat', { body: { action: 'buy_perk', characterName, perk } });
      if (error || !data?.ok) {
        const { message } = await readableFunctionError(error, 'The purchase did not go through. Try again.');
        toast.error(message);
        return;
      }
      const paid = Number(data.cost);
      if (Number.isFinite(paid) && paid > 0) spend(paid);
      apply(data);
      toast.success(`${name} bought`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [characterName]);

  const toggleEquip = useCallback(async (perk: CombatPerkId) => {
    if (busyRef.current) return;
    const isOn = state.equipped.includes(perk);
    if (!isOn && state.equipped.length >= state.slots) { toast.error('Unequip a perk first'); return; }
    const next = isOn ? state.equipped.filter(p => p !== perk) : [...state.equipped, perk];
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('npc-combat', { body: { action: 'equip_perks', characterName, equipped: next } });
      if (error || !data?.ok) {
        const { message } = await readableFunctionError(error, 'Could not change your perks. Try again.');
        toast.error(message);
        return;
      }
      apply(data);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [characterName, state]);

  return { loading, signedOut, owned: state.owned, equipped: state.equipped, slots: state.slots, busy, reload, buy, toggleEquip };
}
