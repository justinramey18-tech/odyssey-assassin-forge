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
//   - The host/assistant chat, text only (old drafts are never re-sent).
//
// Pure functions only (no network, no React) so this file can be unit tested.

import { DM_MODELS, DEFAULT_MODEL_ID, loadSelectedModel } from '@/lib/dm-models';
import { loadApiKey } from '@/lib/api-keys';
import { parseWhispers, isDmBlueprintWhisper, type Whisper } from '@/lib/whisper-parser';
import { questContextLine, type Quest, type WorldStateEntry } from '@/lib/quests';
import { stripActionCard } from '@/lib/roundChatActionCard';
import { parseReply } from '@/lib/chatReply';

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
  createdAt: string;
}

/** Brainstorm: talk only, the draft is never touched. Draft: the assistant may write or edit the draft. */
export type AssistantMode = 'brainstorm' | 'draft';

export interface AssistantDraft {
  narrative: string;
  whispers: Whisper[];
}

export const EMPTY_DRAFT: AssistantDraft = { narrative: '', whispers: [] };

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
  draft: 20_000,
  chatTurns: 16,
  chatChars: 24_000,
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

const MODE_KEY = 'odyssey-dm-assistant-mode';

export function loadAssistantMode(): AssistantMode {
  try { return localStorage.getItem(MODE_KEY) === 'draft' ? 'draft' : 'brainstorm'; } catch { return 'brainstorm'; }
}

