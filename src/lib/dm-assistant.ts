// Human DM Assistant — the host's private co-DM chat on the Party DM screen.
//
// The assistant never posts to the table. It talks with the host and keeps a
// draft post (story text + roll requests + whispers). The host applies the
// draft with one tap.
//
// Lean handoff: every message sends a short brief instead of the whole chart.
//   - World Bible digest: built once, saved on this phone, rebuilt only when
//     the enabled guides change. The "Full Bible" switch sends the complete
//     guides for one message instead.
//   - The running story summary the app already keeps, memory anchors,
//     active quests, world state and the roster.
//   - Only the latest DM post (not the whole story), the Live Table lines,
//     and the current draft.
//   - The whole host/assistant chat since the last post, text only (old
//     drafts are never re-sent). Apply starts a fresh chat.
//
// Pure functions only (no network, no React) so this file can be unit tested.

import { DM_MODELS, DEFAULT_MODEL_ID, loadSelectedModel } from '@/lib/dm-models';
import { loadApiKey } from '@/lib/api-keys';
import { isDmBlueprintWhisper, type Whisper } from '@/lib/whisper-parser';
import {
  type AssistantDraft,
  type DraftEdit,
  EMPTY_DRAFT,
  draftToNumberedText,
  draftToText,
  editHeaderLine,
  parseEditBlock,
  splitParagraphs,
  stripFences,
} from '@/lib/dm-assistant-draft';

// The draft and its small edits live in their own file; re-exported so imports stay the same.
export * from '@/lib/dm-assistant-draft';
import { questContextLine, type Quest, type WorldStateEntry } from '@/lib/quests';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { parseReply } from '@/lib/chatReply';
import { rollForAssistant, type DiceRoll } from '@/lib/dm-dice';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistantChatMessage {
  id: string;
  role: 'host' | 'assistant';
  /** Chat text only. Draft blocks are removed before saving. */
  text: string;
  /** True when this assistant turn changed the draft. */
  draftUpdated?: boolean;
  /** Short note of what changed, e.g. "New draft" or "Edited ¶3". */
  draftNote?: string;
  /** Tap-to-reply suggestions the assistant offered at the end of this reply. */
  suggestions?: string[];
  /** Alternate versions of one paragraph the host can keep. */
  takes?: AssistantTakes;
  /** NPC rehearsal: the NPC this line was said to (host) or by (assistant). */
  npc?: string;
  /** The rehearsal scene this message belongs to. */
  sceneId?: string;
  /** NPC line picked to go into the draft. */
  picked?: boolean;
  /** A dice roll made by the app (shown as a dice card, sent to the assistant as a result). */
  roll?: DiceRoll;
  /** Sent automatically to continue after dice results. */
  auto?: boolean;
  createdAt: string;
}

export interface AssistantTakes {
  /** Paragraph number at the time the versions were written. */
  paragraph: number;
  /** That paragraph's text then, so "Keep" still finds it if the numbers changed. */
  basis: string;
  options: string[];
  /** Index of the version the host kept, if any. */
  kept?: number;
}

/** Brainstorm: talk only, the draft is never touched. Draft: the assistant may write or edit the draft. */
export type AssistantMode = 'brainstorm' | 'draft';

/** One line from the Live Table, as the assistant sees it. */
export interface AssistantTableLine {
  id: string;
  characterName: string;
  content: string;
  inCharacter: boolean;
  /** Ticked for the next hand-off. */
  sealed: boolean;
  /** Already handed to the DM. */
  sent: boolean;
  createdAt: string;
}

export interface AssistantRosterMember {
  user_id: string;
  character_name: string;
  character_status?: Record<string, unknown>;
}

/** A story message as the host's phone already holds it (whispers filtered for the host). */
export interface AssistantStoryMessage {
  role: 'user' | 'assistant';
  content: string;
  sender_name?: string | null;
  team?: string | null;
  whispers?: Whisper[];
}

/** Everything the screen hands over at send time. */
export interface AssistantLiveContext {
  roster: AssistantRosterMember[];
  campaignSummary?: string | null;
  memoryAnchors?: string;
  quests?: Quest[];
  worldState?: WorldStateEntry[];
  story: AssistantStoryMessage[];
  /** Live Table lines, oldest first. */
  tableLines: AssistantTableLine[];
  /** Ids of the sealed lines in the order the host wants them answered. */
  sealedOrder: string[];
  /** Enabled GM guides (the World Bible), full text. */
  guides: string;
}

export interface AssistantBible {
  mode: 'digest' | 'full' | 'none';
  text: string;
}

// ─── Limits (characters) ──────────────────────────────────────────────────────

export const LIMITS = {
  digest: 12_000,
  fullGuides: 200_000,
  summary: 10_000,
  anchors: 6_000,
  quests: 3_000,
  worldState: 2_500,
  roster: 5_000,
  latestPost: 16_000,
  beforeLatest: 3_000,
  tableLines: 30,
  tableLineChars: 600,
  draft: 32_000,
  /**
   * The whole chat since the last post is sent with every message (Justin's call).
   * This ceiling only protects models with small windows; going over it is shown on screen.
   */
  sessionChars: 160_000,
} as const;

