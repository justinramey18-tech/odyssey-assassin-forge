/**
 * Shared utility for estimating the total character count of an AI request,
 * including all context payloads (summary, story context, cards, protagonists).
 */

import type { CharacterCard } from '@/lib/character-cards';
import type { ProtagonistCard } from '@/lib/protagonist-cards';
import type { ScribeContextState } from '@/lib/scribe-context';
import type { SavedStory } from '@/hooks/use-saved-stories';
import { getStoryTail } from '@/lib/scribe-context';

export interface RequestSizeBreakdown {
  inputText: number;
  campaignSummary: number;
  storyContext: number;
  characterCards: number;
  protagonistCards: number;
  total: number;
}

export function getRequestSizeBreakdown(
  inputTextLength: number,
  ctxState: ScribeContextState,
  campaignSummary: string | null,
  stories: SavedStory[],
  characterCards: CharacterCard[],
  protagonistCards: ProtagonistCard[],
): RequestSizeBreakdown {
  let summaryChars = 0;
  if (ctxState.includeCampaignSummary && campaignSummary) {
    summaryChars = campaignSummary.length;
  }

  let storyContextChars = 0;
  if (ctxState.contextStoryId) {
    const story = stories.find(s => s.id === ctxState.contextStoryId);
    if (story) {
      storyContextChars = getStoryTail(story, ctxState.contextWordCount).length;
    }
  }

  let cardChars = 0;
  const enabledCards = characterCards.filter(c => c.enabled !== false);
  for (const c of enabledCards) {
    cardChars += (c.name?.length || 0) + (c.raceClass?.length || 0) + (c.personality?.length || 0) + (c.speechStyle?.length || 0);
  }

  let protagChars = 0;
  const enabledProtags = protagonistCards.filter(p => p.enabled);
  for (const p of enabledProtags) {
    protagChars += (p.name?.length || 0) + (p.raceClass?.length || 0) + (p.personality?.length || 0) + (p.speechStyle?.length || 0);
    protagChars += (p.backstory?.length || 0) + (p.goalsConflicts?.length || 0) + (p.relationships?.length || 0);
    protagChars += (p.appearanceMannerisms?.length || 0) + (p.flawsWeaknesses?.length || 0);
    protagChars += (p.skillsAbilities?.length || 0) + (p.characterArc?.length || 0);
  }

  const total = inputTextLength + summaryChars + storyContextChars + cardChars + protagChars;

  return {
    inputText: inputTextLength,
    campaignSummary: summaryChars,
    storyContext: storyContextChars,
    characterCards: cardChars,
    protagonistCards: protagChars,
    total,
  };
}
