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
  /** True when this assistant turn produced a new draft. */
  draftUpdated?: boolean;
  createdAt: string;
}

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

export interface ParsedAssistantReply {
  /** The chat reply shown to the host. */
  chatText: string;
  /** Full new draft text, or null when this reply did not change the draft. */
  draftText: string | null;
}

function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim();
}

/**
 * Split a finished assistant reply into chat text and draft.
 * The last complete [[DRAFT]]…[[/DRAFT]] block wins. If the closing marker is
 * missing (the model ran out of room), everything after [[DRAFT]] is the draft.
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

  const open = chat.search(DRAFT_OPEN_RE);
  if (open !== -1) {
    const rest = chat.slice(open).replace(DRAFT_OPEN_RE, '');
    if (draftText === null) draftText = stripFences(rest);
    chat = chat.slice(0, open);
  }

  // Tidy fences left around a removed block.
  chat = chat.replace(/```[a-z]*\s*```/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  if (draftText !== null && !draftText.trim()) draftText = null;
  return { chatText: chat, draftText };
}

/** What to show in the chat bubble while the reply is still streaming. */
export function visibleWhileStreaming(raw: string): { text: string; writingDraft: boolean } {
  const text = raw || '';
  const open = text.search(DRAFT_OPEN_RE);
  if (open === -1) return { text: text.trim(), writingDraft: false };
  const afterOpen = text.slice(open);
  const closed = /\[\[\s*\/\s*DRAFT\s*\]\]/i.exec(afterOpen);
  if (!closed) return { text: text.slice(0, open).trim(), writingDraft: true };
  const after = afterOpen.slice(closed.index + closed[0].length);
  return { text: `${text.slice(0, open)}${after}`.replace(/\n{3,}/g, '\n\n').trim(), writingDraft: false };
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
    .map(w => {
      if (w.type === 'action') return `<!--ACTION-->${w.content.trim()}<!--/ACTION-->`;
      if (w.type === 'tactics') return `<!--TACTICS-->${w.content.trim()}<!--/TACTICS-->`;
      const target = w.target?.trim() || 'Unknown';
      return `<!--WHISPER:${target}-->${w.content.trim()}<!--/WHISPER:${target}-->`;
    });
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
  '- Help the host build the best possible DM post: narration, NPC dialogue, consequences, roll requests and private whispers.',
  '- Answer rules questions, offer options, keep continuity, and flag problems: a sealed line nobody answered, a player left out, a World Bible rule being broken.',
  '- The host is the DM. Their decisions override the World Bible, the story summary and your own ideas. If a request conflicts with the World Bible, do it and mention the conflict in one line.',
  '- In chat be brief and direct, like a sharp co-DM. No preamble, no flattery.',
  '',
  'THE DRAFT',
  'The draft is the post the host will apply to the table. It is shown under CURRENT DRAFT.',
  'Whenever you create or change it, write the COMPLETE new draft (never a partial edit) between these markers, each on its own line:',
  '[[DRAFT]]',
  '(the full post)',
  '[[/DRAFT]]',
  '- Only include a draft block when the host asks for a draft or for a change to it. When you only answer a question, leave it out.',
  '- Put your short chat reply BEFORE the draft block. Never put chat inside the block.',
  '- If the host edited the draft by hand, keep their edits unless they ask you to change them.',
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

export interface BuiltHandoff {
  systemPrompt: string;
  chars: number;
  sealedCount: number;
}

/** Build the lean handoff the assistant reads on every message. */
export function buildAssistantSystemPrompt(ctx: AssistantLiveContext, bible: AssistantBible, draft: AssistantDraft): BuiltHandoff {
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
    ['CURRENT DRAFT', capStart(draftToText(draft), LIMITS.draft) || '(empty)'],
  ];

  const body = sections
    .filter(([, text]) => text && text.trim())
    .map(([title, text]) => `=== ${title} ===\n${text}`)
    .join('\n\n');

  const systemPrompt = `${ASSISTANT_RULES}\n\n${body}`;
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
        ? `${m.text.trim()}\n(I updated the draft.)`.trim()
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

export const QUICK_PROMPTS: Array<{ label: string; text: string }> = [
  { label: 'Draft a response', text: 'Draft a full DM post answering the sealed lines.' },
  { label: 'Ask for a roll', text: 'Add the roll requests this moment calls for, with fair DCs, and tell me why.' },
  { label: 'Add a whisper', text: 'Suggest a private whisper for one player that would deepen the scene.' },
  { label: 'Check it', text: 'Check the current draft: did every sealed line get answered, does anything break the World Bible, and is anyone left out?' },
  { label: 'Tighten it', text: 'Tighten the draft: same events, fewer words, stronger ending prompt.' },
];