/** Rough token count for the size readout (about 4 characters per token). */
export function estimateTokens(chars: number): number {
  return Math.round(chars / 4);
}

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Stable 32-bit FNV-1a hash, hex. Used to notice when the guides change. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Keep the start of a long text. */
function capStart(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…(trimmed)`;
}

/** Keep the end of a long text (the end of a scene matters most). */
function capEnd(text: string, max: number): string {
  if (text.length <= max) return text;
  return `…(earlier part trimmed)\n${text.slice(text.length - max)}`;
}

/** Plain text of a Live Table line, without the hidden action card or reply prefix. */
export function cleanTableLine(content: string): string {
  return stripActionCard(parseReply(content || '').body).trim();
}

function fmtNum(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '?';
}

// ─── Model choice ─────────────────────────────────────────────────────────────

const MODEL_KEY = 'odyssey-dm-assistant-model';

/** True when the model needs a personal API key this phone doesn't have. */
export function modelNeedsMissingKey(modelId: string): boolean {
  const provider = DM_MODELS.find(m => m.id === modelId)?.provider;
  if (provider === 'openai-direct') return !loadApiKey('openai');
  if (provider === 'perplexity') return !loadApiKey('perplexity');
  if (provider === 'xai-direct') return !loadApiKey('xai');
  return false;
}

/** The host's saved assistant model, else the party's DM model, else this phone's DM model. */
export function loadAssistantModel(partyModel?: string | null): string {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  if (partyModel && DM_MODELS.some(m => m.id === partyModel)) return partyModel;
  return loadSelectedModel();
}

export function saveAssistantModel(modelId: string): void {
  try { localStorage.setItem(MODEL_KEY, modelId); } catch { /* ignore */ }
}

const BRAINSTORM_MODEL_KEY = 'odyssey-dm-assistant-model-brainstorm';
/** Brainstorm defaults to a fast model; drafting keeps the stronger writer. */
export const DEFAULT_BRAINSTORM_MODEL = 'google/gemini-2.5-flash';

/** The host's saved Brainstorm model, else a fast default, else the Draft model. */
export function loadBrainstormModel(partyModel?: string | null): string {
  try {
    const saved = localStorage.getItem(BRAINSTORM_MODEL_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  if (DM_MODELS.some(m => m.id === DEFAULT_BRAINSTORM_MODEL)) return DEFAULT_BRAINSTORM_MODEL;
  return loadAssistantModel(partyModel);
}

export function saveBrainstormModel(modelId: string): void {
  try { localStorage.setItem(BRAINSTORM_MODEL_KEY, modelId); } catch { /* ignore */ }
}

const MODE_KEY = 'odyssey-dm-assistant-mode';

export function loadAssistantMode(): AssistantMode {
  try { return localStorage.getItem(MODE_KEY) === 'draft' ? 'draft' : 'brainstorm'; } catch { return 'brainstorm'; }
}

export function saveAssistantMode(mode: AssistantMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

// ─── Personality ──────────────────────────────────────────────────────────────

export type AssistantPersona = 'default' | 'veteran' | 'bard' | 'editor';

/** Changes how the assistant talks in chat, never how the DM post is written. */
export const PERSONAS: Record<AssistantPersona, { label: string; line: string }> = {
  default: { label: 'Sharp co-DM', line: '' },
  veteran: {
    label: 'Grizzled veteran DM',
    line: 'PERSONALITY: in chat you are a grizzled veteran DM who has run a thousand tables: dry, blunt, a little gruff, full of hard-won table wisdom and the occasional war story in one line. You care about pacing and fairness above all.',
  },
  bard: {
    label: 'Hype bard',
    line: 'PERSONALITY: in chat you are an over-the-top hype bard: enthusiastic, theatrical, quick with a dramatic flourish and genuine excitement about the host\'s ideas, but still useful and specific.',
  },
  editor: {
    label: 'Ruthless editor',
    line: 'PERSONALITY: in chat you are a ruthless editor: terse, precise, allergic to purple prose and filler. You point out what is weak without softening it and always say how to fix it.',
  },
};

const PERSONA_KEY = 'odyssey-dm-assistant-persona';

export function loadAssistantPersona(): AssistantPersona {
  try {
    const saved = localStorage.getItem(PERSONA_KEY) as AssistantPersona | null;
    if (saved && saved in PERSONAS) return saved;
  } catch { /* ignore */ }
  return 'default';
}

export function saveAssistantPersona(persona: AssistantPersona): void {
  try { localStorage.setItem(PERSONA_KEY, persona); } catch { /* ignore */ }
}

const RECENT_NPCS_KEY = 'odyssey-dm-assistant-npcs';

/** NPC names the host rehearsed with recently on this phone, newest first. */
export function loadRecentNpcs(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_NPCS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveRecentNpc(name: string): string[] {
  const clean = name.trim();
  const next = [clean, ...loadRecentNpcs().filter(n => n.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
  try { localStorage.setItem(RECENT_NPCS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** The model actually sent: falls back to the default if a needed key is missing. */
export function resolveAssistantModel(modelId: string): string {
  if (!DM_MODELS.some(m => m.id === modelId)) return DEFAULT_MODEL_ID;
  return modelNeedsMissingKey(modelId) ? DEFAULT_MODEL_ID : modelId;
}

// ─── Saved chat + draft (per party, on this phone) ────────────────────────────

export interface AssistantSavedState {
  messages: AssistantChatMessage[];
  draft: AssistantDraft;
}

const stateKey = (partyId: string) => `odyssey-dm-assistant:${partyId}`;

export function loadAssistantState(partyId: string | null): AssistantSavedState {
  const empty: AssistantSavedState = { messages: [], draft: { ...EMPTY_DRAFT } };
  if (!partyId) return empty;
  try {
    const raw = localStorage.getItem(stateKey(partyId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    const messages = Array.isArray(parsed?.messages) ? parsed.messages.filter((m: any) =>
      m && (m.role === 'host' || m.role === 'assistant') && typeof m.text === 'string') : [];
    const draft: AssistantDraft = {
      narrative: typeof parsed?.draft?.narrative === 'string' ? parsed.draft.narrative : '',
      whispers: Array.isArray(parsed?.draft?.whispers) ? parsed.draft.whispers.filter((w: any) =>
        w && (w.type === 'action' || w.type === 'tactics' || w.type === 'whisper') && typeof w.content === 'string') : [],
    };
    return { messages, draft };
  } catch {
    return empty;
  }
}

/** Saves the whole chat since the last post. Returns false when the phone refused (storage full or blocked). */
export function saveAssistantState(partyId: string | null, state: AssistantSavedState): boolean {
  if (!partyId) return true;
  try {
    localStorage.setItem(stateKey(partyId), JSON.stringify({
      messages: state.messages,
      draft: state.draft,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearAssistantState(partyId: string | null): void {
  if (!partyId) return;
  try { localStorage.removeItem(stateKey(partyId)); } catch { /* ignore */ }
}

// ─── World Bible digest (built once, saved on this phone) ─────────────────────

export interface DigestRecord {
  hash: string;
  text: string;
  builtAt: string;
  model: string;
}

const digestKey = (partyId: string) => `odyssey-dm-assistant-digest:${partyId}`;

export function loadDigest(partyId: string | null): DigestRecord | null {
  if (!partyId) return null;
  try {
    const raw = localStorage.getItem(digestKey(partyId));
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (typeof rec?.hash !== 'string' || typeof rec?.text !== 'string' || !rec.text.trim()) return null;
    return rec as DigestRecord;
  } catch {
    return null;
  }
}

export function saveDigest(partyId: string | null, rec: DigestRecord): void {
  if (!partyId) return;
  try { localStorage.setItem(digestKey(partyId), JSON.stringify(rec)); } catch { /* ignore */ }
}

export function clearDigest(partyId: string | null): void {
  if (!partyId) return;
  try { localStorage.removeItem(digestKey(partyId)); } catch { /* ignore */ }
}

/** The saved digest is current when it was built from exactly these guides. */
export function isDigestCurrent(rec: DigestRecord | null, guides: string): boolean {
  return !!rec && rec.hash === hashText(guides.trim());
}

export const DIGEST_SYSTEM_PROMPT = [
  'You condense a tabletop campaign\'s World Bible (the game master\'s guides) into a compact digest for a co-DM assistant.',
  '',
  'KEEP, in terse bullet lines under short headings:',
  '- Every hard rule, house rule, ban and "never" or "rejected" item, with exact wording where the wording matters.',
  '- Tone, pacing and writing-style requirements.',
  '- How mechanics are written: damage, healing, XP, gold, items, rolls, DCs, conditions, rests.',
  '- Named NPCs, factions, locations and items, one line of facts each.',
  '- Content limits.',
  '',
  'DROP: examples, repetition, flavor prose and anything that only restates another rule.',
  'Do not add anything that is not in the guides. Do not comment on the guides.',
  `Hard limit: ${LIMITS.digest - 1_000} characters. Output only the digest.`,
].join('\n');

/** The single message sent when building the digest. */
export function buildDigestMessages(guides: string): Array<{ role: 'user'; content: string }> {
  return [{ role: 'user', content: `WORLD BIBLE (all enabled guides):\n\n${capStart(guides.trim(), LIMITS.fullGuides)}` }];
}

// ─── Draft <-> text ───────────────────────────────────────────────────────────

const DRAFT_OPEN_RE = /\[\[\s*DRAFT\s*\]\]/i;
const DRAFT_BLOCK_RE = /\[\[\s*DRAFT\s*\]\]([\s\S]*?)\[\[\s*\/\s*DRAFT\s*\]\]/gi;
const EDIT_OPEN_RE = /\[\[\s*EDIT\s*\]\]/i;
const EDIT_BLOCK_RE = /\[\[\s*EDIT\s*\]\]([\s\S]*?)\[\[\s*\/\s*EDIT\s*\]\]/gi;
const NEXT_OPEN_RE = /\[\[\s*NEXT\s*\]\]/i;
const NEXT_BLOCK_RE = /\[\[\s*NEXT\s*\]\]([\s\S]*?)\[\[\s*\/\s*NEXT\s*\]\]/gi;
const ROLL_BLOCK_RE = /\[\[\s*ROLL\s*\]\]([\s\S]*?)\[\[\s*\/\s*ROLL\s*\]\]/gi;
const TAKES_OPEN_RE = /\[\[\s*TAKES\b[^\]]*\]\]/i;
const TAKES_BLOCK_RE = /\[\[\s*TAKES\s*(?:¶|PARAGRAPH|PARA|P)?\s*#?\s*(\d+)?\s*\]\]([\s\S]*?)\[\[\s*\/\s*TAKES\s*\]\]/gi;
const ANY_OPEN_RE = /\[\[\s*(?:DRAFT|EDIT|NEXT|ROLL|TAKES[^\]]*)\s*\]\]/i;
const ANY_CLOSE_RE = /\[\[\s*\/\s*(?:DRAFT|EDIT|NEXT|ROLL|TAKES)\s*\]\]/i;

/** Split a TAKES block into its versions (separated by a line of ---). At most 4. */
export function parseTakeOptions(raw: string): string[] {
  return stripFences(raw)
    .split(/\n\s*-{3,}\s*(?:\n|$)/)
    .map(t => t.replace(/^\s*(?:\*\*)?(?:version|take|option)\s*\d+\s*(?:\*\*)?\s*[:.)-]?\s*(?:\*\*)?\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** At most 3 short, distinct suggestion lines; list markers and quotes removed. */
export function parseSuggestions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of stripFences(raw).split('\n')) {
    const text = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'“]|["'”]$/g, '').trim();
    if (!text || text.length > 80) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === 3) break;
  }
  return out;
}

export interface ParsedAssistantReply {
  /** The chat reply shown to the host. */
  chatText: string;
  /** Full new draft text, or null when this reply did not write a full draft. */
  draftText: string | null;
  /** Small edits, in the order written. Ignored when a full draft is present. */
  edits: DraftEdit[];
  /** Tap-to-reply suggestions (0 to 3). */
  suggestions: string[];
  /** Alternate versions of one paragraph, or null. */
  takes: { paragraph: number; options: string[] } | null;
  /** Dice the assistant asked the app to roll, one request per line ("Grukk's attack: 1d20+5"). */
  rolls: string[];
  /** Command lines of [[EDIT]] blocks the app could not read. Shown to the host, never dropped silently. */
  unreadableEdits: string[];
}

/**
 * Split a finished assistant reply into chat text, a full draft and/or small edits.
 * The last complete [[DRAFT]]…[[/DRAFT]] block wins. If a closing marker is missing
 * (the model ran out of room), everything after the opening marker is used.
 */
export function parseAssistantReply(raw: string): ParsedAssistantReply {
  let text = raw || '';
  let suggestions: string[] = [];
  let match: RegExpExecArray | null;
  NEXT_BLOCK_RE.lastIndex = 0;
  while ((match = NEXT_BLOCK_RE.exec(text)) !== null) suggestions = parseSuggestions(match[1]);
  text = text.replace(NEXT_BLOCK_RE, '');
  const nextOpen = text.search(NEXT_OPEN_RE);
  if (nextOpen !== -1) {
    // An unclosed list is always the last thing in a reply.
    if (!suggestions.length) suggestions = parseSuggestions(text.slice(nextOpen).replace(NEXT_OPEN_RE, ''));
    text = text.slice(0, nextOpen);
  }

  const rolls: string[] = [];
  ROLL_BLOCK_RE.lastIndex = 0;
  while ((match = ROLL_BLOCK_RE.exec(text)) !== null) {
    rolls.push(...stripFences(match[1]).split('\n').map(l => l.trim()).filter(Boolean));
  }
  text = text.replace(ROLL_BLOCK_RE, '');

  let takes: ParsedAssistantReply['takes'] = null;
  TAKES_BLOCK_RE.lastIndex = 0;
  while ((match = TAKES_BLOCK_RE.exec(text)) !== null) {
    const options = parseTakeOptions(match[2]);
    if (match[1] && options.length) takes = { paragraph: parseInt(match[1], 10), options };
  }
  text = text.replace(TAKES_BLOCK_RE, '');
  const takesOpen = text.search(TAKES_OPEN_RE);
  if (takesOpen !== -1) {
    // Unclosed (ran out of room): use what arrived.
    const head = /\[\[\s*TAKES\s*(?:¶|PARAGRAPH|PARA|P)?\s*#?\s*(\d+)?/i.exec(text.slice(takesOpen));
    const options = parseTakeOptions(text.slice(takesOpen).replace(TAKES_OPEN_RE, ''));
    if (!takes && head?.[1] && options.length) takes = { paragraph: parseInt(head[1], 10), options };
    text = text.slice(0, takesOpen);
  }

  let draftText: string | null = null;
  DRAFT_BLOCK_RE.lastIndex = 0;
  while ((match = DRAFT_BLOCK_RE.exec(text)) !== null) {
    draftText = stripFences(match[1]);
  }
  let chat = text.replace(DRAFT_BLOCK_RE, '');

  const edits: DraftEdit[] = [];
  const unreadableEdits: string[] = [];
  EDIT_BLOCK_RE.lastIndex = 0;
  while ((match = EDIT_BLOCK_RE.exec(chat)) !== null) {
    const edit = parseEditBlock(match[1]);
    if (edit) edits.push(edit);
    else unreadableEdits.push(editHeaderLine(match[1]) || '(empty edit)');
  }
  chat = chat.replace(EDIT_BLOCK_RE, '');

  const draftOpen = chat.search(DRAFT_OPEN_RE);
  if (draftOpen !== -1) {
    const rest = chat.slice(draftOpen).replace(DRAFT_OPEN_RE, '');
    if (draftText === null) draftText = stripFences(rest);
    chat = chat.slice(0, draftOpen);
  }
  const editOpen = chat.search(EDIT_OPEN_RE);
  if (editOpen !== -1) {
    const rawEdit = chat.slice(editOpen).replace(EDIT_OPEN_RE, '');
    const edit = parseEditBlock(rawEdit);
    if (edit) edits.push(edit);
    else if (rawEdit.trim()) unreadableEdits.push(editHeaderLine(rawEdit));
    chat = chat.slice(0, editOpen);
  }

  // Tidy fences left around a removed block.
  chat = chat.replace(/```[a-z]*\s*```/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  if (draftText !== null && !draftText.trim()) draftText = null;
  return { chatText: chat, draftText, edits, suggestions, takes, rolls, unreadableEdits };
}

/** What to show in the chat bubble while the reply is still streaming. */
export function visibleWhileStreaming(raw: string): { text: string; writingDraft: boolean } {
  let rest = raw || '';
  let shown = '';
  for (;;) {
    const open = rest.search(ANY_OPEN_RE);
    if (open === -1) { shown += rest; break; }
    shown += rest.slice(0, open);
    const after = rest.slice(open);
    const close = ANY_CLOSE_RE.exec(after);
    if (!close) return { text: shown.replace(/\n{3,}/g, '\n\n').trim(), writingDraft: true };
    rest = after.slice(close.index + close[0].length);
  }
  return { text: shown.replace(/\n{3,}/g, '\n\n').trim(), writingDraft: false };
}

// ─── The handoff (system prompt) ──────────────────────────────────────────────

const ASSISTANT_RULES = [
  'You are the Human DM Assistant for a live, play-by-post D&D 5e table. The HOST is the human Dungeon Master. You are their co-DM in a private side chat that the players never see. You never post to the table yourself: the host applies your draft when they are happy with it.',
  '',
  'YOUR JOB',
  '- Be a creative partner: bounce ideas around with the host, react to theirs, suggest twists, NPC motives and consequences, answer rules questions, and keep continuity.',
  '- Flag problems: a sealed line nobody answered, a player left out, a World Bible rule being broken.',
  '- The host is the DM. Their decisions override the World Bible, the story summary and your own ideas. If a request conflicts with the World Bible, do it and mention the conflict in one line.',
  '',
  'HOW TO TALK',
  '- Talk like a sharp co-DM sitting next to the host: plain, warm and brief. Usually 2 to 6 sentences. No preamble, no flattery, no headings.',
  '- When ideas help, give 2 or 3 concrete options in a short list, then stop. Ask one short question back when it would move things forward.',
  '- Never repeat the draft back in chat.',
  '- A host message that starts with a target like [¶3] or [W2] is about that part of the CURRENT DRAFT.',
  '',
  'ALTERNATE VERSIONS',
  'When the host asks for versions or alternatives of a paragraph, do not edit the draft. Reply with one short line, then the versions in one block, separated by a line containing only ---, usually 3 versions that differ in approach, not just wording:',
  '[[TAKES ¶3]]',
  '(version one)',
  '---',
  '(version two)',
  '---',
  '(version three)',
  '[[/TAKES]]',
  'The host keeps the one they like; the app puts it in the draft.',
  '',
  'DICE',
  'You cannot roll dice, and you must never invent or assume a roll result. When a DM or NPC roll would decide something (an attack, a save, a check, damage), ask the app to roll it with real dice, one roll per line as "Label: expression", then stop and wait:',
  '[[ROLL]]',
  "Grukk's attack on Kaelen: 1d20+5",
  'Grukk club damage: 2d8+3',
  '[[/ROLL]]',
  'Expressions: NdM+K, and "adv" or "dis" after a d20 for advantage or disadvantage. The app sends the results back in a message starting "Dice (rolled by the app):"; use them exactly. Player characters roll for themselves: ask them through ACTION roll requests in the draft, never here.',
  '',
  'TAP-TO-REPLY SUGGESTIONS',
  'End EVERY reply with 2 or 3 short replies the host is likely to want next, written as the host speaking (under 7 words each, no numbering), one per line, in this block:',
  '[[NEXT]]',
  'Go with option 2',
  'Make the ogre sympathetic',
  '[[/NEXT]]',
  'The host taps one instead of typing it, so make them specific to this moment, not generic. The block always comes last, after any draft or edit blocks.',
  '',
  'THE DRAFT',
  'The draft is the post the host will apply to the table. It is shown under CURRENT DRAFT, numbered: ¶1, ¶2… are story paragraphs, and W1, W2… are roll requests, tips and whispers. Whether you may change it is set by the MODE at the very end of these instructions.',
  '',
  'INSIDE THE DRAFT',
  '- Story text for the whole table, written as the DM. Answer every sealed line. Every player in the scene gets their moment, and the post ends with a clear prompt for what they do next.',
  '- Spoken dialogue: wrap each spoken line in [VOICE:Name]...[/VOICE] with the exact speaker\'s name. Only spoken words go inside; narration stays outside. Never nest these tags.',
  '- Roll requests: one ACTION block per roll, naming the character, the full skill or ability name, and the DC, for example:',
  '  <!--ACTION-->Kaelen: roll a DC 14 Dexterity saving throw<!--/ACTION-->',
  '  Use full names (Perception, Stealth, Dexterity saving throw) so the app\'s Roll button can auto-roll it. Everyone at the table sees ACTION blocks.',
  '- Private whisper to one player: <!--WHISPER:CharacterName-->text<!--/WHISPER:CharacterName--> using the exact character name from the roster. Only that player sees it.',
  '- Shared tactical tip: <!--TACTICS-->text<!--/TACTICS-->',
  '- Put all ACTION, WHISPER and TACTICS blocks after the story text.',
  '',
  'UPDATING THE APP THROUGH THE STORY',
  'Each player\'s sheet, the quest board and the world log update automatically by reading the STORY TEXT of the post. Whispers and ACTION blocks are not read for this. So when the host decides a mechanical outcome, state it plainly in the story text, naming the character and the exact number:',
  '- Damage and healing: "Kaelen takes 7 slashing damage." / "Mira regains 9 hit points."',
  '- XP and gold: "Each of you gains 150 XP." / "Thorne finds 40 gold pieces."',
  '- Items: "Mira picks up a Potion of Healing."',
  '- Conditions and rests: "Kaelen is poisoned." / "The party finishes a long rest."',
  '- Quests: offer, advance or complete them in plain words ("The guildmaster offers you a job: ...", "With the idol returned, the quest is complete.").',
  '- Major world changes: state them plainly ("The bridge at Varn collapses into the river.").',
  'Never add a mechanical change the host did not ask for. If you think one fits, suggest it in chat and wait for the host to agree.',
  '',
  'FACTS',
  '- Use only the PARTY ROSTER for character numbers. Never invent ability scores, HP, gear or gold.',
  '- If something is not in the context below, say you do not know or ask the host.',
  '',
  'CONTENT LIMITS (fixed)',
  'Adults only. Nothing sexual involving animals or characters in animal form. No real people. No slurs. Otherwise match the campaign\'s tone.',
].join('\n');

function rosterSection(roster: AssistantRosterMember[]): string {
  const lines = roster.map(m => {
    const s = (m.character_status || {}) as Record<string, any>;
    const bits = [
      `${m.character_name} — Level ${fmtNum(s.level)} ${s.className || 'Adventurer'}${s.race ? `, ${s.race}` : ''}`,
      `HP ${fmtNum(s.currentHP)}/${fmtNum(s.maxHP)}${typeof s.tempHP === 'number' && s.tempHP > 0 ? ` (+${s.tempHP} temp)` : ''}`,
    ];
    if (typeof s.ac === 'number') bits.push(`AC ${s.ac}`);
    if (s.currentHP === 0) bits.push('DOWN at 0 HP');
    if (Array.isArray(s.conditions) && s.conditions.length) bits.push(`Conditions: ${s.conditions.join(', ')}`);
    return `- ${bits.join(' | ')}`;
  });
  return capStart(lines.join('\n'), LIMITS.roster);
}

function questSection(quests: Quest[] = []): string {
  const open = quests.filter(q => q.status === 'active' || q.status === 'offered').slice(0, 12);
  if (!open.length) return '';
  return capStart(open.map(q => `- [${q.status}] ${questContextLine(q)}`).join('\n'), LIMITS.quests);
}

function worldSection(entries: WorldStateEntry[] = []): string {
  if (!entries.length) return '';
  const recent = entries.slice(-12);
  return capStart(recent.map(e => `- ${e.title}${e.consequence ? ` — ${e.consequence}` : ''}`).join('\n'), LIMITS.worldState);
}

function whisperLine(w: Whisper): string {
  if (w.type === 'action') return `[Roll request] ${w.content}`;
  if (w.type === 'tactics') return `[Tactics] ${w.content}`;
  return `[Whisper to ${w.target || '?'}] ${w.content}`;
}

/** The latest DM post, plus what the players did just before it. */
function latestStory(story: AssistantStoryMessage[]): { latest: string; before: string } {
  // Private player whispers never go to the assistant (host whisper visibility is an open decision).
  const visible = story.filter(m =>
    !(m.team || '').startsWith('whisper:') &&
    ((m.content || '').trim() !== '' || (m.whispers?.length ?? 0) > 0));
  let lastDm = -1;
  for (let i = visible.length - 1; i >= 0; i--) {
    if (visible[i].role === 'assistant') { lastDm = i; break; }
  }
  if (lastDm === -1) return { latest: '', before: '' };

  const post = visible[lastDm];
  const tips = (post.whispers || []).filter(w => !isDmBlueprintWhisper(w)).map(whisperLine);
  const latest = capEnd([post.content.trim(), ...tips].filter(Boolean).join('\n\n'), LIMITS.latestPost);

  const beforeLines: string[] = [];
  for (let i = lastDm - 1; i >= 0 && visible[i].role === 'user'; i--) {
    beforeLines.unshift(visible[i].content.trim());
  }
  return { latest, before: capEnd(beforeLines.join('\n'), LIMITS.beforeLatest) };
}

function tableSection(lines: AssistantTableLine[], sealedOrder: string[]): { table: string; sealed: string; sealedCount: number } {
  const rank = new Map(sealedOrder.map((id, i) => [id, i + 1]));
  const recent = lines.slice(-LIMITS.tableLines);
  const table = recent.map(l => {
    const text = capStart(cleanTableLine(l.content), LIMITS.tableLineChars).replace(/\n+/g, ' ');
    const tag = rank.has(l.id) ? `[SEALED #${rank.get(l.id)}]` : l.sent ? '[sent]' : '[open]';
    const who = l.inCharacter ? l.characterName : `${l.characterName} (table talk)`;
    return `${tag} ${who}: ${text}`;
  }).join('\n');

  const byId = new Map(lines.map(l => [l.id, l]));
  const sealedLines = sealedOrder.map(id => byId.get(id)).filter((l): l is AssistantTableLine => !!l);
  const sealed = sealedLines.map((l, i) => {
    const text = capStart(cleanTableLine(l.content), LIMITS.tableLineChars * 2);
    return `${i + 1}. ${l.inCharacter ? l.characterName : `${l.characterName} (table talk, out of character)`}: ${text}`;
  }).join('\n');
  return { table, sealed, sealedCount: sealedLines.length };
}

