// npc-reply: what the function does.
//   speak:      a player's Live Table line gets an answer from an on-stage NPC
//               (v2: when the line answers a roll the NPC asked for, the NPC reacts to the result).
//   spell:      v2. A player cast a spell: every on-stage NPC that reacts to spells answers (at most 3).
//   banter:     v2. The host starts a short scene: 2 or 3 on-stage NPCs talk to each other (2 to 4 lines).
//   regenerate: the host asks for a new version of an NPC's answer.
// v3: every answer also reads the NPC's guide fields, mood, memory kinds and what it knows
// about each character, and ends with a hidden [MOOD: …] tag that is saved on the line.
// Every permission check happens here, before anything is read or written.

import {
  NPC_FALLBACK_MODEL,
  NPC_FIGHT_VOICE_MODEL,
  combatMoveOf,
  buildNpcSystemPrompt,
  buildNpcUserMessage,
  cardOf,
  cleanNpcReply,
  formatAnchors,
  formatReplyContent,
  formatRollMarker,
  formatJoinMarker,
  joinGuides,
  daysSince,
  describeLooks,
  fadeAttitude,
  isNpcMood,
  readableText,
  rollRequestOf,
  splitMoodTag,
  spellCastOf,
  splitRollTag,
  splitJoinTag,
  validateRollTag,
  validateJoinTag,
  wonOver,
  MAX_ALLIES,
  SOCIAL_CHECKS,
  socialIntentOf,
  replyTargetOf,
  capStart,
  type NpcPerson,
  type NpcPromptInput,
  type NpcRollRequest,
  type NpcJoinOffer,
  type NpcSituation,
} from './prompt.ts';
import type { CallModel } from './models.ts';
import { normalizeSocialStats, type NpcContext, type NpcGuideRow, type NpcRepo, type NpcRow, type ReplyKind, type RoundLine } from './repo.ts';

export interface Deps {
  repo: NpcRepo;
  callModel: CallModel;
  now: () => number;
  /** v2: a fair d20 for an NPC's saving throw. Defaults to crypto random numbers. */
  rollD20?: () => number;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** A player's line older than this can no longer be answered. */
export const MAX_LINE_AGE_MS = 15 * 60_000;
/** At most this many NPCs react to one spell. */
export const MAX_SPELL_REACTORS = 3;
/** A seated player whose phone checked in this recently is at the table. */
export const PRESENT_MS = 3 * 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const reply = (status: number, body: Record<string, unknown>): HandlerResult => ({ status, body });
const refuse = (status: number, error: string): HandlerResult => reply(status, { error });

/** A fair d20 from crypto random numbers. */
export function cryptoD20(): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 20) * 20;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return (buf[0] % 20) + 1;
  }
}

/** ok: true with the cleaned text and which model wrote it, or ok: false with what went wrong. */
export interface Generated {
  ok: boolean;
  text?: string;
  modelUsed?: string;
  fellBack?: boolean;
  fallbackReason?: string | null;
  costUsd?: number | null;
  error?: string;
  /** v2: the [ROLL: …] tag the NPC wrote, not yet checked. */
  rollTag?: { name: string; check: string; dc: number } | null;
  /** D-24: the [JOIN: Name] tag the NPC wrote, not yet checked. */
  joinTag?: { name: string } | null;
  /** v3: the mood the NPC tagged its answer with, or null. */
  mood?: string | null;
}

/** Ask the NPC's model; if it fails or says nothing usable, ask Gemini Flash instead. */
export async function generateWithFallback(
  model: string,
  system: string,
  user: string,
  npcName: string,
  callModel: CallModel,
): Promise<Generated> {
  const read = (raw: string) => {
    const split = splitRollTag(raw);
    const join = splitJoinTag(split.text);
    const moodSplit = splitMoodTag(join.text);
    return { text: cleanNpcReply(moodSplit.text, npcName), tag: split.tag, join: join.tag, mood: moodSplit.mood as string | null };
  };
  const primary = (model || '').trim() || NPC_FALLBACK_MODEL;
  const first = await callModel(primary, system, user);
  const firstOut = first.ok ? read(first.text || '') : { text: '', tag: null, join: null, mood: null };
  if (firstOut.text) {
    return { ok: true, text: firstOut.text, rollTag: firstOut.tag, joinTag: firstOut.join, mood: firstOut.mood, modelUsed: primary, fellBack: false, fallbackReason: null, costUsd: first.costUsd ?? null };
  }
  const reason = first.ok ? `${primary} gave an empty answer` : first.reason || `${primary} failed`;
  if (primary === NPC_FALLBACK_MODEL) return { ok: false, error: reason };

  const second = await callModel(NPC_FALLBACK_MODEL, system, user);
  const secondOut = second.ok ? read(second.text || '') : { text: '', tag: null, join: null, mood: null };
  if (secondOut.text) {
    return { ok: true, text: secondOut.text, rollTag: secondOut.tag, joinTag: secondOut.join, mood: secondOut.mood, modelUsed: NPC_FALLBACK_MODEL, fellBack: true, fallbackReason: reason, costUsd: second.costUsd ?? null };
  }
  return { ok: false, error: `${reason}; the backup model also failed (${second.ok ? 'empty answer' : second.reason || 'no answer'})` };
}

/** The line the NPC answers: its id (left out of the table list), speaker and stored text. */
interface Answering {
  id: string;
  character_name: string;
  content: string;
  user_id?: string;
}

/**
 * Everything the NPC reads. The line being answered is left out of the table list
 * (it is quoted separately), and so is any line in `leaveOut` (an answer being regenerated).
 */
