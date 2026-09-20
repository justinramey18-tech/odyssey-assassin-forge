/**
 * Strips markdown syntax from text for cleaner TTS narration.
 * Preserves quoted dialogue and converts list items to natural pauses.
 */
export function stripMarkdownForTTS(text: string): string {
  let result = text;

  // ── Strip AI DM HUD footers (run first, before markdown processing) ──

  // 1. Truncate at first ═══ separator line (narrative is always above the HUD)
  result = result.replace(/^[═]{3,}.*[\s\S]*$/m, '');

  // 2. Fallback: strip bracketed HUD section headers and everything after
  result = result.replace(/^\[(?:QUEST HUD|PARTY STATUS|COMBAT LOG|LOOT|INVENTORY|MAP|STATUS|WORLD STATE)\][\s\S]*$/gim, '');

  // 3. Remove decorative Unicode divider lines
  result = result.replace(/^[═─▬╔╗╚╝╠╣║│┌┐└┘├┤┬┴┼]{3,}.*$/gm, '');

  // 4. Strip emoji-prefix status lines (► Current Objective:, • Atlas HP, etc.)
  result = result.replace(/^[►▶•●⚔🗡️🛡️⚡💀🎯📍🗺️☠️✦✧◆◇■□▪▫]\s*.+$/gm, '');

  // Remove headers (# ## ### etc.)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic markers but keep content
  result = result.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  result = result.replace(/\*\*(.*?)\*\*/g, '$1');
  result = result.replace(/\*(.*?)\*/g, '$1');
  result = result.replace(/__(.*?)__/g, '$1');
  result = result.replace(/_(.*?)_/g, '$1');

  // Remove inline code
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');

  // Remove horizontal rules
  result = result.replace(/^---+$/gm, '');
  result = result.replace(/^\*\*\*+$/gm, '');

  // Convert blockquotes — preserve the text
  result = result.replace(/^>\s*/gm, '');

  // Convert list items to sentences (natural pauses)
  result = result.replace(/^[-*+]\s+/gm, '');
  result = result.replace(/^\d+\.\s+/gm, '');

  // Remove links — keep display text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Collapse multiple newlines into pauses
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim
  result = result.trim();

  return result;
}

/**
 * Splits text at paragraph boundaries for request stitching.
 * Each chunk is kept under maxChars.
 */
export function splitTextForStitching(text: string, maxChars: number = 5000): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// Voice cache helpers
const VOICE_CACHE_KEY = 'dnd-elevenlabs-voices-cache';
const VOICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface CachedVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string | null;
}

interface VoiceCacheData {
  voices: CachedVoice[];
  timestamp: number;
}

export function getCachedVoices(): CachedVoice[] | null {
  try {
    const raw = localStorage.getItem(VOICE_CACHE_KEY);
    if (!raw) return null;
    const data: VoiceCacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > VOICE_CACHE_TTL) {
      localStorage.removeItem(VOICE_CACHE_KEY);
      return null;
    }
    return data.voices;
  } catch {
    return null;
  }
}

export function setCachedVoices(voices: CachedVoice[]): void {
  try {
    const data: VoiceCacheData = { voices, timestamp: Date.now() };
    localStorage.setItem(VOICE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// Voice tuning settings persistence
const VOICE_SETTINGS_KEY = 'dnd-elevenlabs-voice-settings';

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
};

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      stability: typeof parsed.stability === 'number' ? parsed.stability : DEFAULT_VOICE_SETTINGS.stability,
      similarity_boost: typeof parsed.similarity_boost === 'number' ? parsed.similarity_boost : DEFAULT_VOICE_SETTINGS.similarity_boost,
      style: typeof parsed.style === 'number' ? parsed.style : DEFAULT_VOICE_SETTINGS.style,
      use_speaker_boost: typeof parsed.use_speaker_boost === 'boolean' ? parsed.use_speaker_boost : DEFAULT_VOICE_SETTINGS.use_speaker_boost,
    };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// Selected voice persistence
const VOICE_ID_KEY = 'dnd-elevenlabs-voice-id';

// Narration speed persistence
const NARRATION_SPEED_KEY = 'dnd-elevenlabs-narration-speed';
const DEFAULT_NARRATION_SPEED = 1.0;

export function loadNarrationSpeed(): number {
  try {
    const raw = localStorage.getItem(NARRATION_SPEED_KEY);
    if (!raw) return DEFAULT_NARRATION_SPEED;
    const speed = parseFloat(raw);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) return DEFAULT_NARRATION_SPEED;
    return speed;
  } catch {
    return DEFAULT_NARRATION_SPEED;
  }
}

