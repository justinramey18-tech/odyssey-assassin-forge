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
 * @param mode - 'solo' or 'party'.
 *   'solo' = purely localStorage, no cloud sync.
 *   'party' = cloud-backed via gm_guides table.
 */
export function useGMGuides(ownerUserId?: string, mode?: 'solo' | 'solo-empyrean' | 'party') {
  const isCloudMode = mode === 'party' || !!ownerUserId;

  const [guides, setGuides] = useState<GMGuide[]>(() => ownerUserId ? [] : loadGMGuides(mode));
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Cloud load — only for party mode or co-host
  useEffect(() => {
    if (!isCloudMode) return;

    let cancelled = false;

    const loadFromCloud = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

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
        const cloudGuides: GMGuide[] = data
          .filter(row => !deletedIdsRef.current.has(row.id))
          .map(row => ({
            id: row.id,
            name: row.name,
            content: row.content,
            enabled: row.enabled,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

        setGuides(cloudGuides);
      }
      if (!cancelled) setCloudLoaded(true);
    };

    loadFromCloud();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, mode, isCloudMode]);

  const persistToCloud = useCallback(async (guide: GMGuide) => {
    if (!isCloudMode) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const targetUserId = ownerUserId || session.user.id;
    await supabase.from('gm_guides').upsert({
      id: guide.id,
      user_id: targetUserId,
      name: guide.name,
      content: guide.content,
      enabled: guide.enabled,
      mode: mode || 'party',
      created_at: guide.createdAt,
      updated_at: guide.updatedAt,
    } as any);
  }, [ownerUserId, mode, isCloudMode]);

  const deleteFromCloud = useCallback(async (id: string) => {
    if (!isCloudMode) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('gm_guides').delete().eq('id', id);
  }, [isCloudMode]);

  const persist = useCallback((next: GMGuide[]) => {
    setGuides(next);
    // Solo mode: save to localStorage. Party/co-host: don't use localStorage.
    if (!isCloudMode) {
      saveGMGuides(next, mode);
    }
  }, [isCloudMode, mode]);

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

  const addGuides = useCallback((items: Array<{ name: string; content: string; customId?: string }>): { added: number; skipped: number } => {
    const prepared = items.map(item => ({
      ...item,
      resolvedId: item.customId ?? crypto.randomUUID(),
      oversizeIndividual: item.content.length > MAX_GUIDE_CHARS,
    }));

    let added = 0;
    let skipped = 0;

    setGuides(prev => {
      const acc: GMGuide[] = [...prev];
      for (const p of prepared) {
        if (p.oversizeIndividual) { skipped += 1; continue; }
        if (!canAddContent(acc, p.content.length)) {
          skipped += 1;
          p.oversizeIndividual = true;
          continue;
        }
        acc.push({
          id: p.resolvedId,
          name: (p.name || 'Untitled Guide').trim(),
          content: p.content,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added += 1;
      }
      if (!isCloudMode) {
        saveGMGuides(acc, mode);
      }
      return acc;
    });

    if (isCloudMode) {
      for (const p of prepared) {
        if (p.oversizeIndividual) continue;
        persistToCloud({
          id: p.resolvedId,
          name: (p.name || 'Untitled Guide').trim(),
          content: p.content,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (added > 0) toast.success(`${added} guide${added === 1 ? '' : 's'} added`);
    if (skipped > 0) toast.error(`${skipped} guide${skipped === 1 ? '' : 's'} skipped (size limit)`);
    return { added, skipped };
  }, [isCloudMode, mode, persistToCloud]);

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
    deletedIdsRef.current.add(id);
    persist(guides.filter(g => g.id !== id));
    deleteFromCloud(id);
    toast.success('Guide deleted');
  }, [guides, persist, deleteFromCloud]);

  const deleteGuides = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) deletedIdsRef.current.add(id);
    setGuides(prev => {
      const next = prev.filter(g => !ids.includes(g.id));
      if (!isCloudMode) saveGMGuides(next, mode);
      return next;
    });
    for (const id of ids) deleteFromCloud(id);
  }, [isCloudMode, mode, deleteFromCloud]);

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

  /** Enable only the guides with the given IDs, disable all others. */
  const setActiveGuideIds = useCallback((ids: string[] | null) => {
    if (!ids) {
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
