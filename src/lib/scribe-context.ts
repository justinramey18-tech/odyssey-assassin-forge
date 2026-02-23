/**
 * Shared helpers for the Scribe context pipeline:
 * processing mode, story tail extraction, game-prompt stripping.
 */

import type { SavedStory } from '@/hooks/use-saved-stories';

export type ScribeProcessingMode = 'transform' | 'enhance';
export type TargetMultiplier = 1.5 | 2 | 3;

export interface ScribeContextState {
  processingMode: ScribeProcessingMode;
  targetMultiplier: TargetMultiplier;
  includeCampaignSummary: boolean;
  contextStoryId: string | null;
  contextWordCount: number;
  autoChainEnabled: boolean;
  stripGamePrompts: boolean;
}

export const DEFAULT_CONTEXT_STATE: ScribeContextState = {
  processingMode: 'transform',
  targetMultiplier: 1.5,
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
) {
  const extra: Record<string, unknown> = {
    processingMode: state.processingMode,
    targetMultiplier: state.targetMultiplier,
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

  if (characterCards.length > 0) {
    extra.characterCards = characterCards.map(c => ({
      name: c.name,
      raceClass: c.raceClass,
      personality: c.personality,
      speechStyle: c.speechStyle,
    }));
  }

  return extra;
}
