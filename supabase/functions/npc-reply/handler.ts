// npc-reply: what the function does.
//   speak:      a player's Live Table line gets an answer from an on-stage NPC
//               (v2: when the line answers a roll the NPC asked for, the NPC reacts to the result).
//   spell:      v2. A player cast a spell: every on-stage NPC that reacts to spells answers (at most 3).
//   banter:     v2. The host starts a short scene: 2 or 3 on-stage NPCs talk to each other (2 to 4 lines).
//   regenerate: the host asks for a new version of an NPC's answer.
// Every permission check happens here, before anything is read or written.

import {
  NPC_FALLBACK_MODEL,
  buildNpcSystemPrompt,
  buildNpcUserMessage,
  cardOf,
  cleanNpcReply,
  formatAnchors,
  formatReplyContent,
  formatRollMarker,
  joinGuides,
  rollRequestOf,
  spellCastOf,
  splitRollTag,
  validateRollTag,
  type NpcPromptInput,
  type NpcRollRequest,
  type NpcSituation,
} from './prompt.ts';
import type { CallModel } from './models.ts';
import type { NpcContext, NpcRepo, NpcRow, ReplyKind, RoundLine } from './repo.ts';

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
    return { text: cleanNpcReply(split.text, npcName), tag: split.tag };
  };
  const primary = (model || '').trim() || NPC_FALLBACK_MODEL;
  const first = await callModel(primary, system, user);
  const firstOut = first.ok ? read(first.text || '') : { text: '', tag: null };
  if (firstOut.text) {
    return { ok: true, text: firstOut.text, rollTag: firstOut.tag, modelUsed: primary, fellBack: false, fallbackReason: null, costUsd: first.costUsd ?? null };
  }
  const reason = first.ok ? `${primary} gave an empty answer` : first.reason || `${primary} failed`;
  if (primary === NPC_FALLBACK_MODEL) return { ok: false, error: reason };

  const second = await callModel(NPC_FALLBACK_MODEL, system, user);
  const secondOut = second.ok ? read(second.text || '') : { text: '', tag: null };
  if (secondOut.text) {
    return { ok: true, text: secondOut.text, rollTag: secondOut.tag, modelUsed: NPC_FALLBACK_MODEL, fellBack: true, fallbackReason: reason, costUsd: second.costUsd ?? null };
  }
  return { ok: false, error: `${reason}; the backup model also failed (${second.ok ? 'empty answer' : second.reason || 'no answer'})` };
}

/** The line the NPC answers: its id (left out of the table list), speaker and stored text. */
interface Answering {
  id: string;
  character_name: string;
  content: string;
}

/**
 * Everything the NPC reads. The line being answered is left out of the table list
 * (it is quoted separately), and so is any line in `leaveOut` (an answer being regenerated).
 */
function promptInput(
  npc: NpcRow,
  guide: { guide: string; secrets: string } | null,
  cast: string[],
  ctx: NpcContext,
  line: Answering,
  leaveOut: string[] = [],
  situation?: NpcSituation,
): NpcPromptInput {
  const npcName = npc.name.trim().toLowerCase();
  const skip = new Set([line.id, ...leaveOut].filter(Boolean));
  const seats = new Map((ctx.roster || []).map(r => [r.user_id || '', r.character_name]));
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
    table: ctx.table
      .filter(l => !skip.has(l.id))
      .map(l => ({ speaker: l.character_name || 'Player', npc: !!l.npc_id, inCharacter: l.in_character, content: l.content })),
    speakerName: line.character_name || 'A player',
    line: line.content,
    memory: ctx.mind?.memory ?? [],
    // A seated character's current name wins over the name saved with the attitude.
    attitudes: (ctx.mind?.attitudes ?? []).map(a => ({ name: seats.get(a.user_id) || a.character_name, score: a.score })),
    situation,
  };
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
  return {
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

/** The stored content of an NPC answer, with its roll request (if any) at the end. */
function answerContent(replyToId: string | null, text: string, request: NpcRollRequest | null): string {
  const body = replyToId ? formatReplyContent(replyToId, text) : text;
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
    const input = promptInput(npc, guide, cast, ctx, line, [], situation ?? undefined);
    const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
    if (!result.ok) {
      await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
      return refuse(502, `${npc.name} couldn't answer right now (${result.error}). Try again in a moment.`);
    }

    // A roll request only counts in a normal answer, and only for a seated character.
    const request = kind === 'reply' ? validateRollTag(result.rollTag ?? null, seatsOf(ctx)) : null;
    const replyId = await repo.insertNpcLine({
      party_id: line.party_id,
      user_id: hostId,
      character_name: npc.name,
      content: answerContent(line.id, result.text ?? '', request),
      in_character: true,
      round_id: line.round_id,
      selected: line.selected,
      npc_id: npc.id,
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
      const input = promptInput(npc, guide, stage, ctx, line, [], situation);
      const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
      if (!result.ok) {
        await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
        failed.push({ npc: npc.name, error: result.error || 'no answer' });
        continue;
      }
      const replyId = await repo.insertNpcLine({
        party_id: line.party_id,
        user_id: hostId,
        character_name: npc.name,
        content: answerContent(line.id, result.text ?? '', null),
        in_character: true,
        round_id: line.round_id,
        selected: line.selected,
        npc_id: npc.id,
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
      const input = promptInput(npc, guide, stage, ctx, answering, [], { kind: 'banter', partners, topic, turn, turns });
      const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
      if (!result.ok) {
        await repo.finishRecord(recordId, { error: result.error, latency_ms: deps.now() - started });
        stopped = `${npc.name} couldn't speak (${result.error}), so the scene stopped.`;
        break;
      }
      const replyId = await repo.insertNpcLine({
        party_id: req.partyId,
        user_id: hostId,
        character_name: npc.name,
        content: answerContent(previous?.id ?? null, result.text ?? '', null),
        in_character: true,
        round_id: latest.round_id,
        selected: false,
        npc_id: npc.id,
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
  const input = promptInput(npc, guide, cast, ctx, line, [req.replyMessageId], situation);
  const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
  if (!result.ok) {
    return refuse(502, `${npc.name} couldn't answer right now (${result.error}). The old line was kept.`);
  }

  const request = kind === 'reply' ? validateRollTag(result.rollTag ?? null, seatsOf(ctx)) : null;
  await repo.updateNpcLine(req.replyMessageId, answerContent(line.id, result.text ?? '', request));
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
