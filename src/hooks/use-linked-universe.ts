import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface UniverseMember {
  id: string;
  campaignId: string | null;
  userId: string | null;
  characterName: string;
  storyDigest: string | null;
  digestUpdatedAt: string | null;
  visibility: string;
}

export interface UniverseEvent {
  eventText: string;
  eventType: string;
  importance: number;
}

export interface LinkedUniverseState {
  universe: { id: string; name: string; linkCode: string } | null;
  members: UniverseMember[];
  events: UniverseEvent[];
  isLoading: boolean;
}

const DEFAULT_STATE: LinkedUniverseState = {
  universe: null,
  members: [],
  events: [],
  isLoading: false,
};

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useLinkedUniverse({ campaignId }: { campaignId: string | null }) {
  const { user } = useAuth();
  const [state, setState] = useState<LinkedUniverseState>(DEFAULT_STATE);
  const campaignRef = useRef<string | null>(campaignId);
  campaignRef.current = campaignId;

  const invoke = useCallback(async (action: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    return supabase.functions.invoke('universe-link', {
      body: { action, ...body },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });
  }, []);

  const refresh = useCallback(async () => {
    const cid = campaignRef.current;
    if (!cid || !user) {
      setState(DEFAULT_STATE);
      return;
    }
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await invoke('status', { campaignId: cid });
      if (res.error || res.data?.error) {
        setState({ ...DEFAULT_STATE, isLoading: false });
        return;
      }
      const { universe, members, events } = res.data || {};
      if (!universe) {
        setState({ ...DEFAULT_STATE, isLoading: false });
        return;
      }
      setState({
        universe: {
          id: universe.id,
          name: universe.name,
          linkCode: universe.link_code,
        },
        members: (members || []).map((m: any) => ({
          id: m.id,
          campaignId: m.campaign_id ?? null,
          userId: m.user_id ?? null,
          characterName: m.character_name,
          storyDigest: m.story_digest ?? null,
          digestUpdatedAt: m.digest_updated_at ?? null,
          visibility: m.visibility ?? 'full',
        })),
        events: (events || []).map((e: any) => ({
          eventText: e.event_text,
          eventType: e.event_type,
          importance: e.importance,
        })),
        isLoading: false,
      });
    } catch {
      setState({ ...DEFAULT_STATE, isLoading: false });
    }
  }, [invoke, user]);

  useEffect(() => {
    refresh();
  }, [campaignId, user?.id, refresh]);

  // Poll every 5 minutes + refresh on focus, so digests from other players arrive
  useEffect(() => {
    if (!campaignId || !user) return;
    const interval = window.setInterval(() => { refresh(); }, POLL_INTERVAL_MS);
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [campaignId, user, refresh]);

  const createUniverse = useCallback(async (name: string, characterName: string) => {
    if (!user) { toast.error('Sign in to create a linked universe'); return null; }
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return null; }
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await invoke('create', {
        name: name || 'Shared Universe',
        campaignId: cid,
        characterName,
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to create universe');
        setState(prev => ({ ...prev, isLoading: false }));
        return null;
      }
      const code = res.data.linkCode as string;
      toast.success(`Universe created — code ${code}`);
      await refresh();
      return code;
    } catch {
      toast.error('Failed to create universe');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [invoke, refresh, user]);

  const joinUniverse = useCallback(async (linkCode: string, characterName: string) => {
    if (!user) { toast.error('Sign in to join a linked universe'); return false; }
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await invoke('join', {
        linkCode: linkCode.trim().toUpperCase(),
        campaignId: cid,
        characterName,
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to join universe');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
      toast.success(`Joined ${res.data.universeName || 'universe'}`);
      await refresh();
      return true;
    } catch {
      toast.error('Failed to join universe');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [invoke, refresh, user]);

  const leaveUniverse = useCallback(async () => {
    if (!user) return false;
    const cid = campaignRef.current;
    const uid = state.universe?.id;
    if (!cid || !uid) return false;
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await invoke('leave', { universeId: uid, campaignId: cid });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to unlink');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
      toast.success('Unlinked from universe');
      setState({ ...DEFAULT_STATE });
      return true;
    } catch {
      toast.error('Failed to unlink');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [invoke, state.universe?.id, user]);

  const ownMember = useMemo(
    () => state.members.find(m => m.campaignId === campaignId) ?? null,
    [state.members, campaignId]
  );

  const saveMyDigest = useCallback(async (digest: string) => {
    if (!ownMember) { toast.error('No linked member row'); return false; }
    const { error } = await supabase
      .from('universe_members')
      .update({ story_digest: digest, digest_updated_at: new Date().toISOString() })
      .eq('id', ownMember.id);
    if (error) {
      toast.error('Failed to save digest');
      return false;
    }
    toast.success('Story digest saved');
    await refresh();
    return true;
  }, [ownMember, refresh]);

  const universeContext = useMemo(() => {
    if (!state.universe) return null;
    const others = state.members.filter(
      m => m.campaignId !== campaignId && m.visibility !== 'hidden' && m.storyDigest && m.storyDigest.trim()
    );
    if (others.length === 0) return null;

    const lines: string[] = [];
    lines.push(`=== LINKED UNIVERSE: "${state.universe.name}" ===`);
    lines.push(`Your player's story is linked to other riders' stories in this shared world. These events are happening in parallel. You may reference these characters as NPCs, have your player hear rumors about them, or cross paths naturally. You may NOT kill, injure, or make major story decisions for linked characters — they belong to their own players.`);
    lines.push('');

    const importanceLabel = (n: number) => n >= 3 ? 'World-changing' : n === 2 ? 'Notable' : 'Minor';
    const capped = [...state.events]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);
    if (capped.length > 0) {
      lines.push('--- SHARED CANON (established facts, treat as true) ---');
      for (const ev of capped) {
        lines.push(`• [${importanceLabel(ev.importance)}] ${ev.eventText}`);
      }
      lines.push('');
    }

    for (const m of others) {
      lines.push(`--- LINKED RIDER: ${m.characterName} (played by another player) ---`);
      lines.push(m.storyDigest!.trim());
      lines.push('');
    }

    lines.push('--- INTERACTION RULES ---');
    lines.push('1. Linked characters may appear as background NPCs or in rumors freely.');
    lines.push('2. Direct scenes with a linked character should be brief — their player controls their words and choices in spirit.');
    lines.push('3. Any world-changing events you narrate should stay consistent with the SHARED CANON list above.');
    lines.push('4. If details conflict, favor the SHARED CANON list.');

    return lines.join('\n');
  }, [state.universe, state.members, state.events, campaignId]);

  const controller = {
    ...state,
    createUniverse,
    joinUniverse,
    leaveUniverse,
    refresh,
    ownMember,
    saveMyDigest,
    universeContext,
    isSignedIn: !!user,
  };

  return controller;
}

export type LinkedUniverseController = ReturnType<typeof useLinkedUniverse>;
