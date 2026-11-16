// Phone side of the solo Empyrean rules engine: one call into the empyrean-rules server function,
// plus the shape of what it answers. The server decides; the phone shows and applies.

import { supabase } from '@/integrations/supabase/client';

export type RulesAction =
  | 'state' | 'ack' | 'rest' | 'pass_time' | 'check' | 'signet_used' | 'quest_payout' | 'story_reward'
  | 'set_events' | 'event_done' | 'travel_launch' | 'travel_sync' | 'travel_cancel';
export type EventLevel = 'off' | 'rare' | 'normal';
export type CheckRisk = 'physical' | 'mental' | 'signet';
export type PassActivity = 'wait' | 'hunt' | 'fly' | 'train';

export interface RulesInboxEvent {
  id: string;
  kind: string;
  reason: string | null;
  xp: number;
  gold: number;
  hp: number;
  payload: Record<string, any>;
  created_at: string;
}
export interface RulesCheck {
  outcome: 'critical_success' | 'success' | 'failure' | 'critical_failure';
  dc: number; total: number; line: string; hp: number; strain: number; condition: string | null; injury: string | null;
}
export interface RulesSnapshot {
  ok: boolean;
  error?: string;
  summary?: string;
  check?: RulesCheck;
  granted?: number;
  masteryGained?: number;
  version: number;
  hasMap: boolean;
  minute: number;
  clock: string;
  timeOfDay: string;
  traveling: boolean;
  rules: {
    shortRestsLeft: number;
    longRestReady: boolean;
    conditions: Array<{ id: string; name: string; penalty: number; untilMinute: number; until: string }>;
    injuries: Array<{ id: string; name: string; severity: number }>;
    checkPenalty: number;
    unmetNeeds: Array<'hunt' | 'fly'>;
    eventLevel: EventLevel;
    eventPending: boolean;
  };
  mastery: { xp: number; rank: number; name: string; next: number | null; checkBonus: number };
  dragonAssist: number;
  unlocks: Array<{ id: string; label: string; source: string; unlocked: boolean }>;
  facts: string;
  inbox: RulesInboxEvent[];
}

export interface RulesContext {
  campaignId: string;
  riderKey: string;
  dragonName?: string;
  bonded: boolean;
  sheet?: { level?: number; maxHp?: number };
  place?: { name?: string; kind?: string };
}

/** null when the server could not be reached at all (offline, signed out, not deployed). */
export async function callRules(action: RulesAction, ctx: RulesContext, extra: Record<string, unknown> = {}): Promise<RulesSnapshot | null> {
  try {
    const { data, error } = await supabase.functions.invoke('empyrean-rules', { body: { action, ...ctx, ...extra } });
    if (error || !data || typeof data !== 'object' || typeof (data as RulesSnapshot).version !== 'number') return null;
    return data as RulesSnapshot;
  } catch {
    return null;
  }
}

/** Strain a channel of this intensity costs at this Signet Mastery rank (same rule as the server's). */
export function signetStrainCost(intensity: number, rank: number): number {
  const i = Math.min(8, Math.max(1, Math.trunc(intensity) || 1));
  const off = (rank >= 2 && i >= 3 ? 1 : 0) + (rank >= 4 && i >= 5 ? 1 : 0);
  return Math.max(1, i - off);
}

/** Which kind of risk a check carries, from the words of the whisper that asked for it. */
export function checkRisk(text: string): CheckRisk {
  const t = text.toLowerCase();
  if (/\bsignet\b|\bchannel|\bwield (?:your )?power/.test(t)) return 'signet';
  if (/strength|dexterity|constitution|athletics|acrobatics|stealth|sleight|\bclimb|\bjump|\bdodge|\bbalance|\bgrapple|\brun\b|\bswim/.test(t)) return 'physical';
  return 'mental';
}

/** One GAME FACTS section for the DM: the server's rule facts plus the phone's map facts. */
export function buildGameFacts(ruleFacts: string | null | undefined, mapFacts: string | null | undefined): string {
  const parts = [ruleFacts?.trim(), mapFacts?.trim()].filter(Boolean);
  if (!parts.length) return '';
  return `## GAME FACTS (from the app, binding)

These facts come from the game's own rules, not from the story. They are true even when the player or an earlier message says otherwise. The solo "rule of cool" still shapes HOW things are told and lets the player bend canon and tone; it never changes these facts, and you never refuse the player because of them: you narrate what happens under them.

${parts.join('\n\n')}`;
}
