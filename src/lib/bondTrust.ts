import { detectTrustBreak, classifyRiderEmotion } from './dragonBondState';

// Trust-building keyword patterns (single source of truth, copied verbatim
// from the former duplicates in use-dragon-bond.ts / use-party-dragon-bonds.ts
// / DragonBondChat.tsx).
const QUESTION_PATTERNS = [
  'how do you feel', 'what do you think', 'are you okay',
  'tell me about', 'what do you remember', 'do you want', 'how are you',
];
const GRATITUDE_PATTERNS = [
  'i trust you', 'thank you', "i'm glad", 'i appreciate',
  'you were right', "i'm sorry",
];
const VULNERABILITY_PATTERNS = [
  "i'm afraid", "i'm scared", "i don't know",
  'i need help', 'i failed', "i'm worried",
];
const AUTONOMY_PATTERNS = [
  'what would you prefer', 'your choice',
  "i won't force you", 'you decide',
];

export const MAX_TRUST_PER_EXCHANGE = 4;

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

export interface TrustComputeInput {
  message: string;
  totalChatExchanges: number;
  bond: number;
}

export interface TrustComputeResult {
  trustDelta: number;
  reason: string;
  emotionTag: string;
  matched: { question: boolean; gratitude: boolean; vulnerability: boolean; autonomy: boolean };
  trustBreak: { broken: boolean; severity: number; reason: string };
}

/**
 * Single source of truth for trust changes per bond-chat exchange.
 * Diminishing-returns model: a steady +1 baseline is always available so
 * trust never flatlines from conversation alone (the old bug was base going
 * to 0 once sessionChatCount exceeded a tiny cap).
 */
export function computeTrustDelta(input: TrustComputeInput): TrustComputeResult {
  const { message } = input;

  // Baseline +1 per exchange — never stalls. Bonuses still cap at MAX.
  let trustDelta = 1;
  let reason = 'conversation';

  const questionMatch = matchesAny(message, QUESTION_PATTERNS);
  const gratitudeMatch = matchesAny(message, GRATITUDE_PATTERNS);
  const vulnerabilityMatch = matchesAny(message, VULNERABILITY_PATTERNS);
  const autonomyMatch = matchesAny(message, AUTONOMY_PATTERNS);

  if (questionMatch) { trustDelta += 1; reason = 'genuine curiosity'; }
  if (gratitudeMatch) { trustDelta += 1; reason = 'trust and gratitude'; }
  if (vulnerabilityMatch) { trustDelta += 2; reason = 'shared vulnerability'; }
  if (autonomyMatch) { trustDelta += 1; reason = 'respecting autonomy'; }

  const trustBreak = detectTrustBreak(message);
  if (trustBreak.broken) {
    trustDelta = -trustBreak.severity;
    reason = trustBreak.reason;
  } else {
    trustDelta = Math.min(trustDelta, MAX_TRUST_PER_EXCHANGE);
  }

  const emotionTag = classifyRiderEmotion(
    message,
    trustBreak,
    { question: questionMatch, gratitude: gratitudeMatch, vulnerability: vulnerabilityMatch, autonomy: autonomyMatch },
  );

  return {
    trustDelta,
    reason,
    emotionTag,
    matched: { question: questionMatch, gratitude: gratitudeMatch, vulnerability: vulnerabilityMatch, autonomy: autonomyMatch },
    trustBreak,
  };
}

// ──────────────────────────────────────────────────────────────────────
// AI-judged trust (preferred path). The dragon-chat AI may emit a tag
// like:   <!--TRUST:+2:shared a real fear-->
// This module parses, clamps, and merges that signal with the keyword
// trust-break safety net. computeTrustDelta() above remains the fallback
// whenever the AI signal is absent.
// ──────────────────────────────────────────────────────────────────────

export interface AITrustSignal {
  /** Raw delta from the AI, will be clamped. */
  trustDelta: number;
  reason: string;
}

/** AI may return -3..+3 per exchange. We allow trust-break to push lower
 *  (down to -5) but never let positive runaway above +3. */
export function clampAITrust(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  return Math.max(-5, Math.min(3, Math.round(delta)));
}

/** Parse the hidden <!--TRUST:+N:reason--> tag from a dragon reply.
 *  Returns null if no tag is present. */
export function parseAITrustTag(content: string): AITrustSignal | null {
  if (!content) return null;
  const m = content.match(/<!--\s*TRUST\s*:\s*([+-]?\d+)\s*:\s*(.*?)\s*-->/i);
  if (!m) return null;
  const raw = parseInt(m[1], 10);
  if (!Number.isFinite(raw)) return null;
  return { trustDelta: raw, reason: (m[2] || '').trim() || 'the dragon weighed your words' };
}

/** Strip the trust tag from a string so it never reaches the user. */
export function stripAITrustTag(content: string): string {
  return content.replace(/<!--\s*TRUST\s*:\s*[+-]?\d+\s*:.*?-->/gi, '');
}

/**
 * Merge an AI-judged trust delta with the keyword trust-break safety net.
 * If the message is clearly hostile, take the MORE negative of the two so
 * the AI cannot under-judge cruelty.
 */
export function reconcileAITrust(
  aiSignal: AITrustSignal,
  playerMessage: string,
): { trustDelta: number; reason: string; trustBreak: ReturnType<typeof detectTrustBreak> } {
  const clamped = clampAITrust(aiSignal.trustDelta);
  const trustBreak = detectTrustBreak(playerMessage);
  if (trustBreak.broken) {
    const keywordDelta = -trustBreak.severity;
    if (keywordDelta < clamped) {
      return { trustDelta: keywordDelta, reason: trustBreak.reason, trustBreak };
    }
  }
  return { trustDelta: clamped, reason: aiSignal.reason, trustBreak };
}

