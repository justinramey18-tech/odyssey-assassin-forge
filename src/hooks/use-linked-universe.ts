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
  region: string | null;
  storyDay: number;
}

export interface UniverseEvent {
  id: string;
  eventText: string;
  eventType: string;
  importance: number;
  createdAt: string | null;
  createdByName: string | null;
  occurredOnDay: number;
}

export interface Crossover {
  id: string;
  universeId: string;
  fromMember: string;
  toMember: string;
  scenePremise: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  narrationA: string | null;
  narrationB: string | null;
  createdAt: string;
  resolvedAt: string | null;
  direction: 'outgoing' | 'incoming';
  mySide: 'a' | 'b';
  otherCharacterName: string;
  otherStoryDigest: string | null;
  liveBeatA?: string | null;
  liveBeatAAt?: string | null;
  liveBeatB?: string | null;
  liveBeatBAt?: string | null;
}

export type RelationKind = 'ally' | 'friend' | 'rival' | 'enemy' | 'owes-you' | 'you-owe-them' | 'acquaintance';

export const RELATION_LABELS: Record<RelationKind, string> = {
  ally: 'Ally',
  friend: 'Friend',
  rival: 'Rival',
  enemy: 'Enemy',
  'owes-you': 'Owes you a debt',
  'you-owe-them': 'You owe them',
  acquaintance: 'Acquaintance',
};

export interface UniverseRelationship {
  id: string;
  memberA: string;
  memberB: string;
  relation: RelationKind;
  note: string | null;
  updatedAt: string | null;
}

export interface LinkedUniverseState {
  universe: { id: string; name: string; linkCode: string; currentDay: number } | null;
  members: UniverseMember[];
  events: UniverseEvent[];
  crossovers: Crossover[];
  relationships: UniverseRelationship[];
  myMemberId: string | null;
  isLoading: boolean;
}

