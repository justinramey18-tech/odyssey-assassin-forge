// npc-combat: the referee for Live NPC Combat (party Live Table).
// A player's attack on an on-stage NPC opens a fight. After that, NPCs attack on their own
// timers, downed players roll death saves every 30 seconds, and every roll is made here, fairly.
// Phones never write fight tables; they call this function and read the results live.
//
// POST { action: "open", partyId, npcId, weaponName?, finish? }      start a fight by attacking an NPC
// POST { action: "attack", fightId, targetId, weaponName?, finish? } attack an NPC in the fight
// POST { action: "cast", fightId, targetId, spellName, spellLevel, intent } damage an NPC or heal an ally
// POST { action: "cast_card", fightId, targetId, targetIds?, card, finish? }  a Quick Actions spell card (attack, save, auto-hit or heal; area = up to 3 targets)
// POST { action: "stabilize", fightId, targetId }                    Medicine DC 10 on a downed ally
// POST { action: "huddle", fightId }                                  freeze the fight 20 s to plan (once per player per fight)
// POST { action: "clash", fightId, npcId, side, tapAt }               Counter Clash: one tap on the ring against a big NPC move (free)
// POST { action: "give_potion", fightId, targetId, itemName }         pour one of my healing potions into an ally
// POST { action: "ping", fightId }                                   "I'm here"; also runs the clock
// POST { action: "warm" }                                             wake the function up (no work); returns serverNow
// POST { action: "sync_hp", fightId, hp }                            my sheet's HP changed outside the fight
// POST { action: "ack", eventIds }                                   these HP changes are on my sheet now
// Host only:
// POST { action: "pause" | "resume" | "end", fightId }
// POST { action: "add_npc", fightId, npcId }
// POST { action: "revive", partyId, userId? , npcId? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as R from './rules.ts';
import * as S from './skills.ts';
import * as M from './minigames.ts';
import { combatTurn } from './npc-reply/handler.ts';
import { createModelCaller } from './npc-reply/models.ts';
import { createRepo } from './npc-reply/repo.ts';
import type { CombatMove } from './npc-reply/prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Db = any;

interface Fight {
  id: string;
  party_id: string;
  status: 'active' | 'paused' | 'ended';
  outcome: string | null;
  started_by: string;
  /** v2: when the current pause began, who paused it, and when a huddle ends by itself. */
  paused_at: string | null;
  pause_kind: 'host' | 'huddle' | null;
  paused_until: string | null;
  /** v2: players who already called their one huddle this fight ({ userId: when }). */
  huddles_used: Record<string, string> | null;
}

interface Fighter {
  id: string;
  fight_id: string;
  party_id: string;
  kind: 'npc' | 'player';
  npc_id: string | null;
  user_id: string | null;
  name: string;
  hp: number;
  max_hp: number;
  ac: number;
  status: 'up' | 'down' | 'stable' | 'dead' | 'ko' | 'fled';
  death_successes: number;
  death_failures: number;
  next_action_at: string | null;
  next_save_at: string | null;
  action_seq: number;
  threat: Record<string, number> | null;
  last_seen_at: string | null;
  last_action_at: string | null;
  /** NPCs: how often it acts right now, in ms (Rage and Stagger change it). Null = its Speed preset. */
  act_every_ms: number | null;
  /** Players: the Resolve bar as stored at resolve_at, filling at resolve_rate per second. */
  resolve: number | null;
  resolve_at: string | null;
  resolve_rate: number | null;
  /** Players: perks equipped when they joined, Second Wind dice ("1d8+6"), and whether Last Stand was used. */
  perks: string[] | null;
  second_wind: string | null;
  last_stand_used: boolean | null;
  /** NPCs (v5): the announced skill waiting to happen, and when it happens. */
  pending: { skill: string; type: string; targets: string[]; windup_ms?: number; clash?: unknown } | null;
  strike_at: string | null;
  turn_no: number | null;
  signature_turn: number | null;
  /** NPCs: a Shield ward that absorbs damage until it runs out or expires. */
  ward: number | null;
  ward_until: string | null;
  /** Players: can't act until this time (an NPC's Pin). */
  pinned_until: string | null;
  /** v2 NPCs: when each skill can be used again, uses per fight, last pinned player. */
  cooldowns: S.Cooldowns | null;
  /** v6 mini-games. Players: { clash: this chain's taps, clashStreak: perfect chains in a row }. */
  minigame: Record<string, unknown> | null;
}

interface Seat {
  user_id: string;
  character_name: string;
  character_status: R.SheetSummary | null;
}

interface NpcRow {
  id: string;
  party_id: string;
  name: string;
  on_stage: boolean;
  archived: boolean;
  player_user_id: string | null;
  combat_stats: unknown;
  combat_state: string | null;
}

const FIGHT_COLS = 'id, party_id, status, outcome, started_by, paused_at, pause_kind, paused_until, huddles_used';
const FIGHTER_COLS =
  'id, fight_id, party_id, kind, npc_id, user_id, name, hp, max_hp, ac, status, death_successes, death_failures, next_action_at, next_save_at, action_seq, threat, last_seen_at, last_action_at, act_every_ms, resolve, resolve_at, resolve_rate, perks, second_wind, last_stand_used, pending, strike_at, turn_no, signature_turn, ward, ward_until, pinned_until, cooldowns, minigame';
const NPC_COLS = 'id, party_id, name, on_stage, archived, player_user_id, combat_stats, combat_state';

