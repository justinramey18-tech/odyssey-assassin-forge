export interface GMGuide {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const MAX_GUIDE_CHARS = 30000;
export const MAX_TOTAL_CHARS = 200000;
function getStorageKey(mode?: 'solo' | 'solo-empyrean' | 'party'): string {
  return mode ? `dnd-ai-dm-guides-${mode}` : 'dnd-ai-dm-guides';
}

export function loadGMGuides(mode?: string): GMGuide[] {
  try {
    const raw = localStorage.getItem(getStorageKey(mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveGMGuides(guides: GMGuide[], mode?: string): void {
  try {
    localStorage.setItem(getStorageKey(mode), JSON.stringify(guides));
  } catch (error) {
    console.error('Failed to save GM guides:', error);
  }
}

export function getTotalCharacterCount(guides: GMGuide[]): number {
  return guides.filter(g => g.enabled).reduce((sum, g) => sum + g.content.length, 0);
}

export function getEnabledGuidesContent(guides: GMGuide[]): string {
  return guides
    .filter(g => g.enabled && g.content.trim())
    .map(g => `### ${g.name}\n${g.content}`)
    .join('\n\n---\n\n');
}

export function canAddContent(guides: GMGuide[], newContentLength: number, excludeId?: string): boolean {
  const existing = guides
    .filter(g => g.id !== excludeId && g.enabled)
    .reduce((sum, g) => sum + g.content.length, 0);
  return existing + newContentLength <= MAX_TOTAL_CHARS;
}