export function saveNarrationSpeed(speed: number): void {
  try {
    const clamped = Math.min(2.0, Math.max(0.5, speed));
    localStorage.setItem(NARRATION_SPEED_KEY, clamped.toString());
  } catch {
    // ignore
  }
}

export function loadSelectedVoiceId(): string | null {
  try {
    return localStorage.getItem(VOICE_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function saveSelectedVoiceId(voiceId: string): void {
  try {
    localStorage.setItem(VOICE_ID_KEY, voiceId);
  } catch {
    // ignore
  }
}

// ── TTS Provider Selection ──────────────────────────────────────────────────

export type TTSProvider = 'elevenlabs' | 'speechify';

const TTS_PROVIDER_KEY = 'dnd-tts-provider';

export function loadTTSProvider(): TTSProvider {
  try {
    const raw = localStorage.getItem(TTS_PROVIDER_KEY);
    if (raw === 'speechify') return 'speechify';
    return 'elevenlabs';
  } catch {
    return 'elevenlabs';
  }
}

export function saveTTSProvider(provider: TTSProvider): void {
  try {
    localStorage.setItem(TTS_PROVIDER_KEY, provider);
  } catch {
    // ignore
  }
}

// Speechify voice persistence
const SPEECHIFY_VOICE_KEY = 'dnd-speechify-voice-id';

export function loadSpeechifyVoiceId(): string {
  try {
    return localStorage.getItem(SPEECHIFY_VOICE_KEY) || 'george';
  } catch {
    return 'george';
  }
}

export function saveSpeechifyVoiceId(voiceId: string): void {
  try {
    localStorage.setItem(SPEECHIFY_VOICE_KEY, voiceId);
  } catch {
    // ignore
  }
}

// ── Speechify voice cache ───────────────────────────────────────────────────
const SPEECHIFY_VOICE_CACHE_KEY = 'dnd-speechify-voices-cache';
const SPEECHIFY_VOICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface CachedSpeechifyVoice {
  id: string;
  name: string;
  type: string; // "cloned" | "default" | etc.
}

interface SpeechifyVoiceCacheData {
  voices: CachedSpeechifyVoice[];
  timestamp: number;
}

export function getCachedSpeechifyVoices(): CachedSpeechifyVoice[] | null {
  try {
    const raw = localStorage.getItem(SPEECHIFY_VOICE_CACHE_KEY);
    if (!raw) return null;
    const data: SpeechifyVoiceCacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > SPEECHIFY_VOICE_CACHE_TTL) {
      localStorage.removeItem(SPEECHIFY_VOICE_CACHE_KEY);
      return null;
    }
    return data.voices;
  } catch {
    return null;
  }
}

export function setCachedSpeechifyVoices(voices: CachedSpeechifyVoice[]): void {
  try {
    const data: SpeechifyVoiceCacheData = { voices, timestamp: Date.now() };
    localStorage.setItem(SPEECHIFY_VOICE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ── DM (table-talk) voice ───────────────────────────────────────────────────
// The DM's out-of-character aside can be voiced with a different Speechify
// voice than the story narration.
const SPEECHIFY_DM_VOICE_KEY = 'dnd-speechify-dm-voice-id';

export function loadSpeechifyDMVoiceId(): string {
  try {
    return localStorage.getItem(SPEECHIFY_DM_VOICE_KEY) || loadSpeechifyVoiceId();
  } catch {
    return loadSpeechifyVoiceId();
  }
}

export function saveSpeechifyDMVoiceId(voiceId: string): void {
  try {
    localStorage.setItem(SPEECHIFY_DM_VOICE_KEY, voiceId);
  } catch {
    // ignore
  }
}

export function hasSpeechifyDMVoice(): boolean {
  try {
    return !!localStorage.getItem(SPEECHIFY_DM_VOICE_KEY);
  } catch {
    return false;
  }
}

// ── Table talk vs story split ───────────────────────────────────────────────
const TABLE_TALK_BLOCK = /\[TABLE(?:\s*TALK)?\]([\s\S]*?)\[\/TABLE(?:\s*TALK)?\]/i;

/** Matches a standalone heading line like "## TABLE TALK", "**Table Talk**", "TABLE TALK:". */
const TABLE_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:table\s*talk|dm\s*aside|ooc)\s*(?:\*\*|__)?\s*:?\s*$/i;
const STORY_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:in\s*character|story|narration|scene|ic)\s*(?:\*\*|__)?\s*:?\s*$/i;

/** Splits on "TABLE TALK" / "IN CHARACTER" style section headings. */
function splitByHeadings(raw: string): { tableTalk: string; story: string } | null {
  const lines = raw.split('\n');
  const tableStart = lines.findIndex((l) => TABLE_HEADING.test(l));
  if (tableStart === -1) return null;
  let storyStart = -1;
  for (let i = tableStart + 1; i < lines.length; i++) {
    if (STORY_HEADING.test(lines[i])) { storyStart = i; break; }
  }
  const tableTalk = lines
    .slice(tableStart + 1, storyStart === -1 ? lines.length : storyStart)
    .join('\n')
    .trim();
  if (!tableTalk) return null;
  const before = lines.slice(0, tableStart).join('\n').trim();
  const after = storyStart === -1 ? '' : lines.slice(storyStart + 1).join('\n').trim();
  const story = [before, after].filter(Boolean).join('\n\n').trim();
  return { tableTalk, story };
}


/**
 * Splits a DM response into the out-of-character aside to the table and the
 * in-fiction story narration. The AI is asked to wrap its aside in
 * [TABLE]...[/TABLE]; a couple of plain-text fallbacks are handled too.
 */
export function splitDMResponseParts(text: string): { tableTalk: string; story: string } {
  const raw = text || '';

  const tagged = raw.match(TABLE_TALK_BLOCK);
  if (tagged) {
    return {
      tableTalk: (tagged[1] || '').trim(),
      story: raw.replace(TABLE_TALK_BLOCK, '').trim(),
    };
  }

  // Fallback: heading-style sections, e.g. "## TABLE TALK" ... "## IN CHARACTER".
  const headingSplit = splitByHeadings(raw);
  if (headingSplit) return headingSplit;

  // Fallback: a leading "OOC:" / "Table talk:" line block before the story.

  const lines = raw.split('\n');
  const aside: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { if (aside.length) break; i++; continue; }
    if (/^\s*(?:\*\*)?(?:OOC|Table\s*talk|DM\s*aside)\s*:?(?:\*\*)?\s*/i.test(line)) {
      aside.push(line.replace(/^\s*(?:\*\*)?(?:OOC|Table\s*talk|DM\s*aside)\s*:?(?:\*\*)?\s*/i, '').trim());
      i++;
      continue;
    }
    break;
  }
  if (aside.length) {
    return { tableTalk: aside.join(' ').trim(), story: lines.slice(i).join('\n').trim() };
  }

  return { tableTalk: '', story: raw.trim() };
}

/** Removes the [TABLE] and [VOICE:...] markers while keeping the words, for display. */
export function stripTableTalkTags(text: string): string {
  return (text || '')
    .replace(/\[\/?TABLE(?:\s*TALK)?\]/gi, '')
    .replace(/\[VOICE:[^\]]{0,40}\]/gi, '')
    .replace(/\[\/VOICE\]/gi, '');
}

// ── Character voice cast ────────────────────────────────────────────────────

const VOICE_CAST_KEY = 'dnd-speechify-voice-cast';

export interface VoiceCastEntry {
  /** Character / NPC name as written in DM responses. */
  name: string;
  /** Speechify voice id used for that speaker. */
  voiceId: string;
}

export function loadVoiceCast(): VoiceCastEntry[] {
  try {
    const raw = localStorage.getItem(VOICE_CAST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: any) => e && typeof e.name === 'string' && typeof e.voiceId === 'string' && e.name.trim() && e.voiceId.trim())
      .map((e: any) => ({ name: String(e.name).trim(), voiceId: String(e.voiceId).trim() }));
  } catch {
    return [];
  }
}