const MODE_RULES: Record<AssistantMode, string> = {
  brainstorm: [
    'MODE: BRAINSTORM',
    'Talk ideas through with the host. Do not write or change the draft in this mode: never output [[DRAFT]] or [[EDIT]] blocks, even if asked to change the draft. If the host asks for a change, discuss it and say they can switch to Draft mode to have you make it.',
    'You may quote a sentence or two as an example of how something could read.',
    'A suggestion that would write or change the draft must start with "Draft: ", e.g. "Draft: go with option 2". Tapping it switches to Draft mode.',
  ].join('\n'),
  draft: [
    'MODE: DRAFT',
    'You may write and change the draft. Always say in one short line what you did, BEFORE any block. If the request is unclear, ask instead of guessing.',
    '',
    'When there is no draft yet, or the host asks for a full rewrite, write the whole post in one block:',
    '[[DRAFT]]',
    '(the full post)',
    '[[/DRAFT]]',
    '',
    'Otherwise make the SMALLEST change that does what the host asked, with one [[EDIT]] block per change and never the whole draft. The first line of the block is the command; the new text follows on the next lines:',
    '[[EDIT]]',
    'REPLACE ¶3',
    '(the new text of paragraph 3)',
    '[[/EDIT]]',
    'Commands:',
    '- REPLACE ¶n  (new paragraph text follows; it may be more than one paragraph)',
    '- REPLACE ¶n-¶m  (replaces paragraphs n to m with the new text that follows)',
    '- INSERT AFTER ¶n  (new paragraph text follows; use ¶0 for the very start)',
    '- INSERT BEFORE ¶n  (new paragraph text follows)',
    '- DELETE ¶n  or  DELETE ¶n-¶m  (nothing follows)',
    '- MOVE ¶n AFTER ¶m  or  MOVE ¶n-¶k BEFORE ¶m  (nothing follows; use it to fix the order without retyping)',
    '- REPLACE Wn  (the full replacement tag block follows, e.g. <!--ACTION-->Kaelen: roll a DC 14 Perception check<!--/ACTION-->)',
    '- ADD W  (one or more new tag blocks follow)',
    '- DELETE Wn  (nothing follows)',
    'Numbers always refer to the CURRENT DRAFT exactly as shown above, even when you make several edits in one reply, and each paragraph may be changed by only one edit per reply. Put nothing on the command line except the command. Leave every part you were not asked to change exactly as it is.',
    'If the host edited the draft by hand, keep their edits unless they ask you to change them.',
    'Suggestions in this mode are follow-up changes, e.g. "Shorten ¶2" or "Add a Stealth roll for Mira".',
  ].join('\n'),
};

