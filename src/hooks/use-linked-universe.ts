import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface UniverseMember {
  id: string;
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

  const createUniverse = useCallback(async (name: string, characterName: string) => {
    if (!user) {
      toast.error('Sign in to create a linked universe');
      return null;
    }
    const cid = campaignRef.current;
    if (!cid) {
      toast.error('Save your campaign first');
      return null;
    }
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
    if (!user) {
      toast.error('Sign in to join a linked universe');
      return false;
    }
    const cid = campaignRef.current;
    if (!cid) {
      toast.error('Save your campaign first');
      return false;
    }
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

  return {
    ...state,
    createUniverse,
    joinUniverse,
    leaveUniverse,
    refresh,
    isSignedIn: !!user,
  };
}
