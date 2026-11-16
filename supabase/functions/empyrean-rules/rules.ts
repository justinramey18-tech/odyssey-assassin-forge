// Solo Empyrean rules: pure functions only (no Deno, no database, no network), so the same file
// runs in the edge function and in the app's tests. The AI proposes; these rules decide.
// Time is the campaign map's clock (minutes since Day 1, 00:00).

export type Rand = () => number;
export const d = (sides: number, rand: Rand) => Math.floor(rand() * sides) + 1;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

// ── clock ──
export const DAY = 1440;
export const DAWN = 6 * 60;
export const dayOf = (minute: number) => Math.floor(Math.max(0, minute) / DAY) + 1;
export const minuteOfDay = (minute: number) => Math.floor(Math.max(0, minute)) % DAY;
export type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';
export function timeOfDay(minute: number): TimeOfDay {
  const h = minuteOfDay(minute) / 60;
  return h < 5 ? 'night' : h < 8 ? 'dawn' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
}
export function formatTime(minute: number): string {
  const m = minuteOfDay(minute);
  return `Day ${dayOf(minute)}, ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** The next 06:00 that is at least `minGap` minutes away. */
export function nextDawn(minute: number, minGap = 360): number {
  let dawn = Math.floor(minute / DAY) * DAY + DAWN;
  while (dawn < minute + minGap) dawn += DAY;
  return dawn;
}

// ── state ──
export interface Condition { id: string; name: string; penalty: number; untilMinute: number }
export interface Injury { id: string; name: string; severity: number }
export interface PendingEvent { id: string; title: string; premise: string; check?: { label: string; dc: number }; day: number }
export type EventLevel = 'off' | 'rare' | 'normal';
export interface CampaignState {
  v: 1;
  seq: number;
  restDay: number;
  shortRests: number;
  lastLongRestEnd: number;
  conditions: Condition[];
  injuries: Injury[];
  needs: { huntMetDay: number; flyMetDay: number; chargedDay: number };
  events: { level: EventLevel; lastEventDay: number; pending: PendingEvent | null };
  signet: { xpDay: number; xpToday: number };
  rewards: { day: number; xp: number; gold: number };
  lastCheck: { label: string; outcome: Outcome; minute: number } | null;
  travel: { dest: string | null; encounterDone: boolean };
}
export function freshState(): CampaignState {
  return {
    v: 1, seq: 0, restDay: 1, shortRests: 0, lastLongRestEnd: -100000, conditions: [], injuries: [],
    needs: { huntMetDay: 1, flyMetDay: 1, chargedDay: 0 },
    events: { level: 'normal', lastEventDay: 0, pending: null },
    signet: { xpDay: 1, xpToday: 0 }, rewards: { day: 1, xp: 0, gold: 0 }, lastCheck: null,
    travel: { dest: null, encounterDone: false },
  };
}
export function normalizeState(raw: unknown): CampaignState {
  const f = freshState();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const level: EventLevel = r.events?.level === 'off' || r.events?.level === 'rare' ? r.events.level : 'normal';
  const p = r.events?.pending;
  return {
    v: 1,
    seq: Math.max(0, int(r.seq)),
    restDay: Math.max(1, int(r.restDay, 1)),
    shortRests: clamp(int(r.shortRests), 0, 9),
    lastLongRestEnd: int(r.lastLongRestEnd, f.lastLongRestEnd),
    conditions: (Array.isArray(r.conditions) ? r.conditions : []).filter((c: any) => c && typeof c.name === 'string').slice(0, 8)
      .map((c: any) => ({ id: String(c.id || c.name), name: String(c.name).slice(0, 40), penalty: clamp(int(c.penalty, 1), 0, 3), untilMinute: int(c.untilMinute) })),
    injuries: (Array.isArray(r.injuries) ? r.injuries : []).filter((i: any) => i && typeof i.name === 'string').slice(0, 6)
      .map((i: any) => ({ id: String(i.id || i.name), name: String(i.name).slice(0, 40), severity: clamp(int(i.severity, 1), 1, 3) })),
    needs: { huntMetDay: Math.max(1, int(r.needs?.huntMetDay, 1)), flyMetDay: Math.max(1, int(r.needs?.flyMetDay, 1)), chargedDay: int(r.needs?.chargedDay) },
    events: {
      level, lastEventDay: int(r.events?.lastEventDay),
      pending: p && typeof p.title === 'string' && typeof p.premise === 'string'
        ? { id: String(p.id), title: p.title.slice(0, 80), premise: p.premise.slice(0, 600), day: int(p.day, 1),
            ...(p.check && typeof p.check.label === 'string' ? { check: { label: p.check.label.slice(0, 60), dc: snapDc(p.check.dc) } } : {}) }
        : null,
    },
    signet: { xpDay: Math.max(1, int(r.signet?.xpDay, 1)), xpToday: Math.max(0, int(r.signet?.xpToday)) },
    rewards: { day: Math.max(1, int(r.rewards?.day, 1)), xp: Math.max(0, int(r.rewards?.xp)), gold: Math.max(0, int(r.rewards?.gold)) },
    lastCheck: r.lastCheck && typeof r.lastCheck.label === 'string' && OUTCOMES.includes(r.lastCheck.outcome)
      ? { label: r.lastCheck.label.slice(0, 80), outcome: r.lastCheck.outcome, minute: int(r.lastCheck.minute) } : null,
    travel: { dest: typeof r.travel?.dest === 'string' ? r.travel.dest.slice(0, 200) : null, encounterDone: r.travel?.encounterDone === true },
  };
}

export interface RuleEvent { kind: string; reason?: string; xp?: number; gold?: number; hp?: number; payload?: Record<string, unknown>; idem_key: string }
export interface Sheet { level: number; maxHp: number }
export function normalizeSheet(raw: unknown): Sheet {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  return { level: clamp(int(r.level, 1), 1, 20), maxHp: clamp(int(r.maxHp, 10), 1, 999) };
}

/** Daily counters roll over and timed conditions end. Call before every rule. */
export function tick(state: CampaignState, minute: number): CampaignState {
  const day = dayOf(minute);
  const s: CampaignState = { ...state, conditions: state.conditions.filter(c => c.untilMinute > minute) };
  if (s.restDay !== day) { s.restDay = day; s.shortRests = 0; }
  if (s.signet.xpDay !== day) s.signet = { xpDay: day, xpToday: 0 };
  if (s.rewards.day !== day) s.rewards = { day, xp: 0, gold: 0 };
  return s;
}

// ── Signet Mastery ──
export const MASTERY_THRESHOLDS = [0, 15, 40, 80, 140];
export const MASTERY_NAMES = ['Untested', 'Kindled', 'Tempered', 'Honed', 'Mastered'];
export const MASTERY_DAILY_XP = 8;
export function masteryRank(xp: number): number {
  let rank = 0;
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) if (xp >= MASTERY_THRESHOLDS[i]) rank = i;
  return rank;
}
export function masteryInfo(xp: number) {
  const rank = masteryRank(xp);
  const next = MASTERY_THRESHOLDS[rank + 1] ?? null;
  return { xp, rank, name: MASTERY_NAMES[rank], next, checkBonus: Math.min(rank, 3) };
}
/** Strain a channel of this intensity (1–8) costs at this mastery rank. Never less than 1. */
export function signetStrainCost(intensity: number, rank: number): number {
  const i = clamp(int(intensity, 1), 1, 8);
  const off = (rank >= 2 && i >= 3 ? 1 : 0) + (rank >= 4 && i >= 5 ? 1 : 0);
  return Math.max(1, i - off);
}
/** Mastery XP for one channel: up to 3 a use, 8 an in-game day. */
export function signetUse(state: CampaignState, minute: number, intensity: number): { state: CampaignState; xpDelta: number } {
  const s = tick(state, minute);
  const want = clamp(Math.ceil(clamp(int(intensity, 1), 1, 8) / 3), 1, 3);
  const xpDelta = Math.max(0, Math.min(want, MASTERY_DAILY_XP - s.signet.xpToday));
  return { state: { ...s, signet: { ...s.signet, xpToday: s.signet.xpToday + xpDelta } }, xpDelta };
}

// ── checks ──
export const DC_LADDER = [10, 15, 20, 25];
export function snapDc(dc: unknown): number {
  const n = Number(dc);
  if (!Number.isFinite(n)) return 15;
  return DC_LADDER.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), DC_LADDER[0]);
}
export const OUTCOMES = ['critical_success', 'success', 'failure', 'critical_failure'] as const;
export type Outcome = typeof OUTCOMES[number];
export type Risk = 'physical' | 'mental' | 'signet';
export const OUTCOME_LABEL: Record<Outcome, string> = {
  critical_success: 'CRITICAL SUCCESS', success: 'SUCCESS', failure: 'FAILURE', critical_failure: 'CRITICAL FAILURE',
};
/** Bond tiers lend the dragon's help to a check: Growing (21+) +1, Deep (61+) +2. */
export const dragonAssist = (bond: number | null) => (bond == null ? 0 : bond >= 61 ? 2 : bond >= 21 ? 1 : 0);
export function checkPenalty(state: CampaignState): number {
  const injury = state.injuries.reduce((m, i) => Math.max(m, i.severity), 0);
  const cond = Math.min(3, state.conditions.reduce((sum, c) => sum + c.penalty, 0));
  return Math.min(4, injury + cond);
}
export interface CheckInput { d20: number; modifier: number; dc: unknown; risk: Risk; label: string; masteryXp: number; bond: number | null }
export interface CheckResult {
  dc: number; total: number; outcome: Outcome; parts: string[]; hp: number; strain: number;
  condition: Condition | null; injury: Injury | null; line: string; state: CampaignState; events: RuleEvent[];
}
export function resolveCheck(state: CampaignState, minute: number, sheet: Sheet, input: CheckInput, rand: Rand): CheckResult {
  let s = tick(state, minute);
  const d20 = clamp(int(input.d20, 1), 1, 20);
  const dc = snapDc(input.dc);
  const tier = DC_LADDER.indexOf(dc) + 1;
  const parts: string[] = [];
  let bonus = 0;
  if (input.risk === 'signet') { const b = masteryInfo(input.masteryXp).checkBonus; if (b) { bonus += b; parts.push(`+${b} Signet Mastery`); } }
  const assist = dragonAssist(input.bond);
  if (assist) { bonus += assist; parts.push(`+${assist} dragon's help`); }
  const pen = checkPenalty(s);
  if (pen) { bonus -= pen; parts.push(`-${pen} wounds and conditions`); }
  const total = d20 + clamp(int(input.modifier), -10, 30) + bonus;
  let outcome: Outcome = total >= dc + 10 ? 'critical_success' : total >= dc ? 'success' : total <= dc - 10 ? 'critical_failure' : 'failure';
  if (d20 === 20) outcome = total >= dc ? 'critical_success' : 'success';
  if (d20 === 1) outcome = 'critical_failure';

  let hp = 0, strain = 0;
  let condition: Condition | null = null, injury: Injury | null = null;
  const addCondition = (name: string, penalty: number, minutes: number) => {
    condition = { id: `${name.toLowerCase()}-${s.seq}`, name, penalty, untilMinute: minute + minutes };
    s = { ...s, conditions: [...s.conditions.filter(c => c.name !== name), condition].slice(-8) };
  };
  if (outcome === 'critical_failure') {
    if (input.risk === 'physical') {
      for (let i = 0; i < tier; i++) hp -= d(6, rand);
      if (rand() < 0.5) {
        if (tier >= 3 && s.injuries.length < 6) {
          injury = { id: `injury-${s.seq}`, name: ['Wrenched shoulder', 'Cracked rib', 'Twisted knee', 'Gashed forearm'][Math.floor(rand() * 4)], severity: 1 };
          s = { ...s, injuries: [...s.injuries, injury] };
        } else addCondition('Winded', 1, 120);
      }
    } else if (input.risk === 'signet') { strain = 2; addCondition('Backlash', 1, 240); }
    else addCondition('Rattled', 1, 240);
  } else if (outcome === 'failure') {
    if (input.risk === 'physical' && tier >= 3) hp -= d(4, rand) + tier;
    if (input.risk === 'signet') strain = 1;
  }
  hp = Math.max(hp, -Math.max(1, Math.floor(sheet.maxHp / 2)));
  const label = String(input.label || 'Check').slice(0, 80);
  const seq = s.seq + 1;
  s = { ...s, seq, lastCheck: { label, outcome, minute } };
  const bits = [`d20 ${d20}`, `total ${total} vs DC ${dc}`, ...parts];
  const cost = [hp ? `${-hp} damage` : '', strain ? `+${strain} Signet Strain` : '', condition ? `${(condition as Condition).name} (-${(condition as Condition).penalty} to checks for a while)` : '', injury ? `injury: ${(injury as Injury).name}` : ''].filter(Boolean);
  const line = `[APP RULING, binding: ${label}: ${OUTCOME_LABEL[outcome]} (${bits.join(', ')}).${cost.length ? ` Consequence: ${cost.join('; ')}.` : ''}]`;
  const events: RuleEvent[] = [{
    kind: 'check', reason: `${label}: ${OUTCOME_LABEL[outcome]}`, hp, idem_key: `check:${seq}`,
    payload: { outcome, dc, total, d20, strain, condition: condition ? (condition as Condition).name : null, injury: injury ? (injury as Injury).name : null },
  }];
  return { dc, total, outcome, parts, hp, strain, condition, injury, line, state: s, events };
}

