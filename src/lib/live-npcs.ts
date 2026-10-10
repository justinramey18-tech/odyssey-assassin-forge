// Live NPCs (DECISIONS D-22): the rules the Live Table, the NPC Roster and the
// hand-off to the DM share. Pure functions only: no React, no database.

import { DM_MODELS } from '@/lib/dm-models';
import { parseReply } from '@/lib/chatReply';

export const NPC_DEFAULT_MODEL = 'venice/qwen-3-6-plus';
export const NPC_NAME_MAX = 40;
export const NPC_GUIDE_MAX = 20_000;
export const NPC_SECRETS_MAX = 10_000;

/** The parts of an NPC row this file needs. */
export interface NpcLike {
  id: string;
  name: string;
  on_stage?: boolean;
  archived?: boolean;
}

/** The parts of a Live Table line this file needs. */
export interface TableLineLike {
  id: string;
  user_id: string;
  content: string;
  npc_id?: string | null;
  consumed?: boolean;
  selected?: boolean;
}

// ── Names ──

/** A name as it is saved: trimmed, single spaces, at most 40 characters. */
export function cleanNpcName(raw: string): string {
  return (raw || '').replace(/\s+/g, ' ').trim().slice(0, NPC_NAME_MAX);
}

/** Why a name can't be saved, or null when it can. Names are unique per party (ignoring case) among NPCs not archived. */
export function npcNameProblem(raw: string, roster: NpcLike[], selfId?: string | null): string | null {
  const name = (raw || '').replace(/\s+/g, ' ').trim();
  if (!name) return 'Give the NPC a name.';
  if (name.length > NPC_NAME_MAX) return `Names can be up to ${NPC_NAME_MAX} characters.`;
  const taken = roster.some(n => !n.archived && n.id !== selfId && n.name.trim().toLowerCase() === name.toLowerCase());
  return taken ? `You already have an NPC called ${name}.` : null;
}

// ── Models ──

export interface NpcModelChoice {
  id: string;
  label: string;
  description: string;
  group: string;
}

const NPC_MODEL_GROUPS: Record<string, string> = {
  venice: 'Venice (uncensored)',
  lovable: 'Lovable AI',
  anthropic: "Claude (needs the server's Anthropic key)",
};

/**
 * Models an NPC can use. NPC replies are written on the server with the server's own
 * keys, so only Venice, Lovable AI and Claude models qualify (never "own key" models).
 * The default comes first.
 */
export function npcModelChoices(): NpcModelChoice[] {
  const list = DM_MODELS
    .filter(m => m.provider in NPC_MODEL_GROUPS)
    .map(m => ({ id: m.id, label: m.label, description: m.description, group: NPC_MODEL_GROUPS[m.provider] }));
  const first = list.filter(m => m.id === NPC_DEFAULT_MODEL);
  return [...first, ...list.filter(m => m.id !== NPC_DEFAULT_MODEL)];
}

/** A readable name for a model id, even one that is no longer offered. */
export function npcModelLabel(id: string): string {
  return DM_MODELS.find(m => m.id === id)?.label || id;
}

// ── Who a line is for ──

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** NPCs the text names with "@Name", in the order they appear. Longer names win over shorter ones that start the same way. */
export function mentionedNpcs<T extends NpcLike>(text: string, npcs: T[]): T[] {
  const found: Array<{ npc: T; at: number; end: number }> = [];
  const byLength = [...npcs].sort((a, b) => b.name.trim().length - a.name.trim().length);
  for (const npc of byLength) {
    const name = npc.name.trim();
    if (!name) continue;
    const re = new RegExp(`(^|[\\s(\\["'“‘])@\\s?${escapeRe(name)}(?=$|[^\\p{L}\\p{N}_])`, 'giu');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const at = m.index + m[1].length;
      const end = m.index + m[0].length;
      // Skip a match inside a longer name that was already found ("@Mira" inside "@Mirabel Vane").
      if (!found.some(f => at >= f.at && at < f.end)) found.push({ npc, at, end });
    }
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.at - b.at)
    .map(f => f.npc)
    .filter(n => (seen.has(n.id) ? false : (seen.add(n.id), true)));
}

