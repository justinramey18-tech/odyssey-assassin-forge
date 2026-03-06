import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import type { CharacterContext, Whisper } from '@/components/oracle/types';
import type { DmSplitState, SplitTeam } from '@/lib/party-split-types';
import { sendReadyUpNotification } from '@/lib/party-notifications';
import { parseWhispers } from '@/lib/whisper-parser';
import { loadCombatSettings } from '@/lib/combat/combatSettings';
import { formatPartyPowerForPrompt } from '@/lib/combat/encounterDifficulty';
import { getAlignmentZone, type AlignmentScore } from '@/lib/alignmentSpectrum';

function loadAlignmentDrift(): { position: AlignmentScore; zone: string } | null {
  try {
    const activeId = localStorage.getItem('odyssey-active-cloud-save-id');
    const key = activeId ? `odyssey-alignment-drift_${activeId}` : 'odyssey-alignment-drift';
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entries: Array<{ law: number; good: number }> = JSON.parse(raw);
    if (!entries.length) return null;
    const decay = 0.92;
    let totalW = 0, lawS = 0, goodS = 0;
    for (let i = 0; i < entries.length; i++) {
      const w = Math.pow(decay, entries.length - 1 - i);
      lawS += entries[i].law * w;
      goodS += entries[i].good * w;
      totalW += w;
    }
    const position: AlignmentScore = {
      law: Math.round((lawS / totalW) * 10) / 10,
      good: Math.round((goodS / totalW) * 10) / 10,
    };
    const zone = getAlignmentZone(position);
    return { position, zone: zone.label };
  } catch { return null; }
}

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
const SUMMARIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-summarize`;
const SUMMARY_INTERVAL = 5;

export interface PartyDmMessage {
  id: string;
  party_id: string;
  role: 'user' | 'assistant';
  content: string;
  sender_user_id: string | null;
  sender_name: string;
  created_at: string;
  team?: string | null;
  whispers?: Whisper[];
}

/**
 * Parse whispers from an assistant message, filter by character name,
 * and return the message with clean content + filtered whispers.
 */
function enrichMessageWithWhispers(msg: PartyDmMessage, myCharacterName?: string): PartyDmMessage {
  if (msg.role !== 'assistant') return msg;
  const { narrative, whispers } = parseWhispers(msg.content);
  if (whispers.length === 0) return { ...msg, content: narrative };

  // Filter: keep actions + tactics (shared), and whispers targeted at this player
  const filtered = whispers.filter(w => {
    if (w.type !== 'whisper') return true; // actions & tactics visible to all
    if (!myCharacterName) return false; // no character name = hide targeted whispers
    return w.target?.toLowerCase() === myCharacterName.toLowerCase();
  });

  return {
    ...msg,
    content: narrative,
    whispers: filtered.length > 0 ? filtered : undefined,
  };
}

export interface PartyDmPrompt {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  prompt: string;
  is_ready: boolean;
  round_id: string;
  created_at: string;
  team?: string | null;
}

export interface DmSessionConfig {
  active: boolean;
  mode: 'shared' | 'private';
  currentRoundId: string;
  campaignSummary: string | null;
  isGenerating: boolean;
  splitActive?: boolean;
  // Round timer
  timerEnabled?: boolean;
  timerDurationSeconds?: number; // default duration for new rounds
  timerStartedAt?: string | null; // ISO timestamp when timer was started
  timerPausedRemaining?: number | null; // seconds remaining when paused
  extensionRequests?: Array<{ userId: string; name: string }>;
}

interface UsePartyDmOptions {
  partyId: string | null;
  isCreator: boolean;
  memberCount: number;
  characterName: string;
  characterContext: CharacterContext;
  partyMembers: Array<{ character_name: string; character_status: Record<string, unknown>; user_id: string }>;
  customGuidesContent?: string;
}

export function usePartyDm({ partyId, isCreator, memberCount, characterName, characterContext, partyMembers, customGuidesContent }: UsePartyDmOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PartyDmMessage[]>([]);
  const [currentPrompts, setCurrentPrompts] = useState<PartyDmPrompt[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<DmSessionConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoGenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Split state
  const [splitState, setSplitState] = useState<DmSplitState | null>(null);

  const isActive = sessionConfig?.active === true;
  const isSplitActive = splitState?.active === true;

  // Determine current user's team
  const myTeam: SplitTeam = isSplitActive && user
    ? splitState.alphaMembers.includes(user.id) ? 'alpha'
    : splitState.betaMembers.includes(user.id) ? 'beta'
    : null
    : null;

  // Derived: all members ready (in split mode, only count the relevant team)
  const effectiveMemberCount = isSplitActive && splitState && user
    ? (splitState.alphaMembers.includes(user.id)
        ? splitState.alphaMembers.length
        : splitState.betaMembers.includes(user.id)
          ? splitState.betaMembers.length
          : memberCount)
    : memberCount;

  // In split mode, the host triggers generation when BOTH teams have all members ready
  const allReady = (() => {
    if (!isSplitActive || !splitState) {
      return currentPrompts.length > 0 &&
        currentPrompts.length >= memberCount &&
        currentPrompts.every(p => p.is_ready);
    }
    // Split mode: check each team independently — all must be ready
    const alphaPrompts = currentPrompts.filter(p => splitState.alphaMembers.includes(p.user_id));
    const betaPrompts = currentPrompts.filter(p => splitState.betaMembers.includes(p.user_id));
    const alphaReady = alphaPrompts.length >= splitState.alphaMembers.length && alphaPrompts.every(p => p.is_ready);
    const betaReady = betaPrompts.length >= splitState.betaMembers.length && betaPrompts.every(p => p.is_ready);
    return alphaReady && betaReady;
  })();

  // Filter messages based on team membership + enrich with parsed whispers
  const filteredMessages = useMemo(() => {
    const teamFiltered = isSplitActive && user
      ? isCreator
        ? messages // Host sees all
        : messages.filter(m => !m.team || m.team === myTeam)
      : messages;
    // Parse whispers from assistant messages and filter by character name
    return teamFiltered.map(m => enrichMessageWithWhispers(m, characterName));
  }, [messages, isSplitActive, user, isCreator, myTeam, characterName]);

  // Load existing data when session becomes active
  useEffect(() => {
    if (!partyId || !isActive) return;

    (async () => {
      const { data: msgs } = await (supabase.from('party_dm_messages') as any)
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (msgs) setMessages(msgs);

      if (sessionConfig?.currentRoundId) {
        const { data: prompts } = await (supabase.from('party_dm_prompts') as any)
          .select('*')
          .eq('party_id', partyId)
          .eq('round_id', sessionConfig.currentRoundId);
        if (prompts) setCurrentPrompts(prompts);
      }
    })();
  }, [partyId, isActive, sessionConfig?.currentRoundId]);

  // Load session config from party_shared_state
  useEffect(() => {
    if (!partyId) return;

    (async () => {
      const { data } = await (supabase.from('party_shared_state') as any)
        .select('*')
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session')
        .maybeSingle();
      if (data?.state_data) {
        setSessionConfig(data.state_data as DmSessionConfig);
      }

      // Load split state
      const { data: splitData } = await (supabase.from('party_shared_state') as any)
        .select('*')
        .eq('party_id', partyId)
        .eq('state_type', 'dm_split')
        .maybeSingle();
      if (splitData?.state_data) {
        setSplitState(splitData.state_data as DmSplitState);
      }
    })();
  }, [partyId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!partyId) return;

    const msgChannel = supabase
      .channel(`party-dm-msgs-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_dm_messages',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as PartyDmMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as PartyDmMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string };
          if (old.id) {
            setMessages(prev => prev.filter(m => m.id !== old.id));
          }
        }
      })
      .subscribe();

    const promptChannel = supabase
      .channel(`party-dm-prompts-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_dm_prompts',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new as PartyDmPrompt;
          setCurrentPrompts(prev => {
            if (prev.some(x => x.id === p.id)) return prev;
            const updated = [...prev, p];
            // Notify if the inserted prompt is already ready and not from current user
            if (p.is_ready && p.user_id !== user?.id) {
              const readyCount = updated.filter(x => x.is_ready).length;
              sendReadyUpNotification(p.character_name, readyCount, memberCount);
            }
            return updated;
          });
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as PartyDmPrompt;
          const oldPrompt = payload.old as Partial<PartyDmPrompt>;
          setCurrentPrompts(prev => {
            const updated = prev.map(x => x.id === p.id ? p : x);
            // Notify on is_ready transition (false → true) from another user
            if (p.is_ready && !oldPrompt.is_ready && p.user_id !== user?.id) {
              const readyCount = updated.filter(x => x.is_ready).length;
              sendReadyUpNotification(p.character_name, readyCount, memberCount);
            }
            return updated;
          });
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string };
          if (old.id) {
            setCurrentPrompts(prev => prev.filter(x => x.id !== old.id));
          } else {
            setCurrentPrompts([]);
          }
        }
      })
      .subscribe();

    const stateChannel = supabase
      .channel(`party-dm-state-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { state_type?: string };
          if (old.state_type === 'dm_session') {
            setSessionConfig(null);
            setMessages([]);
            setCurrentPrompts([]);
          }
          if (old.state_type === 'dm_split') {
            setSplitState(null);
          }
          return;
        }
        const row = (payload.new || payload.old) as { state_type: string; state_data: unknown };
        if (row.state_type === 'dm_session') {
          setSessionConfig(row.state_data as DmSessionConfig);
        }
        if (row.state_type === 'dm_split') {
          setSplitState(row.state_data as DmSplitState);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(promptChannel);
      supabase.removeChannel(stateChannel);
    };
  }, [partyId]);


  const startSession = useCallback(async (mode: 'shared' | 'private', initialCampaignSummary?: string | null) => {
    if (!partyId || !user) return;
    const roundId = crypto.randomUUID();
    const config: DmSessionConfig = {
      active: true,
      mode,
      currentRoundId: roundId,
      campaignSummary: initialCampaignSummary || null,
      isGenerating: false,
    };

    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_session',
      state_data: config,
    }, { onConflict: 'party_id,user_id,state_type' });

    setSessionConfig(config);
    toast.success('Party DM session started!');
  }, [partyId, user]);

  const endSession = useCallback(async () => {
    if (!partyId || !user) return;
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    // Also clean up split state if active
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('state_type', 'dm_split');
    setSessionConfig(null);
    setSplitState(null);
    setMessages([]);
    setCurrentPrompts([]);
    toast.info('Party DM session ended');
  }, [partyId, user]);

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

  // Use a ref to track activeCampaignId to prevent duplicate campaign creation
  const activeCampaignIdRef = useRef<string | null>(null);
  useEffect(() => { activeCampaignIdRef.current = activeCampaignId; }, [activeCampaignId]);

  // Silent auto-save after each DM response (no toasts)
  const silentAutoSave = useCallback(async (allMessages: PartyDmMessage[], summary: string | null) => {
    if (!user || allMessages.length === 0) return;
    try {
      const serializedMessages = allMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sender_user_id: m.sender_user_id,
        sender_name: m.sender_name,
        created_at: m.created_at,
      }));

      const currentCampaignId = activeCampaignIdRef.current;

      if (currentCampaignId) {
        await supabase
          .from('ai_dm_campaigns')
          .update({
            messages: serializedMessages as any,
            campaign_summary: summary,
          })
          .eq('id', currentCampaignId)
          .eq('user_id', user.id);
      } else {
        const { data } = await supabase
          .from('ai_dm_campaigns')
          .insert({
            user_id: user.id,
            name: `Party Campaign ${new Date().toLocaleDateString()}`,
            messages: serializedMessages as any,
            campaign_summary: summary,
            mode: 'party',
          } as any)
          .select('id')
          .single();
        if (data) {
          activeCampaignIdRef.current = data.id;
          setActiveCampaignId(data.id);
        }
      }
      setLastAutoSaveTime(new Date());
    } catch (error) {
      console.warn('[Party Auto-Save] Failed:', error);
    }
  }, [user]);

  const startNewCampaign = useCallback(async (campaignName?: string) => {
    if (!partyId || !user || !isCreator) return;
    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('party_id', partyId);
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('party_id', partyId);
    // Clear split state if any
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('state_type', 'dm_split');
    setSplitState(null);

    const roundId = crypto.randomUUID();
    const currentMode = sessionConfig?.mode || 'shared';
    const config: DmSessionConfig = {
      active: true,
      mode: currentMode,
      currentRoundId: roundId,
      campaignSummary: null,
      isGenerating: false,
    };
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_session',
      state_data: config,
    }, { onConflict: 'party_id,user_id,state_type' });
    setSessionConfig(config);
    setMessages([]);
    setCurrentPrompts([]);
    setActiveCampaignId(null);
    toast.success(campaignName ? `"${campaignName}" started!` : 'New campaign started!');
  }, [partyId, user, isCreator, sessionConfig]);

  const saveCampaign = useCallback(async (name: string, existingId?: string): Promise<string | null> => {
    if (!partyId || !user) {
      toast.error('Sign in to save campaigns');
      return null;
    }
    try {
      const serializedMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sender_user_id: m.sender_user_id,
        sender_name: m.sender_name,
        created_at: m.created_at,
      }));

      if (existingId) {
        const { error } = await supabase
          .from('ai_dm_campaigns')
          .update({
            name,
            messages: serializedMessages as any,
            campaign_summary: sessionConfig?.campaignSummary || null,
          })
          .eq('id', existingId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('Campaign saved');
        setActiveCampaignId(existingId);
        setLastAutoSaveTime(new Date());
        return existingId;
      } else {
        const { data, error } = await supabase
          .from('ai_dm_campaigns')
          .insert({
            user_id: user.id,
            name,
            messages: serializedMessages as any,
            campaign_summary: sessionConfig?.campaignSummary || null,
            mode: 'party',
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        toast.success('Campaign saved');
        setActiveCampaignId(data.id);
        setLastAutoSaveTime(new Date());
        return data.id;
      }
    } catch (error) {
      console.error('Failed to save party campaign:', error);
      toast.error('Failed to save campaign');
      return null;
    }
  }, [partyId, user, messages, sessionConfig]);

  const loadCampaign = useCallback(async (campaignId: string, campaignMessages: any[], campaignSummary: string | null) => {
    if (!partyId || !user || !isCreator) return;
    await (supabase.from('party_dm_messages') as any).delete().eq('party_id', partyId);
    await (supabase.from('party_dm_prompts') as any).delete().eq('party_id', partyId);

    for (const msg of campaignMessages) {
      await (supabase.from('party_dm_messages') as any).insert({
        party_id: partyId,
        role: msg.role,
        content: msg.content,
        sender_user_id: msg.sender_user_id || null,
        sender_name: msg.sender_name || (msg.role === 'assistant' ? 'DM' : 'Party'),
      });
    }

    const roundId = crypto.randomUUID();
    const config: DmSessionConfig = {
      ...(sessionConfig || { active: true, mode: 'shared', isGenerating: false }),
      currentRoundId: roundId,
      campaignSummary,
      isGenerating: false,
    };
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_session',
      state_data: config,
    }, { onConflict: 'party_id,user_id,state_type' });
    setSessionConfig(config);
    setActiveCampaignId(campaignId);
    toast.success('Campaign loaded!');
  }, [partyId, user, isCreator, sessionConfig]);

  const submitLockRef = useRef(false);

  const submitPrompt = useCallback(async (text: string) => {
    if (!partyId || !user || !sessionConfig) return;
    if (submitLockRef.current) return;
    const existing = currentPrompts.find(p => p.user_id === user.id);
    if (existing) {
      toast.error('You already submitted a prompt this round');
      return;
    }
    submitLockRef.current = true;
    const optimisticId = crypto.randomUUID();
    const insertData: Record<string, unknown> = {
      id: optimisticId,
      party_id: partyId,
      user_id: user.id,
      character_name: characterName,
      prompt: text.trim(),
      is_ready: false,
      round_id: sessionConfig.currentRoundId,
    };
    // Tag with team if split is active
    if (isSplitActive && myTeam) {
      insertData.team = myTeam;
    }
    // Optimistic update — add prompt locally so UI transitions immediately
    const optimisticPrompt: PartyDmPrompt = {
      id: optimisticId,
      party_id: partyId,
      user_id: user.id,
      character_name: characterName,
      prompt: text.trim(),
      is_ready: false,
      round_id: sessionConfig.currentRoundId,
      created_at: new Date().toISOString(),
      team: (isSplitActive && myTeam) ? myTeam : null,
    };
    setCurrentPrompts(prev => [...prev, optimisticPrompt]);
    const { error } = await (supabase.from('party_dm_prompts') as any).insert(insertData);
    if (error) {
      // Rollback optimistic update on failure
      setCurrentPrompts(prev => prev.filter(p => p.id !== optimisticId));
      toast.error('Failed to submit prompt');
    }
    submitLockRef.current = false;
  }, [partyId, user, sessionConfig, characterName, currentPrompts, isSplitActive, myTeam]);

  const setReady = useCallback(async () => {
    if (!user || !partyId || !sessionConfig) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (myPrompt) {
      // Optimistic update
      setCurrentPrompts(prev => prev.map(p => p.id === myPrompt.id ? { ...p, is_ready: true } : p));
      await (supabase.from('party_dm_prompts') as any)
        .update({ is_ready: true })
        .eq('id', myPrompt.id);
    } else {
      const optimisticId = crypto.randomUUID();
      const insertData: Record<string, unknown> = {
        id: optimisticId,
        party_id: partyId,
        user_id: user.id,
        character_name: characterName,
        prompt: '',
        is_ready: true,
        round_id: sessionConfig.currentRoundId,
      };
      if (isSplitActive && myTeam) {
        insertData.team = myTeam;
      }
      // Optimistic update
      const optimisticPrompt: PartyDmPrompt = {
        id: optimisticId,
        party_id: partyId,
        user_id: user.id,
        character_name: characterName,
        prompt: '',
        is_ready: true,
        round_id: sessionConfig.currentRoundId,
        created_at: new Date().toISOString(),
        team: (isSplitActive && myTeam) ? myTeam : null,
      };
      setCurrentPrompts(prev => [...prev, optimisticPrompt]);
      await (supabase.from('party_dm_prompts') as any).insert(insertData);
    }
  }, [user, partyId, sessionConfig, characterName, currentPrompts, isSplitActive, myTeam]);

  const unready = useCallback(async () => {
    if (!user || !partyId || !sessionConfig) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (myPrompt && myPrompt.is_ready) {
      // Optimistic update
      setCurrentPrompts(prev => prev.map(p => p.id === myPrompt.id ? { ...p, is_ready: false } : p));
      await (supabase.from('party_dm_prompts') as any)
        .update({ is_ready: false })
        .eq('id', myPrompt.id);
    }
  }, [partyId, user, sessionConfig, currentPrompts]);

  const editPrompt = useCallback(async (newText: string) => {
    if (!user) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (!myPrompt || myPrompt.is_ready) return;
    // Optimistic update
    setCurrentPrompts(prev => prev.map(p => p.id === myPrompt.id ? { ...p, prompt: newText.trim() } : p));
    await (supabase.from('party_dm_prompts') as any)
      .update({ prompt: newText.trim() })
      .eq('id', myPrompt.id);
  }, [user, currentPrompts]);

  const retractPrompt = useCallback(async () => {
    if (!user) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (!myPrompt || myPrompt.is_ready) return;
    // Optimistic update
    setCurrentPrompts(prev => prev.filter(p => p.id !== myPrompt.id));
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('id', myPrompt.id);
  }, [user, currentPrompts]);

  // Auto-summarize after every Nth assistant message
  const triggerSummaryIfNeeded = useCallback(async (allMessages: PartyDmMessage[]) => {
    if (!partyId || !isCreator || !sessionConfig) return;
    const assistantCount = allMessages.filter(m => m.role === 'assistant' && m.content).length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    setIsSummarizing(true);
    try {
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));
      const authToken = await getAuthToken();
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          previousSummary: sessionConfig.campaignSummary || undefined,
        }),
      });

      if (!response.ok) {
        console.error('Party DM summary generation failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.summary) {
        const updatedConfig: DmSessionConfig = {
          ...sessionConfig,
          campaignSummary: data.summary,
        };
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: updatedConfig })
          .eq('party_id', partyId)
          .eq('state_type', 'dm_session');
        toast.success('Party campaign summary updated', { duration: 2000 });
      }
    } catch (error) {
      console.error('Party summary generation error:', error);
    } finally {
      setIsSummarizing(false);
    }
  }, [partyId, isCreator, sessionConfig]);

  // Helper: stream an AI response and return the content
  const streamAIResponse = useCallback(async (
    apiMessages: Array<{ role: string; content: string }>,
    extraGuides: string,
    signal: AbortSignal,
  ): Promise<string> => {
    const authToken = await getAuthToken();
    const response = await fetch(AI_DM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messages: apiMessages.slice(-100),
        characterContext,
        campaignSummary: sessionConfig?.campaignSummary || undefined,
        customGuides: extraGuides,
        ...(() => {
          const cs = loadCombatSettings();
          const feats: string[] = [];
          if (cs.hasGreatWeaponMaster) feats.push('Great Weapon Master');
          if (cs.hasSharpshooter) feats.push('Sharpshooter');
          if (cs.hasSentinel) feats.push('Sentinel');
          if (cs.hasPolearmMaster) feats.push('Polearm Master');
          if (cs.hasDualWielderFeat) feats.push('Dual Wielder');
          if (cs.hasTwoWeaponFightingStyle) feats.push('Two-Weapon Fighting Style');
          if (cs.hasMonkMartialArts) feats.push('Monk Martial Arts');
          const drift = loadAlignmentDrift();
          return {
            encounterGuidance: formatPartyPowerForPrompt(
              partyMembers.map(m => Number((m.character_status as any)?.level) || 1),
              cs.difficultyPreference
            ) || undefined,
            combatFeats: feats.length > 0 ? feats : undefined,
            alignmentContext: drift ? { law: drift.position.law, good: drift.position.good, zone: drift.zone } : undefined,
          };
        })(),
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'AI request failed');
    }

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (delta) assistantContent += delta;
        } catch { /* skip */ }
      }
    }
    return assistantContent;
  }, [characterContext, sessionConfig?.campaignSummary]);

  // Build party members system prompt section
  const buildPartyMembersGuide = useCallback((memberIds?: string[]) => {
    const relevantMembers = memberIds
      ? partyMembers.filter(m => memberIds.includes(m.user_id))
      : partyMembers;
    const partyMembersSummary = relevantMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      return `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
    }).join('\n');
    return partyMembersSummary;
  }, [partyMembers]);

  // Generate split summary for a team
  const generateSplitSummary = useCallback(async (teamMessages: PartyDmMessage[], previousSummary: string | null): Promise<string | null> => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: teamMessages.map(m => ({ role: m.role, content: m.content })),
          previousSummary: previousSummary || undefined,
        }),
      });
      if (!response.ok) return previousSummary;
      const data = await response.json();
      return data.summary || previousSummary;
    } catch {
      return previousSummary;
    }
  }, []);

  // Helper: build AFK guide context for absent members
  // Returns guidesSection, promptSection, and consumedCascades (members whose first cascade prompt was used)
  const buildAfkGuidesContext = useCallback((readyPrompts: PartyDmPrompt[], teamMemberIds?: string[]) => {
    const relevantMembers = teamMemberIds
      ? partyMembers.filter(m => teamMemberIds.includes(m.user_id))
      : partyMembers;
    const absentMembers = relevantMembers.filter(
      m => !readyPrompts.some(p => p.user_id === m.user_id)
    );
    const afkLines: string[] = [];
    const afkPromptLines: string[] = [];
    const consumedCascades: { userId: string; remainingCascade: string[] }[] = [];

    for (const m of absentMembers) {
      const status = m.character_status as Record<string, unknown>;
      const cascade = status?.afkPromptCascade as string[] | null;
      const guide = status?.afkPersonalityGuide as string | null;

      if (cascade && cascade.length > 0) {
        // Use the first cascade prompt
        const nextPrompt = cascade[0];
        const remaining = cascade.slice(1);
        afkPromptLines.push(`[${m.character_name}] (AFK — Cascade Prompt): ${nextPrompt}`);
        afkLines.push(`- ${m.character_name}: ${guide || '(no general guide)'}`);
        consumedCascades.push({ userId: m.user_id, remainingCascade: remaining });
      } else if (guide) {
        afkLines.push(`- ${m.character_name}: ${guide}`);
        afkPromptLines.push(`[${m.character_name}] (AFK): ${guide}`);
      } else {
        afkPromptLines.push(`[${m.character_name}]: Holds their action`);
      }
    }
    const guidesSection = afkLines.length > 0
      ? `\n\n## AFK CHARACTER GUIDES\nRoleplay the following absent characters in-character based on their personality descriptions:\n${afkLines.join('\n')}`
      : '';
    const promptSection = afkPromptLines.length > 0 ? '\n' + afkPromptLines.join('\n') : '';
    return { guidesSection, promptSection, consumedCascades };
  }, [partyMembers]);

  // Consume cascade prompts after they've been used for AFK members
  const consumeCascadePrompts = useCallback(async (consumed: { userId: string; remainingCascade: string[] }[]) => {
    if (!partyId) return;
    for (const { userId, remainingCascade } of consumed) {
      try {
        const { data: member } = await (supabase.from('party_members') as any)
          .select('character_status')
          .eq('party_id', partyId)
          .eq('user_id', userId)
          .single();

        const currentStatus = (member?.character_status as Record<string, unknown>) || {};
        await (supabase.from('party_members') as any)
          .update({
            character_status: {
              ...currentStatus,
              afkPromptCascade: remainingCascade.length > 0 ? remainingCascade : null,
            },
          })
          .eq('party_id', partyId)
          .eq('user_id', userId);
      } catch (err) {
        console.error(`[PartyDM] Failed to consume cascade for user ${userId}:`, err);
      }
    }
  }, [partyId]);

  const generateResponse = useCallback(async () => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;

    const readyPrompts = currentPrompts.filter(p => p.is_ready);
    if (readyPrompts.length === 0) {
      toast.error('No ready prompts to generate from');
      return;
    }

    const formatPromptLine = (p: PartyDmPrompt) =>
      `[${p.character_name}]: ${p.prompt.trim() || '(no action)'}`;

    const insertPartyMessage = async (insertData: Record<string, unknown>) => {
      const { data, error } = await (supabase.from('party_dm_messages') as any)
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to save message: ${error.message}`);
      }

      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data as PartyDmMessage];
        });
      }

      return data as PartyDmMessage | null;
    };

    setIsGenerating(true);

    // Atomic database lock: only proceed if isGenerating was false
    // This prevents multiple clients from triggering generation simultaneously
    const { data: lockData, error: stateErr } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .not('state_data->isGenerating', 'eq', true)
      .select('id');
    if (stateErr) console.error('[PartyDM] Failed to set isGenerating state:', stateErr);
    
    // If no rows updated, another client already claimed generation
    if (!lockData || lockData.length === 0) {
      console.log('[PartyDM] Generation already in progress on another client, skipping');
      setIsGenerating(false);
      return;
    }

    abortRef.current = new AbortController();
    try {
      if (isSplitActive && splitState) {
        let allConsumedCascades: { userId: string; remainingCascade: string[] }[] = [];
        // === SPLIT MODE: Generate two sequential responses from READY prompts ===
        const alphaPrompts = readyPrompts.filter(p =>
          splitState.alphaMembers.includes(p.user_id)
        );
        const betaPrompts = readyPrompts.filter(p =>
          splitState.betaMembers.includes(p.user_id)
        );

        const alphaMessages = messages.filter(m => m.team === 'alpha');
        const betaMessages = messages.filter(m => m.team === 'beta');

        // --- Team Alpha ---
        if (alphaPrompts.length > 0) {
          const { guidesSection: alphaAfkGuides, promptSection: alphaAfkPrompts, consumedCascades: alphaConsumed } = buildAfkGuidesContext(alphaPrompts, splitState.alphaMembers);
          allConsumedCascades = [...allConsumedCascades, ...alphaConsumed];
          const alphaCombined = alphaPrompts
            .map(formatPromptLine)
            .join('\n') + alphaAfkPrompts;

          await insertPartyMessage({
            party_id: partyId,
            role: 'user',
            content: alphaCombined,
            sender_user_id: user.id,
            sender_name: splitState.alphaName || 'Team Alpha',
            team: 'alpha',
          });

          const alphaMembersSummary = buildPartyMembersGuide(splitState.alphaMembers);
          const alphaApiMsgs = alphaMessages.map(m => ({ role: m.role, content: m.content }));
          alphaApiMsgs.push({ role: 'user', content: alphaCombined });

          const alphaGuides = [
            customGuidesContent || '',
            `\n\n## PARTY SPLIT — ${splitState.alphaName || 'Team Alpha'}\nThe party has split up. You are narrating ONLY for "${splitState.alphaName || 'Team Alpha'}".\n${alphaMembersSummary}\nDo NOT narrate what the other team ("${splitState.betaName || 'Team Beta'}") is doing. Focus solely on this group's adventure. Refer to this group as "${splitState.alphaName || 'Team Alpha'}" in your narration.`,
            splitState.betaSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${splitState.betaName || 'Team Beta'}"'s adventure summary (for narrative coherence only — do NOT reveal to "${splitState.alphaName || 'Team Alpha'}"):\n${splitState.betaSummary}` : '',
            splitState.alphaSummary ? `\n\n## PREVIOUS "${splitState.alphaName || 'Team Alpha'}" SUMMARY\n${splitState.alphaSummary}` : '',
            alphaAfkGuides,
          ].filter(Boolean).join('\n\n');

          const alphaContent = await streamAIResponse(alphaApiMsgs, alphaGuides, abortRef.current!.signal);

          if (alphaContent?.trim()) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'assistant',
              content: alphaContent,
              sender_user_id: null,
              sender_name: 'DM',
              team: 'alpha',
            });
          }
        }

        // --- Team Beta ---
        if (betaPrompts.length > 0) {
          const { guidesSection: betaAfkGuides, promptSection: betaAfkPrompts, consumedCascades: betaConsumed } = buildAfkGuidesContext(betaPrompts, splitState.betaMembers);
          allConsumedCascades = [...allConsumedCascades, ...betaConsumed];
          const betaCombined = betaPrompts
            .map(formatPromptLine)
            .join('\n') + betaAfkPrompts;

          await insertPartyMessage({
            party_id: partyId,
            role: 'user',
            content: betaCombined,
            sender_user_id: user.id,
            sender_name: splitState.betaName || 'Team Beta',
            team: 'beta',
          });

          const betaMembersSummary = buildPartyMembersGuide(splitState.betaMembers);
          const betaApiMsgs = betaMessages.map(m => ({ role: m.role, content: m.content }));
          betaApiMsgs.push({ role: 'user', content: betaCombined });

          const betaGuides = [
            customGuidesContent || '',
            `\n\n## PARTY SPLIT — ${splitState.betaName || 'Team Beta'}\nThe party has split up. You are narrating ONLY for "${splitState.betaName || 'Team Beta'}".\n${betaMembersSummary}\nDo NOT narrate what the other team ("${splitState.alphaName || 'Team Alpha'}") is doing. Focus solely on this group's adventure. Refer to this group as "${splitState.betaName || 'Team Beta'}" in your narration.`,
            splitState.alphaSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${splitState.alphaName || 'Team Alpha'}"'s adventure summary (for narrative coherence only — do NOT reveal to "${splitState.betaName || 'Team Beta'}"):\n${splitState.alphaSummary}` : '',
            splitState.betaSummary ? `\n\n## PREVIOUS "${splitState.betaName || 'Team Beta'}" SUMMARY\n${splitState.betaSummary}` : '',
            betaAfkGuides,
          ].filter(Boolean).join('\n\n');

          const betaContent = await streamAIResponse(betaApiMsgs, betaGuides, abortRef.current!.signal);

          if (betaContent?.trim()) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'assistant',
              content: betaContent,
              sender_user_id: null,
              sender_name: 'DM',
              team: 'beta',
            });
          }
        }

        // Build up-to-date message arrays that include what we just inserted
        // (React state won't have all realtime updates yet)
        const newAlphaUserMsg: PartyDmMessage = {
          id: '',
          party_id: partyId,
          role: 'user',
          content: alphaPrompts.map(formatPromptLine).join('\n'),
          sender_user_id: user.id,
          sender_name: splitState.alphaName || 'Team Alpha',
          created_at: '',
          team: 'alpha',
        };
        const newBetaUserMsg: PartyDmMessage = {
          id: '',
          party_id: partyId,
          role: 'user',
          content: betaPrompts.map(formatPromptLine).join('\n'),
          sender_user_id: user.id,
          sender_name: splitState.betaName || 'Team Beta',
          created_at: '',
          team: 'beta',
        };

        const allAlpha = [
          ...alphaMessages,
          ...(alphaPrompts.length > 0 ? [newAlphaUserMsg] : []),
        ];
        const allBeta = [
          ...betaMessages,
          ...(betaPrompts.length > 0 ? [newBetaUserMsg] : []),
        ];

        // Generate rolling split summaries (fire-and-forget)
        Promise.all([
          allAlpha.length > 0 ? generateSplitSummary(allAlpha, splitState.alphaSummary) : Promise.resolve(splitState.alphaSummary),
          allBeta.length > 0 ? generateSplitSummary(allBeta, splitState.betaSummary) : Promise.resolve(splitState.betaSummary),
        ]).then(async ([newAlphaSummary, newBetaSummary]) => {
          if (newAlphaSummary !== splitState.alphaSummary || newBetaSummary !== splitState.betaSummary) {
            const updatedSplit: DmSplitState = {
              ...splitState,
              alphaSummary: newAlphaSummary,
              betaSummary: newBetaSummary,
            };
            await (supabase.from('party_shared_state') as any)
              .update({ state_data: updatedSplit })
              .eq('party_id', partyId)
              .eq('state_type', 'dm_split');
          }
        }).catch(console.error);

        // Auto-save split session to campaign record
        const allSplitMessages = [...allAlpha, ...allBeta];
        if (allSplitMessages.length > 0) {
          silentAutoSave(allSplitMessages, sessionConfig.campaignSummary || null);
        }

        // Consume used cascade prompts for split mode
        if (allConsumedCascades.length > 0) {
          await consumeCascadePrompts(allConsumedCascades);
        }

      } else {
        // === NORMAL MODE ===
        const { guidesSection: afkGuidesSection, promptSection: afkPromptSection, consumedCascades: normalConsumed } = buildAfkGuidesContext(readyPrompts);
        const combined = readyPrompts
          .map(formatPromptLine)
          .join('\n') + afkPromptSection;

        await insertPartyMessage({
          party_id: partyId,
          role: 'user',
          content: combined,
          sender_user_id: user.id,
          sender_name: 'Party',
        });

        const partyMembersSummary = buildPartyMembersGuide();
        const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
        apiMessages.push({ role: 'user', content: combined });

        const guides = [
          customGuidesContent || '',
          `\n\n## PARTY MEMBERS\nThis is a multiplayer session. Multiple players are acting simultaneously each round.\n${partyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
          afkGuidesSection,
        ].filter(Boolean).join('\n\n');

        const assistantContent = await streamAIResponse(apiMessages, guides, abortRef.current!.signal);

        if (assistantContent?.trim()) {
          await insertPartyMessage({
            party_id: partyId,
            role: 'assistant',
            content: assistantContent,
            sender_user_id: null,
            sender_name: 'DM',
          });

          // Trigger summary and auto-save
          const updatedMessages = [...messages,
            { id: '', party_id: partyId, role: 'user' as const, content: combined, sender_user_id: user.id, sender_name: 'Party', created_at: '' },
            { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
          ];
          triggerSummaryIfNeeded(updatedMessages);
          silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
        }

        // Consume used cascade prompts for normal mode
        if (normalConsumed.length > 0) {
          await consumeCascadePrompts(normalConsumed);
        }
      }

      // Clear prompts and start new round
      await (supabase.from('party_dm_prompts') as any)
        .delete()
        .eq('party_id', partyId)
        .eq('round_id', sessionConfig.currentRoundId);

      const newRoundId = crypto.randomUUID();
      const newConfig: DmSessionConfig = {
        ...sessionConfig,
        currentRoundId: newRoundId,
        isGenerating: false,
        // Auto-start timer for new round if enabled
        timerStartedAt: sessionConfig.timerEnabled ? new Date().toISOString() : null,
        timerPausedRemaining: null,
        extensionRequests: [],
      };
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: newConfig })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('Party DM generation error:', error);
        toast.error(error instanceof Error ? error.message : 'Generation failed');
      }

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, currentPrompts, messages, characterContext, partyMembers, customGuidesContent, triggerSummaryIfNeeded, silentAutoSave, isSplitActive, splitState, streamAIResponse, buildPartyMembersGuide, generateSplitSummary, buildAfkGuidesContext, consumeCascadePrompts]);

  // Auto-trigger generation when all ready (host only)
  useEffect(() => {
    if (!isCreator || !allReady || isGenerating) return;
    if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    autoGenTimerRef.current = setTimeout(() => {
      generateResponse();
    }, 2000);
    return () => {
      if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    };
  }, [allReady, isCreator, isGenerating, generateResponse]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!partyId || !isCreator) return;
    await (supabase.from('party_dm_messages') as any)
      .update({ content: newContent })
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
    toast.success('Message updated');
  }, [partyId, isCreator]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!partyId || !isCreator) return;
    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast.success('Message deleted');
  }, [partyId, isCreator]);

  const regenerateMessage = useCallback(async (messageId: string) => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const originalMsg = messages[msgIndex];
    const msgTeam = originalMsg?.team || null;

    const precedingUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!precedingUserMsg) {
      toast.error('No preceding prompt found to regenerate from');
      return;
    }

    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('id', messageId)
      .eq('party_id', partyId);
    setMessages(prev => prev.filter(m => m.id !== messageId));

    setIsGenerating(true);

    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');

    abortRef.current = new AbortController();

    try {
      let guides: string;
      let apiMessages: Array<{ role: string; content: string }>;
      let historyMessages: PartyDmMessage[];

      if (isSplitActive && splitState && msgTeam) {
        // Split mode: filter history to only this team's messages
        historyMessages = messages.slice(0, msgIndex).filter(m => m.team === msgTeam);
        apiMessages = historyMessages.map(m => ({ role: m.role, content: m.content }));

        const teamName = msgTeam === 'alpha'
          ? (splitState.alphaName || 'Team Alpha')
          : (splitState.betaName || 'Team Beta');
        const otherTeamName = msgTeam === 'alpha'
          ? (splitState.betaName || 'Team Beta')
          : (splitState.alphaName || 'Team Alpha');
        const teamMembers = msgTeam === 'alpha' ? splitState.alphaMembers : splitState.betaMembers;
        const otherSummary = msgTeam === 'alpha' ? splitState.betaSummary : splitState.alphaSummary;
        const thisSummary = msgTeam === 'alpha' ? splitState.alphaSummary : splitState.betaSummary;

        const membersSummary = buildPartyMembersGuide(teamMembers);
        guides = [
          customGuidesContent || '',
          `\n\n## PARTY SPLIT — ${teamName}\nThe party has split up. You are narrating ONLY for "${teamName}".\n${membersSummary}\nDo NOT narrate what the other team ("${otherTeamName}") is doing. Focus solely on this group's adventure. Refer to this group as "${teamName}" in your narration.`,
          otherSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${otherTeamName}"'s adventure summary (for narrative coherence only — do NOT reveal to "${teamName}"):\n${otherSummary}` : '',
          thisSummary ? `\n\n## PREVIOUS "${teamName}" SUMMARY\n${thisSummary}` : '',
        ].filter(Boolean).join('\n\n');
      } else {
        // Normal mode
        historyMessages = messages.slice(0, msgIndex);
        apiMessages = historyMessages.map(m => ({ role: m.role, content: m.content }));

        const partyMembersSummary = buildPartyMembersGuide();
        guides = [
          customGuidesContent || '',
          `\n\n## PARTY MEMBERS\nThis is a multiplayer session. Multiple players are acting simultaneously each round.\n${partyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
        ].filter(Boolean).join('\n\n');
      }

      const assistantContent = await streamAIResponse(apiMessages, guides, abortRef.current!.signal);

      if (assistantContent) {
        const insertData: Record<string, unknown> = {
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: 'DM',
        };
        if (msgTeam) insertData.team = msgTeam;

        await (supabase.from('party_dm_messages') as any).insert(insertData);
      }

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

      toast.success('Response regenerated');

      if (assistantContent) {
        const updatedMessages = [...historyMessages,
          { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
        ];
        silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Party DM regeneration error:', error);
      toast.error(error instanceof Error ? error.message : 'Regeneration failed');

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, messages, characterContext, partyMembers, customGuidesContent, silentAutoSave, streamAIResponse, buildPartyMembersGuide, isSplitActive, splitState]);

  // Regenerate whisper tray: send the (possibly edited) AI message content back to the AI
  // asking it to re-apply whisper delimiters, then update the message in-place.
  const regenerateWhispers = useCallback(async (messageId: string) => {
    if (!partyId || !isCreator || isGenerating) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.role !== 'assistant') {
      toast.error('Can only regenerate whispers on AI messages');
      return;
    }

    toast.info('Regenerating whisper tray…');

    try {
      const authToken = await getAuthToken();
      const whisperPrompt = `You are a formatting assistant for a D&D AI Dungeon Master. Your ONLY task is to re-read the following AI DM response and re-format it by wrapping mechanical content in the correct delimiter tags. Do NOT change the narrative text. Do NOT add new content. Do NOT remove content. Only add the delimiter tags where appropriate.

## DELIMITER FORMAT
- Dice rolls & checks: <!--ACTION-->Roll a Perception check (DC 14)<!--/ACTION-->
- Strategic advice & tactical tips: <!--TACTICS-->Consider saving Shield for the next attack.<!--/TACTICS-->
- Per-player whispers: <!--WHISPER:CharacterName-->Secret info here.<!--/WHISPER:CharacterName-->

## RULES
- Everything outside these tags must remain pure narrative prose
- Never put dice notation, DC values, or mechanical instructions outside tags
- You may include multiple tagged blocks per response
- Keep tagged content concise
- Preserve ALL existing narrative text exactly as-is
- If the message already has proper tags, keep them as-is
- Return the FULL message with tags applied — do not summarize or shorten`;

      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Re-format this AI DM response with proper whisper/action/tactics delimiter tags:\n\n${msg.content}` }],
          characterContext,
          systemPromptOverride: whisperPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let newContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) newContent += delta;
          } catch { /* skip */ }
        }
      }

      if (newContent.trim()) {
        await (supabase.from('party_dm_messages') as any)
          .update({ content: newContent })
          .eq('id', messageId)
          .eq('party_id', partyId);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
        toast.success('Whisper tray regenerated');
      } else {
        toast.error('No content returned from AI');
      }
    } catch (error) {
      console.error('Whisper regeneration error:', error);
      toast.error('Failed to regenerate whisper tray');
    }
  }, [partyId, isCreator, isGenerating, messages, characterContext]);

  const addMediaMessage = useCallback(async (content: string, senderName: string) => {
    if (!partyId || !user) return;
    const insertData: Record<string, unknown> = {
      party_id: partyId,
      role: 'user',
      content: content.trim(),
      sender_user_id: user.id,
      sender_name: senderName,
    };
    if (isSplitActive && myTeam) {
      insertData.team = myTeam;
    }
    await (supabase.from('party_dm_messages') as any).insert(insertData);
  }, [partyId, user, isSplitActive, myTeam]);

  // === SPLIT PARTY FUNCTIONS ===

  const initiateSplit = useCallback(async (alphaMembers: string[], alphaName?: string, betaName?: string) => {
    if (!partyId || !user || !isCreator || !sessionConfig) return;
    if (isSplitActive) {
      toast.error('A split is already active');
      return;
    }

    const allMemberIds = partyMembers.map(m => m.user_id);
    const betaMembers = allMemberIds.filter(id => !alphaMembers.includes(id));

    if (alphaMembers.length < 2 || betaMembers.length < 2) {
      toast.error('Each team must have at least 2 members');
      return;
    }

    // Snapshot current messages
    const snapshotMessages = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sender_user_id: m.sender_user_id,
      sender_name: m.sender_name,
      created_at: m.created_at,
    }));

    const splitData: DmSplitState = {
      active: true,
      alphaMembers,
      betaMembers,
      initiatedBy: user.id,
      initiatedAt: new Date().toISOString(),
      snapshotMessages,
      alphaSummary: null,
      betaSummary: null,
      alphaName: alphaName?.trim() || 'Team Alpha',
      betaName: betaName?.trim() || 'Team Beta',
    };

    // Save split state
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_split',
      state_data: splitData,
    }, { onConflict: 'party_id,user_id,state_type' });

    // Clear current messages and prompts
    await (supabase.from('party_dm_messages') as any)
      .delete()
      .eq('party_id', partyId);
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('party_id', partyId);

    // Update session config
    const newRoundId = crypto.randomUUID();
    const updatedConfig: DmSessionConfig = {
      ...sessionConfig,
      currentRoundId: newRoundId,
      isGenerating: false,
      splitActive: true,
    };
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updatedConfig })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');

    setSplitState(splitData);
    setSessionConfig(updatedConfig);
    setMessages([]);
    setCurrentPrompts([]);

    toast.success('Party has split! Each team now has their own adventure.');
  }, [partyId, user, isCreator, sessionConfig, isSplitActive, messages, partyMembers]);

  const regroupParty = useCallback(async (reunionPrompt: string) => {
    if (!partyId || !user || !isCreator || !sessionConfig || !splitState) return;

    setIsGenerating(true);

    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');

    try {
      // Delete all split messages
      await (supabase.from('party_dm_messages') as any)
        .delete()
        .eq('party_id', partyId);
      await (supabase.from('party_dm_prompts') as any)
        .delete()
        .eq('party_id', partyId);

      // Restore snapshot messages
      for (const msg of splitState.snapshotMessages) {
        await (supabase.from('party_dm_messages') as any).insert({
          party_id: partyId,
          role: msg.role,
          content: msg.content,
          sender_user_id: msg.sender_user_id || null,
          sender_name: msg.sender_name,
        });
      }

      // Generate unification response
      const restoredApiMsgs = splitState.snapshotMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const partyMembersSummary = buildPartyMembersGuide();

      const unificationGuides = [
        customGuidesContent || '',
        `\n\n## PARTY MEMBERS\n${partyMembersSummary}`,
        `\n\n## PARTY REUNION\nThe party was split into two groups ("${splitState.alphaName || 'Team Alpha'}" and "${splitState.betaName || 'Team Beta'}"). They are now regrouping.\n\nHost's reunion prompt: "${reunionPrompt}"`,
        splitState.alphaSummary ? `\n\n## "${splitState.alphaName || 'Team Alpha'}"'S SIDE ADVENTURE\n${splitState.alphaSummary}` : '',
        splitState.betaSummary ? `\n\n## "${splitState.betaName || 'Team Beta'}"'S SIDE ADVENTURE\n${splitState.betaSummary}` : '',
        `\n\nNarrate the reunion scene. Describe what each group experienced (briefly, using their team names "${splitState.alphaName || 'Team Alpha'}" and "${splitState.betaName || 'Team Beta'}") and how they come back together. Make it dramatic and engaging. Do NOT dump the full summary — weave key highlights into the reunion narrative.`,
      ].filter(Boolean).join('\n\n');

      restoredApiMsgs.push({ role: 'user', content: `[DM Note]: The party regroups. ${reunionPrompt}` });

      abortRef.current = new AbortController();
      const unificationContent = await streamAIResponse(restoredApiMsgs, unificationGuides, abortRef.current.signal);

      if (unificationContent) {
        await (supabase.from('party_dm_messages') as any).insert({
          party_id: partyId,
          role: 'assistant',
          content: unificationContent,
          sender_user_id: null,
          sender_name: 'DM',
        });
      }

      // Clear split state
      await (supabase.from('party_shared_state') as any)
        .delete()
        .eq('party_id', partyId)
        .eq('state_type', 'dm_split');

      // Update session config
      const newRoundId = crypto.randomUUID();
      const updatedConfig: DmSessionConfig = {
        ...sessionConfig,
        currentRoundId: newRoundId,
        isGenerating: false,
        splitActive: false,
      };
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: updatedConfig })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

      setSplitState(null);
      setSessionConfig(updatedConfig);
      setCurrentPrompts([]);

      toast.success('Party has regrouped!');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Regroup error:', error);
      toast.error(error instanceof Error ? error.message : 'Regroup failed');

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, isCreator, sessionConfig, splitState, streamAIResponse, buildPartyMembersGuide, customGuidesContent]);

  const myPrompt = currentPrompts.find(p => p.user_id === user?.id) || null;

  // ── Timer Controls ──────────────────────────────────────────────────────
  const updateSessionConfig = useCallback(async (patch: Partial<DmSessionConfig>) => {
    if (!partyId || !sessionConfig) return;
    const updated: DmSessionConfig = { ...sessionConfig, ...patch };
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updated })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    setSessionConfig(updated);
  }, [partyId, sessionConfig]);

  const setTimerConfig = useCallback(async (enabled: boolean, durationSeconds: number) => {
    await updateSessionConfig({
      timerEnabled: enabled,
      timerDurationSeconds: durationSeconds,
      timerStartedAt: null,
      timerPausedRemaining: null,
      extensionRequests: [],
    });
  }, [updateSessionConfig]);

  const startTimer = useCallback(async () => {
    if (!sessionConfig?.timerEnabled || !sessionConfig.timerDurationSeconds) return;
    await updateSessionConfig({
      timerStartedAt: new Date().toISOString(),
      timerPausedRemaining: null,
      extensionRequests: [],
    });

    // Schedule a precise server-side callback via QStash
    if (partyId) {
      try {
        await supabase.functions.invoke('schedule-timer-callback', {
          body: {
            partyId,
            delaySeconds: sessionConfig.timerDurationSeconds,
          },
        });
      } catch (e) {
        console.warn('[startTimer] Failed to schedule QStash callback (will rely on pg_cron fallback):', e);
      }
    }
  }, [sessionConfig, updateSessionConfig, partyId, supabase]);

  const pauseTimer = useCallback(async () => {
    if (!sessionConfig?.timerStartedAt) return;
    const elapsed = (Date.now() - new Date(sessionConfig.timerStartedAt).getTime()) / 1000;
    const remaining = Math.max(0, (sessionConfig.timerDurationSeconds || 0) - elapsed);
    await updateSessionConfig({
      timerStartedAt: null,
      timerPausedRemaining: remaining,
    });
  }, [sessionConfig, updateSessionConfig]);

  const resumeTimer = useCallback(async () => {
    if (sessionConfig?.timerPausedRemaining == null) return;
    // Set a new startedAt so that (now - startedAt) = (duration - remaining)
    const offset = (sessionConfig.timerDurationSeconds || 0) - sessionConfig.timerPausedRemaining;
    const fakeStart = new Date(Date.now() - offset * 1000).toISOString();
    await updateSessionConfig({
      timerStartedAt: fakeStart,
      timerPausedRemaining: null,
    });
  }, [sessionConfig, updateSessionConfig]);

  const cancelTimer = useCallback(async () => {
    await updateSessionConfig({
      timerStartedAt: null,
      timerPausedRemaining: null,
      extensionRequests: [],
    });
  }, [updateSessionConfig]);

  const requestExtension = useCallback(async () => {
    if (!sessionConfig || !user) return;
    const existing = sessionConfig.extensionRequests || [];
    if (existing.some(r => r.userId === user.id)) return; // already requested
    const charName = characterName || 'Unknown';
    await updateSessionConfig({
      extensionRequests: [...existing, { userId: user.id, name: charName }],
    });
  }, [sessionConfig, user, characterName, updateSessionConfig]);

  const approveExtension = useCallback(async (additionalSeconds: number) => {
    if (!sessionConfig?.timerStartedAt) return;
    // Shift startedAt forward to add time
    const newStart = new Date(new Date(sessionConfig.timerStartedAt).getTime() + additionalSeconds * 1000).toISOString();
    // Hmm, shifting forward is wrong — we need to shift it BACK to add more time
    // remaining = duration - (now - startedAt). To add time: shift startedAt back.
    const shiftedStart = new Date(new Date(sessionConfig.timerStartedAt).getTime() - additionalSeconds * 1000).toISOString();
    await updateSessionConfig({
      timerStartedAt: shiftedStart,
      extensionRequests: [],
    });
    toast.success(`Added ${additionalSeconds >= 60 ? `${Math.round(additionalSeconds / 60)}m` : `${additionalSeconds}s`} to the timer`);
  }, [sessionConfig, updateSessionConfig]);

  const dismissExtensions = useCallback(async () => {
    await updateSessionConfig({ extensionRequests: [] });
  }, [updateSessionConfig]);

  return {
    messages: filteredMessages,
    allMessages: messages,
    currentPrompts,
    sessionConfig,
    isActive,
    isGenerating: isGenerating || (sessionConfig?.isGenerating ?? false),
    isSummarizing,
    allReady,
    myPrompt,
    activeCampaignId,
    lastAutoSaveTime,
    splitState,
    isSplitActive,
    myTeam,
    startSession,
    endSession,
    startNewCampaign,
    saveCampaign,
    loadCampaign,
    submitPrompt,
    editPrompt,
    retractPrompt,
    setReady,
    unready,
    generateResponse,
    editMessage,
    deleteMessage,
    regenerateMessage,
    regenerateWhispers,
    addMediaMessage,
    initiateSplit,
    regroupParty,
    // Timer
    setTimerConfig,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    requestExtension,
    approveExtension,
    dismissExtensions,
  };
}