/** NPC rehearsal replaces the mode section: the assistant becomes the NPC. */
export function rehearsalRules(npc: string, cast: string[] = []): string {
  const others = cast.filter(n => n.toLowerCase() !== npc.toLowerCase());
  return [
    `MODE: NPC REHEARSAL WITH ${npc.toUpperCase()}`,
    ...(others.length ? [`This scene also has ${others.join(', ')}. Their earlier lines are marked [as Name] in the chat. ${npc} hears them and may react to them, but you speak ONLY as ${npc} this time; never write lines for ${others.join(' or ')}.`] : []),
    `The host is rehearsing dialogue with ${npc} to build natural lines for the scene. Reply ONLY as ${npc}, fully in character: what ${npc} says out loud, with at most one short action beat in *asterisks*. Usually under 70 words.`,
    `Host messages are what the party says or does to ${npc}; a message may name the speaker, e.g. "Kaelen: where is the pup?". Never speak or act for the party.`,
    `Stay consistent with everything the story, memory anchors and World Bible say about ${npc}: voice, knowledge, secrets and attitude. If ${npc} is new, give them a distinct voice that fits the scene. ${npc} only knows what they would plausibly know.`,
    'No out-of-character notes, no narration of the scene, no [[DRAFT]], [[EDIT]] or [[TAKES]] blocks. If a roll would decide something (lying, noticing, intimidating), you may ask for it in a [[ROLL]] block.',
    `End with a [[NEXT]] block of 2 or 3 short things the party might say to ${npc} next.`,
  ].join('\n');
}

