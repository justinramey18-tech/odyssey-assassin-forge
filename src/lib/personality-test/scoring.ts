import type { Answer, PersonaResult } from './types';
import { PERSONAS } from './personas';

export function calculatePersona(answers: Answer[]): PersonaResult {
  // Count how many times each value appears
  const scores: Record<string, number> = {};
  answers.forEach(answer => {
    scores[answer.value] = (scores[answer.value] || 0) + 1;
  });

  // Determine dominant traits (threshold: 3+ out of 5 in each section)
  const isMethodical = (scores.methodical || 0) >= 3;
  const isSpontaneous = (scores.spontaneous || 0) >= 3;
  const isAnalytical = (scores.analytical || 0) >= 3;
  const isEmpathetic = (scores.empathetic || 0) >= 3;
  const isAchievement = (scores.achievement || 0) >= 3;
  const isNarrative = (scores.narrative || 0) >= 3;

  // Map to personas based on trait combinations (priority order)
  if (isMethodical && isAnalytical) {
    return PERSONAS.CAREFUL_STRATEGIST;
  }

  if (isSpontaneous && isAchievement) {
    return PERSONAS.BOLD_ADVENTURER;
  }

  if (isEmpathetic && isNarrative) {
    return PERSONAS.EMPATHETIC_SOUL;
  }

  if (isAnalytical && !isEmpathetic) {
    return PERSONAS.ANALYTICAL_MIND;
  }

  if (isNarrative && !isMethodical) {
    return PERSONAS.STORY_SEEKER;
  }

  // Default: balanced explorer
  return PERSONAS.BALANCED_EXPLORER;
}

/** Get the persona key from a PersonaResult for lookup in PAIRING_REASONS */
export function getPersonaKey(result: PersonaResult): string {
  for (const [key, persona] of Object.entries(PERSONAS)) {
    if (persona.playerArchetype === result.playerArchetype) return key;
  }
  return 'BALANCED_EXPLORER';
}
