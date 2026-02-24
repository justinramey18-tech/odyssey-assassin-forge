/**
 * Shared helpers for the Scribe context pipeline:
 * processing mode, story tail extraction, game-prompt stripping.
 */

import type { SavedStory } from '@/hooks/use-saved-stories';
import type { ProtagonistCard } from '@/lib/protagonist-cards';

export type ScribeProcessingMode = 'transform' | 'enhance';

export interface ScribeContextState {
  processingMode: ScribeProcessingMode;
  includeCampaignSummary: boolean;
  contextStoryId: string | null;
  contextWordCount: number;
  autoChainEnabled: boolean;
  stripGamePrompts: boolean;
}

export const DEFAULT_CONTEXT_STATE: ScribeContextState = {
  processingMode: 'transform',
  includeCampaignSummary: false,
  contextStoryId: null,
  contextWordCount: 5000,
  autoChainEnabled: false,
  stripGamePrompts: false,
};

/** Extract the last N words from a story's content */
export function getStoryTail(story: SavedStory, wordCount: number): string {
  const words = story.content.split(/\s+/);
  if (words.length <= wordCount) return story.content;
  return words.slice(-wordCount).join(' ');
}

/**
 * Strip interactive choice blocks (A/B/C/D) and "How do you…" prompts.
 * Preserves bold/italic markdown.
 */
export function stripChoiceBlocks(text: string): string {
  return text
    .replace(
      /\n\n\*?\*?(?:How (?:do|would|will) you.*?\??\*?\*?\s*\n)?(?:\s*\*?\*?[A-D][.):\s].*\n?)+/gi,
      ''
    )
    .trim();
}

/** Build the extra context fields for the edge function request body */
export function buildContextBody(
  state: ScribeContextState,
  campaignSummary: string | null,
  stories: SavedStory[],
  characterCards: import('@/lib/character-cards').CharacterCard[],
  protagonistCards?: ProtagonistCard[],
) {
  const extra: Record<string, unknown> = {
    processingMode: state.processingMode,
  };

  if (state.includeCampaignSummary && campaignSummary) {
    extra.campaignSummary = campaignSummary;
  }

  if (state.contextStoryId) {
    const story = stories.find(s => s.id === state.contextStoryId);
    if (story) {
      extra.storyContext = getStoryTail(story, state.contextWordCount);
    }
  }

  // Only include enabled character cards
  const enabledCards = characterCards.filter(c => c.enabled !== false);
  if (enabledCards.length > 0) {
    extra.characterCards = enabledCards.map(c => ({
      name: c.name,
      raceClass: c.raceClass,
      personality: c.personality,
      speechStyle: c.speechStyle,
    }));
  }

  // Only include enabled protagonist cards
  if (protagonistCards && protagonistCards.length > 0) {
    const enabledProtags = protagonistCards.filter(p => p.enabled);
    if (enabledProtags.length > 0) {
      extra.protagonistCards = enabledProtags.map(p => ({
        name: p.name,
        raceClass: p.raceClass,
        personality: p.personality,
        speechStyle: p.speechStyle,
        povStyle: p.povStyle,
        backstory: p.backstory,
        goalsConflicts: p.goalsConflicts,
        relationships: p.relationships,
        appearanceMannerisms: p.appearanceMannerisms,
        flawsWeaknesses: p.flawsWeaknesses,
        skillsAbilities: p.skillsAbilities,
        characterArc: p.characterArc,
      }));
    }
  }

  return extra;
}
