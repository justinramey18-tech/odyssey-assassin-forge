// Progression Deduplication
// Merges AI-detected ASIs, feats, and class features with offline regex results,
// removing duplicates based on semantic matching.

import type { AbilityScoreIncreaseMatch } from './patterns/abilityScoreIncrease';
import type { FeatAcquisitionMatch } from './patterns/featAcquisition';
import type { ClassFeatureUnlockMatch } from './patterns/classFeatureUnlock';
import type { ConfidenceLevel } from './types';

/** AI-parsed ability score increase (from parseAIResponse) */
export interface AIAbilityScoreIncrease {
  ability: string; // e.g. 'str', 'strength'
  increase: number;
  newScore?: number | null;
  source?: string;
  confidence: ConfidenceLevel;
  sourceText: string;
}

/** AI-parsed feat acquisition */
export interface AIFeatAcquisition {
  featName: string;
  isKnownFeat: boolean;
  source?: string;
  confidence: ConfidenceLevel;
  sourceText: string;
}

/** AI-parsed class feature unlock */
export interface AIClassFeatureUnlock {
  featureName: string;
  className?: string | null;
  level?: number | null;
  confidence: ConfidenceLevel;
  sourceText: string;
}

// Normalize ability name to lowercase full form
function normalizeAbility(raw: string): string {
  const map: Record<string, string> = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
  };
  const lower = raw.toLowerCase().trim();
  return map[lower] || lower;
}

// Check if two source texts refer to the same event (overlap > 50% of shorter text)
function sourceTextsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return true;
  // Check if one contains the other
  if (la.includes(lb) || lb.includes(la)) return true;
  return false;
}

/**
 * Convert AI-parsed ASIs to AbilityScoreIncreaseMatch format
 */
export function convertAIAbilityScoreIncreases(
  aiResults: AIAbilityScoreIncrease[]
): AbilityScoreIncreaseMatch[] {
  return aiResults.map((ai, i) => ({
    category: 'ability_score_increase' as const,
    fullMatch: ai.sourceText,
    value: ai.increase,
    context: ai.sourceText,
    index: -(i + 1), // Negative index to distinguish AI-sourced
    ability: normalizeAbility(ai.ability),
    increase: ai.increase,
    newScore: ai.newScore ?? undefined,
    source: ai.source,
  }));
}

/**
 * Convert AI-parsed feats to FeatAcquisitionMatch format
 */
export function convertAIFeatAcquisitions(
  aiResults: AIFeatAcquisition[]
): FeatAcquisitionMatch[] {
  return aiResults.map((ai, i) => ({
    category: 'feat_acquisition' as const,
    fullMatch: ai.sourceText,
    value: ai.featName,
    context: ai.sourceText,
    index: -(i + 1),
    featName: ai.featName,
    isKnownFeat: ai.isKnownFeat,
    source: ai.source,
  }));
}

/**
 * Convert AI-parsed class features to ClassFeatureUnlockMatch format
 */
export function convertAIClassFeatureUnlocks(
  aiResults: AIClassFeatureUnlock[]
): ClassFeatureUnlockMatch[] {
  return aiResults.map((ai, i) => ({
    category: 'class_feature_unlock' as const,
    fullMatch: ai.sourceText,
    value: ai.featureName,
    context: ai.sourceText,
    index: -(i + 1),
    featureName: ai.featureName,
    className: ai.className ?? undefined,
    level: ai.level ?? undefined,
    isKnownFeature: true,
  }));
}

/**
 * Deduplicate ASI matches: same ability + same increase = duplicate
 */
export function deduplicateASIs(
  offline: AbilityScoreIncreaseMatch[],
  ai: AbilityScoreIncreaseMatch[]
): AbilityScoreIncreaseMatch[] {
  const result = [...offline];
  
  for (const aiMatch of ai) {
    const isDuplicate = result.some(existing =>
      normalizeAbility(existing.ability) === normalizeAbility(aiMatch.ability) &&
      existing.increase === aiMatch.increase &&
      (sourceTextsOverlap(existing.fullMatch, aiMatch.fullMatch) ||
       (existing.newScore != null && aiMatch.newScore != null && existing.newScore === aiMatch.newScore))
    );
    
    if (!isDuplicate) {
      result.push(aiMatch);
    }
  }
  
  return result;
}

