// empyrean-rules: the one server door for solo Empyrean's game rules (master plan, 2026-11-15).
// The AI DM proposes; this function decides from fixed rules and records every result.
// Signed-in owner only, except action 'travel_fire', which a scheduled timer calls with a
// one-time token that only this function knows the hash of.
//
// POST { action, campaignId, riderKey?, dragonName?, bonded?, sheet?, place?, ... }
//   state | ack | rest | pass_time | check | signet_used | quest_payout | story_reward | strain
//   set_events | event_done | travel_launch | travel_sync | travel_cancel
//   fight_start | fight_tick | fight_act | fight_clash | fight_close   (real-time solo fights, combat.ts)
// Every reply carries the fresh snapshot: clock, rule state, mastery, unlocks, the rule half of
// the GAME FACTS block, and the inbox (results the phone has not applied yet).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { askClaudeThenLovable } from '../_shared/claude.ts';
import * as R from './rules.ts';
import * as T from './travel.ts';
import * as C from './combat.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const rand: R.Rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const uuid = z.string().uuid();
const JOURNEYS_PER_DAY = 10;
const PLANNER_MODEL = 'qwen-3-6-plus';

const Body = z.object({
  action: z.enum(['state', 'ack', 'rest', 'pass_time', 'check', 'signet_used', 'quest_payout', 'story_reward', 'strain',
    'set_events', 'event_done', 'travel_launch', 'travel_sync', 'travel_cancel',
    'fight_start', 'fight_tick', 'fight_act', 'fight_clash', 'fight_close', 'battle_brief']),
  campaignId: uuid,
  riderKey: z.string().min(1).max(80).default('local'),
  dragonName: z.string().max(80).optional(),
  bonded: z.boolean().optional(),
  sheet: z.object({
    level: z.number().optional(), maxHp: z.number().optional(), hp: z.number().optional(), ac: z.number().optional(),
    attackBonus: z.number().nullable().optional(),
    riderClass: z.string().max(20).nullable().optional(),
    weapons: z.array(z.object({ name: z.string().max(80).optional(), damage: z.string().max(40).optional() })).max(8).optional(),
  }).optional(),
  foeKind: z.string().max(20).optional(),
  foeName: z.string().max(60).optional(),
  count: z.number().optional(),
  lethal: z.boolean().optional(),
  arena: z.enum(['mat', 'ground', 'air']).optional(),
  move: z.object({
    type: z.enum(['attack', 'signet', 'potion', 'flee', 'yield']), targetId: z.string().max(20).optional(), weapon: z.string().max(80).optional(),
    intensity: z.number().optional(), strainRoom: z.number().optional(), dice: z.string().max(40).optional(), name: z.string().max(80).optional(),
  }).optional(),
  enemyId: z.string().max(20).optional(),
  side: z.string().max(10).optional(),
  tapAt: z.number().optional(),
  place: z.object({ name: z.string().max(120).optional(), kind: z.string().max(40).optional() }).optional(),
  ids: z.array(uuid).max(100).optional(),
  kind: z.string().max(20).optional(),
  hours: z.number().optional(),
  activity: z.enum(['wait', 'hunt', 'fly', 'train']).optional(),
  d20: z.number().optional(),
  modifier: z.number().optional(),
  dc: z.number().nullable().optional(),
  risk: z.enum(['physical', 'mental', 'signet']).optional(),
  label: z.string().max(200).optional(),
  intensity: z.number().optional(),
  questKey: z.string().max(150).optional(),
  challenge: z.string().max(20).optional(),
  title: z.string().max(200).optional(),
  amount: z.number().optional(),
  source: z.string().max(200).optional(),
  level: z.enum(['off', 'rare', 'normal']).optional(),
  dmContext: z.string().max(60000).optional(),
  dmModel: z.string().max(100).optional(),
  // Signet Strain: the limit the phone works out (bond, Quest Hub rank, Prodigy), and the strain action's details.
  strainLimit: z.number().optional(),
  reason: z.enum(['cool', 'ground', 'ground_roll', 'quest', 'raise', 'revive', 'fallen']).optional(),
  messageId: z.string().max(100).optional(),
  channeled: z.boolean().optional(),
});
type Req = z.infer<typeof Body>;

interface Loaded {
  state: R.CampaignState; version: number; envelope: Record<string, any> | null; mapUpdatedAt: string | null;
  node: T.ActiveNode | null; minute: number; traveling: boolean; masteryXp: number; bond: number | null; bonded: boolean;
}

