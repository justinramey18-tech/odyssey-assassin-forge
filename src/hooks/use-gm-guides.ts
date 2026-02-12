import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  GMGuide,
  MAX_GUIDE_CHARS,
  MAX_TOTAL_CHARS,
  loadGMGuides,
  saveGMGuides,
  getTotalCharacterCount,
  getEnabledGuidesContent,
  canAddContent,
} from '@/lib/gm-guides-storage';

export function useGMGuides() {
  const [guides, setGuides] = useState<GMGuide[]>(() => loadGMGuides());

  const persist = useCallback((next: GMGuide[]) => {
    setGuides(next);
    saveGMGuides(next);
  }, []);

  const addGuide = useCallback((name: string, content: string): boolean => {
    if (content.length > MAX_GUIDE_CHARS) {
      toast.error(`Guide exceeds ${MAX_GUIDE_CHARS.toLocaleString()} character limit`);
      return false;
    }
    if (!canAddContent(guides, content.length)) {
      toast.error(`Total guides would exceed ${MAX_TOTAL_CHARS.toLocaleString()} character budget`);
      return false;
    }
    const guide: GMGuide = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Guide',
      content,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist([...guides, guide]);
    toast.success('Guide added');
    return true;
  }, [guides, persist]);

  const updateGuide = useCallback((id: string, updates: Partial<Pick<GMGuide, 'name' | 'content' | 'enabled'>>): boolean => {
    const existing = guides.find(g => g.id === id);
    if (!existing) return false;

    const newContent = updates.content ?? existing.content;
    if (newContent.length > MAX_GUIDE_CHARS) {
      toast.error(`Guide exceeds ${MAX_GUIDE_CHARS.toLocaleString()} character limit`);
      return false;
    }
    if (updates.content !== undefined && !canAddContent(guides, newContent.length, id)) {
      toast.error(`Total guides would exceed ${MAX_TOTAL_CHARS.toLocaleString()} character budget`);
      return false;
    }

    persist(guides.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g));
    return true;
  }, [guides, persist]);

  const deleteGuide = useCallback((id: string) => {
    persist(guides.filter(g => g.id !== id));
    toast.success('Guide deleted');
  }, [guides, persist]);

  const toggleGuide = useCallback((id: string) => {
    persist(guides.map(g => g.id === id ? { ...g, enabled: !g.enabled, updatedAt: new Date().toISOString() } : g));
  }, [guides, persist]);

  const totalChars = useMemo(() => getTotalCharacterCount(guides), [guides]);
  const enabledContent = useMemo(() => getEnabledGuidesContent(guides), [guides]);

  return {
    guides,
    addGuide,
    updateGuide,
    deleteGuide,
    toggleGuide,
    totalChars,
    enabledContent,
  };
}
