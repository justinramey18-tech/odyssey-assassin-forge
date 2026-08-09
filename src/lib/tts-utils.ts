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

/** Removes the [TABLE] markers while keeping the words, for on-screen display. */
export function stripTableTalkTags(text: string): string {
  return (text || '').replace(/\[\/?TABLE(?:\s*TALK)?\]/gi, '');
}