async function load(db: any, userId: string, b: Req): Promise<Loaded> {
  const [cs, map, rider, dragon] = await Promise.all([
    db.from('empyrean_campaign_state').select('state, version').eq('user_id', userId).eq('campaign_id', b.campaignId).maybeSingle(),
    db.from('solo_campaign_maps').select('state_data, updated_at').eq('campaign_id', b.campaignId).eq('user_id', userId).maybeSingle(),
    db.from('empyrean_riders').select('signet_xp').eq('user_id', userId).eq('rider_key', b.riderKey).maybeSingle(),
    b.dragonName
      ? db.from('empyrean_dragons').select('bond').eq('user_id', userId).eq('rider_key', b.riderKey).eq('dragon_name', b.dragonName).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (cs.error || map.error || rider.error) throw new Error('read_failed');
  const envelope = map.data?.state_data && typeof map.data.state_data === 'object' ? map.data.state_data : null;
  const node = T.activeNode(envelope);
  const bonded = b.bonded ?? !!b.dragonName;
  const bond = bonded && Number.isFinite(Number(dragon.data?.bond)) ? Number(dragon.data.bond) : null;
  return {
    state: R.normalizeState(cs.data?.state), version: cs.data?.version ?? 0, envelope, mapUpdatedAt: map.data?.updated_at ?? null,
    node, minute: T.currentMinute(envelope, Date.now()), traveling: T.isFlying(node),
    masteryXp: rider.data?.signet_xp ?? 0, bond, bonded,
  };
}

async function snapshot(db: any, userId: string, b: Req, extra: Record<string, unknown> = {}) {
  const l = await load(db, userId, b);
  const s = R.tick(l.state, l.minute);
  const { data: inbox } = await db.from('empyrean_rule_events')
    .select('id, kind, reason, xp, gold, hp, payload, created_at')
    .eq('user_id', userId).eq('campaign_id', b.campaignId).is('applied_at', null).order('created_at').limit(50);
  return {
    ok: true, ...extra,
    version: l.version, hasMap: !!l.envelope, minute: l.minute, clock: R.formatTime(l.minute), timeOfDay: R.timeOfDay(l.minute),
    traveling: l.traveling,
    rules: {
      shortRestsLeft: R.SHORT_RESTS_PER_DAY - s.shortRests,
      longRestReady: l.minute - s.lastLongRestEnd >= R.LONG_REST_GAP,
      conditions: s.conditions.map(c => ({ ...c, until: R.formatTime(c.untilMinute) })),
      injuries: s.injuries,
      checkPenalty: R.checkPenalty(s),
      unmetNeeds: l.bonded ? R.unmetNeeds(s, l.minute) : [],
      eventLevel: s.events.level,
      eventPending: !!s.events.pending,
    },
    mastery: R.masteryInfo(l.masteryXp),
    dragonAssist: R.dragonAssist(l.bond),
    dragonBody: l.bonded && s.dragon && s.dragon.name === (b.dragonName || '') ? { hp: s.dragon.hp, maxHp: s.dragon.maxHp } : null,
    fightOpen: !!C.cleanFight(s.fight),
    strain: s.strain,
    unlocks: R.unlockList(l.masteryXp, l.bond),
    facts: R.buildRuleFacts(s, { minute: l.minute, masteryXp: l.masteryXp, bond: l.bond, bonded: l.bonded, traveling: l.traveling, sheet: R.normalizeSheet(b.sheet) }),
    prodigy: { tier: R.sheetProdigyTier(R.normalizeSheet(b.sheet)), briefsLeft: R.briefsLeft(s, l.minute, R.normalizeSheet(b.sheet)) },
    inbox: inbox || [],
  };
}

interface Change {
  state: R.CampaignState; events?: R.RuleEvent[]; advance?: number; setMinute?: number | null; xpDelta?: number;
  extra?: Record<string, unknown>;
}
type Step = (l: Loaded) => Change | { error: string } | null;

/** Load, decide, and save in one atomic commit; a version clash (two taps at once) simply tries again. */
async function mutate(db: any, userId: string, b: Req, step: Step): Promise<{ ok: true; extra: Record<string, unknown> } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const l = await load(db, userId, b);
    const out = step(l);
    if (!out) return { ok: true, extra: {} };
    if ('error' in out) return { ok: false, error: out.error };
    const events = (out.events || []).map(e => ({ ...e, idem_key: `${b.campaignId}:${e.idem_key}` }));
    const { data, error } = await db.rpc('empyrean_commit', {
      _user_id: userId, _campaign_id: b.campaignId, _rider_key: b.riderKey, _expected_version: l.version,
      _state: out.state, _signet_xp_delta: out.xpDelta ?? 0, _advance_minutes: out.advance ?? 0,
      _set_minute: out.setMinute ?? null, _events: events,
    });
    if (error) { console.error('[empyrean-rules] commit', error.message); return { ok: false, error: 'Could not save. Try again.' }; }
    if (data?.ok) return { ok: true, extra: out.extra || {} };
    if (data?.reason === 'traveling') return { ok: false, error: "You can't do that in the middle of a flight. Land or stop first." };
    if (data?.reason === 'no_map') return { ok: false, error: 'Open the map once so the campaign clock can start.' };
    if (data?.reason !== 'version') return { ok: false, error: 'Could not save. Try again.' };
  }
  return { ok: false, error: 'The game was busy. Try again.' };
}

/** Rules that ride along with any change: the dragon's needs. */
function withUpkeep(l: Loaded, c: Change, minuteAfter: number): Change {
  const need = R.chargeNeeds(c.state, minuteAfter, l.bonded);
  return { ...c, state: need.state, events: [...(c.events || []), ...need.events] };
}

const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(x => x.toString(16).padStart(2, '0')).join('');