class Refusal extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const refuse = (status: number, message: string): never => {
  throw new Refusal(status, message);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const needUuid = (v: unknown, what: string): string => (isUuid(v) ? v : refuse(400, `Missing or invalid ${what}.`));
const must = (what: string, error: { message?: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message || 'database error'}`);
};
const iso = (ms: number) => new Date(ms).toISOString();
const due = (at: string | null, now: number) => !!at && Date.parse(at) <= now;
/** Speed: a check-in this early waits for the moment something is due, so NPC hits and death saves happen on time. */
const EARLY_WINDOW_MS = 800;
const ON_TIME_MARGIN_MS = 15;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** Wait until a moment (plus a small margin) and return the clock after the wait. */
async function waitUntil(at: number, now: number): Promise<number> {
  const wait = at - now + ON_TIME_MARGIN_MS;
  const startedAt = Date.now();
  await sleep(wait);
  return now + Math.max(wait, Date.now() - startedAt);
}
/** The soonest moment anything in the fight is due (an NPC strike or turn, a death save); NaN when nothing is scheduled. */
function nextDueAt(fight: Fight, fighters: Fighter[]): number {
  let soonest = NaN;
  const consider = (at: string | null) => {
    const t = at ? Date.parse(at) : NaN;
    if (Number.isFinite(t) && !(t >= soonest)) soonest = t;
  };
  for (const f of fighters) {
    if (f.kind === 'npc' && f.status === 'up' && fight.status === 'active') consider(f.pending ? f.strike_at : f.next_action_at);
    else if (f.kind === 'player' && f.status === 'down') consider(f.next_save_at);
  }
  return soonest;
}
const roll = R.cryptoRoll;
/** Most targets an area spell card can land on. */
const AREA_MAX_TARGETS = 3;

// ── Reads ─────────────────────────────────────────────────────────────────────

async function hostOf(db: Db, partyId: string): Promise<string> {
  const { data, error } = await db.from('parties').select('created_by').eq('id', partyId).maybeSingle();
  must('read party', error);
  return data?.created_by ?? refuse(404, 'Party not found.');
}

async function seatOf(db: Db, partyId: string, userId: string): Promise<Seat | null> {
  const { data, error } = await db.from('party_members')
    .select('user_id, character_name, character_status')
    .eq('party_id', partyId).eq('user_id', userId).limit(1);
  must('read seat', error);
  return (data?.[0] as Seat | undefined) ?? null;
}

async function requireSeat(db: Db, partyId: string, userId: string): Promise<Seat> {
  const seat = await seatOf(db, partyId, userId);
  return seat ?? refuse(403, 'Only players seated at this table can fight.');
}

async function getFight(db: Db, fightId: string): Promise<Fight> {
  const { data, error } = await db.from('party_fights').select(FIGHT_COLS).eq('id', fightId).maybeSingle();
  must('read fight', error);
  return (data as Fight | null) ?? refuse(404, 'That fight was not found.');
}

async function openFightOf(db: Db, partyId: string): Promise<Fight | null> {
  const { data, error } = await db.from('party_fights').select(FIGHT_COLS)
    .eq('party_id', partyId).neq('status', 'ended').limit(1);
  must('read open fight', error);
  return (data?.[0] as Fight | undefined) ?? null;
}

async function fightersOf(db: Db, fightId: string): Promise<Fighter[]> {
  const { data, error } = await db.from('party_fight_combatants').select(FIGHTER_COLS).eq('fight_id', fightId);
  must('read fighters', error);
  return (data || []) as Fighter[];
}

async function fighterById(db: Db, id: string): Promise<Fighter | null> {
  const { data, error } = await db.from('party_fight_combatants').select(FIGHTER_COLS).eq('id', id).maybeSingle();
  must('read fighter', error);
  return (data as Fighter | null) ?? null;
}

async function getNpc(db: Db, npcId: string): Promise<NpcRow> {
  const { data, error } = await db.from('party_npcs').select(NPC_COLS).eq('id', npcId).maybeSingle();
  must('read NPC', error);
  return (data as NpcRow | null) ?? refuse(404, 'That NPC was not found.');
}

async function hasFallen(db: Db, partyId: string, userId: string): Promise<boolean> {
  const { data, error } = await db.from('party_character_deaths').select('id')
    .eq('party_id', partyId).eq('user_id', userId).is('revived_at', null).limit(1);
  must('read fallen', error);
  return Array.isArray(data) && data.length > 0;
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Change one fighter safely. Reads it fresh, asks change() for a patch (null = leave it),
 * and writes only if nobody else changed it in between (action_seq). Retries a few times.
 */
async function mutate(
  db: Db,
  fighterId: string,
  change: (f: Fighter) => Partial<Fighter> | null,
  known?: Fighter | null,
): Promise<{ before: Fighter; after: Fighter } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    // Speed: a row just read by the caller saves the first read. If it changed since, the write misses and we re-read.
    const before = attempt === 0 && known && known.id === fighterId ? known : await fighterById(db, fighterId);
    if (!before) return null;
    const patch = change(before);
    if (!patch) return null;
    const { data, error } = await db.from('party_fight_combatants')
      .update({ ...patch, action_seq: before.action_seq + 1 })
      .eq('id', fighterId).eq('action_seq', before.action_seq)
      .select(FIGHTER_COLS);
    must('update fighter', error);
    if (Array.isArray(data) && data.length > 0) return { before, after: data[0] as Fighter };
  }
  return null;
}

/** Claim a fighter's turn: only one caller wins when several phones run the clock at once. */
async function claim(db: Db, f: Fighter, patch: Partial<Fighter>): Promise<boolean> {
  const { data, error } = await db.from('party_fight_combatants')
    .update({ ...patch, action_seq: f.action_seq + 1 })
    .eq('id', f.id).eq('action_seq', f.action_seq)
    .select('id');
  must('claim turn', error);
  if (Array.isArray(data) && data.length > 0) {
    Object.assign(f, patch, { action_seq: f.action_seq + 1 });
    return true;
  }
  return false;
}

interface EventIn {
  kind: string;
  actor_name?: string;
  target_name?: string;
  target_user_id?: string | null;
  hp_delta?: number;
  d20?: number | null;
  total?: number | null;
  detail?: string;
}

async function addEvent(db: Db, fight: Fight, e: EventIn): Promise<void> {
  const { error } = await db.from('party_fight_events').insert({
    fight_id: fight.id,
    party_id: fight.party_id,
    kind: e.kind,
    actor_name: e.actor_name ?? '',
    target_name: e.target_name ?? '',
    target_user_id: e.target_user_id ?? null,
    hp_delta: e.hp_delta ?? 0,
    d20: e.d20 ?? null,
    total: e.total ?? null,
    detail: (e.detail ?? '').slice(0, 300),
  });
  must('write fight event', error);
}

/** A short line in the Live Table, ticked for the next Send to DM. Never breaks the fight if it fails. */
async function postLine(db: Db, partyId: string, hostId: string, content: string): Promise<void> {
  try {
    const { data } = await db.from('party_round_chat').select('round_id')
      .eq('party_id', partyId).order('created_at', { ascending: false }).limit(1);
    const roundId = (data?.[0]?.round_id as string | undefined) ?? crypto.randomUUID();
    const { error } = await db.from('party_round_chat').insert({
      party_id: partyId,
      user_id: hostId,
      character_name: '⚔ Combat',
      content: `⚔ ${content}`,
      in_character: true,
      round_id: roundId,
      selected: true,
      npc_id: null,
    });
    if (error) console.warn('[npc-combat] could not post line:', error.message);
  } catch (err) {
    console.warn('[npc-combat] could not post line:', err);
  }
}

// ── NPC lines in the chat ─────────────────────────────────────────────────────

interface VoiceJob {
  partyId: string;
  hostId: string;
  npcId: string;
  turn: CombatMove;
  /** Posted as a plain ⚔ line when the NPC's AI line fails. Null = stay quiet on failure. */
  fallback: string | null;
}

/** Set in Deno.serve for each request: writes the NPC's line in the background. */
let voiceLine: ((db: Db, job: VoiceJob) => void) | null = null;

/** The NPC says or does something in the Live Table about this fight moment. Never blocks the fight. */
function speak(db: Db, job: VoiceJob): void {
  if (voiceLine) voiceLine(db, job);
  else if (job.fallback) void postLine(db, job.partyId, job.hostId, job.fallback);
}

// ── Perks (bought with gold, per character) ───────────────────────────────────

interface PerkRow {
  id: string | null;
  owned: R.PerkId[];
  equipped: R.PerkId[];
  slots: number;
  version: number;
}

async function perksOf(db: Db, userId: string, characterName: string): Promise<PerkRow> {
  const { data, error } = await db.from('character_perks').select('id, owned, equipped, slots, version')
    .eq('user_id', userId).eq('character_name', characterName).limit(1);
  must('read perks', error);
  const row = data?.[0];
  if (!row) return { id: null, owned: [], equipped: [], slots: R.BASE_PERK_SLOTS, version: 0 };
  const owned = R.cleanPerks(row.owned);
  const slots = Math.min(R.MAX_PERK_SLOTS, Math.max(R.BASE_PERK_SLOTS, Number(row.slots) || R.BASE_PERK_SLOTS));
  return { id: row.id, owned, equipped: R.cleanPerks(row.equipped).filter(p => owned.includes(p)).slice(0, slots), slots, version: Number(row.version) || 0 };
}

/** Saves a perk change only if nobody changed the row since it was read, so a double tap can't buy twice. */
async function savePerks(db: Db, userId: string, characterName: string, before: PerkRow, next: { owned: R.PerkId[]; equipped: R.PerkId[]; slots: number }): Promise<void> {
  if (!before.id) {
    const { error } = await db.from('character_perks').insert({ user_id: userId, character_name: characterName, ...next, version: 1 });
    if (error?.code === '23505') refuse(409, 'That was already saved. Check your perks and try again.');
    must('save perks', error);
    return;
  }
  const { data, error } = await db.from('character_perks').update({ ...next, version: before.version + 1 })
    .eq('id', before.id).eq('version', before.version).select('id');
  must('save perks', error);
  if (!Array.isArray(data) || data.length === 0) refuse(409, 'That was already saved. Check your perks and try again.');
}

const perkView = (p: { owned: R.PerkId[]; equipped: R.PerkId[]; slots: number }) => ({ owned: p.owned, equipped: p.equipped, slots: p.slots });

// ── Joining ───────────────────────────────────────────────────────────────────

/** The caller's fighter in this fight, joining it from their sheet if needed. Null if their character has fallen. */
async function ensurePlayer(db: Db, fight: Fight, seat: Seat, now: number): Promise<Fighter | null> {
  const { data, error } = await db.from('party_fight_combatants').select(FIGHTER_COLS)
    .eq('fight_id', fight.id).eq('user_id', seat.user_id).limit(1);
  must('read my fighter', error);
  const existing = data?.[0] as Fighter | undefined;
  if (existing) {
    // Refresh "I'm here" at most every 20 s: every write wakes every phone's live update.
    const seen = existing.last_seen_at ? Date.parse(existing.last_seen_at) : 0;
    if (!Number.isFinite(seen) || now - seen >= 20_000) {
      const { error: seenError } = await db.from('party_fight_combatants')
        .update({ last_seen_at: iso(now) }).eq('id', existing.id);
      must('mark seen', seenError);
      existing.last_seen_at = iso(now);
    }
    return existing;
  }
  if (fight.status === 'ended') return null;
  if (await hasFallen(db, fight.party_id, seat.user_id)) return null;
  const sheet = seat.character_status ?? {};
  const hp = R.sheetCurrentHp(sheet);
  const perks = (await perksOf(db, seat.user_id, seat.character_name)).equipped;
  const row = {
    fight_id: fight.id,
    party_id: fight.party_id,
    kind: 'player',
    user_id: seat.user_id,
    name: seat.character_name || 'Adventurer',
    hp,
    max_hp: R.sheetMaxHp(sheet),
    ac: R.sheetAc(sheet),
    status: hp > 0 ? 'up' : 'down',
    next_save_at: hp > 0 ? null : R.nextDeathSaveAt(now),
    last_seen_at: iso(now),
    resolve: R.RESOLVE_START,
    resolve_at: iso(now),
    resolve_rate: R.resolveRate(sheet, perks),
    perks,
    second_wind: R.formatDice(R.secondWindDice(sheet as R.SheetSummary & { className?: unknown }, perks)),
  };
  const { data: inserted, error: insertError } = await db.from('party_fight_combatants').insert(row).select(FIGHTER_COLS);
  if (insertError?.code === '23505') return ensurePlayer(db, fight, seat, now);
  must('join fight', insertError);
  await rescaleNpcs(db, fight, row.name);
  return inserted[0] as Fighter;
}

/**
 * v2: NPC max HP follows how many players are in the fight, worked out from each NPC's own stat block
 * (built for `designedFor` players). It only grows mid-fight, never shrinks, and keeps each NPC's share of health.
 */
async function rescaleNpcs(db: Db, fight: Fight, joinerName: string): Promise<void> {
  if (fight.status === 'ended') return;
  const fighters = await fightersOf(db, fight.id);
  const players = fighters.filter(f => f.kind === 'player').length;
  const npcs = fighters.filter(f => f.kind === 'npc' && f.status === 'up' && f.npc_id);
  if (npcs.length === 0) return;
  const { data, error } = await db.from('party_npcs').select('id, combat_stats').in('id', npcs.map(f => f.npc_id as string));
  must('read NPC stats for scaling', error);
  const statsById = new Map<string, R.NpcCombatStats>();
  for (const r of data || []) {
    const st = R.cleanCombatStats(r.combat_stats);
    if (st) statsById.set(r.id, st);
  }
  let grew = 0;
  for (const f of npcs) {
    const st = statsById.get(f.npc_id as string);
    if (!st) continue;
    const target = R.scaledMaxHp(st.maxHp, players, st.designedFor);
    const r = await mutate(db, f.id, x => (x.status !== 'up' || target <= x.max_hp
      ? null
      : { max_hp: target, hp: R.rescaledHp(x.hp, x.max_hp, target) }));
    if (r) grew += 1;
  }
  if (grew > 0) {
    await addEvent(db, fight, { kind: 'scale', actor_name: joinerName, detail: `${joinerName} joins: the enemy scales up for ${players} fighters` });
    const hostId = await hostOf(db, fight.party_id);
    await postLine(db, fight.party_id, hostId, `The enemy steels itself as ${joinerName} joins the fight!`);
  }
}

/** Checks an NPC can fight and puts it in the fight. Returns its fighter and whether it just joined. */
async function ensureNpc(db: Db, fight: Fight, npc: NpcRow, now: number): Promise<{ fighter: Fighter; joined: boolean }> {
  if (npc.party_id !== fight.party_id) refuse(403, 'That NPC is not at this table.');
  const { data, error } = await db.from('party_fight_combatants').select(FIGHTER_COLS)
    .eq('fight_id', fight.id).eq('npc_id', npc.id).limit(1);
  must('read NPC fighter', error);
  if (data?.[0]) return { fighter: data[0] as Fighter, joined: false };
  if (npc.archived || !npc.on_stage) refuse(409, `${npc.name} is not on stage.`);
  if (npc.player_user_id) refuse(409, `${npc.name} is standing in for a player and can't be fought.`);
  if (npc.combat_state) refuse(409, `${npc.name} is already ${npc.combat_state === 'dead' ? 'dead' : 'knocked out'}.`);
  const stats = R.cleanCombatStats(npc.combat_stats) ??
    refuse(409, `${npc.name} has no combat stats yet. The host can add them on its Mind screen.`);
  // v2: sized for the players already in the fight (at least 1: the attacker joins right after).
  const playersIn = (await fightersOf(db, fight.id)).filter(f => f.kind === 'player').length;
  const startHp = R.scaledMaxHp(stats.maxHp, playersIn, stats.designedFor);
  const row = {
    fight_id: fight.id,
    party_id: fight.party_id,
    kind: 'npc',
    npc_id: npc.id,
    name: npc.name,
    hp: startHp,
    max_hp: startHp,
    ac: stats.ac,
    status: 'up',
    next_action_at: R.nextActionAt(now, stats.speed),
    act_every_ms: R.baseIntervalMs(stats.speed),
  };
  const { data: inserted, error: insertError } = await db.from('party_fight_combatants').insert(row).select(FIGHTER_COLS);
  if (insertError?.code === '23505') return ensureNpc(db, fight, npc, now);
  must('add NPC to fight', insertError);
  return { fighter: inserted[0] as Fighter, joined: true };
}

// ── Player actions ────────────────────────────────────────────────────────────

/** The fight is running, you are up, and your last action was long enough ago. Claims your action. */
async function startAction(db: Db, fight: Fight, me: Fighter | null, now: number): Promise<Fighter> {
  if (fight.status === 'paused') refuse(409, fight.pause_kind === 'huddle' ? 'Huddle in progress. Plan your move!' : 'The host paused the fight.');
  if (fight.status === 'ended') refuse(409, 'This fight is over.');
  if (!me) return refuse(409, 'Your character has fallen. The host can revive them.');
  if (me.status !== 'up') refuse(409, 'You are down and cannot act.');
  const pinnedFor = me.pinned_until ? Math.ceil((Date.parse(me.pinned_until) - now) / 1000) : 0;
  if (pinnedFor > 0) refuse(429, `You're pinned down: ${pinnedFor}s.`);
  const last = me.last_action_at ? Date.parse(me.last_action_at) : 0;
  const wait = Math.ceil((last + R.PLAYER_ACTION_COOLDOWN_S * 1000 - now) / 1000);
  if (wait > 0) refuse(429, `Catch your breath: ${wait}s.`);
  const ok = await claim(db, me, { last_action_at: iso(now), last_seen_at: iso(now) });
  if (!ok) refuse(409, 'Too fast. Try again.');
  return me;
}

/** Healing dice for a healing potion, from its name (5e): Healing 2d4+2, Greater 4d4+4, Superior 8d4+8, Supreme 10d4+20. Null when it isn't one. */
function potionHealDice(itemName: string): R.Dice | null {
  if (R.potionResolve(itemName) <= 0) return null;
  const n = itemName.toLowerCase();
  if (/supreme/.test(n)) return { count: 10, sides: 4, bonus: 20 };
  if (/superior/.test(n)) return { count: 8, sides: 4, bonus: 8 };
  if (/greater/.test(n)) return { count: 4, sides: 4, bonus: 4 };
  return { count: 2, sides: 4, bonus: 2 };
}

type Finish = 'knockout' | 'kill';
const finishOf = (v: unknown): Finish => (v === 'kill' ? 'kill' : 'knockout');

/** An NPC's Speed preset (for Rage and Stagger), or 'medium' when it has no usable stats. */
async function speedOfNpc(db: Db, npcId: string | null): Promise<R.SpeedPreset> {
  if (!npcId) return 'medium';
  const { data, error } = await db.from('party_npcs').select('combat_stats').eq('id', npcId).maybeSingle();
  must('read NPC speed', error);
  return R.cleanCombatStats(data?.combat_stats)?.speed ?? 'medium';
}

/** Damage on an NPC. Knocks it out or kills it at 0 HP, as the attacker chose. Otherwise it is staggered. */
async function hitNpc(
  db: Db, fight: Fight, hostId: string, me: Fighter, targetId: string, damage: number, finish: Finish, crit = false, now = Date.now(),
  pre?: { target?: Fighter; speed?: R.SpeedPreset },
): Promise<{ lost: number; hp: number; defeated: boolean }> {
  // Speed: callers that already read the target (and its Speed) pass them in, saving two reads.
  const current = pre?.target && pre.target.id === targetId ? pre.target : await fighterById(db, targetId);
  const speed = pre?.speed ?? await speedOfNpc(db, current?.npc_id ?? null);
  const result = await mutate(db, targetId, f => {
    if (f.kind !== 'npc' || f.status !== 'up') return null;
    // A Shield ward soaks up damage first.
    const wardLeft = f.ward_until && Date.parse(f.ward_until) > now ? Math.max(0, f.ward ?? 0) : 0;
    const absorbed = Math.min(wardLeft, damage);
    const { hp } = R.applyDamage(f.hp, damage - absorbed);
    const lost = f.hp - hp;
    const threat = { ...(f.threat ?? {}) };
    threat[me.user_id as string] = (threat[me.user_id as string] ?? 0) + lost;
    const wardPatch = wardLeft > 0 ? { ward: wardLeft - absorbed } : {};
    if (hp === 0) return { hp, threat, status: finish === 'kill' ? 'dead' : 'ko', next_action_at: null, pending: null, strike_at: null, ...wardPatch };
    if (lost === 0) return { threat, ...wardPatch };
    // Stagger: the NPC acts later, and slower from now on. Mid wind-up, the announced skill is pushed back instead.
    const s = R.stagger(R.currentIntervalMs(f.act_every_ms, speed), speed, lost, f.max_hp);
    if (f.pending && f.strike_at) {
      // Counter Clash: once the first circle is on the ring, the chain can't be pushed back (taps are timed to it).
      const chain = M.cleanClash(f.pending.clash);
      if (chain && M.clashUnderWay(chain, Date.parse(f.strike_at), now)) return { hp, threat, act_every_ms: s.intervalMs, ...wardPatch };
      const strike = Math.min(Math.max(Date.parse(f.strike_at), now) + s.delayMs, now + s.intervalMs);
      return { hp, threat, act_every_ms: s.intervalMs, strike_at: iso(strike), ...wardPatch };
    }
    const next = f.next_action_at ? Date.parse(f.next_action_at) : now;
    const pushed = Math.min(Math.max(next, now) + s.delayMs, now + s.intervalMs);
    return { hp, threat, act_every_ms: s.intervalMs, next_action_at: iso(pushed), ...wardPatch };
  }, current);
  if (!result) return { lost: 0, hp: 0, defeated: false };
  const { before, after } = result;
  const defeated = after.status !== 'up';
  // Speed: the attacker's Resolve and the knockout's writes don't depend on each other, so they run side by side.
  const fillResolve = async () => {
    if (before.hp <= after.hp) return;
    // Landing a hit fills the attacker's Resolve.
    const r = await mutate(db, me.id, f => (f.status === 'dead' ? null : {
      resolve: Math.min(R.RESOLVE_MAX, R.resolveNow(f.resolve, f.resolve_at, f.resolve_rate, now) + R.hitResolve(R.cleanPerks(f.perks))),
      resolve_at: iso(now),
    }), me);
    if (r) Object.assign(me, r.after);
  };
  const markDefeated = async () => {
    if (!(defeated && after.npc_id)) return;
    const patch: Record<string, unknown> = { combat_state: after.status === 'dead' ? 'dead' : 'ko' };
    if (after.status === 'dead') patch.on_stage = false;
    const { error } = await db.from('party_npcs').update(patch).eq('id', after.npc_id);
    must('mark NPC defeated', error);
    await addEvent(db, fight, { kind: 'defeat_npc', actor_name: me.name, target_name: after.name, detail: after.status === 'dead' ? 'killed' : 'knocked out' });
    await postLine(db, fight.party_id, hostId, `${me.name} ${after.status === 'dead' ? 'kills' : 'knocks out'} ${after.name}!`);
    // The NPC's final words as it goes down.
    speak(db, {
      partyId: fight.party_id, hostId, npcId: after.npc_id,
      turn: { move: 'fall', attacker: me.name, killed: after.status === 'dead' },
      fallback: null,
    });
  };
  await Promise.all([markDefeated(), fillResolve()]);
  if (defeated) {
    // Nothing more: a defeated NPC doesn't react.
  } else if (after.npc_id && before.hp > after.hp) {
    // The NPC reacts to the hit (npc-reply allows one reaction per 20 seconds).
    speak(db, {
      partyId: fight.party_id, hostId, npcId: after.npc_id,
      turn: { move: 'hit', attacker: withLook(me), crit, damage: before.hp - after.hp },
      fallback: null,
    });
  }
  return { lost: before.hp - after.hp, hp: after.hp, defeated };
}

async function npcTarget(db: Db, fight: Fight, targetId: unknown, early?: Promise<Fighter | null>): Promise<Fighter> {
  const id = needUuid(targetId, 'target');
  const t = (early ? await early : null) ?? await fighterById(db, id);
  if (!t || t.id !== id || t.fight_id !== fight.id || t.kind !== 'npc') return refuse(404, 'That target is not an NPC in this fight.');
  if (t.status !== 'up') refuse(409, `${t.name} is already down.`);
  return t;
}

async function doAttack(
  db: Db, fight: Fight, hostId: string, seat: Seat, me: Fighter | null, target: Fighter,
  weaponName: unknown, finish: Finish, now: number,
) {
  // Speed: claiming my turn and reading the target's Speed don't depend on each other.
  const [actor, speed] = await Promise.all([startAction(db, fight, me, now), speedOfNpc(db, target.npc_id)]);
  const w = R.weaponAttack(seat.character_status ?? {}, weaponName);
  const a = R.resolveAttack(roll, w.bonus, target.ac);
  let lost = 0;
  let hp = target.hp;
  let defeated = false;
  if (a.hit) {
    const out = await hitNpc(db, fight, hostId, actor, target.id, R.rollDamage(w.dice, roll, a.crit), finish, a.crit, now, { target, speed });
    ({ lost, hp, defeated } = out);
  }
  await addEvent(db, fight, {
    kind: 'attack', actor_name: actor.name, target_name: target.name, hp_delta: -lost, d20: a.d20, total: a.total,
    detail: a.hit ? `${w.name}: ${lost} damage${a.crit ? ' (critical!)' : ''}` : `${w.name}: miss`,
  });
  return { hit: a.hit, crit: a.crit, d20: a.d20, total: a.total, damage: lost, targetHp: hp, defeated, weapon: w.name };
}

// ── The clock ─────────────────────────────────────────────────────────────────

/** Runs whatever is due: NPC attacks, death saves, and the end of the fight. Safe to call from every phone. */
// ── NPC skills (v5): announce, wind up, then act ──────────────────────────────

const isPresent = (p: Fighter, now: number) =>
  p.status === 'up' && !!p.last_seen_at && (now - Date.parse(p.last_seen_at)) / 1000 <= R.PRESENT_S;

/** False when the NPC's hard lines say it would never run. */
async function canRetreat(db: Db, npcId: string): Promise<boolean> {
  const { data, error } = await db.from('party_npc_guides').select('hard_lines').eq('npc_id', npcId).maybeSingle();
  if (error) return false;
  return !S.forbidsRetreat(data?.hard_lines);
}

/**
 * One NPC attack roll against one player, with Resolve, Last Stand, Rage and the inbox events.
 * Returns what happened so the caller can write the ⚔ line.
 */
async function npcHitsPlayer(
  db: Db, fight: Fight, hostId: string, npc: Fighter, target: Fighter, bonus: number, dice: R.Dice,
  stats: R.NpcCombatStats, now: number, scale = 1,
): Promise<{ hit: boolean; crit: boolean; lost: number; downed: boolean }> {
  const a = R.resolveAttack(roll, bonus, target.ac);
  let lost = 0;
  let downed = false;
  let stoodHp = 0;
  if (a.hit) {
    const damage = Math.max(scale < 1 ? 0 : 1, Math.floor(R.rollDamage(dice, roll, a.crit) * scale));
    let lastStandHp = 0;
    const result = await mutate(db, target.id, f => {
      if (f.status !== 'up') return null;
      const { hp } = R.applyDamage(f.hp, damage);
      const perks = R.cleanPerks(f.perks);
      const resolve = Math.min(R.RESOLVE_MAX, R.resolveNow(f.resolve, f.resolve_at, f.resolve_rate, now) + R.damageResolve(f.hp - hp, f.max_hp, perks));
      if (hp === 0 && perks.includes('last_stand') && !f.last_stand_used && resolve >= R.RESOLVE_MAX) {
        lastStandHp = Math.min(f.max_hp, R.rollHealing(R.parseDice(f.second_wind) ?? { count: 1, sides: 8, bonus: 0 }, roll));
        return { hp: lastStandHp, resolve: 0, resolve_at: iso(now), last_stand_used: true };
      }
      lastStandHp = 0;
      return hp === 0
        ? { hp, status: 'down', death_successes: 0, death_failures: 0, next_save_at: R.nextDeathSaveAt(now), resolve, resolve_at: iso(now) }
        : { hp, resolve, resolve_at: iso(now) };
    });
    if (result) {
      const stood = !!result.after.last_stand_used && !result.before.last_stand_used;
      lost = stood ? result.before.hp : result.before.hp - result.after.hp;
      downed = result.after.status === 'down';
      Object.assign(target, result.after);
      if (stood) stoodHp = lastStandHp;
    }
    if (lost > 0) {
      // Rage: the NPC speeds up. Its next turn is already scheduled; it moves closer with the new pace.
      await mutate(db, npc.id, f => {
        if (f.status !== 'up') return null;
        const current = R.currentIntervalMs(f.act_every_ms, stats.speed);
        const faster = R.rageIntervalMs(current, stats.speed, lost, target.max_hp);
        const next = f.next_action_at ? Math.min(Date.parse(f.next_action_at), now + faster) : null;
        return next === null ? { act_every_ms: faster } : { act_every_ms: faster, next_action_at: iso(next) };
      });
    }
  }
  await addEvent(db, fight, {
    kind: 'attack', actor_name: npc.name, target_name: target.name, target_user_id: target.user_id,
    hp_delta: -lost, d20: a.d20, total: a.total,
    detail: a.hit ? `${lost} damage${a.crit ? ' (critical!)' : ''}` : 'miss',
  });
  if (downed) {
    await addEvent(db, fight, { kind: 'down', actor_name: npc.name, target_name: target.name, target_user_id: target.user_id });
  }
  if (stoodHp > 0) {
    // Logged after the hit, so phones apply the damage first and then the Last Stand healing.
    await addEvent(db, fight, {
      kind: 'last_stand', actor_name: target.name, target_name: target.name, target_user_id: target.user_id,
      hp_delta: stoodHp, detail: `Last Stand: back up with ${stoodHp} HP`,
    });
    await postLine(db, fight.party_id, hostId, `${target.name} refuses to fall: Last Stand!`);
  }
  return { hit: a.hit, crit: a.crit, lost, downed };
}

// ── Counter Clash (v6) ────────────────────────────────────────────────────────

const isPinned = (f: Fighter, now: number) => !!f.pinned_until && Date.parse(f.pinned_until) > now;

/**
 * A target's Counter Clash on this chain, read from their taps: how much of the hit still lands, whether every
 * swing was perfect, and whether this perfect chain is a Riposte. Saves their new perfect-chain count.
 */
async function settleClash(db: Db, t: Fighter, chain: M.Clash): Promise<{ perfect: boolean; riposte: boolean; scale: number }> {
  const results = M.clashResultsOf(t.minigame, chain.id);
  const perfect = M.chainPerfect(chain, results);
  const scale = M.chainScale(chain, results);
  const before = Number((t.minigame ?? {}).clashStreak) || 0;
  const { streak, riposte } = M.nextClashStreak(before, perfect);
  if (results.length > 0 || before !== streak) {
    const r = await mutate(db, t.id, f => {
      const { clash: _done, ...rest } = (f.minigame ?? {}) as Record<string, unknown>;
      return { minigame: { ...rest, clashStreak: streak } };
    }, t);
    if (r) Object.assign(t, r.after);
  }
  return { perfect, riposte, scale };
}

/** A perfect chain's free counter: weapon damage x1.5 (x2 against a signature move); a Riposte makes it critical. */
async function landCounter(
  db: Db, fight: Fight, hostId: string, npc: Fighter, player: Fighter, move: M.ClashMove, riposte: boolean, now: number,
): Promise<number> {
  const seat = player.user_id ? await seatOf(db, fight.party_id, player.user_id) : null;
  const w = R.weaponAttack(seat?.character_status ?? {}, undefined);
  const damage = M.counterDamage(R.rollDamage(w.dice, roll, riposte), move);
  const out = await hitNpc(db, fight, hostId, player, npc.id, damage, 'knockout', riposte, now);
  // Logged as an attack; phones spot a counter by the "Counter Clash!" detail.
  await addEvent(db, fight, {
    kind: 'attack', actor_name: player.name, target_name: npc.name, hp_delta: -out.lost,
    detail: `Counter Clash! ${w.name}: ${out.lost} damage${riposte ? ' (RIPOSTE!)' : ''}`,
  });
  return out.lost;
}

/** A perfect clash staggers the NPC: its next turn waits at least two of its intervals. */
async function staggerNpc(db: Db, npcId: string, now: number, interval: number): Promise<void> {
  await mutate(db, npcId, f => {
    if (f.status !== 'up' || f.pending) return null;
    const next = f.next_action_at ? Date.parse(f.next_action_at) : 0;
    return { next_action_at: iso(Math.max(now + interval * 2, Number.isFinite(next) ? next : 0)) };
  });
}

/** The announced skill happens: one claim so only one phone's ping runs it, then its effect and a ⚔ line. */
async function resolveSkill(
  db: Db, fight: Fight, hostId: string, npc: Fighter, skills: S.Skill[], stats: R.NpcCombatStats,
  fighters: Fighter[], now: number,
): Promise<void> {
  const p = npc.pending;
  if (!p) return;
  const interval = R.currentIntervalMs(npc.act_every_ms, stats.speed);
  if (!(await claim(db, npc, { pending: null, strike_at: null, next_action_at: iso(now + interval) }))) return;
  const sk = skills.find(k => k.name === p.skill && k.type === p.type) ?? skills.find(k => k.type === p.type)
    ?? (p.type === 'strike' ? S.basicStrike(stats) : skills[0]);
  const fresh = await fightersOf(db, fight.id);
  const byId = new Map(fresh.map(f => [f.id, f]));
  const players = fresh.filter(f => f.kind === 'player');
  const present = players.filter(f => isPresent(f, now));
  const line = (text: string) => postLine(db, fight.party_id, hostId, text);

  if (S.OFFENSE.includes(sk.type)) {
    let targets = p.targets.map(id => byId.get(id)).filter((f): f is Fighter => !!f && isPresent(f, now));
    if (targets.length === 0) {
      // The target went down or left during the wind-up: the NPC turns on someone else.
      const id = R.pickTarget(present.map(f => ({ id: f.id, status: f.status, threat: npc.threat?.[f.user_id as string] ?? 0, idleSeconds: 0 })), roll);
      const other = id ? byId.get(id) : undefined;
      targets = other ? [other] : [];
    }
    if (targets.length === 0) {
      await line(`${npc.name}'s ${sk.name} finds no one to hit.`);
      return;
    }
    const parts: string[] = [];
    let staggered = false;
    // Counter Clash (heavy, signature, sweep): each target's own taps on the chain decide how much lands.
    const chain = M.cleanClash(p.clash);
    for (const t of targets.slice(0, S.SWEEP_MAX)) {
      // A pinned player can't clash: they take the normal hit.
      const c = chain && !isPinned(t, now) ? await settleClash(db, t, chain) : null;
      if (chain && c?.perfect) {
        const dealt = await landCounter(db, fight, hostId, npc, t, chain.move, c.riposte, now);
        parts.push(`${t.name} clashes perfectly${chain.swings.length > 1 ? ` x${chain.swings.length}` : ''} and counters for ${dealt}${c.riposte ? ' (RIPOSTE!)' : ''}`);
        staggered = true;
        continue;
      }
      const scale = c ? c.scale : 1;
      const r = await npcHitsPlayer(db, fight, hostId, npc, t, sk.bonus, sk.dice, stats, now, scale);
      const note = scale < 1 ? ` (${Math.round((1 - scale) * 100)}% blocked)` : '';
      parts.push(r.hit
        ? `${t.name} ${r.lost} damage${note}${r.crit ? ' (critical!)' : ''}${r.downed ? ', and goes down' : ''}`
        : `${t.name} dodges`);
    }
    if (staggered) await staggerNpc(db, npc.id, now, interval);
    await line(`${npc.name}'s ${sk.name}: ${parts.join('; ')}.${staggered ? ` ${npc.name} staggers!` : ''}`);
    return;
  }

  if (sk.type === 'mend') {
    const t = byId.get(p.targets[0]);
    const target = t && t.kind === 'npc' && t.status === 'up' ? t : byId.get(npc.id);
    if (!target || target.status !== 'up') return;
    const r = await mutate(db, target.id, f => (f.status !== 'up' ? null : { hp: R.applyHealing(f.hp, f.max_hp, sk.power).hp }));
    const gained = r ? r.after.hp - r.before.hp : 0;
    await addEvent(db, fight, { kind: 'mend', actor_name: npc.name, target_name: target.name, hp_delta: gained, detail: `${sk.name}: +${gained} HP` });
    await line(`${npc.name}'s ${sk.name} restores ${gained} HP to ${target.id === npc.id ? 'themself' : target.name}.`);
    return;
  }

  if (sk.type === 'shield') {
    const t = byId.get(p.targets[0]);
    const target = t && t.kind === 'npc' && t.status === 'up' ? t : byId.get(npc.id);
    if (!target || target.status !== 'up') return;
    await mutate(db, target.id, f => (f.status !== 'up' ? null : { ward: sk.power, ward_until: iso(now + S.WARD_MS) }));
    await addEvent(db, fight, { kind: 'shield', actor_name: npc.name, target_name: target.name, detail: `${sk.name}: absorbs ${sk.power}` });
    await line(`${npc.name}'s ${sk.name} wards ${target.id === npc.id ? 'themself' : target.name} (absorbs ${sk.power}).`);
    return;
  }

  if (sk.type === 'rally') {
    const allies = fresh.filter(f => f.kind === 'npc' && f.status === 'up' && f.id !== npc.id && !f.pending && f.next_action_at);
    for (const a of allies) {
      await mutate(db, a.id, f => {
        if (f.status !== 'up' || f.pending || !f.next_action_at) return null;
        const left = Math.max(0, Date.parse(f.next_action_at) - now);
        return { next_action_at: iso(now + Math.round(left * (1 - S.RALLY_SHARE))) };
      });
    }
    await addEvent(db, fight, { kind: 'rally', actor_name: npc.name, target_name: allies.map(a => a.name).join(', '), detail: sk.name });
    await line(`${npc.name}'s ${sk.name} spurs ${allies.length ? allies.map(a => a.name).join(' and ') : 'no one'} on!`);
    return;
  }

  if (sk.type === 'pin') {
    const t = byId.get(p.targets[0]);
    const target = t && isPresent(t, now) ? t : present[0];
    if (!target) return;
    await mutate(db, target.id, f => (f.status !== 'up' ? null : { pinned_until: iso(now + S.PIN_MS) }));
    await addEvent(db, fight, { kind: 'pin', actor_name: npc.name, target_name: target.name, target_user_id: target.user_id, detail: `${sk.name}: pinned ${S.PIN_MS / 1000}s` });
    await line(`${npc.name}'s ${sk.name} pins ${target.name} down for ${S.PIN_MS / 1000} seconds!`);
    return;
  }

  if (sk.type === 'retreat') {
    const r = await mutate(db, npc.id, f => (f.status !== 'up' ? null : { status: 'fled', next_action_at: null, pending: null, strike_at: null }));
    if (!r) return;
    if (npc.npc_id) {
      const { error } = await db.from('party_npcs').update({ combat_state: 'fled', on_stage: false }).eq('id', npc.npc_id);
      must('mark NPC fled', error);
    }
    await addEvent(db, fight, { kind: 'retreat', actor_name: npc.name, detail: sk.name });
    await line(`${npc.name} flees the fight!`);
  }
}

async function tick(db: Db, fightId: string, hostId: string, now: number, known?: Fight): Promise<void> {
  let fight = known ?? await getFight(db, fightId);
  // Speed: a check-in just before a huddle's end waits for it (then re-reads, in case the host held it).
  if (fight.status === 'paused' && fight.pause_kind === 'huddle' && fight.paused_until) {
    const endsAt = Date.parse(fight.paused_until);
    if (endsAt > now && endsAt - now <= EARLY_WINDOW_MS) {
      now = await waitUntil(endsAt, now);
      fight = await getFight(db, fightId);
    }
  }
  // v2: a huddle ends by itself when its 20 seconds are up.
  if (fight.status === 'paused' && fight.pause_kind === 'huddle' && due(fight.paused_until, now)) {
    if (await resumeFight(db, fight, hostId, now)) fight = await getFight(db, fightId);
  }
  if (fight.status === 'paused') return;
  let fighters = await fightersOf(db, fight.id);
  // Speed: most check-ins find nothing due (no NPC turn, wind-up or death save), so they stop here.
  const soonest = nextDueAt(fight, fighters);
  if (!Number.isFinite(soonest) || soonest - now > EARLY_WINDOW_MS) return;
  if (soonest > now) {
    // Speed: phones check in just before something is due. Wait for that exact moment, then re-read the fight
    // (a player may have pushed the NPC back or paused meanwhile), so the hit lands when the countdown reaches zero.
    now = await waitUntil(soonest, now);
    fight = await getFight(db, fightId);
    if (fight.status === 'paused') return;
    fighters = await fightersOf(db, fight.id);
  }
  const players = fighters.filter(f => f.kind === 'player');

  if (fight.status === 'active') {
    const npcIds = fighters.filter(f => f.kind === 'npc' && f.npc_id).map(f => f.npc_id as string);
    // One read for every NPC's stat block and skills.
    const statsById = new Map<string, R.NpcCombatStats>();
    const rawById = new Map<string, unknown>();
    if (npcIds.length) {
      const { data, error } = await db.from('party_npcs').select('id, combat_stats').in('id', npcIds);
      must('read NPC stats', error);
      for (const row of data || []) {
        rawById.set(row.id, row.combat_stats);
        const s = R.cleanCombatStats(row.combat_stats);
        if (s) statsById.set(row.id, s);
      }
    }
    for (const npc of fighters) {
      if (npc.kind !== 'npc' || npc.status !== 'up') continue;
      const stats = statsById.get(npc.npc_id as string);
      if (!stats) {
        if (due(npc.next_action_at, now)) await claim(db, npc, { next_action_at: iso(now + R.baseIntervalMs('trivial')) });
        continue;
      }
      const skills = S.skillsOf(rawById.get(npc.npc_id as string), stats);
      const interval = R.currentIntervalMs(npc.act_every_ms, stats.speed);

      // 1. An announced skill whose wind-up is over happens now.
      if (npc.pending) {
        if (due(npc.strike_at, now)) await resolveSkill(db, fight, hostId, npc, skills, stats, fighters, now);
        continue;
      }
      if (!due(npc.next_action_at, now)) continue;

      // 2. Otherwise, when its timer is up, the NPC picks a skill and announces it.
      // v2: only skills that are off cooldown and under their per-fight limit.
      const cd = S.cleanCooldowns(npc.cooldowns);
      const ready = S.readySkills(skills, cd, now, stats);
      const turnNo = (npc.turn_no ?? 0) + 1;
      const choice = S.chooseSkill({
        skills: ready,
        selfId: npc.id,
        turnNo,
        signatureTurn: npc.signature_turn ?? -99,
        lastPinned: cd.lastPinned ?? null,
        canRetreat: ready.some(k => k.type === 'retreat') ? await canRetreat(db, npc.npc_id as string) : false,
        npcs: fighters.filter(f => f.kind === 'npc').map(f => ({
          id: f.id, hp: f.hp, maxHp: f.max_hp, status: f.status,
          ward: f.ward_until && Date.parse(f.ward_until) > now ? (f.ward ?? 0) : 0,
        })),
        players: players.map(p => ({ id: p.id, status: p.status, present: isPresent(p, now), threat: npc.threat?.[p.user_id as string] ?? 0 })),
      }, roll);
      if (choice.kind === 'idle') {
        await claim(db, npc, { next_action_at: iso(now + interval) });
        continue;
      }
      if (choice.kind === 'beat') {
        // A turn spent talking: a taunt, a plea, an order.
        if (await claim(db, npc, { next_action_at: iso(now + interval), turn_no: turnNo })) {
          speak(db, { partyId: fight.party_id, hostId, npcId: npc.npc_id as string, turn: { move: 'beat' }, fallback: null });
        }
        continue;
      }
      const sk = choice.skill;
      const claimed = await claim(db, npc, {
        pending: {
          skill: sk.name, type: sk.type, targets: choice.targetIds, windup_ms: sk.windupMs,
          // Counter Clash: big moves come as a chain of swings the target can tap (timed back from the hit).
          ...(M.isClashMove(sk.type) ? { clash: M.buildClash(crypto.randomUUID(), sk.type, roll) } : {}),
        },
        strike_at: iso(now + sk.windupMs),
        next_action_at: null,
        cooldowns: S.afterUse(cd, sk, now, choice.targetIds),
        turn_no: turnNo,
        ...(sk.type === 'signature' ? { signature_turn: turnNo } : {}),
      });
      if (!claimed) continue;
      const names = choice.targetIds
        .filter(id => id !== npc.id)
        .map(id => fighters.find(f => f.id === id)?.name)
        .filter((n): n is string => !!n);
      await addEvent(db, fight, {
        kind: 'intent', actor_name: npc.name, target_name: names.join(', '),
        detail: `${sk.name} (${S.SKILL_LABEL[sk.type]}) in ${Math.round(sk.windupMs / 1000)}s`,
      });
      speak(db, {
        partyId: fight.party_id, hostId, npcId: npc.npc_id as string,
        turn: {
          move: 'intent', skill: sk.name, skillType: sk.type,
          targets: choice.targetIds.filter(id => id !== npc.id)
            .map(id => fighters.find(x => x.id === id))
            .filter((x): x is Fighter => !!x)
            .map(x => (x.kind === 'player' ? withLook(x) : x.name)),
        },
        fallback: `${npc.name} readies ${sk.name}${names.length ? ` against ${names.join(' and ')}` : ''}!`,
      });
    }
  }

  // Death saves run while the fight is on, and after a defeat until each downed player is settled.
  if (fight.status === 'active' || fight.outcome === 'defeat') {
    for (const p of players) {
      if (p.status !== 'down' || !due(p.next_save_at, now)) continue;
      const step = R.deathSave(p.death_successes, p.death_failures, roll);
      const patch: Partial<Fighter> = step.outcome === 'revived'
        ? { hp: 1, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null }
        : step.outcome === 'dead'
          ? { status: 'dead', death_successes: step.successes, death_failures: 3, next_save_at: null }
          : { death_successes: step.successes, death_failures: step.failures, next_save_at: R.nextDeathSaveAt(now) };
      if (!(await claim(db, p, patch))) continue;
      if (step.outcome === 'revived') {
        await addEvent(db, fight, {
          kind: 'death_save', target_name: p.name, target_user_id: p.user_id, hp_delta: 1, d20: step.d20, total: step.d20,
          detail: step.d20 === 20 ? 'Natural 20: back up with 1 HP' : '3 successes: back up with 1 HP',
        });
        await postLine(db, fight.party_id, hostId, `${p.name} pulls back from the brink!`);
      } else if (step.outcome === 'dead') {
        await addEvent(db, fight, { kind: 'death', target_name: p.name, target_user_id: p.user_id, d20: step.d20, total: step.d20, detail: '3 failures' });
        const { error } = await db.from('party_character_deaths').insert({
          party_id: fight.party_id, user_id: p.user_id, character_name: p.name, fight_id: fight.id,
        });
        must('record death', error);
        await postLine(db, fight.party_id, hostId, `${p.name} has fallen.`);
      } else {
        await addEvent(db, fight, {
          kind: 'death_save', target_name: p.name, target_user_id: p.user_id, d20: step.d20, total: step.d20,
          detail: `${step.successes} success${step.successes === 1 ? '' : 'es'}, ${step.failures} failure${step.failures === 1 ? '' : 's'}`,
        });
      }
    }
  }

  if (fight.status === 'active') await checkEnd(db, fight.id, hostId, now);
}

/**
 * v2: ends a pause (host or huddle). Every clock moves later by exactly how long the fight was paused, so
 * nothing is gained or lost: NPC turns and wind-ups, wards, cooldowns, pins, player cooldowns, Resolve
 * and death saves. Anything due within 3 s waits until then, so nothing fires the instant the fight resumes.
 */
async function resumeFight(db: Db, fight: Fight, hostId: string, now: number): Promise<boolean> {
  const { data, error } = await db.from('party_fights')
    .update({ status: 'active', paused_at: null, pause_kind: null, paused_until: null })
    .eq('id', fight.id).eq('status', 'paused').select('id');
  must('resume fight', error);
  if (!data?.length) return false;
  const pausedAt = fight.paused_at ? Date.parse(fight.paused_at) : NaN;
  const by = Number.isFinite(pausedAt) ? Math.max(0, now - pausedAt) : 0;
  const soon = now + 3000;
  for (const f of await fightersOf(db, fight.id)) {
    await mutate(db, f.id, x => {
      const patch: Partial<Fighter> = {};
      if (x.kind === 'npc') {
        if (x.status === 'up' && x.pending && x.strike_at) {
          // Counter Clash: the first circle starts at least 1.5 s after the fight resumes.
          const chain = M.cleanClash(x.pending.clash);
          const lead = chain ? Date.parse(x.strike_at) - M.clashStartsAt(chain, Date.parse(x.strike_at)) : 0;
          patch.strike_at = R.shiftIso(x.strike_at, by, Math.max(soon, now + 1500 + lead));
        }
        else if (x.status === 'up' && x.next_action_at) patch.next_action_at = R.shiftIso(x.next_action_at, by, soon);
        if (x.ward_until) patch.ward_until = R.shiftIso(x.ward_until, by);
        if (x.cooldowns) patch.cooldowns = S.shiftCooldowns(S.cleanCooldowns(x.cooldowns), by);
      } else {
        if (x.pinned_until) patch.pinned_until = R.shiftIso(x.pinned_until, by);
        if (x.resolve_at) patch.resolve_at = R.shiftIso(x.resolve_at, by);
        if (x.last_action_at) patch.last_action_at = R.shiftIso(x.last_action_at, by);
        if (x.status === 'down' && x.next_save_at) patch.next_save_at = R.shiftIso(x.next_save_at, by, now + 5000);
      }
      return Object.keys(patch).length ? patch : null;
    });
  }
  const huddle = fight.pause_kind === 'huddle';
  await addEvent(db, fight, { kind: 'resume', detail: huddle ? 'The huddle ends' : 'The fight resumes' });
  await postLine(db, fight.party_id, hostId, huddle ? 'The huddle breaks. Back to the fight!' : 'The fight resumes!');
  return true;
}

/** Ends the fight when every NPC is beaten or every player is down. Cheap (two reads), so player actions use it instead of the full clock. */
async function checkEnd(db: Db, fightId: string, hostId: string, now: number): Promise<void> {
  const fight = await getFight(db, fightId);
  if (fight.status !== 'active') return;
  const all = await fightersOf(db, fight.id);
  const npcs = all.filter(f => f.kind === 'npc');
  const pcs = all.filter(f => f.kind === 'player');
  if (npcs.length > 0 && npcs.every(f => f.status === 'ko' || f.status === 'dead' || f.status === 'fled')) {
    await endFight(db, fight, hostId, 'victory', now);
  } else if (pcs.length > 0 && pcs.every(f => f.status !== 'up')) {
    await endFight(db, fight, hostId, 'defeat', now);
  }
}

/** "The Pig (badly hurt)": how a fighter looks right now, for NPC combat lines. */
function withLook(f: Pick<Fighter, 'name' | 'hp' | 'max_hp'>): string {
  const pct = f.max_hp > 0 ? f.hp / f.max_hp : 1;
  const look = pct > 0.75 ? 'barely scratched' : pct > 0.5 ? 'hurt' : pct > 0.25 ? 'badly hurt' : 'close to collapse';
  return `${f.name} (${look})`;
}

async function endFight(db: Db, fight: Fight, hostId: string, outcome: 'victory' | 'defeat' | 'host_ended', now: number) {
  const { data, error } = await db.from('party_fights')
    .update({ status: 'ended', outcome, ended_at: iso(now) })
    .eq('id', fight.id).neq('status', 'ended').select('id');
  must('end fight', error);
  if (!Array.isArray(data) || data.length === 0) return;
  fight.status = 'ended';
  fight.outcome = outcome;
  if (outcome !== 'defeat') {
    // Nobody dies after the fight is won or called off: downed players are stable.
    const { error: stableError } = await db.from('party_fight_combatants')
      .update({ status: 'stable', next_save_at: null })
      .eq('fight_id', fight.id).eq('status', 'down');
    must('stabilize after fight', stableError);
  }
  const fighters = await fightersOf(db, fight.id);
  const names = (s: string) => fighters.filter(f => f.kind === 'player' && f.status === s).map(f => f.name);
  const label = outcome === 'victory' ? 'the party wins' : outcome === 'defeat' ? 'the party is defeated' : 'the host ended the fight';
  const parts = [`Combat over: ${label}.`];
  const fallen = names('dead');
  const downed = [...names('down'), ...names('stable')];
  if (fallen.length) parts.push(`Fallen: ${fallen.join(', ')}.`);
  if (downed.length) parts.push(`Down: ${downed.join(', ')}.`);
  await addEvent(db, fight, { kind: 'end', detail: parts.join(' ') });
  await postLine(db, fight.party_id, hostId, parts.join(' '));
}

// ── Requests ──────────────────────────────────────────────────────────────────

async function handle(db: Db, userId: string, body: Record<string, unknown>, now: number): Promise<Record<string, unknown>> {
  const action = typeof body.action === 'string' ? body.action : '';

  // Speed: phones call this when the fight bar opens, so the function is already running when the first attack comes.
  if (action === 'warm') return { ok: true, serverNow: Date.now() };

  if (action === 'open') {
    const partyId = needUuid(body.partyId, 'party');
    const hostId = await hostOf(db, partyId);
    const seat = await requireSeat(db, partyId, userId);
    if (await hasFallen(db, partyId, userId)) refuse(409, 'Your character has fallen. The host can revive them.');
    const npc = await getNpc(db, needUuid(body.npcId, 'NPC'));
    if (npc.party_id !== partyId) refuse(403, 'That NPC is not at this table.');
    let fight = await openFightOf(db, partyId);
    let created = false;
    if (!fight) {
      const { data, error } = await db.from('party_fights').insert({ party_id: partyId, started_by: userId }).select(FIGHT_COLS);
      if (error?.code === '23505') fight = await openFightOf(db, partyId);
      else {
        must('start fight', error);
        fight = data[0] as Fight;
        created = true;
      }
    }
    if (!fight) return refuse(409, 'Could not start the fight. Try again.');
    if (fight.status === 'paused') refuse(409, fight.pause_kind === 'huddle' ? 'Huddle in progress. Plan your move!' : 'The host paused the fight.');
    const { fighter: target, joined } = await ensureNpc(db, fight, npc, now);
    const me = await ensurePlayer(db, fight, seat, now);
    if (created) {
      await addEvent(db, fight, { kind: 'start', actor_name: seat.character_name, target_name: npc.name });
      await postLine(db, partyId, hostId, `${seat.character_name} attacks ${npc.name}! Combat begins.`);
    } else if (joined) {
      await postLine(db, partyId, hostId, `${seat.character_name} attacks ${npc.name}, who joins the fight!`);
    }
    if (target.status !== 'up') refuse(409, `${target.name} is already down.`);
    const result = await doAttack(db, fight, hostId, seat, me, target, body.weaponName, finishOf(body.finish), now);
    await checkEnd(db, fight.id, hostId, now);
    return { fightId: fight.id, ...result };
  }

  if (action === 'revive') {
    const partyId = needUuid(body.partyId, 'party');
    const hostId = await hostOf(db, partyId);
    if (hostId !== userId) refuse(403, 'Only the host can revive.');
    const open = await openFightOf(db, partyId);
    if (isUuid(body.userId)) {
      const { data, error } = await db.from('party_character_deaths')
        .update({ revived_at: iso(now), revived_by: userId })
        .eq('party_id', partyId).eq('user_id', body.userId).is('revived_at', null)
        .select('character_name');
      must('revive character', error);
      const name = (data?.[0]?.character_name as string | undefined) ?? 'The fallen';
      if (open) {
        const { data: rows } = await db.from('party_fight_combatants').select('id')
          .eq('fight_id', open.id).eq('user_id', body.userId).eq('status', 'dead').limit(1);
        const id = rows?.[0]?.id as string | undefined;
        if (id) {
          const r = await mutate(db, id, f => (f.status === 'dead' ? { hp: 1, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null } : null));
          if (r) await addEvent(db, open, { kind: 'revive', target_name: r.after.name, target_user_id: r.after.user_id, hp_delta: 1, detail: 'The host revived them' });
        }
      }
      await postLine(db, partyId, hostId, `${name} is revived.`);
      return { ok: true };
    }
    const npc = await getNpc(db, needUuid(body.npcId, 'NPC or player'));
    if (npc.party_id !== partyId) refuse(403, 'That NPC is not at this table.');
    const { error } = await db.from('party_npcs').update({ combat_state: null }).eq('id', npc.id);
    must('revive NPC', error);
    await postLine(db, partyId, hostId, `${npc.name} is back on their feet.`);
    return { ok: true };
  }

  if (action === 'ack') {
    const ids = Array.isArray(body.eventIds) ? body.eventIds.filter(isUuid).slice(0, 100) : [];
    if (ids.length === 0) return { ok: true };
    const { error } = await db.from('party_fight_events')
      .update({ applied_at: iso(now) })
      .in('id', ids).eq('target_user_id', userId).is('applied_at', null);
    must('mark applied', error);
    return { ok: true };
  }

  // Perks: buying and equipping work outside any fight, for the caller's own character.
  if (action === 'perks' || action === 'buy_perk' || action === 'equip_perks') {
    const characterName = typeof body.characterName === 'string' ? body.characterName.trim().slice(0, 120) : '';
    if (!characterName) refuse(400, 'Missing character name.');
    const current = await perksOf(db, userId, characterName);
    if (action === 'perks') return perkView(current);
    if (action === 'buy_perk') {
      if (body.perk === 'slot') {
        if (current.slots >= R.MAX_PERK_SLOTS) refuse(409, 'You already have the extra perk slot.');
        const next = { owned: current.owned, equipped: current.equipped, slots: current.slots + 1 };
        await savePerks(db, userId, characterName, current, next);
        return { ok: true, cost: R.EXTRA_SLOT_COST, ...perkView(next) };
      }
      if (!R.isPerkId(body.perk)) refuse(400, 'Unknown perk.');
      const perk = body.perk as R.PerkId;
      if (current.owned.includes(perk)) refuse(409, `You already own ${R.PERKS[perk].name}.`);
      const owned = [...current.owned, perk];
      const equipped = current.equipped.length < current.slots ? [...current.equipped, perk] : current.equipped;
      const next = { owned, equipped, slots: current.slots };
      await savePerks(db, userId, characterName, current, next);
      return { ok: true, cost: R.PERKS[perk].cost, ...perkView(next) };
    }
    const wanted = R.cleanPerks(body.equipped);
    if (wanted.some(p => !current.owned.includes(p))) refuse(400, "You can only equip perks you own.");
    if (wanted.length > current.slots) refuse(400, `You can equip ${current.slots} perks at a time.`);
    const next = { owned: current.owned, equipped: wanted, slots: current.slots };
    await savePerks(db, userId, characterName, current, next);
    return { ok: true, ...perkView(next) };
  }

  // Everything else acts on one fight.
  const fight = await getFight(db, needUuid(body.fightId, 'fight'));
  const [hostId, seat] = await Promise.all([hostOf(db, fight.party_id), seatOf(db, fight.party_id, userId)]);
  const isHost = hostId === userId;
  if (!seat && !isHost) refuse(403, 'Only players seated at this table can fight.');

  if (action === 'ping') {
    if (seat) await ensurePlayer(db, fight, seat, now);
    await tick(db, fight.id, hostId, now, fight);
    // Speed: the server's clock, so phones can line their countdowns up with it.
    return { ok: true, serverNow: Date.now() };
  }

  if (['pause', 'resume', 'end', 'add_npc'].includes(action) && !isHost) refuse(403, 'Only the host can do that.');

  if (action === 'pause') {
    const { data, error } = await db.from('party_fights').update({ status: 'paused', paused_at: iso(now), pause_kind: 'host', paused_until: null })
      .eq('id', fight.id).eq('status', 'active').select('id');
    must('pause fight', error);
    if (data?.length) {
      await addEvent(db, fight, { kind: 'pause', detail: 'The host paused the fight' });
      await postLine(db, fight.party_id, hostId, 'The host pauses the fight.');
    } else if (fight.status === 'paused' && fight.pause_kind === 'huddle') {
      // The host can hold a huddle open: it becomes a normal pause that only the host ends.
      const { error: holdError } = await db.from('party_fights').update({ pause_kind: 'host', paused_until: null })
        .eq('id', fight.id).eq('status', 'paused').eq('pause_kind', 'huddle');
      must('hold huddle', holdError);
      await addEvent(db, fight, { kind: 'pause', detail: 'The host holds the huddle' });
    }
    return { ok: true };
  }

  if (action === 'resume') {
    await resumeFight(db, fight, hostId, now);
    return { ok: true };
  }

  if (action === 'end') {
    await endFight(db, fight, hostId, 'host_ended', now);
    return { ok: true };
  }

  if (action === 'add_npc') {
    if (fight.status === 'ended') refuse(409, 'This fight is over.');
    const npc = await getNpc(db, needUuid(body.npcId, 'NPC'));
    const { joined } = await ensureNpc(db, fight, npc, now);
    if (joined) await postLine(db, fight.party_id, hostId, `${npc.name} joins the fight!`);
    return { ok: true };
  }

  // Player actions below need a seat.
  if (!seat) return refuse(403, 'Only players seated at this table can fight.');
  // Speed: an attack or spell reads its target at the same time as my own fighter row.
  const earlyTarget = (action === 'attack' || action === 'cast' || action === 'cast_card') && isUuid(body.targetId)
    ? fighterById(db, body.targetId as string).catch(() => null)
    : undefined;
  const me = await ensurePlayer(db, fight, seat, now);

  if (action === 'huddle') {
    // v2: any player can freeze the fight for 20 s to plan, once per fight.
    if (fight.status === 'paused') refuse(409, 'The fight is already paused.');
    if (fight.status === 'ended') refuse(409, 'This fight is over.');
    if (!me) return refuse(409, 'Your character has fallen. The host can revive them.');
    if (fight.huddles_used?.[userId]) refuse(409, "You've already called your huddle this fight.");
    const until = now + R.HUDDLE_MS;
    const { data, error } = await db.from('party_fights').update({
      status: 'paused', paused_at: iso(now), pause_kind: 'huddle', paused_until: iso(until),
      huddles_used: { ...(fight.huddles_used ?? {}), [userId]: iso(now) },
    }).eq('id', fight.id).eq('status', 'active').select('id');
    must('call huddle', error);
    if (!data?.length) refuse(409, 'The fight just changed. Try again.');
    await addEvent(db, fight, { kind: 'huddle', actor_name: me.name, detail: `${me.name} calls a ${R.HUDDLE_MS / 1000}-second huddle` });
    await postLine(db, fight.party_id, hostId, `${me.name} calls a huddle! The fight freezes for ${R.HUDDLE_MS / 1000} seconds.`);
    return { ok: true, pausedUntil: iso(until) };
  }

  if (action === 'clash') {
    // Counter Clash: one tap on the ring, judged against the chain on the server's clock. Free: never uses the action timer.
    if (fight.status !== 'active') refuse(409, 'The fight is not running.');
    if (!me || me.status !== 'up') return refuse(409, 'You are down and cannot clash.');
    if (isPinned(me, now)) refuse(409, "You're pinned and can't clash.");
    const npc = await fighterById(db, needUuid(body.npcId, 'NPC'));
    const chain = npc && npc.fight_id === fight.id && npc.kind === 'npc' && npc.status === 'up' && npc.strike_at && npc.pending
      ? M.cleanClash(npc.pending.clash) : null;
    if (!npc || !chain || !npc.strike_at) return refuse(409, 'Nothing to clash.');
    if (!npc.pending?.targets.includes(me.id)) refuse(409, "That move isn't aimed at you.");
    const side = body.side === 'left' || body.side === 'top' || body.side === 'right' ? body.side : refuse(400, 'Missing side.');
    const tapRaw = Number(body.tapAt);
    const tapAt = Number.isFinite(tapRaw) && tapRaw <= now && tapRaw >= now - 1500 ? tapRaw : now;
    const hitAt = Date.parse(npc.strike_at);
    let judged: { index: number; q: M.ClashQ } | null = null;
    const saved = await mutate(db, me.id, f => {
      const results = M.clashResultsOf(f.minigame, chain.id);
      judged = M.judgeClash(chain, hitAt, tapAt, side, results);
      if (!judged) return null;
      const r = [...results];
      while (r.length < chain.swings.length) r.push(null);
      r[judged.index] = judged.q;
      return { minigame: { ...(f.minigame ?? {}), clash: { id: chain.id, r } } };
    }, me);
    const j = judged as { index: number; q: M.ClashQ } | null;
    return saved && j ? { ok: true, index: j.index, quality: j.q } : { ok: false };
  }

  if (action === 'attack') {
    const target = await npcTarget(db, fight, body.targetId, earlyTarget);
    const result = await doAttack(db, fight, hostId, seat, me, target, body.weaponName, finishOf(body.finish), now);
    // Speed: a player's attack can only end the fight by downing an NPC.
    if (result.defeated) await checkEnd(db, fight.id, hostId, now);
    return result;
  }

  if (action === 'cast') {
    const spellName = typeof body.spellName === 'string' ? body.spellName.trim().slice(0, 80) : '';
    if (!spellName) refuse(400, 'Pick a spell.');
    const spellLevel = Number.isFinite(Number(body.spellLevel)) ? Math.max(0, Math.min(9, Math.round(Number(body.spellLevel)))) : 0;
    const sheet = seat.character_status ?? {};
    if (body.intent === 'heal') {
      const dice = R.spellHealDice(spellLevel, sheet) ?? refuse(400, "Cantrips can't heal in a fight. Pick a spell of level 1 or higher.");
      const target = await fighterById(db, needUuid(body.targetId, 'target'));
      if (!target || target.fight_id !== fight.id || target.kind !== 'player') return refuse(404, 'That ally is not in this fight.');
      if (target.status === 'dead') refuse(409, `${target.name} has fallen. Only the host can revive them.`);
      const actor = await startAction(db, fight, me, now);
      const amount = R.rollHealing(dice, roll);
      const r = await mutate(db, target.id, f => {
        if (f.status === 'dead') return null;
        const { hp } = R.applyHealing(f.hp, f.max_hp, amount);
        return hp > 0 && f.status !== 'up'
          ? { hp, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null }
          : { hp };
      });
      const gained = r ? r.after.hp - r.before.hp : 0;
      await addEvent(db, fight, {
        kind: 'heal', actor_name: actor.name, target_name: target.name, target_user_id: target.user_id, hp_delta: gained,
        detail: `${spellName}: +${gained} HP`,
      });
      if (r && r.before.status !== 'up' && r.after.status === 'up') {
        await postLine(db, fight.party_id, hostId, `${actor.name} brings ${target.name} back to their feet!`);
      }
      await checkEnd(db, fight.id, hostId, now);
      return { healed: gained, targetHp: r?.after.hp ?? target.hp };
    }
    const target = await npcTarget(db, fight, body.targetId, earlyTarget);
    const [actor, speed] = await Promise.all([startAction(db, fight, me, now), speedOfNpc(db, target.npc_id)]);
    const a = R.resolveAttack(roll, R.spellAttackBonus(sheet), target.ac);
    let out = { lost: 0, hp: target.hp, defeated: false };
    if (a.hit) {
      out = await hitNpc(db, fight, hostId, actor, target.id, R.rollDamage(R.spellDamageDice(spellLevel, sheet.level), roll, a.crit), finishOf(body.finish), a.crit, now, { target, speed });
    }
    await addEvent(db, fight, {
      kind: 'spell', actor_name: actor.name, target_name: target.name, hp_delta: -out.lost, d20: a.d20, total: a.total,
      detail: a.hit ? `${spellName}: ${out.lost} damage${a.crit ? ' (critical!)' : ''}` : `${spellName}: miss`,
    });
    if (out.defeated) await checkEnd(db, fight.id, hostId, now);
    return { hit: a.hit, crit: a.crit, d20: a.d20, total: a.total, damage: out.lost, targetHp: out.hp, defeated: out.defeated };
  }

  if (action === 'cast_card') {
    // A spell cast from Quick Actions: its card already holds the player's own roll and the slot is already
    // spent. card.resolve says how it lands: 'attack' (d20 vs AC), 'save' (each enemy saves vs card.saveDC,
    // half damage on a success), 'auto' (always hits) or 'utility' (nothing to land). Older cards without it:
    // a d20 means an attack, no d20 means a save. An area card (card.area) lands on up to 3 targets
    // (body.targetId plus body.targetIds). Numbers are capped so nothing impossible lands.
    const card = body.card && typeof body.card === 'object' ? (body.card as Record<string, unknown>) : null;
    const spellName = card && typeof card.action === 'string' ? card.action.trim().slice(0, 80) : '';
    if (!card || !spellName) refuse(400, 'Missing spell card.');
    const num = (v: unknown, max: number): number | null => {
      const n = Number(v);
      return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : Math.max(0, Math.min(max, Math.round(n)));
    };
    const damage = num(card!.damageTotal, 200) ?? 0;
    const amount = num(card!.amount, 200) ?? 0;
    const d20 = num(card!.d20, 20);
    const attackTotal = num(card!.attackTotal, 60);
    const resolve = card!.resolve === 'attack' || card!.resolve === 'save' || card!.resolve === 'auto' || card!.resolve === 'utility'
      ? card!.resolve as 'attack' | 'save' | 'auto' | 'utility'
      : null;
    if (resolve === 'utility') refuse(400, `${spellName} has no damage or healing to land. The DM narrates it.`);
    const area = card!.area === true;
    const wanted = [needUuid(body.targetId, 'target'), ...(area && Array.isArray(body.targetIds) ? body.targetIds.filter(isUuid) : [])];
    const ids = [...new Set(wanted)].slice(0, area ? AREA_MAX_TARGETS : 1);
    const targets = (await Promise.all(ids.map(async (id, k) => {
      const early = k === 0 && earlyTarget ? await earlyTarget : null;
      return early && early.id === id ? early : fighterById(db, id);
    }))).filter((t): t is Fighter => !!t && t.fight_id === fight.id);
    if (targets.length === 0) return refuse(404, 'That target is not in this fight.');
    const heals = targets[0].kind === 'player';
    if (targets.some(t => (t.kind === 'player') !== heals)) refuse(400, 'Pick only allies for a heal, or only enemies for an attack.');

    if (heals) {
      if (amount < 1) refuse(400, `${spellName} has no healing to give.`);
      const living = targets.filter(t => t.status !== 'dead');
      if (living.length === 0) refuse(409, `${targets[0].name} has fallen. Only the host can revive them.`);
      const actor = await startAction(db, fight, me, now);
      let healed = 0;
      let firstHp: number | null = null;
      for (const target of living) {
        const r = await mutate(db, target.id, f => {
          if (f.status === 'dead') return null;
          const { hp } = R.applyHealing(f.hp, f.max_hp, amount);
          return hp > 0 && f.status !== 'up'
            ? { hp, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null }
            : { hp };
        });
        const gained = r ? r.after.hp - r.before.hp : 0;
        healed += gained;
        if (firstHp === null) firstHp = r?.after.hp ?? target.hp;
        await addEvent(db, fight, {
          kind: 'heal', actor_name: actor.name, target_name: target.name, target_user_id: target.user_id, hp_delta: gained,
          detail: `${spellName}: +${gained} HP`,
        });
        if (r && r.before.status !== 'up' && r.after.status === 'up') {
          await postLine(db, fight.party_id, hostId, `${actor.name} brings ${target.name} back to their feet!`);
        }
      }
      await checkEnd(db, fight.id, hostId, now);
      return { healed, targetHp: firstHp ?? living[0].hp, targets: living.length };
    }

    if (damage < 1) refuse(400, `${spellName} has no damage to deal.`);
    const standing = targets.filter(t => t.status === 'up');
    if (standing.length === 0) refuse(409, `${targets[0].name} is already down.`);
    // Speed: claim my turn while reading each target's Speed.
    const [actor, speeds] = await Promise.all([
      startAction(db, fight, me, now),
      Promise.all(standing.map(t => speedOfNpc(db, t.npc_id))),
    ]);
    const sheet = seat.character_status ?? {};
    const mode: 'attack' | 'save' | 'auto' = resolve === 'attack' || resolve === 'save' || resolve === 'auto'
      ? resolve
      : (d20 !== null && d20 >= 1 ? 'attack' : 'save');
    const cardDc = num(card!.saveDC, 30);
    const dc = cardDc !== null && cardDc >= 5 ? cardDc : 8 + R.proficiency(sheet.level) + R.castingMod(sheet);
    const crit = mode === 'attack' && d20 === 20;
    let lost = 0;
    let anyHit = false;
    let anyDefeated = false;
    let saved = 0;
    let firstShown: number | null = null;
    let firstHp: number | null = null;
    for (const [i, target] of standing.entries()) {
      let hit = true;
      let dealt = damage;
      let shown: number | null = null;
      let note = '';
      if (mode === 'attack') {
        // Spell attack: the card's own roll against each target's AC.
        shown = attackTotal ?? d20;
        hit = crit || (d20 !== null && d20 !== 1 && (shown ?? 0) >= target.ac);
      } else if (mode === 'save') {
        // Saving-throw spell: each target saves against the caster's spell DC; a success halves the damage.
        const save = roll(20);
        shown = save;
        if (save >= dc) {
          dealt = Math.floor(damage / 2);
          saved += 1;
          note = ` (${target.name} saved vs DC ${dc}, half damage)`;
        } else {
          note = ` (${target.name} failed the DC ${dc} save)`;
        }
      } else {
        note = ' (automatic hit)';
      }
      let out = { lost: 0, hp: target.hp, defeated: false };
      if (hit && dealt > 0) out = await hitNpc(db, fight, hostId, actor, target.id, dealt, finishOf(body.finish), crit, now, { target, speed: speeds[i] });
      lost += out.lost;
      anyHit = anyHit || hit;
      anyDefeated = anyDefeated || out.defeated;
      if (firstShown === null) firstShown = shown;
      if (firstHp === null) firstHp = out.hp;
      await addEvent(db, fight, {
        kind: 'spell', actor_name: actor.name, target_name: target.name, hp_delta: -out.lost,
        d20: mode === 'attack' ? d20 : shown, total: shown,
        detail: hit ? `${spellName}: ${out.lost} damage${crit ? ' (critical!)' : ''}${note}` : `${spellName}: miss`,
      });
    }
    if (anyDefeated) await checkEnd(db, fight.id, hostId, now);
    return {
      hit: anyHit, crit, d20: mode === 'attack' ? d20 : null, total: mode === 'attack' ? firstShown : null,
      damage: lost, targetHp: firstHp ?? standing[0].hp, defeated: anyDefeated, targets: standing.length, saved, mode,
    };
  }

  if (action === 'stabilize') {
    const target = await fighterById(db, needUuid(body.targetId, 'target'));
    if (!target || target.fight_id !== fight.id || target.kind !== 'player') return refuse(404, 'That ally is not in this fight.');
    if (target.user_id === userId) refuse(400, "You can't stabilize yourself.");
    if (target.status !== 'down') refuse(409, `${target.name} doesn't need stabilizing.`);
    const actor = await startAction(db, fight, me, now);
    const d20 = roll(20);
    const total = d20 + R.medicineBonus(seat.character_status ?? {});
    const success = total >= R.STABILIZE_DC;
    if (success) await mutate(db, target.id, f => (f.status === 'down' ? { status: 'stable', next_save_at: null } : null));
    await addEvent(db, fight, {
      kind: 'stabilize', actor_name: actor.name, target_name: target.name, target_user_id: target.user_id, d20, total,
      detail: success ? 'Stabilized' : 'Failed to stabilize',
    });
    await checkEnd(db, fight.id, hostId, now);
    return { success, d20, total };
  }

  if (action === 'second_wind') {
    // Spend a full Resolve bar: heal yourself (or an ally, with Battle Medic) by your Second Wind dice.
    if (!me) return refuse(409, 'Your character has fallen. The host can revive them.');
    if (R.resolveNow(me.resolve, me.resolve_at, me.resolve_rate, now) < R.RESOLVE_MAX) refuse(409, 'Your Resolve is not full yet.');
    const perks = R.cleanPerks(me.perks);
    let target: Fighter = me;
    if (isUuid(body.targetId) && body.targetId !== me.id) {
      if (!perks.includes('battle_medic')) refuse(403, 'Healing an ally with Second Wind needs the Battle Medic perk.');
      const ally = await fighterById(db, body.targetId);
      if (!ally || ally.fight_id !== fight.id || ally.kind !== 'player') return refuse(404, 'That ally is not in this fight.');
      if (ally.status === 'dead') refuse(409, `${ally.name} has fallen. Only the host can revive them.`);
      target = ally;
    }
    const actor = await startAction(db, fight, me, now);
    const amount = R.rollHealing(R.parseDice(actor.second_wind) ?? { count: 1, sides: 8, bonus: 0 }, roll);
    const r = await mutate(db, target.id, f => {
      if (f.status === 'dead') return null;
      const { hp } = R.applyHealing(f.hp, f.max_hp, amount);
      const reset = f.id === actor.id ? { resolve: 0, resolve_at: iso(now) } : {};
      return hp > 0 && f.status !== 'up'
        ? { hp, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null, ...reset }
        : { hp, ...reset };
    });
    if (target.id !== actor.id) await mutate(db, actor.id, () => ({ resolve: 0, resolve_at: iso(now) }));
    const gained = r ? r.after.hp - r.before.hp : 0;
    await addEvent(db, fight, {
      kind: 'second_wind', actor_name: actor.name, target_name: target.name, target_user_id: target.user_id, hp_delta: gained,
      detail: `Second Wind: +${gained} HP`,
    });
    if (r && r.before.status !== 'up' && r.after.status === 'up') {
      await postLine(db, fight.party_id, hostId, `${actor.name} hauls ${target.name} back to their feet!`);
    }
    await checkEnd(db, fight.id, hostId, now);
    return { healed: gained, targetHp: r?.after.hp ?? target.hp };
  }

  if (action === 'give_potion') {
    // A healing potion poured into an ally (downed, stable or standing). The giver's phone removes the potion
    // from their inventory only after this succeeds. The server rolls the potion's healing from its name.
    const itemName = typeof body.itemName === 'string' ? body.itemName.trim().slice(0, 80) : '';
    const dice = potionHealDice(itemName) ?? refuse(400, 'Pick a healing potion.');
    const target = await fighterById(db, needUuid(body.targetId, 'target'));
    if (!target || target.fight_id !== fight.id || target.kind !== 'player') return refuse(404, 'That ally is not in this fight.');
    if (target.user_id === userId) refuse(400, 'Drink it yourself from your inventory instead.');
    if (target.status === 'dead') refuse(409, `${target.name} has fallen. Only the host can revive them.`);
    const actor = await startAction(db, fight, me, now);
    const amount = R.rollHealing(dice, roll);
    const r = await mutate(db, target.id, f => {
      if (f.status === 'dead') return null;
      const { hp } = R.applyHealing(f.hp, f.max_hp, amount);
      return hp > 0 && f.status !== 'up'
        ? { hp, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null }
        : { hp };
    });
    const gained = r ? r.after.hp - r.before.hp : 0;
    await addEvent(db, fight, {
      kind: 'heal', actor_name: actor.name, target_name: target.name, target_user_id: target.user_id, hp_delta: gained,
      detail: `${itemName} (given by ${actor.name}): +${gained} HP`,
    });
    if (r && r.before.status !== 'up' && r.after.status === 'up') {
      await postLine(db, fight.party_id, hostId, `${actor.name} pours a potion down ${target.name}'s throat. ${target.name} is back on their feet!`);
    }
    await checkEnd(db, fight.id, hostId, now);
    return { healed: gained, targetHp: r?.after.hp ?? target.hp };
  }

  if (action === 'potion') {
    // A healing potion drunk during the fight (its healing already went on the sheet) also fills Resolve.
    const gain = R.potionResolve(body.itemName);
    if (!me || gain <= 0 || fight.status === 'ended') return { ok: true, resolve: 0 };
    const itemName = typeof body.itemName === 'string' ? body.itemName.trim().slice(0, 80) : 'Potion';
    const r = await mutate(db, me.id, f => (f.status === 'dead' ? null : {
      resolve: Math.min(R.RESOLVE_MAX, R.resolveNow(f.resolve, f.resolve_at, f.resolve_rate, now) + gain),
      resolve_at: iso(now),
    }));
    if (r) await addEvent(db, fight, { kind: 'potion', actor_name: me.name, target_name: me.name, detail: `${itemName}: +${gain} Resolve` });
    return { ok: true, resolve: gain };
  }

  if (action === 'sync_hp') {
    if (!me || fight.status === 'ended') return { ok: true, ignored: true };
    const raw = Number(body.hp);
    if (!Number.isFinite(raw)) refuse(400, 'Missing HP.');
    await mutate(db, me.id, f => {
      if (f.status === 'dead') return null;
      const hp = Math.max(0, Math.min(f.max_hp, Math.round(raw)));
      if (hp > 0 && f.status !== 'up') return { hp, status: 'up', death_successes: 0, death_failures: 0, next_save_at: null };
      if (hp === 0 && f.status === 'up') return { hp, status: 'down', death_successes: 0, death_failures: 0, next_save_at: R.nextDeathSaveAt(now) };
      return hp === f.hp ? null : { hp };
    });
    return { ok: true };
  }

  return refuse(400, 'Unknown fight action.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'Server configuration error.' });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // NPC lines are written by npc-reply's own code, in the background, after this request answers.
  const voiceDeps = {
    repo: createRepo(db),
    callModel: createModelCaller({
      VENICE_API_KEY: Deno.env.get('VENICE_API_KEY'),
      LOVABLE_API_KEY: Deno.env.get('LOVABLE_API_KEY'),
      ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
    }),
    now: () => Date.now(),
  };
  voiceLine = (lineDb, job) => {
    const work = (async () => {
      let ok = false;
      try {
        const result = await combatTurn({ partyId: job.partyId, npcId: job.npcId, turn: job.turn }, voiceDeps);
        ok = result.status === 200;
        if (!ok) console.warn('[npc-combat] NPC line failed:', result.body.error);
      } catch (err) {
        console.warn('[npc-combat] NPC line failed:', err);
      }
      if (!ok && job.fallback) await postLine(lineDb, job.partyId, job.hostId, job.fallback);
    })();
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(work);
  };

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Sign in to fight.' });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return json(401, { error: 'Sign in to fight.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }

  try {
    return json(200, await handle(db, userId, body, Date.now()));
  } catch (err) {
    if (err instanceof Refusal) return json(err.status, { error: err.message });
    console.error('[npc-combat] failed:', err);
    return json(500, { error: 'The fight server had a problem. Try again in a moment.' });
  }
});