/** Fired on window whenever the character voice cast is written. */
export const VOICE_CAST_EVENT = 'odyssey-voice-cast';

export function saveVoiceCast(cast: VoiceCastEntry[]): void {
  try {
    localStorage.setItem(VOICE_CAST_KEY, JSON.stringify(cast));
  } catch { /* ignore */ }
  // Tell every mounted component that the cast changed. Without this, screens
  // that read the cast once (the passage voice picker) keep showing a stale
  // list until a full page reload.
  try {
    window.dispatchEvent(new CustomEvent(VOICE_CAST_EVENT));
  } catch { /* ignore */ }
}

/**
 * Subscribes to voice-cast changes. Returns an unsubscribe function, so it can
 * be returned directly from a useEffect.
 * Also listens to the native 'storage' event so a change made in another tab
 * or window is picked up too.
 */
export function subscribeVoiceCast(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => { /* no-op on server */ };
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === VOICE_CAST_KEY) onChange();
  };
  window.addEventListener(VOICE_CAST_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(VOICE_CAST_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Looks up a cast voice by speaker name (case/spacing tolerant). */
export function voiceForSpeaker(name: string): string | null {
  const needle = (name || '').trim().toLowerCase();
  if (!needle) return null;
  const cast = loadVoiceCast();
  const exact = cast.find((e) => e.name.trim().toLowerCase() === needle);
  if (exact) return exact.voiceId;
  const partial = cast.find((e) => {
    const n = e.name.trim().toLowerCase();
    return n.length > 2 && (needle.includes(n) || n.includes(needle));
  });
  return partial ? partial.voiceId : null;
}

// ── Speaker-tagged story segments ───────────────────────────────────────────

const VOICE_BLOCK = /\[VOICE:\s*([^\]]{1,40}?)\s*\]([\s\S]*?)(?:\[\/VOICE\]|(?=\[VOICE:)|$)/gi;

export interface NarrationSegment {
  /** null = narrator (untagged prose). */
  speaker: string | null;
  text: string;
  /** Forced voice (manual highlight override). Wins over the cast lookup. */
  voiceId?: string | null;
  /** True when the player hand-picked this passage's voice. */
  manual?: boolean;
  /**
   * Index of the source paragraph this piece came from. Narrator pieces are
   * only merged together when they share one. Deliberately NOT part of
   * segmentKey, so a clip's id depends on its text alone.
   */
  para?: number;
  /**
   * 1-based count of how many identical pieces came before this one in the
   * same message. The first keeps the plain hash (so existing clips still
   * match); later duplicates get a "-2", "-3"… suffix so every row has its
   * own id.
   */
  occurrence?: number;
}

/** Removes [VOICE:...] markers while keeping the words, for on-screen display. */
export function stripVoiceTags(text: string): string {
  return (text || '').replace(/\[VOICE:[^\]]{0,40}\]/gi, '').replace(/\[\/VOICE\]/gi, '');
}

/** Stable id for a segment, derived from its words so clips survive re-splits. */
export function segmentKey(seg: NarrationSegment): string {
  const basis = `${seg.speaker || ''}|${seg.voiceId || ''}|${(seg.text || '').replace(/\s+/g, ' ').trim()}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h * 33) ^ basis.charCodeAt(i)) >>> 0;
  const base = `seg-${h.toString(36)}`;
  const n = seg.occurrence;
  return Number.isFinite(n) && (n as number) > 1 ? `${base}-${n}` : base;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a whitespace/markdown-tolerant matcher for a plain-text passage. */
function tolerantMatcher(plain: string): RegExp | null {
  const words = (plain || '').match(/[A-Za-z0-9']+/g);
  if (!words || words.length === 0) return null;
  const body = words.map(escapeRe).join('[^A-Za-z0-9]{0,8}');
  return new RegExp(`[^A-Za-z0-9]{0,8}${body}[^A-Za-z0-9]{0,3}`, 'i');
}

const QUOTED = /[“"]([^”"]{2,})[”"]/g;

function mergeNarrator(list: NarrationSegment[]): NarrationSegment[] {
  const out: NarrationSegment[] = [];
  for (const seg of list) {
    const prev = out[out.length - 1];
    if (prev && !prev.speaker && !prev.manual && !seg.speaker && !seg.manual && prev.para === seg.para) {
      prev.text = `${prev.text}\n\n${seg.text}`;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/**
 * Detects speakers without [VOICE:] tags: paragraphs that name a cast member
 * (bold or plain) and contain quoted speech get that speaker on the quoted
 * lines, while the surrounding prose stays with the narrator.
 */
function autoDetectSegments(raw: string, paraOffset = 0): NarrationSegment[] {
  const cast = loadVoiceCast();
  const paras = raw.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);

  // With no cast saved we still split by paragraph. Returning the whole story
  // as one segment is what made a single highlight re-key everything.
  if (cast.length === 0) {
    return paras.length
      ? paras.map((p, pi) => ({ speaker: null, text: p, para: paraOffset + pi }))
      : [{ speaker: null, text: raw, para: paraOffset }];
  }

  const out: NarrationSegment[] = [];
  paras.forEach((p, pi) => {
    const para = paraOffset + pi;

    const outsideQuotes = p.replace(new RegExp(QUOTED.source, 'g'), ' ');
    let speaker: string | null = null;

    const bold = p.match(/\*\*([^*]{2,40})\*\*/);
    if (bold && voiceForSpeaker(bold[1])) speaker = bold[1].trim();

    if (!speaker) {
      let bestIndex = Infinity;
      for (const entry of cast) {
        const m = outsideQuotes.match(new RegExp(`\\b${escapeRe(entry.name)}\\b`, 'i'));
        if (m && m.index !== undefined && m.index < bestIndex) {
          bestIndex = m.index;
          speaker = entry.name;
        }
      }
    }

    if (!speaker) { out.push({ speaker: null, text: p, para }); return; }

    const re = new RegExp(QUOTED.source, 'g');
    const pieces: NarrationSegment[] = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p)) !== null) {
      const before = p.slice(cursor, m.index).trim();
      if (before) pieces.push({ speaker: null, text: before, para });
      pieces.push({ speaker, text: m[0], para });
      cursor = m.index + m[0].length;
    }
    const tail = p.slice(cursor).trim();
    if (tail) pieces.push({ speaker: null, text: tail, para });
    out.push(...(pieces.length ? pieces : [{ speaker: null, text: p, para }]));
  });

  return out.length ? out : [{ speaker: null, text: raw, para: paraOffset }];
}

// ── Manual highlight overrides ──────────────────────────────────────────────

const OVERRIDES_KEY = 'dnd-narration-voice-overrides';

export interface NarrationOverride {
  /** Plain text of the highlighted passage. */
  text: string;
  /** Speechify voice id chosen for it. */
  voiceId: string;
  /** Friendly label shown in the UI (character name or "Narrator"). */
  label?: string;
}

type OverrideMap = Record<string, NarrationOverride[]>;

function readOverrideMap(): OverrideMap {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as OverrideMap : {};
  } catch { return {}; }
}

function writeOverrideMap(map: OverrideMap): void {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function loadNarrationOverrides(messageId: string): NarrationOverride[] {
  const list = readOverrideMap()[messageId];
  return Array.isArray(list) ? list : [];
}

export function addNarrationOverride(messageId: string, override: NarrationOverride): void {
  const map = readOverrideMap();
  const existing = (map[messageId] || []).filter((o) => o.text !== override.text);
  map[messageId] = [...existing, override];
  writeOverrideMap(map);
}

export function removeNarrationOverride(messageId: string, text: string): void {
  const map = readOverrideMap();
  map[messageId] = (map[messageId] || []).filter((o) => o.text !== text);
  if (map[messageId].length === 0) delete map[messageId];
  writeOverrideMap(map);
}

export function clearNarrationOverrides(messageId: string): void {
  const map = readOverrideMap();
  delete map[messageId];
  writeOverrideMap(map);
}

/**
 * Sentinel "voice" for a passage the player recorded with their own mic.
 * Never sent to Speechify — the saved clip is used as-is.
 */
export const SELF_RECORDED_VOICE_ID = 'self-recorded';

export const isSelfRecordedVoice = (voiceId?: string | null): boolean =>
  voiceId === SELF_RECORDED_VOICE_ID;

/** Replaces every stored override for a message (used when syncing from the party). */
export function setNarrationOverrides(messageId: string, list: NarrationOverride[]): void {
  const map = readOverrideMap();
  if (list.length === 0) delete map[messageId];
  else map[messageId] = list;
  writeOverrideMap(map);
}

/** Merges party-shared overrides in without dropping this device's own picks. */
export function mergeNarrationOverrides(messageId: string, incoming: NarrationOverride[]): boolean {
  if (incoming.length === 0) return false;
  const existing = loadNarrationOverrides(messageId);
  const merged = [...existing];
  let changed = false;
  for (const ov of incoming) {
    const idx = merged.findIndex((o) => o.text === ov.text);
    if (idx === -1) { merged.push(ov); changed = true; }
    else if (merged[idx].voiceId !== ov.voiceId || merged[idx].label !== ov.label) {
      merged[idx] = ov;
      changed = true;
    }
  }
  if (changed) setNarrationOverrides(messageId, merged);
  return changed;
}


/** Carves hand-picked passages out of the auto segments; manual wins. */
function applyOverrides(segments: NarrationSegment[], overrides: NarrationOverride[]): NarrationSegment[] {
  let working = segments;
  for (const ov of overrides) {
    const matcher = tolerantMatcher(ov.text);
    if (!matcher) continue;
    const next: NarrationSegment[] = [];
    let placed = false;
    for (const seg of working) {
      if (placed) { next.push(seg); continue; }
      const m = seg.text.match(matcher);
      if (!m || m.index === undefined) { next.push(seg); continue; }
      const before = seg.text.slice(0, m.index).trim();
      const after = seg.text.slice(m.index + m[0].length).trim();
      // An already hand-picked piece can still be cut apart (that is how a
      // split of a split works). The leftovers keep the parent's voice.
      if (seg.manual && !before && !after) {
        next.push({ ...seg, speaker: ov.label || seg.speaker || null, text: m[0].trim(), voiceId: ov.voiceId, manual: true });
        placed = true;
        continue;
      }
      const keep = { speaker: seg.speaker, voiceId: seg.voiceId, manual: seg.manual, para: seg.para };
      if (before) next.push({ ...keep, text: before });
      next.push({ speaker: ov.label || seg.speaker || null, text: m[0].trim(), voiceId: ov.voiceId, manual: true, para: seg.para });
      if (after) next.push({ ...keep, text: after });
      placed = true;
    }
    if (!placed) {
      // Span fallback: a merged piece can cover words from more than one
      // paragraph, so no single segment contains it. Join consecutive
      // segments until the passage matches, then carve it out of the span.
      for (let i = 0; i < working.length && !placed; i++) {
        let joined = working[i].text;
        let end = i;
        while (!placed) {
          const m = joined.match(matcher);
          if (m && m.index !== undefined) {
            const before = joined.slice(0, m.index).trim();
            const after = joined.slice(m.index + m[0].length).trim();
            const first = working[i];
            const keep = { speaker: first.speaker, voiceId: first.voiceId, manual: first.manual, para: first.para };
            const repl: NarrationSegment[] = [];
            if (before) repl.push({ ...keep, text: before });
            repl.push({ speaker: ov.label || first.speaker || null, text: m[0].trim(), voiceId: ov.voiceId, manual: true, para: first.para });
            if (after) repl.push({ ...keep, text: after });
            working = [...working.slice(0, i), ...repl, ...working.slice(end + 1)];
            placed = true;
            break;
          }
          end += 1;
          if (end >= working.length || joined.length > 8000) break;
          joined = `${joined}\n\n${working[end].text}`;
        }
      }
      if (placed) continue;
    }
    working = next;
  }
  return working;
}

/**
 * Breaks story prose into ordered segments: narrator prose, speaker-tagged
 * dialogue ([VOICE:] tags first, auto-detected bold-name dialogue otherwise),
 * and any hand-picked passages for this message.
 */
export function splitStorySegments(story: string, messageId?: string): NarrationSegment[] {
  const raw = (story || '').trim();
  if (!raw) return [];

  const tagged: NarrationSegment[] = [];
  let cursor = 0;
  VOICE_BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VOICE_BLOCK.exec(raw)) !== null) {
    const before = raw.slice(cursor, match.index).trim();
    if (before) tagged.push({ speaker: null, text: before });
    const speaker = (match[1] || '').trim();
    const line = (match[2] || '').trim();
    if (line) tagged.push({ speaker: speaker || null, text: line });
    cursor = match.index + match[0].length;
  }
  const tail = raw.slice(cursor).trim();
  if (tail) tagged.push({ speaker: null, text: tail });

  const hasTags = tagged.some((s) => !!s.speaker);
  let base: NarrationSegment[];
  if (hasTags) {
    // Tags win, but untagged prose still gets auto-detection.
    // paraCursor keeps paragraph numbers unique across the whole story, so
    // mergeNarrator can never glue two different paragraphs into one clip.
    let paraCursor = 0;
    base = tagged.flatMap((s) => {
      if (s.speaker) {
        const one: NarrationSegment[] = [{ ...s, para: paraCursor }];
        paraCursor += 1;
        return one;
      }
      const auto = autoDetectSegments(s.text, paraCursor);
      paraCursor += Math.max(1, s.text.split(/\n{2,}/).filter((x) => x.trim()).length);
      return auto;
    });
  } else {
    base = autoDetectSegments(raw, 0);
  }

  const overrides = messageId ? loadNarrationOverrides(messageId) : [];
  const withOverrides = overrides.length ? applyOverrides(base, overrides) : base;
  // Drop pieces with nothing speakable left (dividers, status lines, bare
  // headings) so they never become gaps that need audio.
  const speakable = withOverrides.filter((s) => !!stripMarkdownForTTS(s.text || '').trim());
  const merged = mergeNarrator(speakable.length ? speakable : withOverrides);
  const final = merged.length ? merged : [{ speaker: null, text: raw }];
  // Two pieces with identical words would otherwise share one id, which made
  // them render (and reorder) as a single row. Number the repeats in order.
  const seen = new Map<string, number>();
  return final.map((s) => {
    const basis = `${s.speaker || ''}|${s.voiceId || ''}|${(s.text || '').replace(/\s+/g, ' ').trim()}`;
    const n = (seen.get(basis) || 0) + 1;
    seen.set(basis, n);
    return n > 1 ? { ...s, occurrence: n } : s;
  });
}


// ── Narration Studio per-message state (play order + per-piece speed) ───────

const STUDIO_KEY = 'dnd-narration-studio';

export interface NarrationStudioState {
  /**
   * Custom playback order: part ids ('table', segmentKey strings) in the
   * order they should play. Parts not listed keep their story position at
   * the end. Never changes the written story.
   */
  order?: string[];
  /** Per-part playback rate (0.5 - 2). Playback-only; nothing is re-voiced. */
  rates?: Record<string, number>;
  /**
   * Part ids removed from the narration draft. Pieces are re-derived from the
   * message text every load, so without this a removed piece reappears. The
   * written story is never changed.
   */
  hidden?: string[];
}

type StudioMap = Record<string, NarrationStudioState>;

function readStudioMap(): StudioMap {
  try {
    const raw = localStorage.getItem(STUDIO_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as StudioMap : {};
  } catch { return {}; }
}

function writeStudioMap(map: StudioMap): void {
  try { localStorage.setItem(STUDIO_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function loadStudioState(messageId: string): NarrationStudioState {
  const state = readStudioMap()[messageId];
  return state && typeof state === 'object' ? state : {};
}

export function saveStudioState(messageId: string, state: NarrationStudioState): void {
  const map = readStudioMap();
  const clean: NarrationStudioState = {};
  if (Array.isArray(state.order) && state.order.length > 0) clean.order = state.order.filter((p) => typeof p === 'string');
  if (state.rates && typeof state.rates === 'object') {
    const rates: Record<string, number> = {};
    for (const [part, rate] of Object.entries(state.rates)) {
      if (Number.isFinite(rate)) rates[part] = Math.min(2, Math.max(0.5, rate));
    }
    if (Object.keys(rates).length > 0) clean.rates = rates;
  }
  if (Array.isArray(state.hidden) && state.hidden.length > 0) {
    clean.hidden = state.hidden.filter((p) => typeof p === 'string');
  }
  if (clean.order || clean.rates || clean.hidden) map[messageId] = clean;
  else delete map[messageId];
  writeStudioMap(map);
}

export function clearStudioState(messageId: string): void {
  const map = readStudioMap();
  delete map[messageId];
  writeStudioMap(map);
}

// ── Displaced cast voices (a mic recording covering a Speechify take) ───────

const DISPLACED_KEY = 'dnd-narration-displaced';

/**
 * What a self-recorded piece is covering. Recording a passage changes its
 * segment key (the voice id is part of the hash), so the earlier Speechify
 * clip stays in storage but becomes unreachable. This remembers how to get
 * back to it. Nothing is ever deleted.
 */
export interface DisplacedVoice {
  /** Exact override text written for the recording (used to undo it). */
  overrideText: string;
  /** Segment key the piece had before the recording. */
  previousPart: string;
  previousVoiceId?: string | null;
  previousLabel?: string | null;
  /** The override that was in place before, if any, so it can be restored. */
  previousOverride?: NarrationOverride | null;
}

type DisplacedMap = Record<string, Record<string, DisplacedVoice>>;

function readDisplacedMap(): DisplacedMap {
  try {
    const raw = localStorage.getItem(DISPLACED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as DisplacedMap : {};
  } catch { return {}; }
}

function writeDisplacedMap(map: DisplacedMap): void {
  try { localStorage.setItem(DISPLACED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function loadDisplacedVoices(messageId: string): Record<string, DisplacedVoice> {
  const entry = readDisplacedMap()[messageId];
  return entry && typeof entry === 'object' ? entry : {};
}

export function saveDisplacedVoice(messageId: string, part: string, info: DisplacedVoice): void {
  const map = readDisplacedMap();
  map[messageId] = { ...(map[messageId] || {}), [part]: info };
  writeDisplacedMap(map);
}

export function clearDisplacedVoice(messageId: string, part: string): void {
  const map = readDisplacedMap();
  if (!map[messageId]) return;
  delete map[messageId][part];
  if (Object.keys(map[messageId]).length === 0) delete map[messageId];
  writeDisplacedMap(map);
}