/**
 * Which on-stage NPCs answer a new in-character line. The most specific pointer wins:
 *   1. NPCs named with "@Name" in the text, or else
 *   2. the NPC whose line is being replied to, or else
 *   3. the NPCs picked with the Talk to chips.
 * Only NPCs on stage (and not archived) can answer.
 */
export function npcsToAsk<T extends NpcLike>(input: {
  text: string;
  onStage: T[];
  chosenIds: string[];
  replyToNpcId?: string | null;
}): T[] {
  const stage = input.onStage.filter(n => n.on_stage !== false && !n.archived);
  const mentioned = mentionedNpcs(input.text, stage);
  if (mentioned.length) return mentioned;
  const replied = input.replyToNpcId ? stage.find(n => n.id === input.replyToNpcId) : undefined;
  if (replied) return [replied];
  return stage.filter(n => input.chosenIds.includes(n.id));
}

// ── Sealing an exchange ──

/**
 * The lines that seal together with `id`: a player's line and every NPC answer to it.
 * Tapping either side gives the same set. Lines already sent to the DM are left out;
 * the tapped line is always first.
 */
export function exchangeIds(lines: TableLineLike[], id: string): string[] {
  const tapped = lines.find(l => l.id === id);
  if (!tapped) return [id];
  let root: TableLineLike = tapped;
  if (tapped.npc_id) {
    const target = parseReply(tapped.content).replyToId;
    const asked = target ? lines.find(l => l.id === target) : undefined;
    if (!asked || asked.npc_id) return [id];
    root = asked;
  }
  const answers = lines.filter(l => !!l.npc_id && parseReply(l.content).replyToId === root.id);
  const ids = [root.id, ...answers.map(l => l.id)].filter(x => x !== id);
  const open = ids.filter(x => !lines.find(l => l.id === x)?.consumed);
  return [id, ...open];
}

// ── The hand-off to the DM ──

export interface HandoffLine {
  /** The speaker's name: a character, or an NPC. */
  name: string;
  npc: boolean;
  /** The line as the DM should read it. */
  text: string;
}

/**
 * The in-character part of a hand-off. Without NPC lines it is one row per character,
 * exactly as before. With NPC lines it keeps the conversation order, so every answer
 * stays right after the question it answers; NPCs are labelled "(NPC)".
 */
export function inCharacterBlock(lines: HandoffLine[]): string {
  if (!lines.some(l => l.npc)) {
    const order: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const l of lines) {
      if (!grouped.has(l.name)) { grouped.set(l.name, []); order.push(l.name); }
      grouped.get(l.name)!.push(l.text);
    }
    return order.map(name => `[${name}]: ${grouped.get(name)!.join(' ')}`).join('\n');
  }
  const blocks: Array<{ label: string; parts: string[] }> = [];
  for (const l of lines) {
    const label = l.npc ? `${l.name} (NPC)` : l.name;
    const last = blocks[blocks.length - 1];
    if (last && last.label === label) last.parts.push(l.text);
    else blocks.push({ label, parts: [l.text] });
  }
  return blocks.map(b => `[${b.label}]: ${b.parts.join(' ')}`).join('\n');
}

/** An NPC's sealed line as it is saved in the story (the DM's history reads only the text, so the name goes in it). */
export function npcStoryContent(name: string, text: string): string {
  return `**${(name || 'NPC').trim()}:** ${(text || '').trim()}`;
}

// ── Talking to the server ──

/**
 * The plain-language error an edge function sent back, or `fallback`.
 * supabase-js puts the Response of a failed call in error.context.
 */
export async function readableFunctionError(error: unknown, fallback: string): Promise<{ message: string; status: number | null }> {
  const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } } } | null)?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : null;
  try {
    const source = typeof ctx?.clone === 'function' ? ctx.clone() : ctx;
    if (source && typeof source.json === 'function') {
      const body = (await source.json()) as { error?: unknown } | null;
      if (body && typeof body.error === 'string' && body.error.trim()) return { message: body.error.trim(), status };
    }
  } catch {
    // Not JSON, or already read: use the fallback.
  }
  return { message: fallback, status };
}