// ── rest and time ──
export const SHORT_RESTS_PER_DAY = 2;
export const LONG_REST_GAP = 12 * 60;
export type RestResult =
  | { ok: false; error: string }
  | { ok: true; state: CampaignState; events: RuleEvent[]; advance: number; setMinute: number | null; strainDelta: number; strainReset: boolean; summary: string };
export function rest(state: CampaignState, minute: number, kind: 'short' | 'long'): RestResult {
  let s = tick(state, minute);
  const seq = s.seq + 1;
  if (kind === 'short') {
    if (s.shortRests >= SHORT_RESTS_PER_DAY) return { ok: false, error: `You have already taken ${SHORT_RESTS_PER_DAY} short rests today.` };
    // Healing and ability refresh come from the character sheet's own short rest, applied on the
    // phone when this event arrives, so a rest is never counted twice.
    s = { ...s, seq, shortRests: s.shortRests + 1 };
    return {
      ok: true, state: s, advance: 60, setMinute: null, strainDelta: -2, strainReset: false,
      summary: 'Short rest: 1 hour passes. You catch your breath and Signet Strain eases by 2.',
      events: [{ kind: 'rest', reason: 'Short rest', idem_key: `rest:${seq}`, payload: { rest: 'short', strainDelta: -2 } }],
    };
  }
  if (minute - s.lastLongRestEnd < LONG_REST_GAP) {
    const hours = Math.ceil((LONG_REST_GAP - (minute - s.lastLongRestEnd)) / 60);
    return { ok: false, error: `You are too rested to sleep again. Try in about ${hours} hour${hours === 1 ? '' : 's'}, or pass time.` };
  }
  const wake = nextDawn(minute);
  const healed = s.injuries.filter(i => i.severity <= 1).map(i => i.name);
  s = {
    ...s, seq, lastLongRestEnd: wake,
    injuries: s.injuries.map(i => ({ ...i, severity: i.severity - 1 })).filter(i => i.severity >= 1),
    conditions: s.conditions.filter(c => c.untilMinute > wake),
  };
  return {
    ok: true, state: tick(s, wake), advance: 0, setMinute: wake, strainDelta: 0, strainReset: true,
    summary: `Long rest: you wake at ${formatTime(wake)}, fully rested, Signet Strain cleared${healed.length ? `, healed: ${healed.join(', ')}` : ''}.`,
    events: [{ kind: 'rest', reason: 'Long rest', idem_key: `rest:${seq}`, payload: { rest: 'long', strainReset: true, healed } }],
  };
}

