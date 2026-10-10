// npc-reply: the two things the function does.
//   speak:      a player's Live Table line gets an answer from an on-stage NPC.
//   regenerate: the host asks for a new version of an NPC's answer.
// Every permission check happens here, before anything is read or written.

import {
  NPC_FALLBACK_MODEL,
  buildNpcSystemPrompt,
  buildNpcUserMessage,
  cleanNpcReply,
  formatAnchors,
  formatReplyContent,
  joinGuides,
  type NpcPromptInput,
} from './prompt.ts';
import type { CallModel } from './models.ts';
import type { NpcContext, NpcRepo, NpcRow, RoundLine } from './repo.ts';

export interface Deps {
  repo: NpcRepo;
  callModel: CallModel;
  now: () => number;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** A player's line older than this can no longer be answered. */
export const MAX_LINE_AGE_MS = 15 * 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const reply = (status: number, body: Record<string, unknown>): HandlerResult => ({ status, body });
const refuse = (status: number, error: string): HandlerResult => reply(status, { error });

/** ok: true with the cleaned text and which model wrote it, or ok: false with what went wrong. */
export interface Generated {
  ok: boolean;
  text?: string;
  modelUsed?: string;
  fellBack?: boolean;
  fallbackReason?: string | null;
  costUsd?: number | null;
  error?: string;
}

/** Ask the NPC's model; if it fails or says nothing usable, ask Gemini Flash instead. */
export async function generateWithFallback(
  model: string,
  system: string,
  user: string,
  npcName: string,
  callModel: CallModel,
): Promise<Generated> {
  const primary = (model || '').trim() || NPC_FALLBACK_MODEL;
  const first = await callModel(primary, system, user);
  const firstText = first.ok ? cleanNpcReply(first.text || '', npcName) : '';
  if (firstText) {
    return { ok: true, text: firstText, modelUsed: primary, fellBack: false, fallbackReason: null, costUsd: first.costUsd ?? null };
  }
  const reason = first.ok ? `${primary} gave an empty answer` : first.reason || `${primary} failed`;
  if (primary === NPC_FALLBACK_MODEL) return { ok: false, error: reason };

  const second = await callModel(NPC_FALLBACK_MODEL, system, user);
  const secondText = second.ok ? cleanNpcReply(second.text || '', npcName) : '';
  if (secondText) {
    return { ok: true, text: secondText, modelUsed: NPC_FALLBACK_MODEL, fellBack: true, fallbackReason: reason, costUsd: second.costUsd ?? null };
  }
  return { ok: false, error: `${reason}; the backup model also failed (${second.ok ? 'empty answer' : second.reason || 'no answer'})` };
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
  line: RoundLine,
  leaveOut: string[] = [],
): NpcPromptInput {
  const npcName = npc.name.trim().toLowerCase();
  const skip = new Set([line.id, ...leaveOut]);
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
  };
}

/** A player asks an on-stage NPC something. */
export async function speak(req: { userId: string; messageId: unknown; npcId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.messageId) || !isUuid(req.npcId)) return refuse(400, 'Missing or invalid messageId or npcId.');

  const line = await repo.getLine(req.messageId);
  if (!line) return refuse(404, 'That line no longer exists.');
  if (line.user_id !== req.userId) return refuse(403, 'Only the player who said this line can ask an NPC about it.');
  if (line.npc_id) return refuse(400, 'NPCs answer players, not other NPCs.');
  if (!line.in_character) return refuse(409, "NPCs don't hear table talk. Switch to in-character and try again.");
  if (line.consumed) return refuse(409, 'That line was already handed to the DM.');
  if (deps.now() - Date.parse(line.created_at) > MAX_LINE_AGE_MS) return refuse(409, 'That line is too old for an NPC to answer. Say it again.');
  if (!(await repo.isMember(line.party_id, req.userId))) return refuse(403, "You're not seated at this table.");

  const npc = await repo.getNpc(req.npcId);
  if (!npc || npc.party_id !== line.party_id || npc.archived) return refuse(404, 'That NPC is not at this table.');
  if (!npc.on_stage) return refuse(409, `${npc.name} isn't on stage right now.`);

  const hostId = await repo.getPartyHost(line.party_id);
  if (!hostId) return refuse(404, 'Party not found.');

  const claimed = await repo.claim({
    party_id: line.party_id,
    npc_id: npc.id,
    prompt_message_id: line.id,
    requested_by: req.userId,
    model_requested: npc.model,
  }, deps.now());
  if (claimed === 'taken') return refuse(409, `${npc.name} already answered that line (or is answering it now).`);

  const started = deps.now();
  try {
    const [guide, cast, ctx] = await Promise.all([
      repo.getGuide(npc.id),
      repo.listStageNames(line.party_id),
      repo.loadContext(line.party_id, hostId),
    ]);
    const input = promptInput(npc, guide, cast, ctx, line);
    const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
    if (!result.ok) {
      await repo.finish(line.id, npc.id, { error: result.error, latency_ms: deps.now() - started });
      return refuse(502, `${npc.name} couldn't answer right now (${result.error}). Try again in a moment.`);
    }

    const replyId = await repo.insertNpcLine({
      party_id: line.party_id,
      user_id: hostId,
      character_name: npc.name,
      content: formatReplyContent(line.id, result.text ?? ''),
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unexpected error';
    await repo.finish(line.id, npc.id, { error: message, latency_ms: deps.now() - started }).catch(() => {});
    throw err;
  }
}

/** The host asks for a new version of an NPC's answer. */
export async function regenerate(req: { userId: string; replyMessageId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.replyMessageId)) return refuse(400, 'Missing or invalid replyMessageId.');

  const record = await repo.findReplyRecord(req.replyMessageId);
  if (!record) return refuse(404, "That NPC line can't be regenerated (it was written by hand, or is gone).");
  const hostId = await repo.getPartyHost(record.party_id);
  if (!hostId || hostId !== req.userId) return refuse(403, 'Only the host can regenerate an NPC line.');

  const [line, npc] = await Promise.all([repo.getLine(record.prompt_message_id), repo.getNpc(record.npc_id)]);
  if (!line) return refuse(404, 'The line it answered was deleted.');
  if (!npc || npc.archived) return refuse(404, 'That NPC is no longer at this table.');

  const started = deps.now();
  const [guide, cast, ctx] = await Promise.all([
    repo.getGuide(npc.id),
    repo.listStageNames(line.party_id),
    repo.loadContext(line.party_id, hostId, line.created_at),
  ]);
  const input = promptInput(npc, guide, cast, ctx, line, [req.replyMessageId]);
  const result = await generateWithFallback(npc.model, buildNpcSystemPrompt(input), buildNpcUserMessage(input), npc.name, deps.callModel);
  if (!result.ok) {
    return refuse(502, `${npc.name} couldn't answer right now (${result.error}). The old line was kept.`);
  }

  await repo.updateNpcLine(req.replyMessageId, formatReplyContent(line.id, result.text ?? ''));
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