export function saveAssistantMode(mode: AssistantMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
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

export function saveAssistantState(partyId: string | null, state: AssistantSavedState): void {
  if (!partyId) return;
  try {
    localStorage.setItem(stateKey(partyId), JSON.stringify({
      messages: state.messages.slice(-40),
      draft: state.draft,
    }));
  } catch { /* storage full or blocked: the chat still works this session */ }
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
const ANY_OPEN_RE = /\[\[\s*(?:DRAFT|EDIT)\s*\]\]/i;
const ANY_CLOSE_RE = /\[\[\s*\/\s*(?:DRAFT|EDIT)\s*\]\]/i;

/** One small change to the draft. Numbers are 1-based and refer to the draft as it was sent. */
export interface DraftEdit {
  op: 'replace' | 'insert' | 'delete' | 'add';
  target: 'paragraph' | 'whisper';
  /** Paragraph or whisper number. For insert, 0 means "at the very start". Null for add. */
  index: number | null;
  body: string;
  /** The command line as written, e.g. "REPLACE ¶3". */
  label: string;
}

export interface ParsedAssistantReply {
  /** The chat reply shown to the host. */
  chatText: string;
  /** Full new draft text, or null when this reply did not write a full draft. */
  draftText: string | null;
  /** Small edits, in the order written. Ignored when a full draft is present. */
  edits: DraftEdit[];
}

function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim();
}

const EDIT_HEADER_RE = /^(REPLACE|INSERT\s+AFTER|INSERT|DELETE|REMOVE|ADD)\s*(¶|PARAGRAPH|PARA|P|W(?:HISPER)?)?\s*#?\s*(\d+)?\s*:?\s*$/i;

/** Read one [[EDIT]] block. Returns null when the command line can't be understood. */
export function parseEditBlock(raw: string): DraftEdit | null {
  const text = stripFences(raw);
  const nl = text.indexOf('\n');
  const header = (nl === -1 ? text : text.slice(0, nl)).trim().replace(/^[*_`]+|[*_`]+$/g, '');
  const body = (nl === -1 ? '' : text.slice(nl + 1)).trim();
  const m = EDIT_HEADER_RE.exec(header);
  if (!m) return null;
  const verb = m[1].toUpperCase().replace(/\s+/g, ' ');
  const kind = (m[2] || '').toUpperCase();
  const target: DraftEdit['target'] = kind.startsWith('W') ? 'whisper' : 'paragraph';
  const index = m[3] !== undefined ? parseInt(m[3], 10) : null;
  let op: DraftEdit['op'];
  if (verb === 'REPLACE') op = 'replace';
  else if (verb === 'DELETE' || verb === 'REMOVE') op = 'delete';
  else if (verb === 'ADD') op = 'add';
  else op = 'insert';
  if (op === 'add' && target === 'paragraph') { op = 'insert'; }
  if ((op === 'replace' || op === 'delete') && (index === null || index < 1)) return null;
  if (op === 'insert' && target === 'paragraph' && index === null) return null;
  if ((op === 'replace' || op === 'insert' || op === 'add') && !body) return null;
  return { op, target, index, body, label: header };
}

/**
 * Split a finished assistant reply into chat text, a full draft and/or small edits.
 * The last complete [[DRAFT]]…[[/DRAFT]] block wins. If a closing marker is missing
 * (the model ran out of room), everything after the opening marker is used.
 */
export function parseAssistantReply(raw: string): ParsedAssistantReply {
  const text = raw || '';
  let draftText: string | null = null;
  let match: RegExpExecArray | null;
  DRAFT_BLOCK_RE.lastIndex = 0;
  while ((match = DRAFT_BLOCK_RE.exec(text)) !== null) {
    draftText = stripFences(match[1]);
  }
  let chat = text.replace(DRAFT_BLOCK_RE, '');

  const edits: DraftEdit[] = [];
  EDIT_BLOCK_RE.lastIndex = 0;
  while ((match = EDIT_BLOCK_RE.exec(chat)) !== null) {
    const edit = parseEditBlock(match[1]);
    if (edit) edits.push(edit);
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
    const edit = parseEditBlock(chat.slice(editOpen).replace(EDIT_OPEN_RE, ''));
    if (edit) edits.push(edit);
    chat = chat.slice(0, editOpen);
  }

  // Tidy fences left around a removed block.
  chat = chat.replace(/```[a-z]*\s*```/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  if (draftText !== null && !draftText.trim()) draftText = null;
  return { chatText: chat, draftText, edits };
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

// ─── Numbered draft and small edits ──────────────────────────────────────────

/** Paragraphs are separated by a blank line. */
export function splitParagraphs(narrative: string): string[] {
  return (narrative || '').split(/\n[ \t]*\n/).map(p => p.trim()).filter(Boolean);
}

export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.map(p => p.trim()).filter(Boolean).join('\n\n');
}

function whisperToTag(w: Whisper): string {
  if (w.type === 'action') return `<!--ACTION-->${w.content.trim()}<!--/ACTION-->`;
  if (w.type === 'tactics') return `<!--TACTICS-->${w.content.trim()}<!--/TACTICS-->`;
  const target = w.target?.trim() || 'Unknown';
  return `<!--WHISPER:${target}-->${w.content.trim()}<!--/WHISPER:${target}-->`;
}

/** The draft as the assistant sees it: ¶1, ¶2… for story paragraphs and W1, W2… for rolls, tips and whispers. */
export function draftToNumberedText(draft: AssistantDraft): string {
  const paras = splitParagraphs(draft.narrative).map((p, i) => `¶${i + 1} ${p}`);
  const tags = draft.whispers.filter(w => w.content.trim()).map((w, i) => `W${i + 1} ${whisperToTag(w)}`);
  return [...paras, ...tags].join('\n\n');
}

/** Plain description of an edit for the chat, e.g. "¶3", "removed W1", "added a paragraph after ¶2". */
export function describeEdit(e: DraftEdit): string {
  const ref = `${e.target === 'paragraph' ? '¶' : 'W'}${e.index ?? ''}`;
  if (e.op === 'replace') return ref;
  if (e.op === 'delete') return `removed ${ref}`;
  if (e.target === 'paragraph') return e.index === 0 ? 'added an opening paragraph' : `added a paragraph after ${ref}`;
  return 'added a roll or whisper';
}

export interface AppliedEdits {
  draft: AssistantDraft;
  /** 0-based positions in the NEW draft that were added or changed, to highlight. */
  changedParagraphs: number[];
  changedWhispers: number[];
  /** Edits that could not be applied (bad number), described in plain words. */
  skipped: string[];
  /** Edits that were applied, described in plain words. */
  applied: string[];
}

/** Rebuild a list from per-position replacements and insertions (all 1-based on the original list). */
function rebuild<T>(
  original: T[],
  replace: Map<number, T[] | null>,
  insertAfter: Map<number, T[]>,
): { items: T[]; changed: number[] } {
  const items: T[] = [];
  const changed: number[] = [];
  for (let i = 0; i <= original.length; i++) {
    if (i > 0) {
      const r = replace.get(i);
      if (r === undefined) items.push(original[i - 1]);
      else if (r !== null) for (const x of r) { changed.push(items.length); items.push(x); }
    }
    for (const x of insertAfter.get(i) || []) { changed.push(items.length); items.push(x); }
  }
  return { items, changed };
}

/**
 * Apply small edits to the draft. Every number refers to the draft as it was
 * sent, so several edits in one reply never shift each other's targets.
 */
export function applyDraftEdits(draft: AssistantDraft, edits: DraftEdit[]): AppliedEdits {
  const paras = splitParagraphs(draft.narrative);
  const whispers = draft.whispers.filter(w => w.content.trim());
  const pReplace = new Map<number, string[] | null>();
  const pInsert = new Map<number, string[]>();
  const wReplace = new Map<number, Whisper[] | null>();
  const wInsert = new Map<number, Whisper[]>();
  const skipped: string[] = [];
  const applied: string[] = [];
  const push = <T,>(map: Map<number, T[]>, key: number, items: T[]) => map.set(key, [...(map.get(key) || []), ...items]);

  for (const e of edits) {
    if (e.target === 'paragraph') {
      if (e.op === 'delete') {
        if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
        pReplace.set(e.index!, null);
      } else {
        // A paragraph body may carry roll or whisper tags; those become whisper cards.
        const parsed = parseWhispers(e.body);
        const newParas = splitParagraphs(parsed.narrative);
        if (e.op === 'replace') {
          if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
          pReplace.set(e.index!, newParas);
        } else {
          if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
          if (!newParas.length && !parsed.whispers.length) { skipped.push(describeEdit(e)); continue; }
          push(pInsert, e.index!, newParas);
        }
        if (parsed.whispers.length) push(wInsert, whispers.length, parsed.whispers);
      }
    } else {
      if (e.op === 'delete') {
        if (e.index! > whispers.length) { skipped.push(describeEdit(e)); continue; }
        wReplace.set(e.index!, null);
      } else {
        const found = parseWhispers(e.body).whispers;
        if (!found.length) { skipped.push(describeEdit(e)); continue; }
        if (e.op === 'replace') {
          if (e.index! > whispers.length) { skipped.push(describeEdit(e)); continue; }
          wReplace.set(e.index!, found);
        } else {
          const after = e.op === 'insert' && e.index !== null ? e.index : whispers.length;
          if (after > whispers.length) { skipped.push(describeEdit(e)); continue; }
          push(wInsert, after, found);
        }
      }
    }
    applied.push(describeEdit(e));
  }

  const p = rebuild(paras, pReplace, pInsert);
  const w = rebuild(whispers, wReplace, wInsert);
  return {
    draft: { narrative: joinParagraphs(p.items), whispers: w.items },
    changedParagraphs: p.changed,
    changedWhispers: w.changed,
    skipped,
    applied,
  };
}

/** Turn draft text into the editor's story + whisper cards (same parser the table uses). */
export function draftFromText(text: string): AssistantDraft {
  const { narrative, whispers } = parseWhispers(text || '');
  return { narrative, whispers };
}

/** Draft as the assistant should see it (the same format it writes). */
export function draftToText(draft: AssistantDraft): string {
  const blocks = draft.whispers
    .filter(w => w.content.trim())
    .map(whisperToTag);
  return [draft.narrative.trim(), ...blocks].filter(Boolean).join('\n\n');
}

export function draftIsEmpty(draft: AssistantDraft): boolean {
  return !draft.narrative.trim();
}

export function draftCounts(draft: AssistantDraft): { rolls: number; whispers: number; tactics: number } {
  return {
    rolls: draft.whispers.filter(w => w.type === 'action' && w.content.trim()).length,
    whispers: draft.whispers.filter(w => w.type === 'whisper' && w.content.trim()).length,
    tactics: draft.whispers.filter(w => w.type === 'tactics' && w.content.trim()).length,
  };
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
    '- INSERT AFTER ¶n  (new paragraph text follows; use ¶0 for the very start)',
    '- DELETE ¶n  (nothing follows)',
    '- REPLACE Wn  (the full replacement tag block follows, e.g. <!--ACTION-->Kaelen: roll a DC 14 Perception check<!--/ACTION-->)',
    '- ADD W  (one or more new tag blocks follow)',
    '- DELETE Wn  (nothing follows)',
    'Numbers always refer to the CURRENT DRAFT exactly as shown above, even when you make several edits in one reply. Leave every part you were not asked to change exactly as it is.',
    'If the host edited the draft by hand, keep their edits unless they ask you to change them.',
  ].join('\n'),
};

export interface BuiltHandoff {
  systemPrompt: string;
  chars: number;
  sealedCount: number;
}

/** Build the lean handoff the assistant reads on every message. */
export function buildAssistantSystemPrompt(
  ctx: AssistantLiveContext,
  bible: AssistantBible,
  draft: AssistantDraft,
  mode: AssistantMode = 'draft',
): BuiltHandoff {
  const { latest, before } = latestStory(ctx.story || []);
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
    ['CURRENT DRAFT (numbered)', capStart(draftToNumberedText(draft), LIMITS.draft) || '(empty: no draft yet)'],
  ];

  const body = sections
    .filter(([, text]) => text && text.trim())
    .map(([title, text]) => `=== ${title} ===\n${text}`)
    .join('\n\n');

  // The mode goes last, so the long, rarely-changing part of the brief stays identical between messages.
  const systemPrompt = `${ASSISTANT_RULES}\n\n${body}\n\n=== ${MODE_RULES[mode]}`;
  return { systemPrompt, chars: systemPrompt.length, sealedCount };
}

/**
 * The chat history sent to the model: text only, newest turns, starting with
 * the host, no two turns in a row from the same side.
 */
export function buildAssistantMessages(
  history: AssistantChatMessage[],
  newHostText: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns = [
    ...history.map(m => ({
      role: (m.role === 'host' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.role === 'assistant' && m.draftUpdated
        ? `${m.text.trim()}\n(${m.draftNote || 'I updated the draft'}.)`.trim()
        : m.text.trim(),
    })),
    { role: 'user' as const, content: newHostText.trim() },
  ].filter(t => t.content);

  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const t of turns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n\n${t.content}`;
    else merged.push({ ...t });
  }

  let kept = merged.slice(-LIMITS.chatTurns);
  while (kept.length > 1 && kept.reduce((n, t) => n + t.content.length, 0) > LIMITS.chatChars) {
    kept = kept.slice(1);
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept = kept.slice(1);
  return kept;
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

/** Kept so the app still builds between update steps. The panel now uses BRAINSTORM_PROMPTS and DRAFT_PROMPTS. */
export const QUICK_PROMPTS: QuickPrompt[] = DRAFT_PROMPTS;