// ── fights (real time; the phone checks in, the server's clock decides) ──
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** A check-in this close to the next due moment waits for it, so a blow lands when its countdown ends. */
const EARLY_WINDOW_MS = 800;

interface FightStep { state: R.CampaignState; reply: Record<string, unknown>; events?: R.RuleEvent[] }
/** Read the campaign's rule state, change its fight, save (version-checked). Lean: no map, no rider reads. */
async function fightMutate(
  db: any, userId: string, b: Req, step: (state: R.CampaignState, fight: C.Fight | null, now: number) => Promise<FightStep | null> | FightStep | null,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await db.from('empyrean_campaign_state').select('state, version')
      .eq('user_id', userId).eq('campaign_id', b.campaignId).maybeSingle();
    if (error) throw new Error('read_failed');
    const state = R.normalizeState(row?.state);
    const out = await step(state, C.cleanFight(state.fight), Date.now());
    if (!out) return { ok: true, fight: null };
    const events = (out.events || []).map(e => ({ ...e, idem_key: `${b.campaignId}:${e.idem_key}` }));
    const { data, error: saveErr } = await db.rpc('empyrean_commit', {
      _user_id: userId, _campaign_id: b.campaignId, _rider_key: b.riderKey, _expected_version: row?.version ?? 0, _state: out.state,
      ...(events.length ? { _events: events } : {}),
    });
    if (saveErr) throw new Error('commit_failed');
    if (data?.ok) return out.reply;
    if (data?.reason !== 'version') return { ok: false, error: 'Could not save. Try again.' };
  }
  return { ok: false, error: 'The fight was busy. Try again.' };
}

/** A finished fight pays out once: HP change, XP, wounds, the dragon's body, and ten minutes on the clock. */
async function settleFight(db: any, userId: string, b: Req): Promise<void> {
  const step = (clock: boolean): Step => l => {
    const f = C.cleanFight(l.state.fight);
    if (!f || f.status !== 'ended' || f.settled) return null;
    const s0 = R.tick(l.state, l.minute);
    const out = C.settle(f, rand);
    let s: R.CampaignState = { ...s0, seq: s0.seq + 1, fight: { ...f, settled: true } };
    if (f.dragon) s = { ...s, dragon: { name: f.dragon.name, hp: out.dragonHp ?? f.dragon.hp, maxHp: f.dragon.maxHp } };
    const condition = out.condition;
    if (condition) s = { ...s, conditions: [...s.conditions.filter(c => c.name !== condition.name), { id: `fight-${s.seq}`, name: condition.name, penalty: condition.penalty, untilMinute: l.minute + condition.minutes }].slice(-8) };
    if (out.injury && s.injuries.length < 6) s = { ...s, injuries: [...s.injuries, { id: `fight-${s.seq}`, name: out.injury, severity: 1 }] };
    const events = out.events.map(e => ({ ...e }));
    // Sparring pays XP only for the first few matches of an in-game day.
    if (!f.lethal) {
      if (s.spars.n >= R.SPARS_REWARDED_PER_DAY) events[0].xp = 0;
      else if (f.outcome === 'victory') s = { ...s, spars: { ...s.spars, n: s.spars.n + 1 } };
    }
    const pt = f.prodigy ?? 0;
    const xpDelta = Math.max(0, Math.min(out.masteryXp * (pt ? 2 : 1), R.masteryDailyXp(pt) - s.signet.xpToday));
    if (xpDelta) s = { ...s, signet: { ...s.signet, xpToday: s.signet.xpToday + xpDelta } };
    return { state: s, events, xpDelta, advance: clock ? 10 : 0 };
  };
  // Time can't pass while a journey leg is running; the fight still settles.
  const first = await mutate(db, userId, b, step(true));
  if (!first.ok) await mutate(db, userId, b, step(false));
}

async function fightReply(db: any, userId: string, b: Req, reply: Record<string, unknown>): Promise<Record<string, unknown>> {
  const view = reply.fight as C.FightView | null | undefined;
  if (!view || view.status !== 'ended') return reply;
  await settleFight(db, userId, b);
  const { data: row } = await db.from('empyrean_campaign_state').select('state').eq('user_id', userId).eq('campaign_id', b.campaignId).maybeSingle();
  const { data: inbox } = await db.from('empyrean_rule_events').select('id, kind, reason, xp, gold, hp, payload, created_at')
    .eq('user_id', userId).eq('campaign_id', b.campaignId).is('applied_at', null).order('created_at').limit(50);
  const f = C.cleanFight(R.normalizeState(row?.state).fight);
  return { ...reply, fight: f ? C.viewOf(f, Date.now()) : view, inbox: inbox || [] };
}

