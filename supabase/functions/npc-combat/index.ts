// npc-combat: the referee for Live NPC Combat (party Live Table).
// A player's attack on an on-stage NPC opens a fight. After that, NPCs attack on their own
// timers, downed players roll death saves every 30 seconds, and every roll is made here, fairly.
// Phones never write fight tables; they call this function and read the results live.
//
// POST { action: "open", partyId, npcId, weaponName?, finish? }      start a fight by attacking an NPC
// POST { action: "attack", fightId, targetId, weaponName?, finish? } attack an NPC in the fight
// POST { action: "cast", fightId, targetId, spellName, spellLevel, intent } damage an NPC or heal an ally
// POST { action: "stabilize", fightId, targetId }                    Medicine DC 10 on a downed ally
// POST { action: "ping", fightId }                                   "I'm here"; also runs the clock
// POST { action: "sync_hp", fightId, hp }                            my sheet's HP changed outside the fight
// POST { action: "ack", eventIds }                                   these HP changes are on my sheet now
// Host only:
// POST { action: "pause" | "resume" | "end", fightId }
// POST { action: "add_npc", fightId, npcId }
// POST { action: "revive", partyId, userId? , npcId? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as R from './rules.ts';
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
  status: 'up' | 'down' | 'stable' | 'dead' | 'ko';
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

const FIGHT_COLS = 'id, party_id, status, outcome, started_by';
const FIGHTER_COLS =
  'id, fight_id, party_id, kind, npc_id, user_id, name, hp, max_hp, ac, status, death_successes, death_failures, next_action_at, next_save_at, action_seq, threat, last_seen_at, last_action_at, act_every_ms, resolve, resolve_at, resolve_rate, perks, second_wind, last_stand_used';
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
const roll = R.cryptoRoll;

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
): Promise<{ before: Fighter; after: Fighter } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = await fighterById(db, fighterId);
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
    const { error: seenError } = await db.from('party_fight_combatants')
      .update({ last_seen_at: iso(now) }).eq('id', existing.id);
    must('mark seen', seenError);
    existing.last_seen_at = iso(now);
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
  return inserted[0] as Fighter;
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
  const row = {
    fight_id: fight.id,
    party_id: fight.party_id,
    kind: 'npc',
    npc_id: npc.id,
    name: npc.name,
    hp: stats.maxHp,
    max_hp: stats.maxHp,
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
  if (fight.status === 'paused') refuse(409, 'The host paused the fight.');
  if (fight.status === 'ended') refuse(409, 'This fight is over.');
  if (!me) return refuse(409, 'Your character has fallen. The host can revive them.');
  if (me.status !== 'up') refuse(409, 'You are down and cannot act.');
  const last = me.last_action_at ? Date.parse(me.last_action_at) : 0;
  const wait = Math.ceil((last + R.PLAYER_ACTION_COOLDOWN_S * 1000 - now) / 1000);
  if (wait > 0) refuse(429, `Catch your breath: ${wait}s.`);
  const ok = await claim(db, me, { last_action_at: iso(now), last_seen_at: iso(now) });
  if (!ok) refuse(409, 'Too fast. Try again.');
  return me;
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
): Promise<{ lost: number; hp: number; defeated: boolean }> {
  const current = await fighterById(db, targetId);
  const speed = await speedOfNpc(db, current?.npc_id ?? null);
  const result = await mutate(db, targetId, f => {
    if (f.kind !== 'npc' || f.status !== 'up') return null;
    const { hp } = R.applyDamage(f.hp, damage);
    const lost = f.hp - hp;
    const threat = { ...(f.threat ?? {}) };
    threat[me.user_id as string] = (threat[me.user_id as string] ?? 0) + lost;
    if (hp === 0) return { hp, threat, status: finish === 'kill' ? 'dead' : 'ko', next_action_at: null };
    // Stagger: the NPC acts later, and slower from now on.
    const s = R.stagger(R.currentIntervalMs(f.act_every_ms, speed), speed, lost, f.max_hp);
    const next = f.next_action_at ? Date.parse(f.next_action_at) : now;
    const pushed = Math.min(Math.max(next, now) + s.delayMs, now + s.intervalMs);
    return { hp, threat, act_every_ms: s.intervalMs, next_action_at: iso(pushed) };
  });
  if (!result) return { lost: 0, hp: 0, defeated: false };
  const { before, after } = result;
  const defeated = after.status !== 'up';
  if (defeated && after.npc_id) {
    const patch: Record<string, unknown> = { combat_state: after.status === 'dead' ? 'dead' : 'ko' };
    if (after.status === 'dead') patch.on_stage = false;
    const { error } = await db.from('party_npcs').update(patch).eq('id', after.npc_id);
    must('mark NPC defeated', error);
    await addEvent(db, fight, { kind: 'defeat_npc', actor_name: me.name, target_name: after.name, detail: after.status === 'dead' ? 'killed' : 'knocked out' });
    await postLine(db, fight.party_id, hostId, `${me.name} ${after.status === 'dead' ? 'kills' : 'knocks out'} ${after.name}!`);
  }
  if (before.hp > after.hp) {
    // Landing a hit fills the attacker's Resolve.
    await mutate(db, me.id, f => (f.status === 'dead' ? null : {
      resolve: Math.min(R.RESOLVE_MAX, R.resolveNow(f.resolve, f.resolve_at, f.resolve_rate, now) + R.hitResolve(R.cleanPerks(f.perks))),
      resolve_at: iso(now),
    }));
  }
  if (defeated) {
    // Nothing more: a defeated NPC doesn't react.
  } else if (after.npc_id && before.hp > after.hp) {
    // The NPC reacts to the hit (npc-reply allows one reaction per 20 seconds).
    speak(db, {
      partyId: fight.party_id, hostId, npcId: after.npc_id,
      turn: { move: 'hit', attacker: me.name, crit, damage: before.hp - after.hp },
      fallback: null,
    });
  }
  return { lost: before.hp - after.hp, hp: after.hp, defeated };
}