export type Activity = 'wait' | 'hunt' | 'fly' | 'train';
export const ACTIVITY_MIN_HOURS: Record<Activity, number> = { wait: 1, hunt: 3, fly: 1, train: 2 };
export type PassResult = { ok: false; error: string } | { ok: true; state: CampaignState; advance: number; summary: string; xpDelta: number };
export function passTime(state: CampaignState, minute: number, hours: number, activity: Activity, bonded: boolean): PassResult {
  const h = clamp(int(hours, 1), 1, 12);
  if ((activity === 'hunt' || activity === 'fly') && !bonded) return { ok: false, error: 'You have no bonded dragon yet.' };
  if (h < ACTIVITY_MIN_HOURS[activity]) return { ok: false, error: `That takes at least ${ACTIVITY_MIN_HOURS[activity]} hours.` };
  let s = tick(state, minute);
  const end = minute + h * 60;
  const endDay = dayOf(end);
  let xpDelta = 0;
  let what = `${h} hour${h === 1 ? '' : 's'} pass`;
  if (activity === 'hunt') { s = { ...s, needs: { ...s.needs, huntMetDay: endDay } }; what = `Your dragon hunts for ${h} hours and comes back fed`; }
  if (activity === 'fly') { s = { ...s, needs: { ...s.needs, flyMetDay: endDay } }; what = `You fly together for ${h} hour${h === 1 ? '' : 's'}`; }
  if (activity === 'train') { const u = signetUse(s, minute, 3); s = u.state; xpDelta = u.xpDelta; what = `You drill your signet for ${h} hours${xpDelta ? ` (+${xpDelta} Signet Mastery)` : ' (no more to learn today)'}`; }
  return { ok: true, state: { ...s, seq: s.seq + 1 }, advance: h * 60, xpDelta, summary: `${what}. It is now ${formatTime(end)}.` };
}