export interface BuiltHandoff {
  systemPrompt: string;
  chars: number;
  sealedCount: number;
  /** True when the draft is longer than the assistant can read, so it can't see the end. */
  draftTrimmed: boolean;
}

/** Build the lean handoff the assistant reads on every message. */
export function buildAssistantSystemPrompt(
  ctx: AssistantLiveContext,
  bible: AssistantBible,
  draft: AssistantDraft,
  mode: AssistantMode = 'draft',
  extras: { persona?: AssistantPersona; npc?: string | null; cast?: string[] } = {},
): BuiltHandoff {
  const { latest, before } = latestStory(ctx.story || []);
  const numberedDraft = draftToNumberedText(draft);
  const { table, sealed, sealedCount } = tableSection(ctx.tableLines || [], ctx.sealedOrder || []);
  const bibleText = bible.mode === 'full'
    ? capStart(bible.text.trim(), LIMITS.fullGuides)
    : capStart(bible.text.trim(), LIMITS.digest);

  const sections: Array<[string, string]> = [
    [bible.mode === 'full' ? 'WORLD BIBLE (full guides)' : 'WORLD BIBLE (digest of the full guides)', bibleText],
    ['STORY SO FAR (running summary)', capEnd((ctx.campaignSummary || '').trim(), LIMITS.summary)],
    ['MEMORY ANCHORS', capStart((ctx.memoryAnchors || '').trim(), LIMITS.anchors)],
    ['OPEN QUESTS', questSection(ctx.quests)],
    ['WORLD STATE (recent major changes)', worldSection(ctx.worldState)],
    ['PARTY ROSTER', rosterSection(ctx.roster || [])],
    ['WHAT THE PLAYERS DID BEFORE THE LATEST POST', before],
    ['LATEST DM POST (the scene the players are answering)', latest],
    ['LIVE TABLE (recent lines, oldest first)', table],
    ['SEALED LINES TO ANSWER (in this order)', sealed || '(none sealed — the host may be writing without player lines)'],
    ['CURRENT DRAFT (numbered)', capStart(numberedDraft, LIMITS.draft) || '(empty: no draft yet)'],
  ];

  const body = sections
    .filter(([, text]) => text && text.trim())
    .map(([title, text]) => `=== ${title} ===\n${text}`)
    .join('\n\n');

  // The mode goes last, so the long, rarely-changing part of the brief stays identical between messages.
  const tail = extras.npc ? rehearsalRules(extras.npc, extras.cast ?? []) : MODE_RULES[mode];
  const personaLine = PERSONAS[extras.persona ?? 'default']?.line;
  const systemPrompt = `${ASSISTANT_RULES}\n\n${body}\n\n=== ${tail}${personaLine ? `\n\n${personaLine}` : ''}`;
  return { systemPrompt, chars: systemPrompt.length, sealedCount, draftTrimmed: numberedDraft.length > LIMITS.draft };
}