async function npcTarget(db: Db, fight: Fight, targetId: unknown): Promise<Fighter> {
  const t = await fighterById(db, needUuid(targetId, 'target'));
  if (!t || t.fight_id !== fight.id || t.kind !== 'npc') return refuse(404, 'That target is not an NPC in this fight.');
  if (t.status !== 'up') refuse(409, `${t.name} is already down.`);
  return t;
}

async function doAttack(
  db: Db, fight: Fight, hostId: string, seat: Seat, me: Fighter | null, target: Fighter,
  weaponName: unknown, finish: Finish, now: number,
) {
  const actor = await startAction(db, fight, me, now);
  const w = R.weaponAttack(seat.character_status ?? {}, weaponName);
  const a = R.resolveAttack(roll, w.bonus, target.ac);
  let lost = 0;
  let hp = target.hp;
  let defeated = false;
  if (a.hit) {
    const out = await hitNpc(db, fight, hostId, actor, target.id, R.rollDamage(w.dice, roll, a.crit), finish, a.crit, now);
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
async function tick(db: Db, fightId: string, hostId: string, now: number): Promise<void> {
  const fight = await getFight(db, fightId);
  if (fight.status === 'paused') return;
  const fighters = await fightersOf(db, fight.id);
  const players = fighters.filter(f => f.kind === 'player');

  if (fight.status === 'active') {
    const npcIds = fighters.filter(f => f.kind === 'npc' && f.npc_id).map(f => f.npc_id as string);
    const statsById = new Map<string, R.NpcCombatStats>();
    if (npcIds.length) {
      const { data, error } = await db.from('party_npcs').select('id, combat_stats').in('id', npcIds);
      must('read NPC stats', error);
      for (const row of data || []) {
        const s = R.cleanCombatStats(row.combat_stats);
        if (s) statsById.set(row.id, s);
      }
    }
    for (const npc of fighters) {
      if (npc.kind !== 'npc' || npc.status !== 'up' || !due(npc.next_action_at, now)) continue;
      const stats = statsById.get(npc.npc_id as string);
      const interval = stats ? R.currentIntervalMs(npc.act_every_ms, stats.speed) : R.baseIntervalMs('trivial');
      const nextAt = iso(now + interval);
      if (!(await claim(db, npc, { next_action_at: nextAt })) || !stats) continue;
      const dice = R.parseDice(stats.damage);
      const targetId = R.pickTarget(players.map(p => ({
        id: p.id,
        status: p.status,
        threat: npc.threat?.[p.user_id as string] ?? 0,
        idleSeconds: p.last_seen_at ? (now - Date.parse(p.last_seen_at)) / 1000 : Infinity,
      })), roll);
      const target = players.find(p => p.id === targetId);
      if (!target || !dice) continue;
      // About 1 turn in 5 the NPC talks instead of attacking (a taunt, a plea, an order).
      if (roll(5) === 1) {
        speak(db, { partyId: fight.party_id, hostId, npcId: npc.npc_id as string, turn: { move: 'beat' }, fallback: null });
        continue;
      }
      const a = R.resolveAttack(roll, stats.attackBonus, target.ac);
      let lost = 0;
      let downed = false;
      let stoodHp = 0;
      if (a.hit) {
        const damage = R.rollDamage(dice, roll, a.crit);
        let lastStandHp = 0;
        const result = await mutate(db, target.id, f => {
          if (f.status !== 'up') return null;
          const { hp } = R.applyDamage(f.hp, damage);
          // Taking damage fills Resolve: 1 point per 1% of max HP lost.
          const perks = R.cleanPerks(f.perks);
          const resolve = Math.min(R.RESOLVE_MAX, R.resolveNow(f.resolve, f.resolve_at, f.resolve_rate, now) + R.damageResolve(f.hp - hp, f.max_hp, perks));
          if (hp === 0 && perks.includes('last_stand') && !f.last_stand_used && resolve >= R.RESOLVE_MAX) {
            // Last Stand: once per fight, a full bar turns the fall into a Second Wind.
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
          // Rage: the NPC acts sooner, starting with its next turn.
          const faster = R.rageIntervalMs(interval, stats.speed, lost, target.max_hp);
          await mutate(db, npc.id, f => (f.status === 'up' ? { act_every_ms: faster, next_action_at: iso(now + faster) } : null));
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
      speak(db, {
        partyId: fight.party_id, hostId, npcId: npc.npc_id as string,
        turn: { move: 'attack', target: target.name, hit: a.hit, crit: a.crit, damage: lost, downed },
        fallback: downed
          ? `${npc.name} strikes ${target.name} down!`
          : a.hit ? `${npc.name} hits ${target.name}: ${lost} damage.` : `${npc.name} attacks ${target.name} and misses.`,
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

  if (fight.status === 'active') {
    const now2 = await fightersOf(db, fight.id);
    const npcs = now2.filter(f => f.kind === 'npc');
    const pcs = now2.filter(f => f.kind === 'player');
    if (npcs.length > 0 && npcs.every(f => f.status === 'ko' || f.status === 'dead')) {
      await endFight(db, fight, hostId, 'victory', now);
    } else if (pcs.length > 0 && pcs.every(f => f.status !== 'up')) {
      await endFight(db, fight, hostId, 'defeat', now);
    }
  }
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
    if (fight.status === 'paused') refuse(409, 'The host paused the fight.');
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
    await tick(db, fight.id, hostId, now);
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
  const hostId = await hostOf(db, fight.party_id);
  const isHost = hostId === userId;
  const seat = await seatOf(db, fight.party_id, userId);
  if (!seat && !isHost) refuse(403, 'Only players seated at this table can fight.');

  if (action === 'ping') {
    if (seat) await ensurePlayer(db, fight, seat, now);
    await tick(db, fight.id, hostId, now);
    return { ok: true };
  }

  if (['pause', 'resume', 'end', 'add_npc'].includes(action) && !isHost) refuse(403, 'Only the host can do that.');

  if (action === 'pause') {
    const { data, error } = await db.from('party_fights').update({ status: 'paused', paused_at: iso(now) })
      .eq('id', fight.id).eq('status', 'active').select('id');
    must('pause fight', error);
    if (data?.length) {
      await addEvent(db, fight, { kind: 'pause', detail: 'The host paused the fight' });
      await postLine(db, fight.party_id, hostId, 'The host pauses the fight.');
    }
    return { ok: true };
  }

  if (action === 'resume') {
    const { data, error } = await db.from('party_fights').update({ status: 'active', paused_at: null })
      .eq('id', fight.id).eq('status', 'paused').select('id');
    must('resume fight', error);
    if (data?.length) {
      // Every clock restarts from now, so nothing fires the instant the fight resumes.
      const fighters = await fightersOf(db, fight.id);
      const { data: npcRows } = await db.from('party_npcs').select('id, combat_stats')
        .in('id', fighters.filter(f => f.npc_id).map(f => f.npc_id as string));
      const speedOf = new Map<string, R.SpeedPreset>();
      for (const row of npcRows || []) speedOf.set(row.id, R.cleanCombatStats(row.combat_stats)?.speed ?? 'trivial');
      for (const f of fighters) {
        if (f.kind === 'npc' && f.status === 'up') {
          await mutate(db, f.id, x => ({ next_action_at: iso(now + R.currentIntervalMs(x.act_every_ms, speedOf.get(f.npc_id as string) ?? 'trivial')) }));
        } else if (f.kind === 'player' && f.status === 'down') {
          await mutate(db, f.id, x => (x.status === 'down' ? { next_save_at: R.nextDeathSaveAt(now) } : null));
        }
      }
      await addEvent(db, fight, { kind: 'resume', detail: 'The fight resumes' });
      await postLine(db, fight.party_id, hostId, 'The fight resumes!');
    }
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
  const me = await ensurePlayer(db, fight, seat, now);

  if (action === 'attack') {
    const target = await npcTarget(db, fight, body.targetId);
    const result = await doAttack(db, fight, hostId, seat, me, target, body.weaponName, finishOf(body.finish), now);
    await tick(db, fight.id, hostId, now);
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
      await tick(db, fight.id, hostId, now);
      return { healed: gained, targetHp: r?.after.hp ?? target.hp };
    }
    const target = await npcTarget(db, fight, body.targetId);
    const actor = await startAction(db, fight, me, now);
    const a = R.resolveAttack(roll, R.spellAttackBonus(sheet), target.ac);
    let out = { lost: 0, hp: target.hp, defeated: false };
    if (a.hit) {
      out = await hitNpc(db, fight, hostId, actor, target.id, R.rollDamage(R.spellDamageDice(spellLevel, sheet.level), roll, a.crit), finishOf(body.finish), a.crit, now);
    }
    await addEvent(db, fight, {
      kind: 'spell', actor_name: actor.name, target_name: target.name, hp_delta: -out.lost, d20: a.d20, total: a.total,
      detail: a.hit ? `${spellName}: ${out.lost} damage${a.crit ? ' (critical!)' : ''}` : `${spellName}: miss`,
    });
    await tick(db, fight.id, hostId, now);
    return { hit: a.hit, crit: a.crit, d20: a.d20, total: a.total, damage: out.lost, targetHp: out.hp, defeated: out.defeated };
  }

  if (action === 'cast_card') {
    // A spell cast from Quick Actions: its card already holds the player's own roll (attack total
    // and damage, or the healing amount) and the slot is already spent. Capped so nothing impossible lands.
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
    const target = await fighterById(db, needUuid(body.targetId, 'target'));
    if (!target || target.fight_id !== fight.id) return refuse(404, 'That target is not in this fight.');

    if (target.kind === 'player') {
      if (amount < 1) refuse(400, `${spellName} has no healing to give.`);
      if (target.status === 'dead') refuse(409, `${target.name} has fallen. Only the host can revive them.`);
      const actor = await startAction(db, fight, me, now);
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
      await tick(db, fight.id, hostId, now);
      return { healed: gained, targetHp: r?.after.hp ?? target.hp };
    }

    if (damage < 1) refuse(400, `${spellName} has no damage to deal.`);
    if (target.status !== 'up') refuse(409, `${target.name} is already down.`);
    const actor = await startAction(db, fight, me, now);
    const sheet = seat.character_status ?? {};
    let hit = true;
    let crit = false;
    let dealt = damage;
    let shown: number | null = null;
    let note = '';
    if (d20 !== null && d20 >= 1) {
      // Spell attack: the card's own roll against the NPC's AC.
      crit = d20 === 20;
      shown = attackTotal ?? d20;
      hit = crit || (d20 !== 1 && shown >= target.ac);
    } else {
      // Saving-throw spell: the NPC saves against the caster's spell DC; a success halves the damage.
      const save = roll(20);
      const dc = 8 + R.proficiency(sheet.level) + R.castingMod(sheet);
      shown = save;
      if (save >= dc) {
        dealt = Math.floor(damage / 2);
        note = ` (${target.name} saved, half damage)`;
      }
    }
    let out = { lost: 0, hp: target.hp, defeated: false };
    if (hit && dealt > 0) out = await hitNpc(db, fight, hostId, actor, target.id, dealt, finishOf(body.finish), crit, now);
    await addEvent(db, fight, {
      kind: 'spell', actor_name: actor.name, target_name: target.name, hp_delta: -out.lost, d20, total: shown,
      detail: hit ? `${spellName}: ${out.lost} damage${crit ? ' (critical!)' : ''}${note}` : `${spellName}: miss`,
    });
    await tick(db, fight.id, hostId, now);
    return { hit, crit, d20, total: shown, damage: out.lost, targetHp: out.hp, defeated: out.defeated };
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
    await tick(db, fight.id, hostId, now);
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
    await tick(db, fight.id, hostId, now);
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