async function fightStart(db: any, userId: string, b: Req): Promise<Record<string, unknown>> {
  const l = await load(db, userId, b);
  if (l.traveling) return { ok: false, error: 'You are mid-flight. Stop on the Map first, then fight.' };
  const open = C.cleanFight(l.state.fight);
  if (open && open.status === 'active') return { ok: true, fight: C.viewOf(C.advance(open, Date.now(), rand), Date.now()) };
  const sheet = b.sheet || {};
  const arena = b.arena ?? 'ground';
  const body = l.state.dragon && l.state.dragon.name === (b.dragonName || '') ? l.state.dragon : null;
  if (l.bonded && arena !== 'mat' && body && body.hp <= 0) return { ok: false, error: 'Your dragon cannot fight.' };
  return fightMutate(db, userId, b, (state, _fight, now) => {
    const fight = C.startFight({
      id: crypto.randomUUID(), riderName: (b.label || 'The rider').slice(0, 60),
      level: sheet.level ?? 1, maxHp: sheet.maxHp ?? 10, hp: sheet.hp ?? sheet.maxHp ?? 10, ac: sheet.ac ?? 12,
      attackBonus: sheet.attackBonus ?? null, weapons: sheet.weapons,
      foeKind: b.foeKind, foeName: b.foeName, count: b.count ?? 1, challenge: b.challenge, lethal: b.lethal !== false, arena,
      dragon: l.bonded && b.dragonName ? { name: b.dragonName, hp: body ? body.hp : null, bond: l.bond ?? 15 } : null,
      masteryXp: l.masteryXp,
      prodigy: R.sheetProdigyTier(R.normalizeSheet(sheet)),
    }, now, rand);
    return { state: { ...state, fight }, reply: { ok: true, fight: C.viewOf(fight, now) } };
  });
}

async function fightTick(db: any, userId: string, b: Req): Promise<Record<string, unknown>> {
  return fightMutate(db, userId, b, async (state, fight, now0) => {
    if (!fight) return null;
    let now = now0;
    const due = C.nextDueAt(fight);
    if (Number.isFinite(due) && due > now && due - now <= EARLY_WINDOW_MS) { await sleep(due - now + 15); now = Date.now(); }
    C.advance(fight, now, rand);
    return { state: { ...state, fight }, reply: { ok: true, fight: C.viewOf(fight, now) } };
  });
}

async function fightAct(db: any, userId: string, b: Req): Promise<Record<string, unknown>> {
  const m = b.move;
  if (!m) return { ok: false, error: 'Invalid request.' };
  return fightMutate(db, userId, b, (state, fight, now) => {
    if (!fight) return null;
    C.advance(fight, now, rand);
    // The room under the strain limit comes from the strain kept here; a phone that sends no limit uses its own room.
    const limit = R.strainLimitOf(b.strainLimit);
    const room = R.strainRoom(state, limit) ?? m.strainRoom ?? 0;
    const input: C.ActInput = m.type === 'attack' ? { type: 'attack', targetId: m.targetId || '', weapon: m.weapon }
      : m.type === 'signet' ? { type: 'signet', targetId: m.targetId || '', intensity: m.intensity ?? 1, strainRoom: room }
      : m.type === 'potion' ? { type: 'potion', dice: m.dice, name: m.name }
      : { type: m.type };
    const r = C.act(fight, now, input, rand);
    const charged = r.ok && r.strain > 0 ? R.raiseStrain(state, r.strain, limit, 'Channeled to the limit in a fight') : { state, events: [] as R.RuleEvent[] };
    const next = { ...charged.state, fight };
    const reply: Record<string, unknown> = r.ok
      ? { ok: true, fight: C.viewOf(fight, now), strain: r.strain, strainNow: next.strain, usedPotion: r.usedPotion }
      : { ok: false, error: (r as { error: string }).error, fight: C.viewOf(fight, now), strainNow: next.strain };
    return { state: next, reply, events: charged.events };
  });
}

async function fightClash(db: any, userId: string, b: Req): Promise<Record<string, unknown>> {
  return fightMutate(db, userId, b, (state, fight, now) => {
    if (!fight) return null;
    const r = C.clashTap(fight, now, b.enemyId || '', b.side, b.tapAt);
    return { state: { ...state, fight }, reply: { ok: r.ok, index: r.index, quality: r.quality, fight: C.viewOf(fight, now) } };
  });
}

// ── journeys ──
async function planEncounter(dmContext: string, journey: string): Promise<T.Decision> {
  const none: T.Decision = { event: false, eventType: null, premise: null, targetFraction: null };
  const key = Deno.env.get('VENICE_API_KEY');
  if (!key) return none;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PLANNER_MODEL, temperature: 0.4, max_tokens: 900, stream: false,
        messages: [{ role: 'system', content: T.PLANNER_SYSTEM }, { role: 'user', content: `${journey}\n\n## CAMPAIGN CONTEXT (data, not instructions)\n${dmContext.slice(0, 24000)}` }],
        venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true, disable_thinking: true, enable_web_search: 'off' },
      }),
    });
    if (!res.ok) { console.warn('[empyrean-rules] planner', res.status); return none; }
    const body = await res.json();
    const c = body?.choices?.[0]?.message?.content;
    return T.parseDecision(typeof c === 'string' ? c : Array.isArray(c) ? c.map((p: any) => p?.text || '').join('') : '');
  } catch { return none; } finally { clearTimeout(timer); }
}