// ── the dragon's needs ──
export const HUNT_EVERY_DAYS = 3;
export const FLY_EVERY_DAYS = 2;
export function unmetNeeds(state: CampaignState, minute: number): Array<'hunt' | 'fly'> {
  const day = dayOf(minute);
  const out: Array<'hunt' | 'fly'> = [];
  if (day - state.needs.huntMetDay > HUNT_EVERY_DAYS) out.push('hunt');
  if (day - state.needs.flyMetDay > FLY_EVERY_DAYS) out.push('fly');
  return out;
}
/** Once per in-game day, an ignored need costs 1 trust (applied on the phone through the dragon record). */
export function chargeNeeds(state: CampaignState, minute: number, bonded: boolean): { state: CampaignState; events: RuleEvent[] } {
  const day = dayOf(minute);
  const unmet = bonded ? unmetNeeds(state, minute) : [];
  if (!unmet.length || state.needs.chargedDay >= day) return { state, events: [] };
  return {
    state: { ...state, needs: { ...state.needs, chargedDay: day } },
    events: [{ kind: 'dragon_need', reason: `Your dragon's needs went unmet: ${unmet.join(' and ')}`, idem_key: `need:${day}`, payload: { trust: -1, needs: unmet } }],
  };
}
/** A journey on dragonback counts as flying together. */
export const flightMeetsNeed = (state: CampaignState, minute: number): CampaignState =>
  ({ ...state, needs: { ...state.needs, flyMetDay: dayOf(minute) } });

