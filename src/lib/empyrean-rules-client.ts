// Phone side of the solo Empyrean rules engine: one call into the empyrean-rules server function,
// plus the shape of what it answers. The server decides; the phone shows and applies.

import { supabase } from '@/integrations/supabase/client';
import { prodigyStrainDiscount, type ProdigyTier } from '@/lib/empyreanClasses/prodigy';

export type RulesAction =
  | 'state' | 'ack' | 'rest' | 'pass_time' | 'check' | 'signet_used' | 'quest_payout' | 'story_reward'
  | 'set_events' | 'event_done' | 'travel_launch' | 'travel_sync' | 'travel_cancel' | 'battle_brief' | 'strain' | 'story_time' | 'web_buy';
/** Ways Signet Strain moves besides channels, checks, rests and fights (the server sets the amounts). */
export type StrainReason = 'cool' | 'ground' | 'ground_roll' | 'quest' | 'raise' | 'revive' | 'fallen';
export type FightAction = 'fight_start' | 'fight_tick' | 'fight_act' | 'fight_clash' | 'fight_close';
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
/** The progression web as the server keeps it: XP to spend, nodes owned, and what they add up to. */
export interface RulesWebNode {
  id: string; tier: 'small' | 'big' | 'capstone'; name: string; effect: string; cost: number; owned: boolean; canBuy: boolean; why: string | null;
  /** The node that must be owned first (null: the hub), the branch it sits on (null: the trunk), shown but not buyable yet. Absent from an older server. */
  parent?: string | null; branch?: string | null; soon?: boolean;
}
export interface RulesWebSpoke {
  id: string; half: 'rider' | 'dragon'; name: string; stat: string; blurb: string; coming: boolean; owned: number; nodes: RulesWebNode[];
  /** The branches a spoke's trunk splits into (absent or empty: a single line). */
  branches?: Array<{ id: string; name: string; aspect: string }>;
}
export interface RulesWeb {
  xp: { earned: number; spent: number; balance: number };
  owned: string[];
  bonuses: { strainLimit: number; backlashOff: number; freeChannel: boolean; maxHp?: number };
  spokes: RulesWebSpoke[];
}
/** The top the server allows for the Signet Strain limit, web bonus included. */
export const WEB_STRAIN_TOP = 20;
/** The strain limit to show: the phone's own limit plus the web's bonus (none while the rider has no signet). */
export const webStrainLimit = (base: number, web: RulesWeb | null | undefined): number =>
  base > 0 ? Math.min(WEB_STRAIN_TOP, base + Math.max(0, Math.trunc(Number(web?.bonuses?.strainLimit)) || 0)) : base;

export interface RulesSnapshot {
  ok: boolean;
  error?: string;
  summary?: string;
  check?: RulesCheck;
  granted?: number;
  masteryGained?: number;
  /** The answer to battle_brief: the binding line for the DM and the briefs left today. */
  brief?: { line: string; left: number };
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
  /** The dragon's body between fights (null until its first fight, or when unbonded). */
  dragonBody?: { hp: number; maxHp: number } | null;
  /** A fight is running or finished and not yet closed. */
  fightOpen?: boolean;
  unlocks: Array<{ id: string; label: string; source: string; unlocked: boolean }>;
  /** The Prodigy (D-37): its Ascension tier (0 for other riders) and Battle Briefs left today. */
  prodigy?: { tier: number; briefsLeft: number };
  /** Signet Strain as the server keeps it (absent from an older server: then the phone keeps its own). */
  strain?: number;
  /** What a signet channel cost (the answer to signet_used). */
  strainCost?: number;
  /** That channel was the day's free one (the progression web's Deep Well). */
  freeChannel?: boolean;
  /** The progression web (absent from an older server). */
  web?: RulesWeb;
  /** The node just bought (the answer to web_buy). */
  bought?: { id: string; name: string; effect: string };
  facts: string;
  inbox: RulesInboxEvent[];
}