const DEFAULT_STATE: LinkedUniverseState = {
  universe: null,
  members: [],
  events: [],
  crossovers: [],
  relationships: [],
  myMemberId: null,
  isLoading: false,
};

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const REALTIME_DEBOUNCE_MS = 3000;

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
      const [statusRes, cxRes] = await Promise.all([
        invoke('status', { campaignId: cid }),
        invoke('listCrossovers', { campaignId: cid }),
      ]);
      if (statusRes.error || statusRes.data?.error) {
        setState({ ...DEFAULT_STATE, isLoading: false });
        return;
      }
      const { universe, members, events, relationships: relsRaw } = statusRes.data || {};
      if (!universe) {
        setState({ ...DEFAULT_STATE, isLoading: false });
        return;
      }
      const crossovers = (cxRes.data?.crossovers || []) as Crossover[];
      const myMemberId = (cxRes.data?.myMemberId as string) || null;
      const relationships: UniverseRelationship[] = (relsRaw || []).map((r: any) => ({
        id: r.id,
        memberA: r.member_a,
        memberB: r.member_b,
        relation: r.relation,
        note: r.note ?? null,
        updatedAt: r.updated_at ?? null,
      }));
      setState({
        universe: {
          id: universe.id,
          name: universe.name,
          linkCode: universe.link_code,
          currentDay: Number(universe.current_day ?? 0) || 0,
        },
        members: (members || []).map((m: any) => ({
          id: m.id,
          campaignId: m.campaign_id ?? null,
          userId: m.user_id ?? null,
          characterName: m.character_name,
          storyDigest: m.story_digest ?? null,
          digestUpdatedAt: m.digest_updated_at ?? null,
          visibility: m.visibility ?? 'full',
          region: m.region ?? null,
          storyDay: Number(m.story_day ?? 0) || 0,
        })),
        events: (events || []).map((e: any) => ({
          id: e.id,
          eventText: e.event_text,
          eventType: e.event_type,
          importance: e.importance,
          createdAt: e.created_at ?? null,
          createdByName: e.created_by_name ?? null,
          occurredOnDay: Number(e.occurred_on_day ?? 0) || 0,
        })),
        crossovers,
        relationships,
        myMemberId,
        isLoading: false,
      });
    } catch {
      setState({ ...DEFAULT_STATE, isLoading: false });
    }
  }, [invoke, user]);

  useEffect(() => {
    refresh();
  }, [campaignId, user?.id, refresh]);

  // Slow safety poll (15 min) + refresh on focus. Realtime does the heavy lifting below.
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

  // Unseen-event tracking (per-campaign lastSeen timestamp)
  const lastSeenKey = campaignId ? `lu-lastseen-${campaignId}` : null;
  const [lastSeenAt, setLastSeenAt] = useState<number>(() => {
    if (!lastSeenKey) return 0;
    try {
      const raw = localStorage.getItem(lastSeenKey);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch { return 0; }
  });
  useEffect(() => {
    if (!lastSeenKey) { setLastSeenAt(0); return; }
    try {
      const raw = localStorage.getItem(lastSeenKey);
      setLastSeenAt(raw ? parseInt(raw, 10) || 0 : 0);
    } catch { setLastSeenAt(0); }
  }, [lastSeenKey]);

  const markSeen = useCallback(() => {
    if (!lastSeenKey) return;
    const now = Date.now();
    try { localStorage.setItem(lastSeenKey, String(now)); } catch {}
    setLastSeenAt(now);
  }, [lastSeenKey]);

  const myMemberIdRef = useRef<string | null>(null);
  myMemberIdRef.current = state.myMemberId;

  const pendingCrossoversForMe = useMemo(
    () => state.crossovers.filter(c => c.direction === 'incoming' && c.status === 'pending').length,
    [state.crossovers]
  );

  const unseenEvents = useMemo(() => {
    if (!lastSeenAt) return 0;
    const myId = state.myMemberId;
    return state.events.filter(e => {
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      if (t <= lastSeenAt) return false;
      // universe_events don't expose created_by in current status shape; treat createdByName === own character as self-authored
      const ownName = state.members.find(m => m.id === myId)?.characterName;
      if (ownName && e.createdByName && e.createdByName === ownName) return false;
      return true;
    }).length;
  }, [state.events, state.members, state.myMemberId, lastSeenAt]);

  // Realtime subscription scoped to the current universe.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedUniverseIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Toast throttle for world-events (max one per 10s), plus dedupe for crossover toasts
  const lastEventToastAtRef = useRef<number>(0);
  const toastedCrossoverIdsRef = useRef<Set<string>>(new Set());
  const membersRef = useRef(state.members);
  membersRef.current = state.members;

  useEffect(() => {
    const universeId = state.universe?.id ?? null;
    if (subscribedUniverseIdRef.current === universeId && channelRef.current) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      subscribedUniverseIdRef.current = null;
    }
    if (!universeId) return;

    const scheduleRefresh = () => {
      if (debounceTimerRef.current != null) return;
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        refreshRef.current();
      }, REALTIME_DEBOUNCE_MS);
    };

    const handleCrossoverChange = (payload: any) => {
      const row = payload?.new;
      if (row && payload.eventType === 'INSERT' && row.status === 'pending' && row.to_member === myMemberIdRef.current) {
        if (!toastedCrossoverIdsRef.current.has(row.id)) {
          toastedCrossoverIdsRef.current.add(row.id);
          const fromName = membersRef.current.find(m => m.id === row.from_member)?.characterName || 'Another rider';
          const premise = typeof row.scene_premise === 'string' && row.scene_premise.trim()
            ? `: ${row.scene_premise.trim().slice(0, 120)}`
            : '';
          toast(`${fromName} wants a crossover${premise}`);
        }
      }
      scheduleRefresh();
    };

    const handleEventInsert = (payload: any) => {
      const row = payload?.new;
      if (row && row.importance >= 3) {
        // Skip if authored by me (created_by is universe_members.id)
        const isMine = row.created_by && row.created_by === myMemberIdRef.current;
        if (!isMine) {
          const now = Date.now();
          if (now - lastEventToastAtRef.current >= 10_000) {
            lastEventToastAtRef.current = now;
            const text = typeof row.event_text === 'string' ? row.event_text.slice(0, 160) : 'A new world event occurred';
            toast(`World event: ${text}`, { duration: 5000 });
          }
        }
      }
      scheduleRefresh();
    };

    const filter = `universe_id=eq.${universeId}`;
    const channel = supabase
      .channel(`universe:${universeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'universe_members', filter }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'universe_events', filter }, handleEventInsert)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crossover_requests', filter }, handleCrossoverChange)
      .subscribe();

    channelRef.current = channel;
    subscribedUniverseIdRef.current = universeId;

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedUniverseIdRef.current = null;
      }
    };
  }, [state.universe?.id]);

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

  const checkConflict = useCallback(async (proposedText: string): Promise<{ conflict: boolean; reason?: string }> => {
    const uid = universeIdRef.current;
    if (!uid || !proposedText || !proposedText.trim()) return { conflict: false };
    try {
      const res = await invoke('flagConflict', { universeId: uid, proposedText });
      if (res.error || res.data?.error) return { conflict: false };
      return {
        conflict: !!res.data?.conflict,
        reason: typeof res.data?.reason === 'string' ? res.data.reason : undefined,
      };
    } catch {
      return { conflict: false };
    }
  }, [invoke]);

  const saveMyDigest = useCallback(async (digest: string) => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    if (digest.length > 5000) { toast.error('Digest must be 5000 characters or fewer'); return false; }
    try {
      const res = await invoke('saveDigest', { campaignId: cid, digest });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to save digest');
        return false;
      }
      toast.success('Story digest saved');
      await refresh();
      // Non-blocking canon conflict check — warn only, save already succeeded
      checkConflict(digest).then(({ conflict, reason }) => {
        if (conflict) {
          toast.warning(`Heads up: this may conflict with established world canon${reason ? ` — ${reason}` : ''}`);
        }
      }).catch(() => {});
      return true;
    } catch {
      toast.error('Failed to save digest');
      return false;
    }
  }, [invoke, refresh, checkConflict]);

  const lastAutoDigestAtRef = useRef<number>(0);
  const universeIdRef = useRef<string | null>(null);
  universeIdRef.current = state.universe?.id ?? null;

  const generateDigestFromSummary = useCallback(async (campaignSummary: string, characterName: string) => {
    const cid = campaignRef.current;
    if (!cid) return;
    if (!universeIdRef.current) return; // not linked, silent no-op
    if (!campaignSummary || !campaignSummary.trim()) return;
    const now = Date.now();
    if (now - lastAutoDigestAtRef.current < 60_000) return; // debounce 60s
    lastAutoDigestAtRef.current = now;
    try {
      const res = await invoke('generateDigest', {
        campaignId: cid,
        campaignSummary,
        characterName: characterName || 'Adventurer',
      });
      if (res.error || res.data?.error) return;
      if (res.data?.success) {
        refresh();
      }
    } catch {
      // silent
    }
  }, [invoke, refresh]);

  const setVisibility = useCallback(async (value: 'full' | 'headline' | 'hidden') => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    if (!['full', 'headline', 'hidden'].includes(value)) return false;
    try {
      const res = await invoke('setVisibility', { campaignId: cid, visibility: value });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to update visibility');
        return false;
      }
      toast.success(
        value === 'full' ? 'Story visibility: Full' :
        value === 'headline' ? 'Story visibility: Headline only' :
        'Story visibility: Hidden'
      );
      await refresh();
      return true;
    } catch {
      toast.error('Failed to update visibility');
      return false;
    }
  }, [invoke, refresh]);

  const myVisibility = useMemo<'full' | 'headline' | 'hidden'>(() => {
    const v = ownMember?.visibility;
    return v === 'headline' || v === 'hidden' ? v : 'full';
  }, [ownMember?.visibility]);

  const myRegion = useMemo<string | null>(() => ownMember?.region ?? null, [ownMember?.region]);

  const setRegion = useCallback(async (value: string | null) => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    const cleaned = value === null ? null : value.trim().slice(0, 64) || null;
    try {
      const res = await invoke('setRegion', { campaignId: cid, region: cleaned });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to update region');
        return false;
      }
      toast.success(cleaned ? `Region set: ${cleaned}` : 'Region cleared (global)');
      await refresh();
      return true;
    } catch {
      toast.error('Failed to update region');
      return false;
    }
  }, [invoke, refresh]);

  const setRelationship = useCallback(async (toMemberId: string, relation: RelationKind, note?: string | null) => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    try {
      const res = await invoke('setRelationship', {
        fromCampaignId: cid,
        toMemberId,
        relation,
        note: note ?? null,
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to update relationship');
        return false;
      }
      toast.success(`Relationship set: ${RELATION_LABELS[relation]}`);
      await refresh();
      return true;
    } catch {
      toast.error('Failed to update relationship');
      return false;
    }
  }, [invoke, refresh]);

  const relationshipByMember = useMemo(() => {
    const map = new Map<string, UniverseRelationship>();
    for (const r of state.relationships) map.set(r.memberB, r);
    return map;
  }, [state.relationships]);

  const setStoryDay = useCallback(async (storyDay: number) => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    const clean = Math.max(0, Math.min(100000, Math.floor(Number(storyDay) || 0)));
    try {
      const res = await invoke('setStoryDay', { campaignId: cid, storyDay: clean });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to update in-fiction day');
        return false;
      }
      toast.success(`In-fiction day set: Day ${clean}`);
      await refresh();
      return true;
    } catch {
      toast.error('Failed to update in-fiction day');
      return false;
    }
  }, [invoke, refresh]);

  const myStoryDay = useMemo<number>(() => ownMember?.storyDay ?? 0, [ownMember?.storyDay]);
  const universeCurrentDay = useMemo<number>(() => state.universe?.currentDay ?? 0, [state.universe?.currentDay]);

  const MAX_FULL_DIGESTS = 6;
  const FUTURE_GRACE_DAYS = 1;

  const universeContext = useMemo(() => {
    if (!state.universe) return null;
    const callerStoryDay = ownMember?.storyDay ?? 0;
    const callerRegion = ownMember?.region?.trim() || null;
    const visibleOthers = state.members.filter(
      m => m.campaignId !== campaignId && m.visibility !== 'hidden' && m.storyDigest && m.storyDigest.trim()
    );
    // Filter events by caller's in-fiction position (future events are withheld)
    const timeVisibleEvents = state.events.filter(e => (e.occurredOnDay || 0) <= callerStoryDay + FUTURE_GRACE_DAYS);
    if (visibleOthers.length === 0 && timeVisibleEvents.length === 0) return null;

    // Region scoping: if caller has a region, same-region members keep their tier,
    // other-region members are demoted to 'headline' regardless of their visibility.
    const scoped = visibleOthers.map(m => {
      if (!callerRegion) return { m, tier: (m.visibility === 'headline' ? 'headline' : 'full') as 'full' | 'headline' };
      const sameRegion = (m.region?.trim() || null) === callerRegion;
      const tier: 'full' | 'headline' = sameRegion
        ? (m.visibility === 'headline' ? 'headline' : 'full')
        : 'headline';
      return { m, tier };
    });

    // Cap total FULL digests. Prefer most recently updated ones.
    const fullEntries = scoped.filter(s => s.tier === 'full')
      .sort((a, b) => {
        const at = a.m.digestUpdatedAt ? new Date(a.m.digestUpdatedAt).getTime() : 0;
        const bt = b.m.digestUpdatedAt ? new Date(b.m.digestUpdatedAt).getTime() : 0;
        return bt - at;
      });
    const keepFull = new Set(fullEntries.slice(0, MAX_FULL_DIGESTS).map(s => s.m.id));
    const demotedByCap = fullEntries.length - keepFull.size;
    const finalScoped = scoped.map(s =>
      s.tier === 'full' && !keepFull.has(s.m.id) ? { ...s, tier: 'headline' as const } : s
    );

    const lines: string[] = [];
    lines.push(`=== LINKED UNIVERSE: "${state.universe.name}" ===`);
    lines.push(`Your player's story is linked to other riders' stories in this shared world. These events are happening in parallel. You may reference these characters as NPCs, have your player hear rumors about them, or cross paths naturally. You may NOT kill, injure, or make major story decisions for linked characters — they belong to their own players.`);
    lines.push(`Your story is at in-fiction Day ${callerStoryDay}. The wider world has reached Day ${state.universe.currentDay ?? 0}. Some riders are further ahead in time; do NOT narrate events from their future as if your player already experienced them.`);
    if (callerRegion) {
      lines.push(`Your player is currently in region: ${callerRegion}. Riders in the same region are shown in full detail; riders elsewhere are only summarized.`);
    }
    if (demotedByCap > 0) {
      lines.push(`(The world is larger than what is shown here — ${demotedByCap} additional rider(s) exist but are summarized only.)`);
    }
    lines.push('');

    const importanceLabel = (n: number) => n >= 3 ? 'World-changing' : n === 2 ? 'Notable' : 'Minor';
    const timingLabel = (day: number) => {
      const diff = callerStoryDay - day;
      if (diff >= 7) return 'some time ago';
      if (diff >= 2) return 'recently';
      if (diff >= -1) return 'recent';
      return 'just ahead';
    };
    const capped = [...timeVisibleEvents]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);
    if (capped.length > 0) {
      lines.push('--- SHARED CANON (established facts within your timeline, treat as true) ---');
      for (const ev of capped) {
        const dayTag = ev.occurredOnDay ? ` (Day ${ev.occurredOnDay} · ${timingLabel(ev.occurredOnDay)})` : '';
        lines.push(`• [${importanceLabel(ev.importance)}]${dayTag} ${ev.eventText}`);
      }
      lines.push('');
      lines.push('--- CANON CONSISTENCY (binding) ---');
      lines.push('The SHARED CANON events above are established facts your player has reached in the timeline. When you narrate, you MUST NOT contradict them. If the player attempts something that would contradict canon (e.g. visiting a place that canon says was destroyed, or interacting with someone canon says is dead), acknowledge the established fact in the fiction rather than ignoring it. You may build on canon, add nuance, or reveal new details, but you may not reverse an established world-changing event unless the fiction explicitly earns it. Events from other riders that occur AFTER your player\'s current day are hidden from you — do NOT invent or reference them.');
      lines.push('');
    }

    for (const { m, tier } of finalScoped) {
      const regionTag = m.region?.trim() ? ` [${m.region.trim()}]` : '';
      const dayTag = m.storyDay ? ` (at Day ${m.storyDay})` : '';
      const rel = relationshipByMember.get(m.id);
      const historyLine = rel
        ? `YOUR HISTORY WITH THEM: ${RELATION_LABELS[rel.relation]}${rel.note ? ` — ${rel.note}` : ''}`
        : null;
      if (tier === 'headline') {
        const firstLine = m.storyDigest!.split('\n').map(s => s.trim()).find(s => s.length > 0) || '';
        lines.push(`• ${m.characterName}${regionTag}${dayTag} is also in this world: ${firstLine}`);
        if (historyLine) lines.push(`  ${historyLine}`);
        lines.push('');
      } else {
        lines.push(`--- LINKED RIDER: ${m.characterName}${regionTag}${dayTag} (played by another player) ---`);
        lines.push(m.storyDigest!.trim());
        if (historyLine) lines.push(historyLine);
        lines.push('');
      }
    }


    lines.push('--- INTERACTION RULES ---');
    lines.push('1. Linked characters may appear as background NPCs or in rumors freely.');
    lines.push('2. Direct scenes with a linked character should be brief — their player controls their words and choices in spirit.');
    lines.push('3. Any world-changing events you narrate should stay consistent with the SHARED CANON list above.');
    lines.push('4. If details conflict, favor the SHARED CANON list.');
    lines.push('5. When YOUR HISTORY WITH THEM is provided, weave that prior bond or grudge into how they behave toward the player — reference past dealings naturally.');
    lines.push('6. Respect the in-fiction timeline: never narrate an event from another rider\'s future as if your player has experienced it.');

    return lines.join('\n');
  }, [state.universe, state.members, state.events, campaignId, ownMember?.region, ownMember?.storyDay, relationshipByMember]);

  const requestCrossover = useCallback(async (toMemberId: string, scenePremise: string) => {
    const cid = campaignRef.current;
    if (!cid) { toast.error('Save your campaign first'); return false; }
    try {
      const res = await invoke('requestCrossover', {
        fromCampaignId: cid,
        toMemberId,
        scenePremise: scenePremise.trim(),
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to request crossover');
        return false;
      }
      toast.success('Crossover requested');
      await refresh();
      return true;
    } catch {
      toast.error('Failed to request crossover');
      return false;
    }
  }, [invoke, refresh]);

  const respondCrossover = useCallback(async (crossoverId: string, accept: boolean) => {
    try {
      const res = await invoke('respondCrossover', { crossoverId, accept });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to respond');
        return false;
      }
      toast.success(accept ? 'Crossover accepted' : 'Crossover declined');
      await refresh();
      return true;
    } catch {
      toast.error('Failed to respond');
      return false;
    }
  }, [invoke, refresh]);

  const saveCrossoverNarration = useCallback(async (
    crossoverId: string,
    side: 'a' | 'b',
    narration: string,
    relationUpdate?: { relation: RelationKind; note?: string | null } | null,
  ) => {
    try {
      const payload: Record<string, unknown> = { crossoverId, side, narration };
      if (relationUpdate && relationUpdate.relation) {
        payload.relation = relationUpdate.relation;
        payload.note = relationUpdate.note ?? null;
      }
      const res = await invoke('saveCrossoverNarration', payload);
      if (res.error || res.data?.error) return false;
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [invoke, refresh]);

  const buildCrossoverPrompt = useCallback((cx: Crossover): string => {
    const digest = cx.otherStoryDigest?.trim() || `(no digest available — improvise a brief in-character appearance for ${cx.otherCharacterName})`;
    const premise = cx.scenePremise?.trim();
    const lines = [
      '=== CROSSOVER SCENE ===',
      `Your player is about to share a scene with ${cx.otherCharacterName}, a rider from a linked story. Here is who they are:`,
      '',
      digest,
      '',
    ];
    if (premise) {
      lines.push(`SCENE PREMISE: ${premise}`);
      lines.push('');
    }
    lines.push('Narrate a brief encounter between your player and this character. Keep the other character IN CHARACTER based on their digest, but do NOT make major life decisions for them — leave room for their own player. Aim for a memorable but self-contained moment (a conversation, a chance meeting, a brief alliance or clash).');
    return lines.join('\n');
  }, []);

  const [activeCrossoverId, setActiveCrossoverId] = useState<string | null>(null);
  const activeCrossover = useMemo(
    () => state.crossovers.find(c => c.id === activeCrossoverId) ?? null,
    [state.crossovers, activeCrossoverId]
  );
  const pendingCrossoverPrompt = useMemo(
    () => activeCrossover ? buildCrossoverPrompt(activeCrossover) : null,
    [activeCrossover, buildCrossoverPrompt]
  );

  // Auto-detect an accepted crossover involving this rider (for live beat relay)
  const acceptedCrossover = useMemo(
    () => state.crossovers.find(c => c.status === 'accepted') ?? null,
    [state.crossovers]
  );

  const lastBeatPushAtRef = useRef<number>(0);
  const pushLiveBeat = useCallback(async (narration: string) => {
    const cx = acceptedCrossover;
    if (!cx || cx.status !== 'accepted') return;
    const text = (narration || '').trim();
    if (!text) return;
    const cid = campaignRef.current;
    if (!cid) return;
    const now = Date.now();
    if (now - lastBeatPushAtRef.current < 4000) return;
    lastBeatPushAtRef.current = now;
    try {
      await invoke('pushBeat', { crossoverId: cx.id, campaignId: cid, narration: text.slice(0, 2000) });
    } catch {
      // fire-and-forget
    }
  }, [acceptedCrossover, invoke]);

  const liveBeatContext = useMemo<string | null>(() => {
    const cx = acceptedCrossover;
    if (!cx) return null;
    const mySide = cx.mySide;
    const myBeat = mySide === 'a' ? cx.liveBeatA : cx.liveBeatB;
    const myBeatAt = mySide === 'a' ? cx.liveBeatAAt : cx.liveBeatBAt;
    const otherBeat = mySide === 'a' ? cx.liveBeatB : cx.liveBeatA;
    const otherBeatAt = mySide === 'a' ? cx.liveBeatBAt : cx.liveBeatAAt;
    const otherText = (otherBeat || '').trim();
    if (!otherText) return null;

    const myT = myBeatAt ? new Date(myBeatAt).getTime() : 0;
    const otherT = otherBeatAt ? new Date(otherBeatAt).getTime() : 0;
    // Other is canon if I have no beat yet, or their beat is earlier than mine
    const otherIsCanon = !myT || (otherT > 0 && otherT < myT);

    const lines: string[] = [];
    lines.push('=== LIVE CROSSOVER — SHARED SCENE IN PROGRESS ===');
    lines.push(`You are sharing this exact moment with ${cx.otherCharacterName}, played by another player. Here is what just happened in THEIR narration of this shared scene:`);
    lines.push('---');
    lines.push(otherText);
    lines.push('---');
    if (otherIsCanon) {
      lines.push('This was narrated FIRST and is now ESTABLISHED CANON for this shared moment. You MUST narrate your own player\'s perspective of these SAME events consistently. Do NOT contradict, undo, or re-narrate the shared beat differently. Show what your player experiences and does within the events above — reactions, choices, dialogue — but the shared physical events themselves are fixed.');
    } else {
      lines.push('Your player already established this shared beat. Treat the above as the other rider\'s reaction to events you set in motion. Keep consistent; do not overwrite their character\'s choices.');
    }
    lines.push('--- END LIVE CROSSOVER ---');
    return lines.join('\n');
  }, [acceptedCrossover]);

  const activateCrossover = useCallback((crossoverId: string) => {
    setActiveCrossoverId(crossoverId);
  }, []);
  const clearActiveCrossover = useCallback(() => setActiveCrossoverId(null), []);

  const controller = {
    ...state,
    createUniverse,
    joinUniverse,
    leaveUniverse,
    refresh,
    ownMember,
    saveMyDigest,
    generateDigestFromSummary,
    checkConflict,
    universeContext,
    requestCrossover,
    respondCrossover,
    saveCrossoverNarration,
    buildCrossoverPrompt,
    activateCrossover,
    clearActiveCrossover,
    activeCrossover,
    activeCrossoverId,
    pendingCrossoverPrompt,
    pendingCrossoversForMe,
    unseenEvents,
    markSeen,
    myVisibility,
    setVisibility,
    myRegion,
    setRegion,
    setRelationship,
    relationshipByMember,
    myStoryDay,
    universeCurrentDay,
    setStoryDay,
    isSignedIn: !!user,
  };

  return controller;
}

export type LinkedUniverseController = ReturnType<typeof useLinkedUniverse>;