/** How one saved chat message is shown to the assistant later. */
function historyText(m: AssistantChatMessage): string {
  if (m.roll) return `Dice (rolled by the app): ${rollForAssistant(m.roll)}`;
  let text = m.text.trim();
  if (m.npc) text = m.role === 'assistant' ? `[as ${m.npc}] ${text}` : `[to ${m.npc}] ${text}`;
  if (m.role === 'assistant' && m.takes) {
    const kept = m.takes.kept !== undefined ? ` The host kept version ${m.takes.kept + 1}.` : '';
    text = `${text}\n(I offered ${m.takes.options.length} versions of ¶${m.takes.paragraph}.${kept})`;
  }
  if (m.role === 'assistant' && m.draftUpdated) text = `${text}\n(${m.draftNote || 'I updated the draft'}.)`;
  return text.trim();
}

export interface SessionMessages {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Oldest turns that did not fit under LIMITS.sessionChars (0 almost always). Shown on screen. */
  omittedTurns: number;
}

/**
 * The chat history sent to the model: the whole session since the last post,
 * text only, starting with the host, no two turns in a row from the same side.
 * Only a session past LIMITS.sessionChars loses its oldest turns, and that is counted.
 */
export function buildSessionMessages(
  history: AssistantChatMessage[],
  newHostText: string,
  maxChars: number = LIMITS.sessionChars,
): SessionMessages {
  const turns = [
    ...history.map(m => ({
      role: (m.role === 'host' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: historyText(m),
    })),
    { role: 'user' as const, content: newHostText.trim() },
  ].filter(t => t.content);

  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const t of turns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n\n${t.content}`;
    else merged.push({ ...t });
  }

  let kept = merged;
  let total = kept.reduce((n, t) => n + t.content.length, 0);
  while (kept.length > 1 && total > maxChars) {
    total -= kept[0].content.length;
    kept = kept.slice(1);
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept = kept.slice(1);
  return { messages: kept, omittedTurns: merged.length - kept.length };
}

/** The chat history as a plain list (the whole session that fits). */
export function buildAssistantMessages(
  history: AssistantChatMessage[],
  newHostText: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return buildSessionMessages(history, newHostText).messages;
}

// ─── Quick starts for the panel ───────────────────────────────────────────────

export interface QuickPrompt {
  label: string;
  text: string;
  /** Switch to this mode before sending. */
  mode?: AssistantMode;
}

export const BRAINSTORM_PROMPTS: QuickPrompt[] = [
  { label: 'Ideas for this', text: 'Give me 2 or 3 ideas for where this scene could go next, given the sealed lines.' },
  { label: 'What could go wrong?', text: 'What could go wrong for the party here? Give me 2 or 3 complications that fit the story.' },
  { label: 'NPC reactions', text: 'How would the NPCs in this scene react to what the players just did?' },
  { label: 'Check my draft', text: 'Check the current draft: did every sealed line get answered, does anything break the World Bible, and is anyone left out? Just tell me; do not change it.' },
  { label: 'Draft it', text: 'Write the full DM post answering the sealed lines, using what we talked about.', mode: 'draft' },
];

export const DRAFT_PROMPTS: QuickPrompt[] = [
  { label: 'Draft it', text: 'Write the full DM post answering the sealed lines, using what we talked about.' },
  { label: 'Add a roll', text: 'Add the roll request this moment calls for, with a fair DC, as a small edit.' },
  { label: 'Add a whisper', text: 'Add one private whisper for the player it would matter most to, as a small edit.' },
  { label: 'Tighten it', text: 'Tighten the draft with small edits: same events, fewer words, a stronger ending prompt.' },
];

export const TONE_PROMPTS: QuickPrompt[] = [
  { label: 'Darker', text: 'Make this darker.', mode: 'draft' },
  { label: 'Funnier', text: 'Make this funnier.', mode: 'draft' },
  { label: 'Tenser', text: 'Make this tenser.', mode: 'draft' },
  { label: 'Shorter', text: 'Make this shorter. Keep what matters.', mode: 'draft' },
  { label: 'More vivid', text: 'Make this more vivid and sensory.', mode: 'draft' },
];

export const VERSIONS_PROMPT = 'Give me 3 alternate versions of this paragraph.';

// ─── NPC dialogue into the draft ─────────────────────────────────────────────

/**
 * Turn one rehearsed NPC line into story text: spoken words get voice tags,
 * *action beats* become plain narration.
 */
const BEAT_SUBJECTS = new Set(['he', 'she', 'they', 'it', 'his', 'her', 'their', 'its', 'the', 'a', 'an', 'i', 'we']);

export function npcLineToStory(npc: string, line: string): string {
  const parts: string[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const speech = (raw: string) => {
    const words = raw.trim().replace(/^["“”]+|["“”]+$/g, '').trim();
    if (words) parts.push(`[VOICE:${npc}]"${words}"[/VOICE]`);
  };
  while ((m = re.exec(line)) !== null) {
    speech(line.slice(last, m.index));
    const beat = m[1].trim().replace(/[.!?]*$/, '');
    if (beat) {
      // "*plants his feet*" reads as "Grukk plants his feet."; "*He sighs*" stays as written.
      const first = beat.split(/\s+/)[0].toLowerCase();
      const needsName = /^[a-z]/.test(beat) && !BEAT_SUBJECTS.has(first);
      parts.push(needsName ? `${npc} ${beat}.` : `${beat.charAt(0).toUpperCase()}${beat.slice(1)}.`);
    }
    last = m.index + m[0].length;
  }
  speech(line.slice(last));
  return parts.join(' ');
}

/** The ask that weaves a rehearsed exchange into the draft. */
export function buildWeavePrompt(
  npc: string,
  exchange: Array<{ who: 'party' | 'npc'; text: string }>,
  afterParagraph: number | null,
): string {
  const lines = exchange.map(e => `${e.who === 'npc' ? npc : 'Party'}: ${e.text.trim()}`).join('\n');
  const place = afterParagraph !== null
    ? `Insert it after ¶${afterParagraph}.`
    : 'Put it where it fits best, or write the full post if there is no draft yet.';
  return [
    `Weave this rehearsed exchange with ${npc} into the draft as natural dialogue with light narration.`,
    `Keep ${npc}'s lines as written (trim if needed) inside voice tags. Players speak for their own characters at the table, so keep the party's side brief or turn it into narration.`,
    `${place} Use small edits.`,
    '',
    'EXCHANGE:',
    lines,
  ].join('\n');
}

/** Kept so the app still builds between update steps. The panel now uses BRAINSTORM_PROMPTS and DRAFT_PROMPTS. */
export const QUICK_PROMPTS: QuickPrompt[] = DRAFT_PROMPTS;
