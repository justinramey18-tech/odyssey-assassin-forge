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