// ── rewards ──
export type Challenge = 'easy' | 'moderate' | 'hard' | 'deadly';
/** Same ranges as REWARD_RANGES in src/lib/empyrean-quest-hub.ts (a test keeps them in step). */
export const QUEST_REWARDS: Record<Challenge, { xp: [number, number]; gold: [number, number] }> = {
  easy: { xp: [50, 150], gold: [5, 25] },
  moderate: { xp: [100, 300], gold: [15, 60] },
  hard: { xp: [250, 600], gold: [40, 150] },
  deadly: { xp: [500, 1200], gold: [100, 400] },
};
const rollRange = ([lo, hi]: [number, number], rand: Rand, step: number) => Math.round((lo + rand() * (hi - lo)) / step) * step;
export function questPayout(challenge: unknown, questKey: string, title: string, rand: Rand): RuleEvent {
  const c: Challenge = challenge === 'easy' || challenge === 'hard' || challenge === 'deadly' ? challenge : 'moderate';
  const r = QUEST_REWARDS[c];
  return {
    kind: 'quest_payout', reason: `Quest: ${String(title || questKey).slice(0, 120)}`,
    xp: rollRange(r.xp, rand, 5), gold: rollRange(r.gold, rand, 1), idem_key: `quest:${String(questKey).slice(0, 150)}`,
    payload: { challenge: c, questKey },
  };
}
/** XP the story hands out is snapped to a size and capped per in-game day; gold gains likewise. Spending passes through. */
export const STORY_XP_SIZES = [25, 75, 150];
export const STORY_GOLD_SIZES = [5, 20, 60];
const snapDown = (n: number, sizes: number[]) => sizes.reduce((best, s) => (n >= s ? s : best), sizes[0]);
export function storyReward(state: CampaignState, minute: number, kind: 'xp' | 'gold', amount: number, level: number, source: string):
  { state: CampaignState; events: RuleEvent[]; granted: number } {
  let s = tick(state, minute);
  const n = int(amount);
  if (n === 0) return { state: s, events: [], granted: 0 };
  const seq = s.seq + 1;
  const reason = String(source || 'Story').slice(0, 120);
  if (kind === 'gold' && n < 0) {
    return { state: { ...s, seq }, granted: n, events: [{ kind: 'story_gold', reason, gold: n, idem_key: `story:${seq}` }] };
  }
  if (n < 0) return { state: s, events: [], granted: 0 };
  const scale = kind === 'xp' ? Math.max(1, Math.ceil(level / 4)) : 1;
  const sizes = (kind === 'xp' ? STORY_XP_SIZES : STORY_GOLD_SIZES).map(v => v * scale);
  const cap = sizes[2] * 3;
  const used = kind === 'xp' ? s.rewards.xp : s.rewards.gold;
  const granted = Math.max(0, Math.min(snapDown(n, sizes), cap - used));
  if (granted <= 0) return { state: s, events: [], granted: 0 };
  s = { ...s, seq, rewards: { ...s.rewards, [kind]: used + granted } };
  return {
    state: s, granted,
    events: [{ kind: kind === 'xp' ? 'story_xp' : 'story_gold', reason, ...(kind === 'xp' ? { xp: granted } : { gold: granted }), idem_key: `story:${seq}` }],
  };
}