function promptInput(
  npc: NpcRow,
  guide: NpcGuideRow | null,
  cast: string[],
  ctx: NpcContext,
  line: Answering,
  leaveOut: string[] = [],
  situation?: NpcSituation,
  now: number = Date.now(),
  joinOffer?: JoinGate,
): NpcPromptInput {
  const npcName = npc.name.trim().toLowerCase();
  const skip = new Set([line.id, ...leaveOut].filter(Boolean));
  const seats = new Map((ctx.roster || []).map(r => [r.user_id || '', r.character_name]));
  const standIn = !!npc.player_user_id;
  // v3: an NPC knows only what was said since it came on stage (a stand-in knows it all).
  const since = !standIn && npc.on_stage_since ? Date.parse(npc.on_stage_since) - 1000 : NaN;
  const heard = (l: { created_at: string }) => !Number.isFinite(since) || Date.parse(l.created_at) >= since;
  const visible = ctx.table.filter(l => !skip.has(l.id) && heard(l));
  const joinedLate = Number.isFinite(since) && ctx.table.some(l => !heard(l));
  const own = ctx.table.filter(l => l.npc_id === npc.id && !skip.has(l.id)).slice(-5);

  // v3: each character as this NPC sees them (only with a v3 context).
  let people: NpcPerson[] | undefined;
  if (ctx.mind) {
    const feel = new Map((ctx.mind.attitudes ?? []).map(a => [a.user_id, a]));
    const spokeLately = new Set(visible.slice(-12).filter(l => !l.npc_id && l.in_character).map(l => l.user_id));
    people = ctx.roster.filter(r => r.character_name).map(r => {
      const a = r.user_id ? feel.get(r.user_id) : undefined;
      const present = !!r.updated_at && now - Date.parse(r.updated_at) < PRESENT_MS;
      return {
        name: r.character_name,
        looks: describeLooks(r.character_status),
        knowsName: !!a?.knows_name,
        lastSeenDays: daysSince(a?.last_seen_at, now),
        score: fadeAttitude(a?.score ?? 0, a?.last_seen_at ?? a?.updated_at, guide?.grudge_style, now),
        quiet: present && !!r.user_id && r.user_id !== line.user_id && !spokeLately.has(r.user_id),
        self: standIn && r.user_id === npc.player_user_id,
      };
    });
  }

  // v3: emoji reactions to this NPC's own recent lines.
  const reactions: string[] = [];
  for (const l of own) {
    const counts = new Map<string, number>();
    for (const r of ctx.reactions ?? []) if (r.message_id === l.id) counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    if (!counts.size) continue;
    const said = l.content.replace(/^\s*\[reply:[^\]]*\]\s*/, '').replace(/⟪ROLL⟫[\s\S]*?⟪\/ROLL⟫/g, '').replace(/\s+/g, ' ').trim();
    const emojis = Array.from(counts.entries()).map(([e, n]) => (n > 1 ? `${e}×${n}` : e)).join(' ');
    reactions.push(`${emojis} to: "${said.length > 80 ? `${said.slice(0, 80)}…` : said}"`);
  }

  return {
    npcName: npc.name,
    guide: guide?.guide ?? '',
    secrets: guide?.secrets ?? '',
    cast: cast.filter(n => n.trim().toLowerCase() !== npcName),
    worldBible: joinGuides(ctx.guides),
    anchors: formatAnchors(ctx.anchors),
    summary: ctx.summary,
    latestPost: ctx.latestPost,
    roster: ctx.roster.map(r => {
      const s = (r.character_status || {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      return {
        name: r.character_name,
        race: str(s.race),
        className: str(s.className),
        level: typeof s.level === 'number' || typeof s.level === 'string' ? (s.level as number | string) : undefined,
        gender: str(s.gender),
      };
    }),
    table: visible
      .map(l => ({ speaker: l.character_name || 'Player', npc: !!l.npc_id, inCharacter: l.in_character, content: l.content })),
    speakerName: line.character_name || 'A player',
    line: line.content,
    memory: ctx.mind?.memory ?? [],
    // A seated character's current name wins over the name saved with the attitude.
    attitudes: (ctx.mind?.attitudes ?? []).map(a => ({ name: seats.get(a.user_id) || a.character_name, score: a.score })),
    situation,
    fields: guide
      ? { wants: guide.wants ?? '', levers: guide.levers ?? '', hardLines: guide.hard_lines ?? '', moodRange: guide.mood_range ?? '' }
      : undefined,
    mood: npc.mood ?? undefined,
    fight: ctx.fight ?? undefined,
    people,
    threads: ctx.mind?.threads ?? [],
    selfFacts: ctx.mind?.selfFacts ?? [],
    ownLines: own.map(l => l.content),
    reactions,
    standIn,
    joinedLate,
    // D-24: allies know they travel with the party; a reply may carry an offer to join.
    ally: !!npc.ally_since,
    allies: ctx.allies ?? [],
    joinOffer: joinOffer && joinOffer.names.length ? { names: joinOffer.names, won: joinOffer.won } : undefined,
  };
}

// ── D-24: offers to join the party ──

/** Who the NPC may offer to join in this reply (empty = no offer allowed). */
export interface JoinGate {
  names: string[];
  /** The character who just won the NPC over, or null for a volunteer. */
  won: string | null;
  /** The seats an offer may name. */
  seats: Array<{ user_id: string; character_name: string }>;
}

const NO_JOIN: JoinGate = { names: [], won: null, seats: [] };

/**
 * D-24: whether this reply may offer to join the party, and to whom. A won Persuasion, Intimidation or
 * Deception lets the NPC offer to that character; otherwise it may only volunteer to characters it is
 * already Friendly or Loyal toward. Never while it is an ally, a stand-in, knocked out, fighting the
 * party, or when the party already has its 3 allies.
 */
export async function joinGateFor(
  npc: NpcRow,
  guide: NpcGuideRow | null,
  ctx: NpcContext,
  situation: NpcSituation | undefined,
  line: { user_id?: string },
  repo: NpcRepo,
  now: number,
): Promise<JoinGate> {
  if (npc.ally_since || npc.player_user_id || npc.combat_state) return NO_JOIN;
  if ((ctx.allies ?? []).length >= MAX_ALLIES) return NO_JOIN;
  if (repo.enemyInOpenFight && (await repo.enemyInOpenFight(npc.id))) return NO_JOIN;
  const seats = seatsOf(ctx);
  if (wonOver(situation)) {
    const seat = seats.find(s => s.user_id === line.user_id);
    return seat ? { names: [seat.character_name], won: seat.character_name, seats: [seat] } : NO_JOIN;
  }
  const feel = new Map((ctx.mind?.attitudes ?? []).map(a => [a.user_id, a]));
  const friendly = seats.filter(s => {
    const a = feel.get(s.user_id);
    return !!a && fadeAttitude(a.score ?? 0, a.last_seen_at ?? a.updated_at, guide?.grudge_style, now) >= 1;
  });
  return friendly.length ? { names: friendly.map(s => s.character_name), won: null, seats: friendly } : NO_JOIN;
}

/** v3: the mood to save with an answer (the tagged one, else the NPC's current one), and saves a change. */
async function moodAfter(npc: NpcRow, tagged: string | null | undefined, repo: NpcRepo): Promise<string | null> {
  if (isNpcMood(tagged)) {
    if (tagged !== npc.mood) await repo.setNpcMood?.(npc.id, tagged);
    npc.mood = tagged;
    return tagged;
  }
  return isNpcMood(npc.mood) ? npc.mood : null;
}

/** Seats as the roll check needs them. */
function seatsOf(ctx: NpcContext): Array<{ user_id: string; character_name: string }> {
  return (ctx.roster || [])
    .filter(r => typeof r.user_id === 'string' && !!r.user_id && !!r.character_name)
    .map(r => ({ user_id: r.user_id as string, character_name: r.character_name }));
}

/**
 * When a player's line answers a roll this NPC asked them for, the roll situation.
 * Null for any other line (then it is a normal answer).
 */
async function rollSituationFor(line: RoundLine, npcId: string, repo: NpcRepo): Promise<NpcSituation | null> {
  const card = cardOf(line.content);
  if (!card || !isUuid(card.replyTo) || typeof card.total !== 'number' || typeof card.dc !== 'number') return null;
  const asked = await repo.getLine(card.replyTo);
  if (!asked || asked.npc_id !== npcId || asked.party_id !== line.party_id) return null;
  const request = rollRequestOf(asked.content);
  if (!request || request.to !== line.user_id) return null;
  // The goal comes only from the NPC's own hidden request, never from the phone's card.
  let objective = request.objective;
  let context: string | undefined;
  if (!objective && !request.save && (SOCIAL_CHECKS as readonly string[]).includes(request.check)) {
    // Older request with no goal: recover it from the player line the NPC was answering.
    const originId = replyTargetOf(asked.content);
    const origin = originId && isUuid(originId) ? await repo.getLine(originId) : null;
    if (origin && origin.party_id === line.party_id && !origin.npc_id) {
      const said = readableText(origin.content).replace(/\s+/g, ' ').trim();
      const intent = socialIntentOf(said);
      if (intent) objective = intent.objective;
      else if (said) context = capStart(said, 240);
    }
  }
  return {
    ...(objective ? { objective } : {}),
    ...(context ? { context } : {}),
    kind: 'roll',
    roller: line.character_name || request.name,
    check: request.check,
    save: request.save,
    total: card.total,
    // The DC the NPC set wins over anything a phone wrote.
    dc: request.dc,
    success: card.total >= request.dc,
    natural: typeof card.d20 === 'number' && (card.d20 === 20 || card.d20 === 1) ? card.d20 : null,
  };
}

/**
 * A lasting memory for a successful Persuasion, Intimidation or Deception roll with a known goal.
 * Null for everything else (Insight, other checks, failures, no goal). No mechanics in the words.
 */
export function socialOutcomeNote(situation: NpcSituation | null | undefined, npcName: string): string | null {
  if (!situation || situation.kind !== 'roll' || !situation.success || situation.save) return null;
  const goal = (situation.objective || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!goal) return null;
  const who = (situation.roller || 'A character').trim().slice(0, 40);
  const npc = (npcName || 'The NPC').trim().slice(0, 40);
  let note: string;
  if (situation.check === 'Persuasion') note = `${who} talked ${npc} round: ${npc} agreed to ${goal}. ${npc} keeps to that agreement unless circumstances truly change.`;
  else if (situation.check === 'Intimidation') note = `${who} threatened ${npc}, and ${npc} gave in to the demand: ${goal}. ${npc} remembers the threat and keeps to that compliance unless circumstances truly change.`;
  else if (situation.check === 'Deception') note = `${npc}'s BELIEF (not necessarily true): ${who} convinced ${npc} of this: ${goal}. ${npc} acts on that belief until credible evidence disproves it.`;
  else return null;
  return note.slice(0, 300);
}

/** The stored content of an NPC answer, with its roll request or join offer (if any) at the end. */
function answerContent(replyToId: string | null, text: string, request: NpcRollRequest | null, offer: NpcJoinOffer | null = null): string {
  const body = replyToId ? formatReplyContent(replyToId, text) : text;
  if (offer) return `${body}${formatJoinMarker(offer)}`;
  return request ? `${body}${formatRollMarker(request)}` : body;
}

/** The checks every player-line action shares. Returns the line, or a refusal. */
async function checkPlayerLine(userId: string, messageId: unknown, deps: Deps): Promise<RoundLine | HandlerResult> {
  const { repo } = deps;
  if (!isUuid(messageId)) return refuse(400, 'Missing or invalid messageId.');
  const line = await repo.getLine(messageId);
  if (!line) return refuse(404, 'That line no longer exists.');
  if (line.user_id !== userId) return refuse(403, 'Only the player who said this line can ask an NPC about it.');
  if (line.npc_id) return refuse(400, 'NPCs answer players, not other NPCs.');
  if (!line.in_character) return refuse(409, "NPCs don't hear table talk. Switch to in-character and try again.");
  if (line.consumed) return refuse(409, 'That line was already handed to the DM.');
  if (deps.now() - Date.parse(line.created_at) > MAX_LINE_AGE_MS) return refuse(409, 'That line is too old for an NPC to answer. Say it again.');
  if (!(await repo.isMember(line.party_id, userId))) return refuse(403, "You're not seated at this table.");
  return line;
}

const isRefusal = (v: unknown): v is HandlerResult => !!v && typeof v === 'object' && 'status' in (v as object) && 'body' in (v as object);

/** A player asks an on-stage NPC something (or shows it the roll it asked for). */
export async function speak(req: { userId: string; messageId: unknown; npcId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.messageId) || !isUuid(req.npcId)) return refuse(400, 'Missing or invalid messageId or npcId.');

  const checked = await checkPlayerLine(req.userId, req.messageId, deps);
  if (isRefusal(checked)) return checked;
  const line = checked;

  const npc = await repo.getNpc(req.npcId);
  if (!npc || npc.party_id !== line.party_id || npc.archived) return refuse(404, 'That NPC is not at this table.');
  if (!npc.on_stage) return refuse(409, `${npc.name} isn't on stage right now.`);
  if (npc.combat_state) return refuse(409, npc.combat_state === 'ko' ? `${npc.name} is knocked out and can't answer.` : `${npc.name} is dead.`);

  const hostId = await repo.getPartyHost(line.party_id);
  if (!hostId) return refuse(404, 'Party not found.');

  const situation = await rollSituationFor(line, npc.id, repo);
  const kind: ReplyKind = situation ? 'roll' : 'reply';

  const claimed = await repo.claim({
    party_id: line.party_id,
    npc_id: npc.id,
    prompt_message_id: line.id,
    requested_by: req.userId,
    model_requested: npc.model,
    ...(kind !== 'reply' ? { kind } : {}),
  }, deps.now());
  if (claimed === 'taken') return refuse(409, `${npc.name} already answered that line (or is answering it now).`);

  const started = deps.now();
  try {
    const [guide, cast, ctx] = await Promise.all([
      repo.getGuide(npc.id),
      repo.listStageNames(line.party_id),
      repo.loadContext(line.party_id, hostId, undefined, npc.id),
    ]);
    const gate = await joinGateFor(npc, guide, ctx, situation ?? undefined, line, repo, deps.now());
    const input = promptInput(npc, guide, cast, ctx, line, [], situation ?? undefined, deps.now(), gate);
    const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
    if (!result.ok) {
      await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
      return refuse(502, `${npc.name} couldn't answer right now (${result.error}). Try again in a moment.`);
    }

    // D-24: an offer to join counts only for a character the gate allowed. A roll request only counts
    // in a normal answer, and only for a seated character. An offer and a roll never share one line.
    const offer = validateJoinTag(result.joinTag ?? null, gate.seats);
    const request = !offer && kind === 'reply' ? validateRollTag(result.rollTag ?? null, seatsOf(ctx)) : null;
    const mood = await moodAfter(npc, result.mood, repo);
    // A won social roll is remembered BEFORE the answer is posted, so later turns can't forget it.
    // If this write fails, the attempt fails and can be retried (the write is idempotent).
    const outcome = kind === 'roll' ? socialOutcomeNote(situation, npc.name) : null;
    if (outcome && repo.ensureEventMemory) await repo.ensureEventMemory(npc.id, line.party_id, outcome);
    const replyId = await repo.insertNpcLine({
      party_id: line.party_id,
      user_id: hostId,
      character_name: npc.name,
      content: answerContent(line.id, result.text ?? '', request, offer),
      in_character: true,
      round_id: line.round_id,
      selected: line.selected,
      npc_id: npc.id,
      npc_mood: mood,
    });
    await repo.finish(line.id, npc.id, {
      reply_message_id: replyId,
      model_used: result.modelUsed ?? null,
      fell_back: !!result.fellBack,
      fallback_reason: result.fallbackReason ?? null,
      error: null,
      latency_ms: deps.now() - started,
      cost_usd: result.costUsd ?? null,
    });
    return reply(200, {
      ok: true,
      replyId,
      npc: npc.name,
      modelUsed: result.modelUsed,
      fellBack: result.fellBack,
      fallbackReason: result.fallbackReason,
      rollRequest: request ? { name: request.name, check: request.check, save: request.save, dc: request.dc } : null,
      joinOffer: offer ? { name: offer.name } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unexpected error';
    await repo.finish(line.id, npc.id, { error: message, latency_ms: deps.now() - started }).catch(() => {});
    throw err;
  }
}

// ── Direct opposed social checks (Live NPC social rolls) ──

const DIRECT_SOCIAL: Record<string, { skill: 'Persuasion' | 'Intimidation' | 'Deception' | 'Insight'; opposing: 'Insight' | 'Deception' | 'Wisdom Save'; stat: 'insight' | 'deception' | 'wisdomSave' }> = {
  persuasion: { skill: 'Persuasion', opposing: 'Insight', stat: 'insight' },
  deception: { skill: 'Deception', opposing: 'Insight', stat: 'insight' },
  insight: { skill: 'Insight', opposing: 'Deception', stat: 'deception' },
  intimidation: { skill: 'Intimidation', opposing: 'Wisdom Save', stat: 'wisdomSave' },
};

/** A checked roll { die 1..20, whole modifier, total = die + modifier }, or null. */
function rollOf(raw: unknown): { die: number; modifier: number; total: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const die = r.die, modifier = r.modifier, total = r.total;
  if (typeof die !== 'number' || typeof modifier !== 'number' || typeof total !== 'number') return null;
  if (!Number.isInteger(die) || die < 1 || die > 20) return null;
  if (!Number.isInteger(modifier) || modifier < -30 || modifier > 40) return null;
  if (!Number.isInteger(total) || total !== die + modifier) return null;
  return { die, modifier, total };
}

const clip = (v: string, max: number) => {
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/**
 * A lasting memory for a won direct Persuasion, Intimidation or Deception check, built from what the
 * player said and what the NPC answered. Null for Insight, ties and failures. No game terms.
 */
export function directSocialNote(situation: NpcSituation | null | undefined, npcName: string, npcReply: string): string | null {
  if (!situation || situation.kind !== 'social' || situation.outcome !== 'success') return null;
  const who = clip(situation.roller || 'A character', 40);
  const npc = clip(npcName || 'The NPC', 40);
  const said = clip(situation.objective || situation.said || '', 90);
  const answered = clip(readableText(npcReply), 90);
  if (!said) return null;
  let note: string;
  if (situation.skill === 'Persuasion') note = `${who} talked ${npc} round ("${said}"). ${npc} agreed: "${answered}". ${npc} honors that decision unless circumstances truly change.`;
  else if (situation.skill === 'Intimidation') note = `${who} threatened ${npc} ("${said}"), and ${npc} complied: "${answered}". ${npc} remembers being threatened.`;
  else if (situation.skill === 'Deception') note = `${npc}'s BELIEF (not world fact): ${who} told ${npc} "${said}" and ${npc} believes it, until credible evidence says otherwise.`;
  else return null;
  return note.slice(0, 300);
}

/** A player rolled a social skill against an on-stage NPC; the server checks the dice and the NPC plays it out. */
export async function socialCheck(
  req: { userId: string; messageId: unknown; npcId: unknown; skill: unknown; playerRoll: unknown; npcRoll: unknown },
  deps: Deps,
): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.messageId) || !isUuid(req.npcId)) return refuse(400, 'Missing or invalid messageId or npcId.');
  const spec = typeof req.skill === 'string' ? DIRECT_SOCIAL[req.skill.trim().toLowerCase()] : undefined;
  if (!spec) return refuse(400, 'Use Persuasion, Intimidation, Deception or Insight.');
  const playerRoll = rollOf(req.playerRoll);
  const npcRoll = rollOf(req.npcRoll);
  if (!playerRoll || !npcRoll) return refuse(400, 'The rolls are not valid. Roll again.');

  const checked = await checkPlayerLine(req.userId, req.messageId, deps);
  if (isRefusal(checked)) return checked;
  const line = checked;

  const npc = await repo.getNpc(req.npcId);
  if (!npc || npc.party_id !== line.party_id || npc.archived) return refuse(404, 'That NPC is not at this table.');
  if (!npc.on_stage) return refuse(409, `${npc.name} isn't on stage right now.`);
  if (npc.combat_state) return refuse(409, npc.combat_state === 'ko' ? `${npc.name} is knocked out and can't answer.` : `${npc.name} is dead.`);

  const expected = normalizeSocialStats(npc.social_stats)[spec.stat];
  if (npcRoll.modifier !== expected) return refuse(409, "That NPC's social stats changed. Try the check again.");
  const outcome: 'success' | 'failure' | 'tie' = playerRoll.total > npcRoll.total ? 'success' : playerRoll.total < npcRoll.total ? 'failure' : 'tie';

  const hostId = await repo.getPartyHost(line.party_id);
  if (!hostId) return refuse(404, 'Party not found.');

  const said = capStart(readableText(line.content).replace(/\s+/g, ' ').trim(), 240);
  const intent = socialIntentOf(said);
  const situation: NpcSituation = {
    kind: 'social',
    roller: line.character_name || 'A player',
    skill: spec.skill,
    player: playerRoll,
    opposingLabel: spec.opposing,
    npcRoll,
    outcome,
    said,
    ...(intent?.objective ? { objective: intent.objective } : {}),
  };

  const claimed = await repo.claim({
    party_id: line.party_id,
    npc_id: npc.id,
    prompt_message_id: line.id,
    requested_by: req.userId,
    model_requested: npc.model,
    kind: 'roll',
  }, deps.now());
  if (claimed === 'taken') return refuse(409, `${npc.name} already answered that line (or is answering it now).`);

  const started = deps.now();
  try {
    const [guide, cast, ctx] = await Promise.all([
      repo.getGuide(npc.id),
      repo.listStageNames(line.party_id),
      repo.loadContext(line.party_id, hostId, undefined, npc.id),
    ]);
    const gate = await joinGateFor(npc, guide, ctx, situation, line, repo, deps.now());
    const input = promptInput(npc, guide, cast, ctx, line, [], situation, deps.now(), gate);
    const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
    if (!result.ok) {
      await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
      return refuse(502, `${npc.name} couldn't answer right now (${result.error}). Try again in a moment.`);
    }
    const text = result.text ?? '';
    // D-24: a won check may come with an offer to join the party.
    const offer = validateJoinTag(result.joinTag ?? null, gate.seats);
    const mood = await moodAfter(npc, result.mood, repo);
    // A won check is remembered BEFORE the answer is posted; if this fails, the whole attempt fails and can be retried.
    const note = directSocialNote(situation, npc.name, text);
    if (note && repo.ensureEventMemory) await repo.ensureEventMemory(npc.id, line.party_id, note);
    const replyId = await repo.insertNpcLine({
      party_id: line.party_id,
      user_id: hostId,
      character_name: npc.name,
      content: answerContent(line.id, text, null, offer),
      in_character: true,
      round_id: line.round_id,
      selected: line.selected,
      npc_id: npc.id,
      npc_mood: mood,
    });
    await repo.finish(line.id, npc.id, {
      reply_message_id: replyId,
      model_used: result.modelUsed ?? null,
      fell_back: !!result.fellBack,
      fallback_reason: result.fallbackReason ?? null,
      error: null,
      latency_ms: deps.now() - started,
      cost_usd: result.costUsd ?? null,
    });
    return reply(200, {
      ok: true,
      replyId,
      npc: npc.name,
      modelUsed: result.modelUsed,
      fellBack: result.fellBack,
      fallbackReason: result.fallbackReason,
      skill: spec.skill,
      opposingLabel: spec.opposing,
      playerRoll,
      npcRoll,
      outcome,
      joinOffer: offer ? { name: offer.name } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unexpected error';
    await repo.finish(line.id, npc.id, { error: message, latency_ms: deps.now() - started }).catch(() => {});
    throw err;
  }
}

/** v2: a player cast a spell at the table. On-stage NPCs that react to spells answer, one after another. */
export async function spell(req: { userId: string; messageId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  const checked = await checkPlayerLine(req.userId, req.messageId, deps);
  if (isRefusal(checked)) return checked;
  const line = checked;

  const cast = spellCastOf(line.content);
  if (!cast) return refuse(400, "That line doesn't cast a spell.");
  const hostId = await repo.getPartyHost(line.party_id);
  if (!hostId) return refuse(404, 'Party not found.');

  const reactors = ((await repo.listSpellReactors?.(line.party_id)) ?? []).slice(0, MAX_SPELL_REACTORS);
  if (reactors.length === 0) return reply(200, { ok: true, replies: [], failed: [] });

  const replies: Array<{ npc: string; replyId: string; fellBack: boolean }> = [];
  const failed: Array<{ npc: string; error: string }> = [];
  const d20 = deps.rollD20 ?? cryptoD20;

  for (const npc of reactors) {
    const claimed = await repo.claim({
      party_id: line.party_id,
      npc_id: npc.id,
      prompt_message_id: line.id,
      requested_by: req.userId,
      model_requested: npc.model,
      kind: 'spell',
    }, deps.now());
    // Already answered (for example the caster also asked this NPC directly).
    if (claimed === 'taken') continue;

    const started = deps.now();
    try {
      const [guide, stage, ctx] = await Promise.all([
        repo.getGuide(npc.id),
        repo.listStageNames(line.party_id),
        repo.loadContext(line.party_id, hostId, undefined, npc.id),
      ]);
      const situation: NpcSituation = {
        kind: 'spell',
        caster: line.character_name || 'A player',
        spell: cast.spell,
        summary: cast.summary,
        saveRoll: d20(),
      };
      const input = promptInput(npc, guide, stage, ctx, line, [], situation, deps.now());
      const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
      if (!result.ok) {
        await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
        failed.push({ npc: npc.name, error: result.error || 'no answer' });
        continue;
      }
      const mood = await moodAfter(npc, result.mood, repo);
      const replyId = await repo.insertNpcLine({
        party_id: line.party_id,
        user_id: hostId,
        character_name: npc.name,
        content: answerContent(line.id, result.text ?? '', null),
        in_character: true,
        round_id: line.round_id,
        selected: line.selected,
        npc_id: npc.id,
        npc_mood: mood,
      });
      await repo.finish(line.id, npc.id, {
        reply_message_id: replyId,
        model_used: result.modelUsed ?? null,
        fell_back: !!result.fellBack,
        fallback_reason: result.fallbackReason ?? null,
        error: null,
        latency_ms: deps.now() - started,
        cost_usd: result.costUsd ?? null,
      });
      replies.push({ npc: npc.name, replyId, fellBack: !!result.fellBack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected error';
      await repo.finish(line.id, npc.id, { error: message, latency_ms: deps.now() - started }).catch(() => {});
      failed.push({ npc: npc.name, error: message });
    }
  }

  if (replies.length === 0 && failed.length > 0) {
    return reply(502, { error: `${failed.map(f => f.npc).join(' and ')} couldn't react (${failed[0].error}).`, replies, failed });
  }
  return reply(200, { ok: true, spell: cast.spell, replies, failed });
}

/** v2: the host starts a short scene in which 2 or 3 on-stage NPCs talk to each other. */
export async function banter(
  req: { userId: string; partyId: unknown; npcIds: unknown; topic?: unknown; turns?: unknown },
  deps: Deps,
): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.partyId)) return refuse(400, 'Missing or invalid partyId.');
  const ids = Array.isArray(req.npcIds) ? Array.from(new Set(req.npcIds.filter(isUuid))) : [];
  if (ids.length < 2 || ids.length > 3) return refuse(400, 'Pick 2 or 3 NPCs for a scene.');
  const turnsRaw = typeof req.turns === 'number' ? Math.round(req.turns) : 3;
  const turns = Math.min(4, Math.max(2, turnsRaw));
  const topic = typeof req.topic === 'string' ? req.topic.trim().slice(0, 500) : '';
  if (!repo.startRecord || !repo.finishRecord || !repo.latestLine || !repo.playerSpokeSince) {
    return refuse(500, 'NPC scenes are not set up on the server yet.');
  }

  const hostId = await repo.getPartyHost(req.partyId);
  if (!hostId) return refuse(404, 'Party not found.');
  if (hostId !== req.userId) return refuse(403, 'Only the host can start an NPC scene.');

  const npcs: NpcRow[] = [];
  for (const id of ids) {
    const npc = await repo.getNpc(id);
    if (!npc || npc.party_id !== req.partyId || npc.archived) return refuse(404, 'One of those NPCs is not at this table.');
    if (!npc.on_stage) return refuse(409, `${npc.name} isn't on stage right now.`);
    if (npc.combat_state) return refuse(409, npc.combat_state === 'ko' ? `${npc.name} is knocked out and can't answer.` : `${npc.name} is dead.`);
    npcs.push(npc);
  }

  const latest = await repo.latestLine(req.partyId);
  if (!latest) return refuse(409, 'Post one line in the Live Table first, then start the scene.');
  const startedIso = new Date(deps.now()).toISOString();

  const posted: Array<{ npc: string; replyId: string }> = [];
  let previous: Answering | null = null;
  let stopped: string | null = null;

  for (let turn = 1; turn <= turns; turn++) {
    if (turn > 1 && (await repo.playerSpokeSince(req.partyId, startedIso))) {
      stopped = 'A player spoke, so the scene stopped.';
      break;
    }
    const npc = npcs[(turn - 1) % npcs.length];
    const partners = npcs.filter(n => n.id !== npc.id).map(n => n.name);
    const recordId = await repo.startRecord({
      party_id: req.partyId,
      npc_id: npc.id,
      prompt_message_id: previous?.id ?? null,
      requested_by: req.userId,
      model_requested: npc.model,
      kind: 'banter',
    });
    const started = deps.now();
    try {
      const [guide, stage, ctx] = await Promise.all([
        repo.getGuide(npc.id),
        repo.listStageNames(req.partyId),
        repo.loadContext(req.partyId, hostId, undefined, npc.id),
      ]);
      const answering: Answering = previous ?? { id: '', character_name: 'The scene', content: '' };
      const input = promptInput(npc, guide, stage, ctx, answering, [], { kind: 'banter', partners, topic, turn, turns }, deps.now());
      const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
      if (!result.ok) {
        await repo.finishRecord(recordId, { error: result.error, latency_ms: deps.now() - started });
        stopped = `${npc.name} couldn't speak (${result.error}), so the scene stopped.`;
        break;
      }
      const mood = await moodAfter(npc, result.mood, repo);
      const replyId = await repo.insertNpcLine({
        party_id: req.partyId,
        user_id: hostId,
        character_name: npc.name,
        content: answerContent(previous?.id ?? null, result.text ?? '', null),
        in_character: true,
        round_id: latest.round_id,
        selected: false,
        npc_id: npc.id,
        npc_mood: mood,
      });
      await repo.finishRecord(recordId, {
        reply_message_id: replyId,
        model_used: result.modelUsed ?? null,
        fell_back: !!result.fellBack,
        fallback_reason: result.fallbackReason ?? null,
        error: null,
        latency_ms: deps.now() - started,
        cost_usd: result.costUsd ?? null,
      });
      posted.push({ npc: npc.name, replyId });
      previous = { id: replyId, character_name: npc.name, content: result.text ?? '' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected error';
      await repo.finishRecord(recordId, { error: message, latency_ms: deps.now() - started }).catch(() => {});
      stopped = `The scene stopped because of a server error (${message}).`;
      break;
    }
  }

  if (posted.length === 0) return reply(502, { error: stopped || 'The scene could not start.', posted, stopped });
  return reply(200, { ok: true, posted, stopped });
}

/** The host asks for a new version of an NPC's answer. */
/** A player's hit gets at most one reaction line per NPC in this window. */
export const COMBAT_REACT_GAP_MS = 20_000;

/** The spoken words of an NPC line, lowercased: *beats*, (notes), tags and punctuation removed. */
function spokenWords(stored: string): string[] {
  const said = readableText(stored).replace(/\*[^*]*\*|\([^)]*\)/g, ' ');
  return said.toLowerCase().replace(/[’‘`´]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || [];
}

/** How many words in a row two lines may share before the second counts as a repeat. */
export const REPEAT_RUN_WORDS = 4;

/**
 * True when `line` says nearly what one of `earlier` already said: the same words, one line
 * inside the other (2 words or more), or a run of REPEAT_RUN_WORDS words in a row in common.
 * A line with no spoken words (only an action) never counts as a repeat.
 */
export function repeatsEarlierLine(line: string, earlier: string[]): boolean {
  const words = spokenWords(line);
  if (words.length === 0) return false;
  const text = ` ${words.join(' ')} `;
  const runs = new Set<string>();
  for (let i = 0; i + REPEAT_RUN_WORDS <= words.length; i++) runs.add(words.slice(i, i + REPEAT_RUN_WORDS).join(' '));
  return earlier.some((e) => {
    const old = spokenWords(e);
    if (old.length === 0) return false;
    const oldText = ` ${old.join(' ')} `;
    if (oldText === text) return true;
    if (old.length >= 2 && text.includes(oldText)) return true;
    if (words.length >= 2 && oldText.includes(text)) return true;
    for (let i = 0; i + REPEAT_RUN_WORDS <= old.length; i++) {
      if (runs.has(old.slice(i, i + REPEAT_RUN_WORDS).join(' '))) return true;
    }
    return false;
  });
}

/** Added to the request when a fight line came back as a repeat of the NPC's own earlier line. */
export function repeatRetryNote(earlier: string[]): string {
  const said = earlier.map(e => readableText(e).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-8);
  return [
    'You already said these lines in this fight. Your answer repeated one of them. Say something new in completely different words, or answer with only an action in *asterisks*:',
    ...said.map(s => `- ${s.length > 200 ? `${s.slice(0, 200)}…` : s}`),
  ].join('\n');
}

/**
 * Live NPC Combat: one in-character line for an NPC's own fight moment (its attack, a hit it
 * took, or a turn spent talking). Called only by the npc-combat server function, never by a phone,
 * so the facts in `turn` come from the server's own dice. No reply record: lines can't be regenerated.
 */
export async function combatTurn(
  req: { partyId: unknown; npcId: unknown; turn: unknown },
  deps: Deps,
): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.partyId) || !isUuid(req.npcId)) return refuse(400, 'Missing partyId or npcId.');
  const move = combatMoveOf(req.turn);
  if (!move) return refuse(400, 'Missing or invalid combat turn.');
  const npc = await repo.getNpc(req.npcId);
  if (!npc || npc.party_id !== req.partyId || npc.archived) return refuse(404, 'That NPC is not at this table.');
  // A knocked-out, dead, off-stage or stand-in NPC stays quiet. Not an error: the fight goes on.
  // A knocked-out or killed NPC still gets its final words (move 'fall'); otherwise it stays quiet.
  if (npc.player_user_id) return reply(200, { ok: true, skipped: 'quiet' });
  if (move.move !== 'fall' && (!npc.on_stage || npc.combat_state)) return reply(200, { ok: true, skipped: 'quiet' });
  if (move.move === 'hit' && repo.npcSpokeSince
    && (await repo.npcSpokeSince(npc.id, new Date(deps.now() - COMBAT_REACT_GAP_MS).toISOString()))) {
    return reply(200, { ok: true, skipped: 'spoke recently' });
  }
  const hostId = await repo.getPartyHost(req.partyId);
  if (!hostId) return refuse(404, 'Party not found.');
  const [guide, stage, ctx, latest] = await Promise.all([
    repo.getGuide(npc.id),
    repo.listStageNames(req.partyId),
    repo.loadContext(req.partyId, hostId, undefined, npc.id),
    repo.latestLine ? repo.latestLine(req.partyId) : Promise.resolve(null),
  ]);
  const answering: Answering = { id: '', character_name: 'The fight', content: '' };
  const input = promptInput(npc, guide, stage, ctx, answering, [], { kind: 'combat', ...move }, deps.now());
  // Fight lines use a fast model (with the usual fallback) so the NPC's warning reaches the table before its hit.
  const system = buildNpcSystemPrompt(input);
  const user = buildNpcUserMessage(input);
  let result = await generateWithFallback(NPC_FIGHT_VOICE_MODEL, system, user, npc.name, deps.callModel);
  if (!result.ok) return refuse(502, `${npc.name} couldn't speak (${result.error}).`);
  // The fast fight voice repeats itself (CL-054). A near-repeat of this NPC's own recent line
  // gets one new try; if that repeats too, the NPC stays quiet this time (the fight goes on).
  // A skill wind-up still has to warn the table, so it fails instead and npc-combat posts its plain warning.
  const earlier = ctx.table.filter(l => l.npc_id === npc.id).map(l => l.content);
  if (repeatsEarlierLine(result.text ?? '', earlier)) {
    const retry = await generateWithFallback(NPC_FIGHT_VOICE_MODEL, system, `${user}\n\n${repeatRetryNote(earlier)}`, npc.name, deps.callModel);
    if (!retry.ok || repeatsEarlierLine(retry.text ?? '', earlier)) {
      return move.move === 'intent'
        ? refuse(409, `${npc.name} only repeated an earlier line.`)
        : reply(200, { ok: true, skipped: 'repeat' });
    }
    result = retry;
  }
  const mood = await moodAfter(npc, result.mood, repo);
  const replyId = await repo.insertNpcLine({
    party_id: req.partyId,
    user_id: hostId,
    character_name: npc.name,
    content: answerContent(null, result.text ?? '', null),
    in_character: true,
    round_id: latest?.round_id ?? crypto.randomUUID(),
    selected: true,
    npc_id: npc.id,
    npc_mood: mood,
  });
  return reply(200, { ok: true, replyId });
}

export async function regenerate(req: { userId: string; replyMessageId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.replyMessageId)) return refuse(400, 'Missing or invalid replyMessageId.');

  const record = await repo.findReplyRecord(req.replyMessageId);
  if (!record) return refuse(404, "That NPC line can't be regenerated (it was written by hand, or is gone).");
  const hostId = await repo.getPartyHost(record.party_id);
  if (!hostId || hostId !== req.userId) return refuse(403, 'Only the host can regenerate an NPC line.');
  if (!record.prompt_message_id) return refuse(409, "A scene's opening line can't be regenerated. Delete it and start a new scene.");

  const [line, npc] = await Promise.all([repo.getLine(record.prompt_message_id), repo.getNpc(record.npc_id)]);
  if (!line) return refuse(404, 'The line it answered was deleted.');
  if (!npc || npc.archived) return refuse(404, 'That NPC is no longer at this table.');
  if (npc.combat_state) return refuse(409, npc.combat_state === 'ko' ? `${npc.name} is knocked out and can't answer.` : `${npc.name} is dead.`);

  const kind: ReplyKind = record.kind ?? 'reply';
  let situation: NpcSituation | undefined;
  if (kind === 'spell') {
    const cast = spellCastOf(line.content);
    if (cast) situation = { kind: 'spell', caster: line.character_name || 'A player', spell: cast.spell, summary: cast.summary, saveRoll: (deps.rollD20 ?? cryptoD20)() };
  } else if (kind === 'roll') {
    situation = (await rollSituationFor(line, npc.id, repo)) ?? undefined;
  } else if (kind === 'banter') {
    situation = { kind: 'banter', partners: [line.character_name || 'the other NPC'], topic: '', turn: 2, turns: 3 };
  }

  const started = deps.now();
  const [guide, cast, ctx] = await Promise.all([
    repo.getGuide(npc.id),
    repo.listStageNames(line.party_id),
    repo.loadContext(line.party_id, hostId, line.created_at, npc.id),
  ]);
  const gate = await joinGateFor(npc, guide, ctx, situation, line, repo, deps.now());
  const input = promptInput(npc, guide, cast, ctx, line, [req.replyMessageId], situation, deps.now(), gate);
  const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
  if (!result.ok) {
    return refuse(502, `${npc.name} couldn't answer right now (${result.error}). The old line was kept.`);
  }

  const offer = validateJoinTag(result.joinTag ?? null, gate.seats);
  const request = !offer && kind === 'reply' ? validateRollTag(result.rollTag ?? null, seatsOf(ctx)) : null;
  const mood = await moodAfter(npc, result.mood, repo);
  await repo.updateNpcLine(req.replyMessageId, answerContent(line.id, result.text ?? '', request, offer), mood);
  await repo.finish(line.id, npc.id, {
    model_used: result.modelUsed ?? null,
    fell_back: !!result.fellBack,
    fallback_reason: result.fallbackReason ?? null,
    error: null,
    latency_ms: deps.now() - started,
    cost_usd: result.costUsd ?? null,
  });
  return reply(200, {
    ok: true,
    replyId: req.replyMessageId,
    npc: npc.name,
    modelUsed: result.modelUsed,
    fellBack: result.fellBack,
    fallbackReason: result.fallbackReason,
  });
}