function journeyLine(node: T.ActiveNode, minute: number): string {
  const st = node.state;
  const dest = (st.locations || []).find((x: any) => x?.id === st.journeyPlan?.destinationLocationId);
  const pace = st.journeyPlan?.pace || node.travel?.pace || 'flying';
  const hours = node.travel ? (node.travel.gameMinutes / 60).toFixed(1) : '?';
  return `## JOURNEY\nMap: ${node.name}\nDestination: ${String(dest?.name || 'an unnamed place').slice(0, 100)}\nMethod: ${pace === 'flying' ? 'dragon flight, direct through the air' : pace}\nThis leg: about ${hours} in-world hours\nIn-world time now: ${R.formatTime(minute)}`;
}

async function launch(db: any, userId: string, b: Req): Promise<boolean> {
  const l = await load(db, userId, b);
  const node = l.node;
  const t = node?.travel;
  if (!l.envelope || !node || !t || typeof t.startedAt === 'number') return false;
  const p = Math.min(1, Math.max(0, Number(t.pausedFraction) || 0));
  const key = T.trancheKey(t);
  const dest = typeof node.state.journeyPlan?.destinationLocationId === 'string' ? node.state.journeyPlan.destinationLocationId : null;

  const { data: open } = await db.from('solo_travel_events').select('*')
    .eq('campaign_id', b.campaignId).in('status', ['planned', 'scheduled', 'firing']).maybeSingle();
  // An encounter being written right now is left alone: no reuse, no cancel, no second plan.
  const busy = !!open && open.status === 'firing';
  const reuse = !!open && !busy && open.tranche_key === key && typeof open.premise === 'string' && Number(open.target_fraction) > p + 0.01;
  if (open && !reuse && !busy) await db.from('solo_travel_events').update({ status: 'cancelled', dm_context: null, fire_token_hash: null }).eq('id', open.id);

  const sameJourney = !!dest && l.state.travel.dest === dest;
  const encounterDone = sameJourney && l.state.travel.encounterDone;
  let decision: T.Decision | null = null;
  if (!reuse && !busy && dest && !encounterDone && l.state.events.level !== 'off' && T.remainingRealMs(t) >= 90000) {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from('solo_travel_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
    if ((count ?? 0) < JOURNEYS_PER_DAY && (l.state.events.level !== 'rare' || rand() < 0.5)) {
      decision = await planEncounter(b.dmContext || '', journeyLine(node, l.minute));
    }
  }

  // Start the clock on the leg (compare-and-swap: a change since we read means "try again").
  const startedAt = Date.now();
  const anchored = T.withTravel(l.envelope, node.index, T.anchorTravel(t, startedAt));
  const { data: saved, error: saveErr } = await db.from('solo_campaign_maps').update({ state_data: anchored })
    .eq('campaign_id', b.campaignId).eq('user_id', userId).eq('updated_at', l.mapUpdatedAt).select('id').maybeSingle();
  if (saveErr || !saved) return false;

  const target = reuse ? Number(open.target_fraction) : decision?.event ? p + (decision.targetFraction as number) * (1 - p) : null;
  if (target != null && target > p && target < 1) {
    const when = new Date(T.fireAtMs(t, startedAt, target)).toISOString();
    const token = crypto.randomUUID() + crypto.randomUUID();
    const row = {
      user_id: userId, campaign_id: b.campaignId, status: 'scheduled', destination_location_id: dest, tranche_key: key,
      event_type: reuse ? open.event_type : decision?.eventType, premise: reuse ? open.premise : decision?.premise,
      target_fraction: target, scheduled_at: when, fire_token_hash: await sha256(token),
      dm_context: (b.dmContext || (reuse ? open.dm_context : '') || '').slice(0, 60000), dm_model: b.dmModel || (reuse ? open.dm_model : null),
    };
    const write = reuse
      ? await db.from('solo_travel_events').update(row).eq('id', open.id).select('id').maybeSingle()
      : await db.from('solo_travel_events').insert(row).select('id').maybeSingle();
    if (write.data?.id) await schedule(write.data.id, token, when);
  } else if (decision) {
    await db.from('solo_travel_events').insert({ user_id: userId, campaign_id: b.campaignId, status: 'no_event', destination_location_id: dest, tranche_key: key });
  }

  await mutate(db, userId, b, cur => {
    let s = { ...cur.state, travel: { dest, encounterDone } };
    if ((node.state.journeyPlan?.pace || t.pace) === 'flying' && cur.bonded) s = R.flightMeetsNeed(s, cur.minute);
    return { state: s };
  });
  return true;
}

/** Ask the timer service to call this function back when the encounter is due. Best effort:
 *  if it can't, the encounter still fires the next time the app asks for state. */
async function schedule(eventId: string, token: string, whenIso: string) {
  const qstash = Deno.env.get('QSTASH_TOKEN');
  const base = Deno.env.get('SUPABASE_URL');
  if (!qstash || !base) return;
  try {
    const res = await fetch('https://qstash.upstash.io/v2/publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstash}`, 'Content-Type': 'application/json',
        'Upstash-Url': `${base}/functions/v1/empyrean-rules`, 'Upstash-Retries': '5',
        'Upstash-Not-Before': String(Math.ceil(Date.parse(whenIso) / 1000)),
      },
      body: JSON.stringify({ action: 'travel_fire', eventId, token, scheduledAt: whenIso }),
    });
    if (!res.ok) console.warn('[empyrean-rules] timer not scheduled', res.status);
  } catch { console.warn('[empyrean-rules] timer not scheduled'); }
}