// ── random events (never on a journey; at most one an in-game day) ──
export type PlaceGroup = 'college' | 'settlement' | 'wild';
export function placeGroup(kind: unknown): PlaceGroup {
  return kind === 'fort' || kind === 'city' ? 'college' : kind === 'town' || kind === 'village' ? 'settlement' : 'wild';
}
export const EVENT_CHANCE: Record<EventLevel, number> = { off: 0, rare: 0.15, normal: 0.35 };
interface EventSeed { id: string; title: string; premise: string; when?: 'day' | 'night'; check?: { label: string; dc: number } }
export const EVENT_TABLE: Record<PlaceGroup, EventSeed[]> = {
  college: [
    { id: 'c-challenge', title: 'A challenge on the mat', premise: 'A cadet from another squad calls the rider out for a sparring challenge in front of onlookers. Refusing costs face; accepting risks a beating.', when: 'day', check: { label: 'Hold your own on the mat', dc: 15 } },
    { id: 'c-summons', title: 'Summoned by a professor', premise: 'A professor sends for the rider without saying why. It may be praise, a warning, or a task nobody else wants.', when: 'day' },
    { id: 'c-rumor', title: 'A rumor in the commons', premise: 'A rumor about the rider, or about someone they care for, is spreading through the commons. Someone started it on purpose.' },
    { id: 'c-night', title: 'Footsteps after curfew', premise: 'After curfew the rider notices someone moving where no one should be. Following is a risk. So is ignoring it.', when: 'night', check: { label: 'Follow without being seen', dc: 15 } },
    { id: 'c-drill', title: 'A surprise drill', premise: 'Leadership calls a surprise formation or drill. The rider has minutes to be ready, and someone in the squad is missing.', when: 'day' },
    { id: 'c-favor', title: 'A favor asked', premise: 'A squadmate quietly asks the rider for a favor that bends the rules. Helping builds loyalty; getting caught has a price.' },
  ],
  settlement: [
    { id: 's-plea', title: 'A local needs a rider', premise: 'A local recognizes the flight leathers and asks for help with trouble the garrison has been ignoring.' },
    { id: 's-eyes', title: 'Watched in the market', premise: 'Someone has been watching the rider since they arrived, and is not hiding it well.', when: 'day', check: { label: 'Spot who is watching', dc: 15 } },
    { id: 's-brawl', title: 'Trouble at the tavern', premise: 'A quarrel between off-duty soldiers and locals is about to turn into a brawl, and the rider is close enough to be pulled in.', when: 'night' },
    { id: 's-trader', title: 'A trader with odd goods', premise: 'A traveling trader offers something that should not be for sale this far from the border, and wants to be rid of it quickly.' },
    { id: 's-news', title: 'News from the border', premise: 'Word arrives from the border. The official version and the version the messenger whispers do not match.' },
  ],
  wild: [
    { id: 'w-weather', title: 'The weather turns', premise: 'The weather turns fast and hard. Shelter is far, and the rider has to choose between pushing on and waiting it out.', check: { label: 'Find shelter in time', dc: 15 } },
    { id: 'w-tracks', title: 'Tracks that should not be here', premise: 'The rider finds fresh tracks or signs of a camp where no patrol is posted. Whoever made them left in a hurry.', when: 'day', check: { label: 'Read the signs', dc: 15 } },
    { id: 'w-wings', title: 'Wings overhead', premise: 'Large wings pass high overhead, too far to tell whose. They circle once before moving on.' },
    { id: 'w-ruin', title: 'Something half buried', premise: 'Weather or a rockfall has uncovered something old: worked stone, a marker, the edge of a structure no map shows.' },
    { id: 'w-night', title: 'A light in the dark', premise: 'A single light shows in the dark where nothing should be burning. It goes out when the rider looks straight at it.', when: 'night' },
    { id: 'w-stranded', title: 'Someone stranded', premise: 'The rider comes across a traveler in real trouble: hurt, lost, or hiding from something. Helping will cost time.' },
  ],
};
/** Rolled after a rest or passing time. Returns the state with a pending event, or unchanged. */
export function rollEvent(state: CampaignState, minute: number, placeKind: unknown, traveling: boolean, rand: Rand): CampaignState {
  const day = dayOf(minute);
  if (traveling || state.events.pending || state.events.lastEventDay >= day) return state;
  if (rand() >= EVENT_CHANCE[state.events.level]) return state;
  const tod = timeOfDay(minute);
  const night = tod === 'night' || tod === 'evening';
  const pool = EVENT_TABLE[placeGroup(placeKind)].filter(e => !e.when || (e.when === 'night') === night);
  if (!pool.length) return state;
  const pick = pool[Math.floor(rand() * pool.length)];
  return { ...state, events: { ...state.events, lastEventDay: day, pending: { id: pick.id, title: pick.title, premise: pick.premise, day, ...(pick.check ? { check: pick.check } : {}) } } };
}
export const consumeEvent = (state: CampaignState): CampaignState =>
  (state.events.pending ? { ...state, events: { ...state.events, pending: null } } : state);

