// Automatic wake-ups for away players' stand-ins (on-stage NPCs with a player_user_id).
// Pure logic: given a fresh in-character Live Table line, decide which stand-ins should answer.

export type StandInTrigger = 'name' | 'provocation' | 'advice' | 'skill';

export interface StandInLite { id: string; name: string }

export const STAND_IN_COOLDOWN_MS = 90_000;
export const STAND_IN_IDLE_MS = 4 * 60_000;
/** At most this many stand-ins wake on one line. */
export const MAX_WAKES_PER_LINE = 2;

const INSULT = /\b(coward|idiot|fool|useless|weak(ling)?|pathetic|liar|traitor|worthless|stupid|moron|dead ?weight|scum|bastard|shut up)\b/i;
const ADVICE = /\b(should we|what (do|should) we|what now|any (ideas|thoughts|plans?)|thoughts\?|what do (you|y'?all|you all) think|which way|who agrees|vote|opinions?|advice|help me decide|your call)\b/i;
const SKILL = /\b(lock(ed|pick)?|trap(ped)?|rune|runes|inscription|glyph|sigil|tracks?|footprints?|ancient (text|script)|decipher|riddle|puzzle|poison(ed)?|wounded|bleeding|herbs?|map|ward(ed)?|arcane|mechanism|hidden door|secret door|climb|disarm)\b/i;

/** Names a stand-in answers to: full name and first name (3+ letters). */
export function nameTokens(name: string): string[] {
  const full = name.trim();
  if (!full) return [];
  const first = full.split(/\s+/)[0];
  return Array.from(new Set([full, first].filter(t => t.length >= 3)));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function mentions(text: string, name: string): boolean {
  return nameTokens(name).some(t => new RegExp(`(^|[^\\p{L}])${escape(t)}([^\\p{L}]|$)`, 'iu').test(text));
}

export interface WakeDecision { npcId: string; trigger: StandInTrigger }

/**
 * Which stand-ins should answer this line. Named stand-ins come first (name or provocation);
 * otherwise one stand-in (the one quiet longest) answers an advice or skill moment.
 */
export function pickWakes(
  text: string,
  standIns: StandInLite[],
  lastSpokeAt: Record<string, number>,
  now: number,
): WakeDecision[] {
  const t = (text || '').trim();
  if (!t || t.startsWith('@') || standIns.length === 0) return [];
  const ready = standIns.filter(s => now - (lastSpokeAt[s.id] ?? 0) >= STAND_IN_COOLDOWN_MS);
  if (ready.length === 0) return [];

  const insult = INSULT.test(t);
  const named = ready.filter(s => mentions(t, s.name));
  if (named.length) {
    return named.slice(0, MAX_WAKES_PER_LINE).map(s => ({ npcId: s.id, trigger: insult ? 'provocation' : 'name' }));
  }
  // An unnamed insult only lands when exactly one stand-in is on stage.
  if (insult && standIns.length === 1) return [{ npcId: ready[0].id, trigger: 'provocation' }];

  const trigger: StandInTrigger | null = ADVICE.test(t) ? 'advice' : SKILL.test(t) ? 'skill' : null;
  if (!trigger) return [];
  const quietest = [...ready].sort((a, b) => (lastSpokeAt[a.id] ?? 0) - (lastSpokeAt[b.id] ?? 0))[0];
  return [{ npcId: quietest.id, trigger }];
}