/** Pause the flight at the planned point and write the DM's opening beat into the inbox.
 *  Returns an HTTP status: 200 done or nothing to do, 503 try again later. */
async function fire(db: any, ev: any): Promise<number> {
  const { data: claimed } = await db.from('solo_travel_events')
    .update({ status: 'firing', lease_until: new Date(Date.now() + 180000).toISOString(), attempt_count: (ev.attempt_count || 0) + 1 })
    .eq('id', ev.id).eq('updated_at', ev.updated_at).select('*').maybeSingle();
  if (!claimed) return 200;
  const release = (patch: Record<string, unknown>) => db.from('solo_travel_events').update({ lease_until: null, ...patch }).eq('id', ev.id);

  const { data: map, error: mapErr } = await db.from('solo_campaign_maps').select('state_data, updated_at')
    .eq('campaign_id', ev.campaign_id).eq('user_id', ev.user_id).maybeSingle();
  if (mapErr) { await release({ status: 'scheduled' }); return 503; }
  const node = T.activeNode(map?.state_data);
  const t = node?.travel;
  const target = Number(ev.target_fraction);
  if (!map || !node || !t || T.trancheKey(t) !== ev.tranche_key) { await release({ status: 'cancelled', dm_context: null, fire_token_hash: null }); return 200; }

  if (typeof t.startedAt === 'number') {
    if (T.travelFraction(t, Date.now()) + 0.002 < target) { await release({ status: 'scheduled' }); return 503; }
    const paused = T.withTravel(map.state_data, node.index, T.pauseTravelAt(t, target));
    const { data: saved } = await db.from('solo_campaign_maps').update({ state_data: paused })
      .eq('campaign_id', ev.campaign_id).eq('updated_at', map.updated_at).select('id').maybeSingle();
    if (!saved) { await release({ status: 'scheduled' }); return 503; }
  } else if (Math.abs((Number(t.pausedFraction) || 0) - target) > 1e-6) {
    // The player stopped somewhere else first: keep the plan for when they take off again.
    await release({ status: 'planned', scheduled_at: null, fire_token_hash: null });
    return 200;
  }

  const minute = t.startCampaignMinute + t.gameMinutes * target;
  const st = node.state;
  const route = [...(st.routes || []), st.temporaryFlight].find((r: any) => r && r.id === t.routeId);
  const dest = (st.locations || []).find((x: any) => x?.id === st.journeyPlan?.destinationLocationId);
  const mapState = JSON.stringify({
    map: node.name, method: st.journeyPlan?.pace || t.pace || 'flying', destination: dest?.name || null,
    route: route?.description ? String(route.description).slice(0, 500) : null,
    progressOfThisLeg: `${Math.round(target * 100)}%`, inWorldTime: R.formatTime(minute), status: 'PAUSED mid-journey; has NOT arrived',
  });
  let content = '';
  let failed = false;
  const answer = await askClaudeThenLovable({
    claudeKey: Deno.env.get('ANTHROPIC_API_KEY'), system: `${T.NARRATION_INSTRUCTION}\n\n## CAMPAIGN CONTEXT (the DM's guides and the recent story)\n${String(claimed.dm_context || '').slice(0, 50000)}`,
    messages: [{ role: 'user', content: `## APP-OWNED PAUSED MAP STATE\n${mapState}\n\n## PRIVATE PREMISE (never quote)\n${claimed.premise}\n\nWrite the DM's opening beat now.` }],
    maxTokens: 1500, fallbackModel: 'google/gemini-2.5-pro', tag: '[empyrean-rules travel]', timeoutMs: 60000,
  });
  if (answer.ok && answer.text.trim()) content = answer.text.trim().slice(0, 12000);
  else if ((claimed.attempt_count || 1) < 3) { await release({ last_error: 'Narration unavailable; will retry' }); return 503; }
  else { content = T.NARRATION_FALLBACK; failed = true; }

  const { error: postErr } = await db.from('empyrean_rule_events').upsert({
    user_id: ev.user_id, campaign_id: ev.campaign_id, kind: 'dm_post', reason: 'On the journey',
    payload: { content, eventType: claimed.event_type, minute }, idem_key: `${ev.campaign_id}:travel:${ev.id}`,
  }, { onConflict: 'user_id,idem_key', ignoreDuplicates: true });
  if (postErr) { await release({ last_error: 'Could not post' }); return 503; }
  await release({ status: failed ? 'failed' : 'posted', dm_context: null, fire_token_hash: null, last_error: failed ? 'Narration unavailable after retries' : null });
  const b = { action: 'state', campaignId: ev.campaign_id, riderKey: 'local' } as Req;
  const { data: cs } = await db.from('empyrean_campaign_state').select('rider_key').eq('user_id', ev.user_id).eq('campaign_id', ev.campaign_id).maybeSingle();
  if (cs?.rider_key) b.riderKey = cs.rider_key;
  await mutate(db, ev.user_id, b, cur => ({ state: { ...cur.state, travel: { ...cur.state.travel, encounterDone: true } } }));
  return 200;
}