// ── unlocks and the facts block ──
export interface Unlock { id: string; label: string; source: string; unlocked: boolean }
export function unlockList(masteryXp: number, bond: number | null): Unlock[] {
  const rank = masteryRank(masteryXp);
  const b = bond ?? -1;
  return [
    { id: 'm1', label: '+1 on signet checks', source: `Signet Mastery: ${MASTERY_NAMES[1]}`, unlocked: rank >= 1 },
    { id: 'm2', label: '+2 on signet checks; channeling at intensity 3 or more costs 1 less strain', source: `Signet Mastery: ${MASTERY_NAMES[2]}`, unlocked: rank >= 2 },
    { id: 'm3', label: '+3 on signet checks', source: `Signet Mastery: ${MASTERY_NAMES[3]}`, unlocked: rank >= 3 },
    { id: 'm4', label: 'Channeling at intensity 5 or more costs 2 less strain', source: `Signet Mastery: ${MASTERY_NAMES[4]}`, unlocked: rank >= 4 },
    { id: 'b1', label: "Your dragon lends +1 to every check", source: 'Bond: Growing (21+)', unlocked: b >= 21 },
    { id: 'b2', label: 'Signet Strain limit +1', source: 'Bond: Strong (41+)', unlocked: b >= 41 },
    { id: 'b3', label: "Your dragon lends +2 to every check; strain limit +2", source: 'Bond: Deep (61+)', unlocked: b >= 61 },
    { id: 'b4', label: 'Signet Strain limit +3', source: 'Bond: Legendary (81+)', unlocked: b >= 81 },
  ];
}