/** "Grukk is thinking…" / "Grukk and Mira are thinking…" / "Grukk, Mira and Ollie are thinking…" */
export function thinkingLabel(names: string[]): string {
  const list = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]} is thinking…`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]} are thinking…`;
}

// ── Scorecard ──

export interface ScoreLine {
  id: string;
  npc_id: string | null;
  content: string;
  consumed: boolean;
}

export interface ScoreReaction {
  message_id: string;
  emoji: string;
}

export interface ScoreRecord {
  npc_id: string;
  reply_message_id: string | null;
  fell_back: boolean;
  error: string | null;
  latency_ms: number | null;
  cost_usd: number | string | null;
}

export interface NpcScore {
  npcId: string;
  name: string;
  /** NPC lines still in the Live Table. */
  lines: number;
  /** Of those, how many the AI wrote (the rest the host typed as the NPC). */
  aiLines: number;
  /** Times players asked this NPC something (answered or not). */
  asked: number;
  /** Answers written by the backup model. */
  fellBack: number;
  /** Asks that got no answer at all. */
  failed: number;
  reactions: number;
  /** Reactions per NPC line, one decimal. */
  reactionsPerLine: number;
  topEmojis: Array<{ emoji: string; count: number }>;
  /** Player lines that reply to one of this NPC's lines. */
  answeredBack: number;
  /** NPC lines that went to the DM. */
  sentToDm: number;
  /** Share of NPC lines that went to the DM, 0 to 100. */
  sentPercent: number;
  /** Average time to answer, in milliseconds, or null. */
  avgLatencyMs: number | null;
  costUsd: number;
}

/** One score card per NPC, in roster order. Everything is counted from what is still in the Live Table. */
export function computeNpcScorecard(input: {
  npcs: Array<{ id: string; name: string }>;
  lines: ScoreLine[];
  reactions: ScoreReaction[];
  records: ScoreRecord[];
}): NpcScore[] {
  const npcOfLine = new Map<string, string>();
  for (const l of input.lines) if (l.npc_id) npcOfLine.set(l.id, l.npc_id);

  return input.npcs.map(npc => {
    const mine = input.lines.filter(l => l.npc_id === npc.id);
    const mineIds = new Set(mine.map(l => l.id));
    const records = input.records.filter(r => r.npc_id === npc.id);
    const aiIds = new Set(records.map(r => r.reply_message_id).filter((x): x is string => !!x && mineIds.has(x)));

    const emojiCounts = new Map<string, number>();
    let reactions = 0;
    for (const r of input.reactions) {
      if (!mineIds.has(r.message_id)) continue;
      reactions += 1;
      emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + 1);
    }
    const topEmojis = Array.from(emojiCounts.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
      .slice(0, 3);

    const answeredBack = input.lines.filter(l => {
      if (l.npc_id) return false;
      const target = parseReply(l.content).replyToId;
      return !!target && npcOfLine.get(target) === npc.id;
    }).length;

    const answered = records.filter(r => !!r.reply_message_id);
    const timed = answered.filter(r => typeof r.latency_ms === 'number');
    const sentToDm = mine.filter(l => l.consumed).length;
    const cost = records.reduce((sum, r) => {
      const v = typeof r.cost_usd === 'string' ? Number(r.cost_usd) : r.cost_usd;
      return sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    }, 0);

    return {
      npcId: npc.id,
      name: npc.name,
      lines: mine.length,
      aiLines: aiIds.size,
      asked: records.length,
      fellBack: answered.filter(r => r.fell_back).length,
      failed: records.filter(r => !r.reply_message_id && !!r.error).length,
      reactions,
      reactionsPerLine: mine.length ? Math.round((reactions / mine.length) * 10) / 10 : 0,
      topEmojis,
      answeredBack,
      sentToDm,
      sentPercent: mine.length ? Math.round((sentToDm / mine.length) * 100) : 0,
      avgLatencyMs: timed.length ? Math.round(timed.reduce((s, r) => s + (r.latency_ms as number), 0) / timed.length) : null,
      costUsd: Math.round(cost * 1_000_000) / 1_000_000,
    };
  });
}