/** Safety net for a missed timer: fire anything already due. */
async function catchUp(db: any, userId: string, campaignId: string) {
  const { data: due } = await db.from('solo_travel_events').select('*').eq('campaign_id', campaignId).eq('user_id', userId)
    .in('status', ['scheduled', 'firing']).maybeSingle();
  if (!due) return;
  const now = Date.now();
  const late = due.status === 'scheduled' && due.scheduled_at && Date.parse(due.scheduled_at) < now - 15000;
  const stuck = due.status === 'firing' && (!due.lease_until || Date.parse(due.lease_until) < now);
  if (late || stuck) { try { await fire(db, due); } catch (e) { console.warn('[empyrean-rules] catch-up failed', e instanceof Error ? e.message : e); } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service) return json(500, { error: 'Server configuration error.' });
  const db = createClient(url, service, { auth: { persistSession: false } });

  let raw: any;
  try { raw = await req.json(); } catch { return json(400, { error: 'Invalid JSON.' }); }

  // The scheduled timer: no sign-in, a one-time token instead.
  if (raw?.action === 'travel_fire') {
    const ok = uuid.safeParse(raw.eventId).success && typeof raw.token === 'string' && raw.token.length >= 32 && typeof raw.scheduledAt === 'string';
    if (!ok) return json(400, { error: 'Invalid request.' });
    const { data: ev, error } = await db.from('solo_travel_events').select('*').eq('id', raw.eventId).maybeSingle();
    if (error) return json(503, { error: 'Try again.' });
    if (!ev || !ev.fire_token_hash || ev.fire_token_hash !== await sha256(raw.token)) return json(200, { ok: true });
    if (ev.status !== 'scheduled' && ev.status !== 'firing') return json(200, { ok: true });
    if (ev.status === 'firing' && ev.lease_until && Date.parse(ev.lease_until) > Date.now()) return json(503, { error: 'Busy.' });
    let status = 503;
    try { status = await fire(db, ev); } catch { status = 503; }
    return json(status, { ok: status === 200 });
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in required.' });
  const { data: u, error: authErr } = await db.auth.getUser(token);
  const userId = u?.user?.id;
  if (authErr || !userId) return json(401, { error: 'Sign in required.' });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(400, { error: 'Invalid request.' });
  const b = parsed.data;
  const { data: campaign } = await db.from('ai_dm_campaigns').select('id, user_id').eq('id', b.campaignId).maybeSingle();
  if (!campaign || campaign.user_id !== userId) return json(403, { error: 'That campaign is not yours.' });
  const sheet = R.normalizeSheet(b.sheet);

  // Fights answer with the fight itself, not the full snapshot: they are called every few seconds.
  if (b.action.startsWith('fight_')) {
    try {
      let reply: Record<string, unknown>;
      if (b.action === 'fight_start') reply = await fightStart(db, userId, b);
      else if (b.action === 'fight_tick') reply = await fightTick(db, userId, b);
      else if (b.action === 'fight_act') reply = await fightAct(db, userId, b);
      else if (b.action === 'fight_clash') reply = await fightClash(db, userId, b);
      else {
        reply = await fightMutate(db, userId, b, (state, fight) => (fight && fight.status === 'ended' && fight.settled
          ? { state: { ...state, fight: null }, reply: { ok: true, fight: null } } : null));
      }
      return json(200, { serverNow: Date.now(), ...(await fightReply(db, userId, b, reply)) });
    } catch (e) {
      console.error('[empyrean-rules]', b.action, e instanceof Error ? e.message : e);
      return json(503, { ok: false, error: 'The fight server could not be reached. Try again.' });
    }
  }

  try {
    let result: { ok: true; extra: Record<string, unknown> } | { ok: false; error: string } = { ok: true, extra: {} };
    switch (b.action) {
      case 'state':
        await catchUp(db, userId, b.campaignId);
        result = await mutate(db, userId, b, l => {
          const need = R.chargeNeeds(R.tick(l.state, l.minute), l.minute, l.bonded);
          return need.events.length ? { state: need.state, events: need.events } : null;
        });
        break;
      case 'ack':
        if (b.ids?.length) {
          const { error } = await db.from('empyrean_rule_events').update({ applied_at: new Date().toISOString() })
            .eq('user_id', userId).eq('campaign_id', b.campaignId).in('id', b.ids).is('applied_at', null);
          if (error) return json(503, { ok: false, error: 'Could not confirm. Try again.' });
        }
        break;
      case 'rest':
        result = await mutate(db, userId, b, l => {
          const r = R.rest(l.state, l.minute, b.kind === 'long' ? 'long' : 'short');
          if (!r.ok) return { error: (r as { error: string }).error };
          const after = r.setMinute ?? l.minute + r.advance;
          const state = R.rollEvent(r.state, after, b.place?.kind, false, rand);
          return withUpkeep(l, { state, events: r.events, advance: r.advance, setMinute: r.setMinute, extra: { summary: r.summary } }, after);
        });
        break;
      case 'pass_time':
        result = await mutate(db, userId, b, l => {
          const r = R.passTime(l.state, l.minute, b.hours ?? 1, b.activity ?? 'wait', l.bonded);
          if (!r.ok) return { error: (r as { error: string }).error };
          const after = l.minute + r.advance;
          const state = R.rollEvent(R.tick(r.state, after), after, b.place?.kind, false, rand);
          return withUpkeep(l, { state, advance: r.advance, xpDelta: r.xpDelta, extra: { summary: r.summary } }, after);
        });
        break;
      case 'check':
        result = await mutate(db, userId, b, l => {
          const r = R.resolveCheck(l.state, l.minute, sheet, {
            d20: b.d20 ?? 1, modifier: b.modifier ?? 0, dc: b.dc ?? 15, risk: b.risk ?? 'mental', label: b.label ?? 'Check', masteryXp: l.masteryXp, bond: l.bond,
          }, rand);
          const strained = R.raiseStrain(r.state, r.strain, R.strainLimitOf(b.strainLimit), 'A signet backlash pushed strain to the limit');
          return { state: strained.state, events: [...r.events, ...strained.events], extra: { check: { outcome: r.outcome, dc: r.dc, total: r.total, line: r.line, hp: r.hp, strain: r.strain, condition: r.condition?.name ?? null, injury: r.injury?.name ?? null } } };
        });
        break;
      case 'signet_used':
        result = await mutate(db, userId, b, l => {
          const limit = R.strainLimitOf(b.strainLimit);
          // A phone that sends no limit keeps its own strain: only mastery is recorded, as before.
          if (limit == null) {
            const r = R.signetUse(l.state, l.minute, b.intensity ?? 1, R.sheetProdigyTier(sheet));
            return { state: r.state, xpDelta: r.xpDelta, extra: { masteryGained: r.xpDelta } };
          }
          const r = R.channelSignet(l.state, l.minute, b.intensity ?? 1, R.masteryRank(l.masteryXp), R.sheetProdigyTier(sheet), limit);
          return { state: r.state, events: r.events, xpDelta: r.xpDelta, extra: { masteryGained: r.xpDelta, strainCost: r.cost } };
        });
        break;
      case 'quest_payout':
        if (!b.questKey) return json(400, { ok: false, error: 'Invalid request.' });
        const questKey = b.questKey;
        result = await mutate(db, userId, b, l => ({ state: R.tick(l.state, l.minute), events: [R.questPayout(b.challenge, questKey, b.title || questKey, rand)] }));
        break;
      case 'story_reward':
        result = await mutate(db, userId, b, l => {
          const r = R.storyReward(l.state, l.minute, b.kind === 'gold' ? 'gold' : 'xp', b.amount ?? 0, sheet.level, b.source || 'Story');
          return r.events.length ? { state: r.state, events: r.events, extra: { granted: r.granted } } : null;
        });
        break;
      case 'strain':
        if (!b.reason) return json(400, { ok: false, error: 'Invalid request.' });
        const strainReason = b.reason;
        result = await mutate(db, userId, b, l => {
          const r = R.changeStrain(l.state, strainReason, R.strainLimitOf(b.strainLimit), { messageId: b.messageId, channeled: b.channeled, amount: b.amount });
          return r.state === l.state ? null : { state: r.state, events: r.events };
        });
        break;
      case 'battle_brief':
        result = await mutate(db, userId, b, l => {
          const r = R.battleBrief(l.state, l.minute, sheet);
          if (!r.ok) return { error: (r as { error: string }).error };
          return { state: r.state, extra: { brief: { line: r.line, left: r.left } } };
        });
        break;
      case 'set_events':
        result = await mutate(db, userId, b, l => ({ state: { ...l.state, events: { ...l.state.events, level: b.level ?? 'normal' } } }));
        break;
      case 'event_done':
        result = await mutate(db, userId, b, l => (l.state.events.pending ? { state: R.consumeEvent(l.state) } : null));
        break;
      case 'travel_launch': {
        const ok = await launch(db, userId, b);
        if (!ok) return json(200, { ok: false, error: 'The journey could not start. Try again.' });
        break;
      }
      case 'travel_sync': {
        const l = await load(db, userId, b);
        if (!l.traveling) await db.from('solo_travel_events').update({ status: 'planned', scheduled_at: null, fire_token_hash: null })
          .eq('campaign_id', b.campaignId).eq('user_id', userId).eq('status', 'scheduled');
        break;
      }
      case 'travel_cancel':
        await db.from('solo_travel_events').update({ status: 'cancelled', dm_context: null, fire_token_hash: null })
          .eq('campaign_id', b.campaignId).eq('user_id', userId).in('status', ['planned', 'scheduled']);
        result = await mutate(db, userId, b, l => ({ state: { ...l.state, travel: { dest: null, encounterDone: false } } }));
        break;
    }
    if (!result.ok) return json(200, { ...(await snapshot(db, userId, b)), ok: false, error: (result as { error: string }).error });
    return json(200, await snapshot(db, userId, b, result.extra));
  } catch (e) {
    console.error('[empyrean-rules]', b.action, e instanceof Error ? e.message : e);
    return json(503, { ok: false, error: 'The game server could not be reached. Try again.' });
  }
});
