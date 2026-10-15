// Party-session character creation: owned local fallback + runtime build validation.
// The server draft is canonical; the local copy is only a crash fallback and is
// keyed by user + party + session so it can never cross accounts or sessions.

import type { CharacterBuildData, ChatMessage } from '@/hooks/use-ai-creation-chat';

export interface PartyRules {
  startingLevel?: number | null;
  startingGold?: number;
  allowedClasses?: string[];
  allowedRaces?: string[];
  xpMode?: string;
  diceMode?: string;
  restrictions?: string[];
  unresolved?: string[];
  defaults?: string[];
}

export interface PartyDraft {
  messages: ChatMessage[];
  buildData: CharacterBuildData | null;
  /** Context revision the current build was checked against. */
  buildContextRevision: number | null;
}

const FALLBACK_PREFIX = 'odyssey-party-creation-draft';
export const fallbackKey = (userId: string, partyId: string, sessionId: string) =>
  `${FALLBACK_PREFIX}::${userId}::${partyId}::${sessionId}`;

export function readFallback(key: string): (PartyDraft & { draftRevision: number }) | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const draft = sanitizeDraft(d?.draft);
    if (!draft || !Number.isInteger(d?.draftRevision)) return null;
    return { ...draft, draftRevision: d.draftRevision };
  } catch { return null; }
}
export function writeFallback(key: string, draft: PartyDraft, draftRevision: number) {
  try { localStorage.setItem(key, JSON.stringify({ draft, draftRevision, savedAt: Date.now() })); } catch { /* storage full */ }
}
export function clearFallback(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const MAX_MESSAGES = 120;
const MAX_MESSAGE_CHARS = 16000;
export function sanitizeDraft(raw: unknown): PartyDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const messages = Array.isArray(r.messages)
    ? r.messages.filter((m): m is ChatMessage => !!m && typeof m === 'object'
        && ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant')
        && typeof (m as ChatMessage).content === 'string')
      .slice(-MAX_MESSAGES).map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    : [];
  const build = validateBuildShape(r.buildData).ok ? (r.buildData as CharacterBuildData) : null;
  const rev = Number(r.buildContextRevision);
  return { messages, buildData: build, buildContextRevision: Number.isInteger(rev) ? rev : null };
}

/** Trim so the server's 256 KiB draft cap is never hit by old chatter. */
export function boundDraft(d: PartyDraft): PartyDraft {
  let messages = d.messages;
  while (messages.length > 2 && JSON.stringify({ ...d, messages }).length > 240_000) messages = messages.slice(2);
  return { ...d, messages };
}

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateBuildShape(raw: unknown): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, issues: ['No character build yet.'] };
  const b = raw as Record<string, unknown>;
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 60) issues.push('The character needs a name (up to 60 characters).');
  if (!fin(b.level) || !Number.isInteger(b.level) || b.level < 1 || b.level > 20) issues.push('Level must be a whole number from 1 to 20.');
  if (typeof b.primaryClass !== 'string' || !/^[a-z][a-z_-]{1,39}$/.test(b.primaryClass)) issues.push('The class is missing or not one the app knows.');
  const s = b.abilityScores as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object' || ABILITIES.some(k => !fin(s[k]) || (s[k] as number) < 1 || (s[k] as number) > 30)) issues.push('Ability scores must all be numbers from 1 to 30.');
  if (!Array.isArray(b.starterAbilities)) issues.push('Starting abilities are missing.');
  if (b.consumables !== undefined && !Array.isArray(b.consumables)) issues.push('Starting items are malformed.');
  return { ok: issues.length === 0, issues };
}

/** Shape + this party's explicit rules. */
export function validateAgainstRules(build: CharacterBuildData | null, rules: PartyRules | null): string[] {
  const shape = validateBuildShape(build);
  if (!shape.ok || !build) return shape.issues;
  const out: string[] = [];
  if (rules?.unresolved?.length) out.push('The campaign rules have an unresolved conflict, so this build can’t be finished yet.');
  if (rules && fin(rules.startingLevel) && build.level !== rules.startingLevel) out.push(`This party starts at level ${rules.startingLevel}; the build is level ${build.level}.`);
  if (rules?.allowedClasses?.length && !rules.allowedClasses.includes(build.primaryClass)) out.push(`This party allows: ${rules.allowedClasses.join(', ')}.`);
  if (rules?.allowedRaces?.length && !rules.allowedRaces.some(r => r.toLowerCase() === (build.race || '').toLowerCase())) out.push(`This party allows these races: ${rules.allowedRaces.join(', ')}.`);
  return out;
}
