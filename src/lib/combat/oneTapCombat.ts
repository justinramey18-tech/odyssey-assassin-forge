// One-tap combat actions: pure helpers (no React, no network) so the rules are tested.
//
// When a Live NPC fight is running and a target is already picked, Quick Actions skips the roll
// preview. These helpers decide which slot a one-tap cast may spend (only the spell's own level,
// never an upcast) and which fighters a card may land on.

import { AREA_MAX_TARGETS } from '@/lib/spellResolve';
import type { ActionCard } from '@/lib/roundChatActionCard';
import type { MagicResourceSnapshot } from '@/lib/magic/castBus';

export interface OneTapSlotChoice { slotLevel?: number; usePact?: boolean }

/**
 * The slot a one-tap cast spends: a cantrip spends none; otherwise a slot of exactly the spell's base
 * level (a standard slot first, then a pact slot of that exact level). Null when none remains, so the
 * caller refuses before anything is spent. Never picks a higher slot.
 */
export function baseSlotChoice(baseLevel: number | undefined, res: Pick<MagicResourceSnapshot, 'slots' | 'pactSlots'> | null | undefined): OneTapSlotChoice | null {
  const level = Number(baseLevel);
  if (!Number.isFinite(level) || level <= 0) return {};
  if (!res) return null;
  const std = res.slots.find(s => s.level === level && Number.isFinite(s.current) && s.current > 0);
  if (std) return { slotLevel: level, usePact: false };
  const pact = res.pactSlots;
  if (pact && pact.level === level && Number.isFinite(pact.current) && pact.current > 0) return { slotLevel: level, usePact: true };
  return null;
}

export interface OneTapFighter { id: string; kind: 'player' | 'npc' | string; status: string; hp: number }

/** Which side a card lands on: allies for healing and support, enemies for damage. Null when it lands on nobody. */
export function cardSide(card: ActionCard): 'ally' | 'enemy' | null {
  if (card.resolve === 'buff' && card.combatEffects?.length) return 'ally';
  const dmg = Number(card.damageTotal);
  const amt = Number(card.amount);
  if (card.kind === 'heal' || (Number.isFinite(amt) && amt > 0 && !(Number.isFinite(dmg) && dmg > 0))) return 'ally';
  if (Number.isFinite(dmg) && dmg > 0) return 'enemy';
  return null;
}

/**
 * The fighters a one-tap card lands on, from the already-selected targets (primary first).
 * A single-target card uses only the primary; an area card uses up to AREA_MAX_TARGETS selected targets
 * on the primary's side. One cast never mixes enemies and allies.
 */
export function oneTapTargets(
  card: ActionCard,
  selectedIds: string[],
  fighters: OneTapFighter[],
): { ok: true; targetId: string; extraIds: string[] } | { ok: false; reason: 'no-target' | 'wrong-target' | 'no-effect' } {
  const side = cardSide(card);
  if (!side) return { ok: false, reason: 'no-effect' };
  const ids = [...new Set(selectedIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, reason: 'no-target' };
  const fits = (f: OneTapFighter | undefined) => {
    if (!f) return false;
    if (side === 'enemy') return f.kind === 'npc' && f.status === 'up';
    if (card.resolve === 'buff') return f.kind === 'player' && f.status === 'up' && f.hp > 0;
    return f.kind === 'player' && f.status !== 'dead';
  };
  const primary = fighters.find(f => f.id === ids[0]);
  if (!primary) return { ok: false, reason: 'no-target' };
  if (!fits(primary)) return { ok: false, reason: 'wrong-target' };
  if (card.area !== true) return { ok: true, targetId: primary.id, extraIds: [] };
  const extra = ids.slice(1).map(id => fighters.find(f => f.id === id)).filter(fits).map(f => f!.id);
  return { ok: true, targetId: primary.id, extraIds: extra.slice(0, AREA_MAX_TARGETS - 1) };
}