/**
 * Deduplicate feat matches: same feat name (case-insensitive) = duplicate
 */
export function deduplicateFeats(
  offline: FeatAcquisitionMatch[],
  ai: FeatAcquisitionMatch[]
): FeatAcquisitionMatch[] {
  const result = [...offline];
  
  for (const aiMatch of ai) {
    const isDuplicate = result.some(existing =>
      existing.featName.toLowerCase() === aiMatch.featName.toLowerCase() ||
      sourceTextsOverlap(existing.fullMatch, aiMatch.fullMatch)
    );
    
    if (!isDuplicate) {
      result.push(aiMatch);
    }
  }
  
  return result;
}

/**
 * Deduplicate class feature matches: same feature name (case-insensitive) = duplicate
 */
export function deduplicateClassFeatures(
  offline: ClassFeatureUnlockMatch[],
  ai: ClassFeatureUnlockMatch[]
): ClassFeatureUnlockMatch[] {
  const result = [...offline];
  
  for (const aiMatch of ai) {
    const isDuplicate = result.some(existing =>
      existing.featureName.toLowerCase() === aiMatch.featureName.toLowerCase() ||
      sourceTextsOverlap(existing.fullMatch, aiMatch.fullMatch)
    );
    
    // If AI found a match with more info (class/level), enrich existing
    if (isDuplicate) {
      const existingIdx = result.findIndex(e =>
        e.featureName.toLowerCase() === aiMatch.featureName.toLowerCase()
      );
      if (existingIdx >= 0) {
        if (!result[existingIdx].className && aiMatch.className) {
          result[existingIdx] = { ...result[existingIdx], className: aiMatch.className };
        }
        if (!result[existingIdx].level && aiMatch.level) {
          result[existingIdx] = { ...result[existingIdx], level: aiMatch.level };
        }
      }
    } else {
      result.push(aiMatch);
    }
  }
  
  return result;
}

/**
 * Parse AI progression fields from a raw AI response object.
 * Returns typed arrays ready for dedup/merge.
 */
export function parseAIProgressionFields(data: Record<string, unknown>): {
  abilityScoreIncreases: AIAbilityScoreIncrease[];
  featAcquisitions: AIFeatAcquisition[];
  classFeatureUnlocks: AIClassFeatureUnlock[];
} {
  const abilityScoreIncreases: AIAbilityScoreIncrease[] = [];
  const featAcquisitions: AIFeatAcquisition[] = [];
  const classFeatureUnlocks: AIClassFeatureUnlock[] = [];

  if (Array.isArray(data.ability_score_increases)) {
    for (const asi of data.ability_score_increases) {
      if (typeof asi.ability === 'string' && typeof asi.increase === 'number') {
        abilityScoreIncreases.push({
          ability: asi.ability,
          increase: asi.increase,
          newScore: typeof asi.new_score === 'number' ? asi.new_score : null,
          source: typeof asi.source === 'string' ? asi.source : undefined,
          confidence: validateConf(asi.confidence),
          sourceText: String(asi.source_text || ''),
        });
      }
    }
  }

  if (Array.isArray(data.feat_acquisitions)) {
    for (const feat of data.feat_acquisitions) {
      if (typeof feat.feat_name === 'string' && feat.feat_name.length > 0) {
        featAcquisitions.push({
          featName: feat.feat_name,
          isKnownFeat: feat.is_known_feat === true,
          source: typeof feat.source === 'string' ? feat.source : undefined,
          confidence: validateConf(feat.confidence),
          sourceText: String(feat.source_text || ''),
        });
      }
    }
  }

  if (Array.isArray(data.class_feature_unlocks)) {
    for (const cf of data.class_feature_unlocks) {
      if (typeof cf.feature_name === 'string' && cf.feature_name.length > 0) {
        classFeatureUnlocks.push({
          featureName: cf.feature_name,
          className: typeof cf.class_name === 'string' ? cf.class_name : null,
          level: typeof cf.level === 'number' ? cf.level : null,
          confidence: validateConf(cf.confidence),
          sourceText: String(cf.source_text || ''),
        });
      }
    }
  }

  return { abilityScoreIncreases, featAcquisitions, classFeatureUnlocks };
}

function validateConf(v: unknown): ConfidenceLevel {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}
