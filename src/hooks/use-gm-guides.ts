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

/**
 * @param ownerUserId - If provided, fetches/persists guides for this user instead of the current user.
 *   Used by co-hosts to manage the host's GM guides.
 * @param mode - 'solo' or 'party'. Filters guides by mode in both cloud and localStorage.
 */
export function useGMGuides(ownerUserId?: string, mode?: 'solo' | 'party') {
  const [guides, setGuides] = useState<GMGuide[]>(() => ownerUserId ? [] : loadGMGuides(mode));
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from cloud on mount (if signed in)
  useEffect(() => {
    let cancelled = false;

    const loadFromCloud = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      // When ownerUserId is set, fetch that user's guides (co-host scenario)
      const targetUserId = ownerUserId || session.user.id;

      const baseQuery = mode
        ? (supabase
            .from('gm_guides')
            .select('*')
            .eq('user_id', targetUserId) as any)
            .eq('mode', mode)
            .order('created_at', { ascending: true })
        : supabase
            .from('gm_guides')
            .select('*')
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: true });

      const { data, error } = await baseQuery;

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

        if (ownerUserId) {
          // Co-host mode: cloud is sole source of truth, no local merge
          setGuides(cloudGuides);
        } else {
          // Own guides: merge cloud + local
          const cloudIds = new Set(cloudGuides.map(g => g.id));
          const localOnly = guides.filter(g => !cloudIds.has(g.id));
          const merged = [...cloudGuides, ...localOnly];
          setGuides(merged);
          saveGMGuides(merged, mode);

          // Push any local-only guides to cloud
          if (localOnly.length > 0) {
            for (const g of localOnly) {
              await supabase.from('gm_guides').upsert({
                id: g.id,
                user_id: session.user.id,
                name: g.name,
                content: g.content,
                enabled: g.enabled,
                mode: mode || 'solo',
                created_at: g.createdAt,
                updated_at: g.updatedAt,
              } as any);
            }
          }
        }
      } else if (!ownerUserId) {
        // No cloud data and own guides — push all local guides to cloud
        const local = loadGMGuides(mode);
        if (local.length > 0) {
          for (const g of local) {
            await supabase.from('gm_guides').upsert({
              id: g.id,
              user_id: session.user.id,
              name: g.name,
              content: g.content,
              enabled: g.enabled,
              mode: mode || 'solo',
              created_at: g.createdAt,
              updated_at: g.updatedAt,
            } as any);
          }
        }
      }
      if (!cancelled) setCloudLoaded(true);
    };

    loadFromCloud();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, mode]);

  const persistToCloud = useCallback(async (guide: GMGuide) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    // Use ownerUserId for co-host scenario, otherwise current user
    const targetUserId = ownerUserId || session.user.id;
    await supabase.from('gm_guides').upsert({
      id: guide.id,
      user_id: targetUserId,
      name: guide.name,
      content: guide.content,
      enabled: guide.enabled,
      mode: mode || 'solo',
      created_at: guide.createdAt,
      updated_at: guide.updatedAt,
    } as any);
  }, [ownerUserId, mode]);

  const deleteFromCloud = useCallback(async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('gm_guides').delete().eq('id', id);
  }, []);

  const persist = useCallback((next: GMGuide[]) => {
    setGuides(next);
    // Only save to localStorage for own guides
    if (!ownerUserId) {
      saveGMGuides(next, mode);
    }
  }, [ownerUserId, mode]);

  const addGuide = useCallback((name: string, content: string, customId?: string): boolean => {
    if (content.length > MAX_GUIDE_CHARS) {
      toast.error(`Guide exceeds ${MAX_GUIDE_CHARS.toLocaleString()} character limit`);
      return false;
    }
    if (!canAddContent(guides, content.length)) {
      toast.error(`Total guides would exceed ${MAX_TOTAL_CHARS.toLocaleString()} character budget`);
      return false;
    }
    const guide: GMGuide = {
      id: customId ?? crypto.randomUUID(),
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