export interface FactsInput { minute: number; masteryXp: number; bond: number | null; bonded: boolean; traveling: boolean }
/** The rule half of the one GAME FACTS block. The phone adds the map half (place, journey) at send time. */
export function buildRuleFacts(state: CampaignState, f: FactsInput): string {
  const s = tick(state, f.minute);
  const lines: string[] = [];
  lines.push(`Time: ${formatTime(f.minute)} (${timeOfDay(f.minute)}). Only the app moves time: travel, rests and passing time. Never skip days or announce a new day yourself.`);
  const canLong = f.minute - s.lastLongRestEnd >= LONG_REST_GAP;
  lines.push(`Rest: ${SHORT_RESTS_PER_DAY - s.shortRests} short rest${SHORT_RESTS_PER_DAY - s.shortRests === 1 ? '' : 's'} left today; a long rest is ${canLong ? 'available' : 'not available yet'}. A rest only counts when the player uses the Rest button; if the story calls for one, suggest it.`);
  if (s.injuries.length) lines.push(`Injuries (real, not healed by narration): ${s.injuries.map(i => `${i.name} (${['', 'light', 'serious', 'severe'][i.severity]})`).join('; ')}. Each long rest eases them one step.`);
  if (s.conditions.length) lines.push(`Conditions: ${s.conditions.map(c => `${c.name} until ${formatTime(c.untilMinute)}`).join('; ')}.`);
  const m = masteryInfo(f.masteryXp);
  if (f.bonded) lines.push(`Signet Mastery: ${m.name} (rank ${m.rank} of 4). Describe the signet's control and finesse at that level; raw power still follows the channeled intensity.`);
  if (f.bonded) {
    const unmet = unmetNeeds(s, f.minute);
    if (unmet.length) lines.push(`The dragon's needs are overdue: ${unmet.map(n => (n === 'hunt' ? 'it has not hunted in days and is hungry and short-tempered' : 'it has not flown with its rider in days and is restless')).join('; ')}. Let it show.`);
  }
  if (s.lastCheck && f.minute - s.lastCheck.minute <= 120) lines.push(`Last check: ${s.lastCheck.label}: ${OUTCOME_LABEL[s.lastCheck.outcome]}.`);
  lines.push('Checks: when the player message carries an [APP RULING, binding: ...] line, that outcome and its consequence are final. Narrate them; never soften, reverse or re-roll them. Offer checks with a DC of 10, 15, 20 or 25.');
  lines.push('Rewards: you may award XP and gold in the story, but the app sets the final amounts. Never state exact XP or gold totals as fact.');
  if (s.events.pending && !f.traveling) {
    const e = s.events.pending;
    lines.push(`EVENT TO WORK INTO YOUR NEXT REPLY (rolled by the app, the player has not seen it): ${e.title}. ${e.premise}${e.check ? ` If it calls for a roll, offer: ${e.check.label} (DC ${e.check.dc}).` : ''} Open it naturally from the current scene; do not resolve it for the player.`);
  }
  return lines.join('\n');
}
