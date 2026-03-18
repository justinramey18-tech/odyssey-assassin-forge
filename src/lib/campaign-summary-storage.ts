import { toast } from 'sonner';
import { getScopedItem, setScopedItem, removeScopedItem, migrateToScoped } from '@/lib/scoped-storage';

export const SUMMARY_STORAGE_KEY = 'dnd-ai-dm-campaign-summary';
export const NOVEL_BUILDER_SUMMARY_KEY = 'dnd-novel-builder-campaign-summary';
export const SUMMARY_MAX_CHARS = 50000;

export function loadCampaignSummary(keyOverride?: string): string | null {
  const key = keyOverride ?? SUMMARY_STORAGE_KEY;
  migrateToScoped(key);
  try {
    return getScopedItem(key);
  } catch {
    return null;
  }
}

export function saveCampaignSummary(summary: string, keyOverride?: string): void {
  const key = keyOverride ?? SUMMARY_STORAGE_KEY;
  try {
    const trimmed = summary.slice(0, SUMMARY_MAX_CHARS);
    setScopedItem(key, trimmed);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toast.error('Campaign summary too large to save locally');
    } else {
      console.error('Failed to save campaign summary:', error);
    }
  }
}

export function clearCampaignSummary(keyOverride?: string): void {
  const key = keyOverride ?? SUMMARY_STORAGE_KEY;
  try {
    removeScopedItem(key);
  } catch {
    // ignore
  }
}

// Novel Builder dedicated summary — independent from AI DM summary
export function loadNovelBuilderSummary(): string | null {
  migrateToScoped(NOVEL_BUILDER_SUMMARY_KEY);
  try {
    return getScopedItem(NOVEL_BUILDER_SUMMARY_KEY);
  } catch {
    return null;
  }
}

export function saveNovelBuilderSummary(summary: string): void {
  try {
    const trimmed = summary.slice(0, SUMMARY_MAX_CHARS);
    setScopedItem(NOVEL_BUILDER_SUMMARY_KEY, trimmed);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toast.error('Campaign summary too large to save locally');
    } else {
      console.error('Failed to save novel builder summary:', error);
    }
  }
}

export function clearNovelBuilderSummary(): void {
  try {
    removeScopedItem(NOVEL_BUILDER_SUMMARY_KEY);
  } catch {
    // ignore
  }
}
