import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from cloud on mount (if signed in)
  useEffect(() => {
    let cancelled = false;

    const loadFromCloud = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const { data, error } = await supabase
        .from('gm_guides')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || cancelled) return;

      if (data && data.length > 0) {
        const cloudGuides: GMGuide[] = data.map(row => ({
          id: row.id,
          name: row.name,
          content: row.content,
          enabled: row.enabled,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        // Merge: cloud is source of truth, but keep local-only guides
        const cloudIds = new Set(cloudGuides.map(g => g.id));
        const localOnly = guides.filter(g => !cloudIds.has(g.id));
        const merged = [...cloudGuides, ...localOnly];
        setGuides(merged);
        saveGMGuides(merged);

        // Push any local-only guides to cloud
        if (localOnly.length > 0) {
          for (const g of localOnly) {
            await supabase.from('gm_guides').upsert({
              id: g.id,
              user_id: session.user.id,
              name: g.name,
              content: g.content,
              enabled: g.enabled,
              created_at: g.createdAt,
              updated_at: g.updatedAt,
            });
          }
        }
      } else {
        // No cloud data — push all local guides to cloud
        const local = loadGMGuides();
        if (local.length > 0) {
          for (const g of local) {
            await supabase.from('gm_guides').upsert({
              id: g.id,
              user_id: session.user.id,
              name: g.name,
              content: g.content,
              enabled: g.enabled,
              created_at: g.createdAt,
              updated_at: g.updatedAt,
            });
          }
        }
      }
      if (!cancelled) setCloudLoaded(true);
    };

    loadFromCloud();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistToCloud = useCallback(async (guide: GMGuide) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('gm_guides').upsert({
      id: guide.id,
      user_id: session.user.id,
      name: guide.name,
      content: guide.content,
      enabled: guide.enabled,
      created_at: guide.createdAt,
      updated_at: guide.updatedAt,
    });
  }, []);

  const deleteFromCloud = useCallback(async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('gm_guides').delete().eq('id', id);
  }, []);

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
    persistToCloud(guide);
    toast.success('Guide added');
    return true;
  }, [guides, persist, persistToCloud]);

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

    const updated: GMGuide = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const next = guides.map(g => g.id === id ? updated : g);
    persist(next);
    persistToCloud(updated);
    return true;
  }, [guides, persist, persistToCloud]);

  const deleteGuide = useCallback((id: string) => {
    persist(guides.filter(g => g.id !== id));
    deleteFromCloud(id);
    toast.success('Guide deleted');
  }, [guides, persist, deleteFromCloud]);

  const toggleGuide = useCallback((id: string) => {
    const existing = guides.find(g => g.id === id);
    if (!existing) return;
    const updated: GMGuide = { ...existing, enabled: !existing.enabled, updatedAt: new Date().toISOString() };
    const next = guides.map(g => g.id === id ? updated : g);
    persist(next);
    persistToCloud(updated);
  }, [guides, persist, persistToCloud]);

  const totalChars = useMemo(() => getTotalCharacterCount(guides), [guides]);
  const enabledContent = useMemo(() => getEnabledGuidesContent(guides), [guides]);

  /** Get IDs of currently enabled guides */
  const activeGuideIds = useMemo(() => guides.filter(g => g.enabled).map(g => g.id), [guides]);

  /** Enable only the guides with the given IDs, disable all others. Persists to local + cloud. */
  const setActiveGuideIds = useCallback((ids: string[] | null) => {
    if (!ids) {
      // null means disable all (fresh campaign)
      const next = guides.map(g => ({ ...g, enabled: false, updatedAt: new Date().toISOString() }));
      persist(next);
      next.forEach(g => persistToCloud(g));
      return;
    }
    const idSet = new Set(ids);
    const next = guides.map(g => ({
      ...g,
      enabled: idSet.has(g.id),
      updatedAt: new Date().toISOString(),
    }));
    persist(next);
    next.forEach(g => persistToCloud(g));
  }, [guides, persist, persistToCloud]);

  return {
    guides,
    addGuide,
    updateGuide,
    deleteGuide,
    toggleGuide,
    totalChars,
    enabledContent,
    activeGuideIds,
    setActiveGuideIds,
  };
}
