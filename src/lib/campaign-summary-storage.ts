export const SUMMARY_STORAGE_KEY = 'dnd-ai-dm-campaign-summary';
export const SUMMARY_MAX_CHARS = 30000;

export function loadCampaignSummary(): string | null {
  try {
    return localStorage.getItem(SUMMARY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveCampaignSummary(summary: string): void {
  try {
    const trimmed = summary.slice(0, SUMMARY_MAX_CHARS);
    localStorage.setItem(SUMMARY_STORAGE_KEY, trimmed);
  } catch (error) {
    console.error('Failed to save campaign summary:', error);
  }
}

export function clearCampaignSummary(): void {
  try {
    localStorage.removeItem(SUMMARY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