export interface RulesContext {
  campaignId: string;
  riderKey: string;
  dragonName?: string;
  bonded: boolean;
  sheet?: { level?: number; maxHp?: number; hp?: number; ac?: number; attackBonus?: number | null; weapons?: Array<{ name: string; damage: string }>; riderClass?: string | null };
  place?: { name?: string; kind?: string };
  /** The rider's Signet Strain limit as the phone works it out (bond tier, Quest Hub rank, Prodigy). */
  strainLimit?: number;
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

// ── fights ──
export type FoeKind = 'cadet' | 'rider' | 'soldier' | 'flier' | 'wyvern' | 'venin' | 'beast';
export type FightChallenge = 'easy' | 'moderate' | 'hard' | 'deadly';
export type FightArena = 'mat' | 'ground' | 'air';
export const FOE_OPTIONS: Array<{ id: FoeKind; label: string }> = [
  { id: 'cadet', label: 'Cadet' }, { id: 'rider', label: 'Rider' }, { id: 'soldier', label: 'Soldier' }, { id: 'flier', label: 'Gryphon flier' },
  { id: 'beast', label: 'Beast' }, { id: 'venin', label: 'Venin' }, { id: 'wyvern', label: 'Wyvern' },
];
export const CHALLENGE_OPTIONS: FightChallenge[] = ['easy', 'moderate', 'hard', 'deadly'];
export type ClashSide = 'left' | 'top' | 'right';
export type ClashQuality = 'perfect' | 'block' | 'wrong' | 'bait' | 'early';
export interface FightClash { id: string; move: 'heavy' | 'signature' | 'sweep' | 'pin'; swings: Array<{ off: number; side: ClashSide; feint: boolean }> }
export interface FightLogLine { n: number; at: number; text: string; tone: 'info' | 'good' | 'warn' | 'muted'; targetId?: string; amount?: number; flash?: 'hit' | 'heal' }
export interface FightEnemyView {
  id: string; name: string; kind: FoeKind; hp: number; maxHp: number; status: 'up' | 'down'; nextAt: number;
  pending: { move: FightClash['move']; label: string; target: 'rider' | 'dragon' | 'both'; strikeAt: number; clash: FightClash | null; warded: boolean } | null;
}
export interface FightView {
  id: string; status: 'active' | 'ended'; outcome: 'victory' | 'defeat' | 'fled' | 'yield' | null; lethal: boolean; arena: FightArena; challenge: FightChallenge;
  serverNow: number; nextDueAt: number | null;
  rider: { id: string; name: string; hp: number; maxHp: number; level: number; readyAt: number; weapons: string[]; clash: { id: string; r: Array<ClashQuality | null> } | null };
  dragon: { id: string; name: string; hp: number; maxHp: number; status: 'up' | 'down'; nextAt: number } | null;
  enemies: FightEnemyView[];
  log: FightLogLine[];
  dragonDied: boolean; riderDown: boolean;
}
export interface FightReply {
  ok: boolean; error?: string; serverNow?: number; fight?: FightView | null; inbox?: RulesInboxEvent[];
  strain?: number; usedPotion?: boolean; index?: number; quality?: ClashQuality;
  /** Signet Strain after this move, as the server keeps it (absent from an older server). */
  strainNow?: number;
}
export interface FightOffer { foeKind: FoeKind; foeName: string; count: number; challenge: FightChallenge; lethal: boolean }

/** null when the fight server could not be reached at all. */
export async function callFight(action: FightAction, ctx: RulesContext, extra: Record<string, unknown> = {}): Promise<FightReply | null> {
  try {
    const { data, error } = await supabase.functions.invoke('empyrean-rules', { body: { action, ...ctx, ...extra } });
    if (error || !data || typeof data !== 'object' || typeof (data as FightReply).ok !== 'boolean') return null;
    return data as FightReply;
  } catch {
    return null;
  }
}

const FIGHT_TAG = /<!--FIGHT:([^>]*?)-->/i;
/** The DM's hidden offer of a fight: <!--FIGHT:kind|name|count|challenge|lethal-->. Null when there is none. */
export function parseFightOffer(content: string | null | undefined): FightOffer | null {
  const m = String(content ?? '').match(FIGHT_TAG);
  if (!m) return null;
  const [kind = '', name = '', count = '', challenge = '', lethal = ''] = m[1].split('|').map(s => s.trim());
  const foe = FOE_OPTIONS.find(f => f.id === kind.toLowerCase()) ?? { id: 'soldier' as const, label: 'Soldier' };
  const ch = CHALLENGE_OPTIONS.find(c => c === challenge.toLowerCase()) ?? 'moderate';
  const n = Math.min(4, Math.max(1, Math.trunc(Number(count)) || 1));
  return { foeKind: foe.id, foeName: (name || foe.label).slice(0, 40), count: n, challenge: ch, lethal: !/^(no|false|spar|mat)$/i.test(lethal) };
}

/** Strain a channel of this intensity costs at this Signet Mastery rank (same rule as the server's). */
export function signetStrainCost(intensity: number, rank: number, prodigy = 0): number {
  const i = Math.min(8, Math.max(1, Math.trunc(intensity) || 1));
  const tier = Math.min(5, Math.max(0, Math.trunc(prodigy) || 0)) as ProdigyTier;
  const off = (rank >= 2 && i >= 3 ? 1 : 0) + (rank >= 4 && i >= 5 ? 1 : 0) + prodigyStrainDiscount(tier, i);
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
