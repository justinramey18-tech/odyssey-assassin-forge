import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';
import type { CharacterContext, Whisper } from '@/components/oracle/types';
import type { DmSplitState, SplitTeam } from '@/lib/party-split-types';
import { sendReadyUpNotification } from '@/lib/party-notifications';
import { parseWhispers } from '@/lib/whisper-parser';
import { sendTelegramNotification } from '@/lib/telegram-notify';
import { loadSelectedModel } from '@/lib/dm-models';
import { resolveResponseModePrompt } from '@/lib/dm-response-modes';
import { loadCombatSettings } from '@/lib/combat/combatSettings';
import { formatPartyPowerForPrompt } from '@/lib/combat/encounterDifficulty';
import { getAlignmentZone, type AlignmentScore } from '@/lib/alignmentSpectrum';
import { buildEmpyreanDMPersona } from '@/lib/empyreanDMPersona';
import { getBondDescriptor } from '@/lib/dragonBondState';

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
const BURNOUT_TAG_RE = /<!--BURNOUT:\d+-->/g;
const BURNOUT_TICK_TAG_RE = /<!--BURNOUT_TICK:.+?-->/g;
const BOND_STRAIN_TAG_RE = /<!--BOND_STRAIN:.+?-->/g;

function enrichMessageWithWhispers(msg: PartyDmMessage, myCharacterName?: string, myDragonName?: string): PartyDmMessage {
  if (msg.role !== 'assistant') return msg;
  const { narrative, whispers } = parseWhispers(msg.content);
  // Strip burnout and bond strain tags from narrative
  const cleanNarrative = narrative.replace(BURNOUT_TAG_RE, '').replace(BURNOUT_TICK_TAG_RE, '').replace(BOND_STRAIN_TAG_RE, '').trim();
  if (whispers.length === 0) return { ...msg, content: cleanNarrative };

  // Filter: keep actions + tactics (shared), and whispers targeted at this player or their dragon
  const filtered = whispers.filter(w => {
    if (w.type !== 'whisper') return true; // actions & tactics visible to all
    if (!myCharacterName) return false; // no character name = hide targeted whispers
    const target = w.target?.toLowerCase();
    return target === myCharacterName.toLowerCase() || (myDragonName && target === myDragonName.toLowerCase());
  });

  return {
    ...msg,
    content: cleanNarrative,
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

export type DmMode = 'ai' | 'human' | 'ai-approval' | 'dialogue';

export interface DmSessionConfig {
  active: boolean;
  mode: 'shared' | 'private';
  currentRoundId: string;
  campaignSummary: string | null;
  isGenerating: boolean;
  splitActive?: boolean;
  dmMode?: DmMode; // 'ai' (default) | 'human' | 'ai-approval'
  // Round timer
  timerEnabled?: boolean;
  timerDurationSeconds?: number; // default duration for new rounds
  timerStartedAt?: string | null; // ISO timestamp when timer was started
  timerPausedRemaining?: number | null; // seconds remaining when paused
  extensionRequests?: Array<{ userId: string; name: string }>;
  // Response mode
  responseMode?: string; // preset id or "custom:length:content"
  // Dialogue mode auto-intervention
  dialogueAutoIntervene?: boolean; // AI auto-intervenes during dialogue when triggered
  dialogueAutoInterveneThreshold?: number; // messages since last DM response before auto-check (default 6)
  // Campaign world type
  campaignType?: 'dnd' | 'empyrean'; // default: 'dnd'
  empyreanFocus?: 'combat' | 'political' | 'romance' | 'mystery' | 'survival' | 'balanced';
}

export interface PartyDragonConfig {
  dragonName: string;
  signetType: string;
  yearAtBasgiath: string;
  dragonNotes: string;
  bond: number; // 0-100
  trust: number; // 0-100
  mood: 'calm' | 'alert' | 'protective' | 'distant' | 'ancestral' | 'playful';
  burnout: number; // 0-5
  memories: Array<{ id: string; text: string; createdAt: string }>;
  speechHabits?: string[];
  riderEmotionalLog?: Array<{ tag: string; timestamp: string }>;
}

interface UsePartyDmOptions {
  partyId: string | null;
  isCreator: boolean;
  memberCount: number;
  characterName: string;
  characterContext: CharacterContext;
  partyMembers: Array<{ character_name: string; character_status: Record<string, unknown>; user_id: string }>;
  customGuidesContent?: string;
  memoryAnchorsContent?: string;
  partyDragonConfigs?: Array<{ userId: string; characterName: string; config: { dragonName: string; signetType: string; bond: number; trust: number; mood: string; burnout: number } }>;
  myDragonName?: string;
  onBurnoutDetected?: (level: number) => void;
  onBurnoutTickDetected?: (reason: string) => void;
  onBondStrainDetected?: (reason: string) => void;
  isSoloEmpyrean?: boolean;
}

export function usePartyDm({ partyId, isCreator, memberCount, characterName, characterContext, partyMembers, customGuidesContent, memoryAnchorsContent, partyDragonConfigs, myDragonName, onBurnoutDetected, onBurnoutTickDetected, onBondStrainDetected, isSoloEmpyrean }: UsePartyDmOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PartyDmMessage[]>([]);
  const [currentPrompts, setCurrentPrompts] = useState<PartyDmPrompt[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFullSummarizing, setIsFullSummarizing] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<DmSessionConfig | null>(null);
  const sessionConfigRef = useRef<DmSessionConfig | null>(null);

  // Keep ref in sync for use in async callbacks
  useEffect(() => {
    sessionConfigRef.current = sessionConfig;
  }, [sessionConfig]);

  /** Resolve sessionConfig from memory or DB fallback */
  const resolveSessionConfig = useCallback(async (): Promise<DmSessionConfig | null> => {
    if (sessionConfigRef.current) return sessionConfigRef.current;
    if (!partyId) return null;
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .maybeSingle();
    if (data?.state_data) {
      const config = data.state_data as DmSessionConfig;
      setSessionConfig(config);
      return config;
    }
    return null;
  }, [partyId]);
  const [isGenerating, setIsGenerating] = useState(false);
  const PENDING_DRAFT_KEY = 'odyssey-pending-draft';

  const [pendingDraft, setPendingDraft] = useState<{ content: string; userContent: string; userSenderName: string } | null>(() => {
    try {
      const saved = getScopedItem(PENDING_DRAFT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (pendingDraft) {
        setScopedItem(PENDING_DRAFT_KEY, JSON.stringify(pendingDraft));
      } else {
        removeScopedItem(PENDING_DRAFT_KEY);
      }
    } catch {}
  }, [pendingDraft]);

  // Detect BURNOUT and BOND_STRAIN tags from new assistant messages in Empyrean campaigns
  const onBurnoutRef = useRef(onBurnoutDetected);
  const onBurnoutTickRef = useRef(onBurnoutTickDetected);
  const onBondStrainRef = useRef(onBondStrainDetected);
  useEffect(() => { onBurnoutRef.current = onBurnoutDetected; }, [onBurnoutDetected]);
  useEffect(() => { onBurnoutTickRef.current = onBurnoutTickDetected; }, [onBurnoutTickDetected]);
  useEffect(() => { onBondStrainRef.current = onBondStrainDetected; }, [onBondStrainDetected]);
  const lastParsedMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionConfig?.campaignType !== 'empyrean') return;
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;
    if (lastMsg.id === lastParsedMsgIdRef.current) return;
    lastParsedMsgIdRef.current = lastMsg.id;

    const burnoutMatch = lastMsg.content.match(/<!--BURNOUT:(\d+)-->/);
    if (burnoutMatch) {
      const level = parseInt(burnoutMatch[1], 10);
      if (level >= 0 && level <= 9) onBurnoutRef.current?.(level);
    }

    const strainMatch = lastMsg.content.match(/<!--BOND_STRAIN:(.+?)-->/);
    if (strainMatch) {
      onBondStrainRef.current?.(strainMatch[1]);
    }

    // Parse BURNOUT_TICK: increment burnout by 1
    const tickMatch = lastMsg.content.match(/<!--BURNOUT_TICK:(.+?)-->/);
    if (tickMatch) {
      // Use onBurnoutDetected with -1 sentinel to signal "increment by 1"
      // The handler in StandalonePartyDMScreen will interpret this
      onBurnoutTickRef.current?.(tickMatch[1]);
    }
  }, [messages, sessionConfig?.campaignType]);


  const abortRef = useRef<AbortController | null>(null);
  const lastGeneratedRoundRef = useRef<string | null>(null);
  const autoGenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoInterveneMsgCountRef = useRef<number>(0);

  // Empyrean persona prompt (built when campaignType is 'empyrean')
  const empyreanPersonaPrompt = useMemo(() => {
    if (!sessionConfig || sessionConfig.campaignType !== 'empyrean') return undefined;
    return buildEmpyreanDMPersona(
      ['empyrean-lore-navarre', 'empyrean-lore-basgiath', 'empyrean-lore-dragons', 'empyrean-lore-venin'],
      ['empyrean-tone-tension'],
      null,
      'the party',
      '',
      '',
      'first-year',
      sessionConfig.empyreanFocus || 'balanced',
    );
  }, [sessionConfig?.campaignType, sessionConfig?.empyreanFocus]);

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
  // Only consider prompts from current party members (kicked members' stale prompts are ignored)
  const memberUserIds = useMemo(() => new Set(partyMembers.map(m => m.user_id)), [partyMembers]);
  const activePrompts = useMemo(() => currentPrompts.filter(p => memberUserIds.has(p.user_id)), [currentPrompts, memberUserIds]);

  const allReady = (() => {
    if (!isSplitActive || !splitState) {
      return activePrompts.length > 0 &&
        activePrompts.length >= memberCount &&
        activePrompts.every(p => p.is_ready);
    }
    const alphaPrompts = activePrompts.filter(p => splitState.alphaMembers.includes(p.user_id));
    const betaPrompts = activePrompts.filter(p => splitState.betaMembers.includes(p.user_id));
    const alphaReady = alphaPrompts.length >= splitState.alphaMembers.length && alphaPrompts.every(p => p.is_ready);
    const betaReady = betaPrompts.length >= splitState.betaMembers.length && betaPrompts.every(p => p.is_ready);
    return alphaReady || betaReady;
  })();

  // Filter messages based on team membership + enrich with parsed whispers
  const filteredMessages = useMemo(() => {
    // First filter whisper visibility — only sender and recipient can see
    const whisperFiltered = messages.filter(m => {
      if (m.team?.startsWith('whisper:')) {
        return m.team.includes(user?.id || '');
      }
      return true;
    });
    const teamFiltered = isSplitActive && user
      ? isCreator
        ? whisperFiltered // Host sees all (non-whisper)
        : whisperFiltered.filter(m => !m.team || m.team === myTeam || m.team.startsWith('whisper:'))
      : whisperFiltered;
    // Parse whispers from assistant messages and filter by character name
    return teamFiltered.map(m => enrichMessageWithWhispers(m, characterName, myDragonName));
  }, [messages, isSplitActive, user, isCreator, myTeam, characterName, myDragonName]);

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

      // Backfill: if split is active but team chats are empty, seed from snapshot
      if (msgs && msgs.length === 0 && sessionConfig?.splitActive) {
        const { data: splitData } = await (supabase.from('party_shared_state') as any)
          .select('state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'dm_split')
          .maybeSingle();

        if (splitData?.state_data) {
          const split = splitData.state_data as any;
          const snapshotMsgs = split.snapshotMessages as Array<{ role: string; content: string }> | undefined;
          if (snapshotMsgs && snapshotMsgs.length > 0) {
            const lastDM = [...snapshotMsgs].reverse().find(m => m.role === 'assistant');
            if (lastDM) {
              const { count: existingCount } = await (supabase.from('party_dm_messages') as any)
                .select('id', { count: 'exact', head: true })
                .eq('party_id', partyId);

              if (existingCount === 0) {
                const seedMsg = {
                  party_id: partyId,
                  role: 'assistant',
                  content: lastDM.content,
                  sender_user_id: null,
                  sender_name: 'DM',
                };
                await (supabase.from('party_dm_messages') as any).insert({ ...seedMsg, team: 'alpha' });
                await (supabase.from('party_dm_messages') as any).insert({ ...seedMsg, team: 'beta' });
                console.log('[PartyDM] Backfilled split team chats with last pre-split DM message');
              }
            }
          }
        }
      }

      // Stale lock recovery: if DB says isGenerating but we just loaded fresh, release it
      if (sessionConfig?.isGenerating && isCreator) {
        console.warn('[PartyDM] Detected stale isGenerating lock on load, releasing...');
        const freshConfig = { ...sessionConfig, isGenerating: false };
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: freshConfig })
          .eq('party_id', partyId)
          .eq('state_type', 'dm_session');
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
          const raw = payload.new as Record<string, unknown>;
          const newMsg: PartyDmMessage = {
            ...raw,
            team: raw.team ?? null,
          } as PartyDmMessage;
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
            mode: isSoloEmpyrean ? 'solo-empyrean' : 'party',
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
  }, [user, isSoloEmpyrean]);

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
    // Clear other campaign state that would bleed into the new campaign
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', partyId)
      .in('state_type', ['quest_flags', 'party_memory_anchors', 'dm_poll', 'initiative', 'focus_target', 'map_markers']);
    setSplitState(null);
    setPendingDraft(null);

    const roundId = crypto.randomUUID();
    const currentMode = sessionConfig?.mode || 'shared';
    const config: DmSessionConfig = {
      active: true,
      mode: currentMode,
      currentRoundId: roundId,
      campaignSummary: null,
      isGenerating: false,
      timerStartedAt: null,
      timerPausedRemaining: null,
      extensionRequests: [],
      campaignType: sessionConfig?.campaignType,
      empyreanFocus: sessionConfig?.empyreanFocus,
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
            mode: isSoloEmpyrean ? 'solo-empyrean' : 'party',
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
  }, [partyId, user, messages, sessionConfig, isSoloEmpyrean]);

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
    if (!partyId || !user) return;
    if (submitLockRef.current) return;
    const resolvedConfig = await resolveSessionConfig();
    if (!resolvedConfig) { toast.error('No active session'); return; }
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
      round_id: resolvedConfig.currentRoundId,
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
      round_id: resolvedConfig.currentRoundId,
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
  }, [partyId, user, resolveSessionConfig, characterName, currentPrompts, isSplitActive, myTeam]);

  const setReady = useCallback(async () => {
    if (!user || !partyId) return;
    const resolvedConfig = await resolveSessionConfig();
    if (!resolvedConfig) { toast.error('No active session'); return; }
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
        round_id: resolvedConfig.currentRoundId,
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
        round_id: resolvedConfig.currentRoundId,
        created_at: new Date().toISOString(),
        team: (isSplitActive && myTeam) ? myTeam : null,
      };
      setCurrentPrompts(prev => [...prev, optimisticPrompt]);
      await (supabase.from('party_dm_prompts') as any).insert(insertData);
    }

    // Send Telegram ready-up notification (non-blocking, includes self)
    const readyCount = currentPrompts.filter(p => p.is_ready).length + (currentPrompts.find(p => p.user_id === user.id)?.is_ready ? 0 : 1);
    const promptText = myPrompt?.prompt ?? '';
    const isAutopilot = promptText.startsWith('<<');

    let notificationBody: string;
    if (isAutopilot) {
      notificationBody = `${characterName} got lazy. They're using their afk guide. The A.I. is now having to do all the heavy lifting. If it turns out bad, blame yourself and your afk guide. (${readyCount}/${memberCount} ready)`;
    } else if (promptText.trim()) {
      notificationBody = `${characterName} has readied up!\n\n📝 ${promptText.substring(0, 200)}${promptText.length > 200 ? '…' : ''}\n\n(${readyCount}/${memberCount} ready)`;
    } else {
      notificationBody = `${characterName} has readied up! (${readyCount}/${memberCount} ready)`;
    }

    sendTelegramNotification({
      type: 'ready_up',
      partyId,
      title: '⚔️ Ready Up!',
      body: notificationBody,
      mode: 'party',
    });
  }, [user, partyId, resolveSessionConfig, characterName, currentPrompts, isSplitActive, myTeam]);

  const unready = useCallback(async () => {
    if (!user || !partyId) return;
    const resolvedConfig = await resolveSessionConfig();
    if (!resolvedConfig) return;
    const myPrompt = currentPrompts.find(p => p.user_id === user.id);
    if (myPrompt && myPrompt.is_ready) {
      // Optimistic update
      setCurrentPrompts(prev => prev.map(p => p.id === myPrompt.id ? { ...p, is_ready: false } : p));
      await (supabase.from('party_dm_prompts') as any)
        .update({ is_ready: false })
        .eq('id', myPrompt.id);
    }
  }, [partyId, user, resolveSessionConfig, currentPrompts]);

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
    if (!myPrompt) return;
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
          worldContext: customGuidesContent ? customGuidesContent.slice(0, 4000) : undefined,
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
  }, [partyId, isCreator, sessionConfig, customGuidesContent]);



  // Helper: truncate messages by total character count to avoid exceeding AI context windows
  const truncateMessagesByChars = useCallback((msgs: Array<{ role: string; content: string }>, maxChars: number) => {
    const totalChars = msgs.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars <= maxChars) return msgs;
    // Keep first 2 messages (opening context) and trim from the middle
    const result = [...msgs];
    let chars = totalChars;
    while (chars > maxChars && result.length > 4) {
      const removed = result.splice(2, 1);
      chars -= removed[0]?.content?.length || 0;
    }
    console.log(`[PartyDM] Truncated messages: ${msgs.length} → ${result.length}, chars: ${totalChars} → ${chars}`);
    return result;
  }, []);

  // Helper: merge consecutive same-role messages to avoid API rejections
  // Many AI APIs (OpenAI, Anthropic) require strictly alternating user/assistant roles
  const mergeConsecutiveRoles = useCallback((msgs: Array<{ role: string; content: string }>) => {
    if (msgs.length === 0) return msgs;
    const merged: Array<{ role: string; content: string }> = [msgs[0]];
    for (let i = 1; i < msgs.length; i++) {
      const prev = merged[merged.length - 1];
      if (msgs[i].role === prev.role) {
        // Merge consecutive same-role messages
        prev.content = prev.content + '\n\n' + msgs[i].content;
      } else {
        merged.push({ ...msgs[i] });
      }
    }
    return merged;
  }, []);

  // Helper: fetch last 5 party chat messages for context
  const fetchRecentPartyChat = useCallback(async (): Promise<Array<{ sender: string; message: string }>> => {
    if (!partyId) return [];
    try {
      const { data } = await supabase
        .from('party_messages')
        .select('sender_name, message')
        .eq('party_id', partyId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!data || data.length === 0) return [];
      return data.reverse().map(m => ({ sender: m.sender_name, message: m.message }));
    } catch { return []; }
  }, [partyId]);

  // Helper: fetch recent dragon bond chat messages for DM context
  const fetchRecentDragonChat = useCallback(async (): Promise<Array<{ dragonName: string; riderName: string; role: string; content: string }>> => {
    if (!partyId) return [];
    try {
      // Fetch dragon chat state and dragon bond configs in parallel
      const [chatResult, bondResult] = await Promise.all([
        supabase
          .from('party_shared_state')
          .select('user_id, state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'dragon_chat'),
        supabase
          .from('party_shared_state')
          .select('user_id, state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'dragon_bond'),
      ]);

      if (!chatResult.data || chatResult.data.length === 0) return [];

      // Build dragon name lookup from bond configs
      const dragonNameMap = new Map<string, string>();
      if (bondResult.data) {
        for (const row of bondResult.data) {
          const sd = row.state_data as Record<string, unknown>;
          if (sd?.dragonName) dragonNameMap.set(row.user_id, sd.dragonName as string);
        }
      }

      // Build rider name lookup from partyMembers
      const riderNameMap = new Map<string, string>();
      for (const m of partyMembers) {
        riderNameMap.set(m.user_id, m.character_name || 'Rider');
      }

      const result: Array<{ dragonName: string; riderName: string; role: string; content: string }> = [];

      for (const row of chatResult.data) {
        const sd = row.state_data as Record<string, unknown>;
        const messages = (sd?.messages as Array<{ role: string; content: string; timestamp?: string }>) || [];
        const last3 = messages.slice(-3);
        const dragonName = dragonNameMap.get(row.user_id) || 'Dragon';
        const riderName = riderNameMap.get(row.user_id) || 'Rider';

        for (const msg of last3) {
          result.push({
            dragonName,
            riderName,
            role: msg.role,
            content: msg.content,
          });
        }
      }

      return result;
    } catch {
      return [];
    }
  }, [partyId, partyMembers]);

  // Helper: fetch recent dragon network messages for DM context
  const fetchRecentDragonNetwork = useCallback(async (): Promise<Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }>> => {
    if (!partyId) return [];
    try {
      const { data } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', 'dragon_network_message')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return [];

      const seen = new Set<string>();
      const result: Array<{ fromDragon: string; toDragon: string; exchange: string; timestamp: string }> = [];

      for (const row of data) {
        if (result.length >= 5) break;
        const sd = row.state_data as Record<string, unknown>;
        const msgId = sd?.id as string;
        if (!msgId || seen.has(msgId)) continue;
        seen.add(msgId);

        const exchange = (sd?.dragonExchange as string) || '';
        if (!exchange.trim()) continue;

        result.push({
          fromDragon: (sd?.fromDragon as string) || 'Dragon',
          toDragon: (sd?.toDragon as string) || 'Dragon',
          exchange,
          timestamp: (sd?.timestamp as string) || '',
        });
      }

      return result;
    } catch {
      return [];
    }
  }, [partyId]);

  // Helper: stream an AI response and return the content
  const streamAIResponse = useCallback(async (
    apiMessages: Array<{ role: string; content: string }>,
    extraGuides: string,
    signal: AbortSignal,
    partyContext?: string,
    responseModePrompt?: string,
    dmPersonaPrompt?: string,
  ): Promise<string> => {
    // Ensure strictly alternating roles before sending to AI
    const sanitizedMessages = mergeConsecutiveRoles(apiMessages);

    // Fetch recent party chat for DM awareness
    const recentPartyChat = await fetchRecentPartyChat();
    const recentDragonChat = await fetchRecentDragonChat();
    const recentDragonNetwork = await fetchRecentDragonNetwork();

    const authToken = await getAuthToken();
    const response = await fetch(AI_DM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messages: truncateMessagesByChars(sanitizedMessages.slice(-100), 120000),
        characterContext,
        campaignSummary: sessionConfig?.campaignSummary || undefined,
        customGuides: extraGuides,
        partyContext: partyContext || undefined,
        memoryAnchors: memoryAnchorsContent || undefined,
        recentPartyChat: recentPartyChat.length > 0 ? recentPartyChat : undefined,
        recentDragonChat: recentDragonChat.length > 0 ? recentDragonChat : undefined,
        recentDragonNetwork: recentDragonNetwork.length > 0 ? recentDragonNetwork : undefined,
        responseModePrompt: responseModePrompt || undefined,
        dmPersonaPrompt: dmPersonaPrompt || undefined,
        model: loadSelectedModel(),
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
  }, [characterContext, sessionConfig?.campaignSummary, memoryAnchorsContent, mergeConsecutiveRoles, fetchRecentPartyChat, fetchRecentDragonChat, fetchRecentDragonNetwork]);


  // Build party members system prompt section
  const buildPartyMembersGuide = useCallback((memberIds?: string[]) => {
    const relevantMembers = memberIds
      ? partyMembers.filter(m => memberIds.includes(m.user_id))
      : partyMembers;
    const isEmpyrean = sessionConfig?.campaignType === 'empyrean';
    const partyMembersSummary = relevantMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      let line = `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
      if (isEmpyrean && partyDragonConfigs) {
        const dc = partyDragonConfigs.find(d => d.userId === m.user_id);
        if (dc) {
          line += ` | Dragon: ${dc.config.dragonName}, Signet: ${dc.config.signetType || 'unknown'}, Bond: ${getBondDescriptor(dc.config.bond)}, Burnout: ${dc.config.burnout}/${dc.config.bond >= 76 ? 9 : dc.config.bond >= 51 ? 7 : dc.config.bond >= 26 ? 5 : 4}`;
        }
      }
      return line;
    }).join('\n');
    return partyMembersSummary;
  }, [partyMembers, sessionConfig?.campaignType, partyDragonConfigs]);

  // Build dragon bonds context section for Empyrean campaigns
  const buildDragonBondsSection = useCallback(() => {
    if (sessionConfig?.campaignType !== 'empyrean' || !partyDragonConfigs || partyDragonConfigs.length === 0) return '';
    const bondedRiders = partyDragonConfigs.filter(d => d.config.dragonName);
    if (bondedRiders.length === 0) return '';
    const lines = bondedRiders.map(d => {
      const mood = d.config.mood || 'calm';
      const bondDesc = getBondDescriptor(d.config.bond);
      return `- ${d.config.dragonName} (bonded to ${d.characterName}, mood: ${mood}, bond: ${bondDesc}): Use whisper tag ">>${d.characterName}" to send dragon telepathy`;
    }).join('\n');
    return `## PARTY DRAGON BONDS\nMultiple riders have bonded dragons. Generate whisper tags for each rider's dragon when appropriate:\n${lines}\n\nEach dragon has its own personality. Address their riders by name through the bond. Dragon whispers should feel telepathic — sensory impressions, emotions, short warnings.\n\nReflect each dragon's current mood in its telepathic whispers:\n- distant: colder, shorter, more withholding\n- protective: more urgent about threats, proactive warnings\n- alert: heightened sensory impressions, vigilance\n- playful: dry humor, teasing (still dragon-like)\n- ancestral: older voice, echoes of ancient memories/visions\n- calm: measured, steady, unhurried`;
  }, [sessionConfig?.campaignType, partyDragonConfigs]);

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

  // Shared helper: insert a party DM message and update local state
  const insertPartyMessageHelper = useCallback(async (pId: string, insertData: Record<string, unknown>) => {
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
  }, []);

  const generateResponse = useCallback(async () => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;

    const readyPrompts = currentPrompts.filter(p => p.is_ready && memberUserIds.has(p.user_id));
    if (readyPrompts.length === 0) {
      toast.error('No ready prompts to generate from');
      return;
    }

    // ── OOC Override Detection ──
    // Check if any ready prompt (especially the host's) contains an OOC directive
    // to ignore AFK guides. If so, we strip all AFK guide content at the code level.
    const OOC_IGNORE_AFK_PATTERN = /(?:ooc\s*:|^\s*\[ooc\]|\[.*?\])\s*ignore\s+(?:afk|autopilot)\s*(?:guides?|personality)?/im;
    const suppressAfkGuides = readyPrompts.some(p => OOC_IGNORE_AFK_PATTERN.test(p.prompt));

    const formatPromptLine = (p: PartyDmPrompt) => {
      if (p.prompt.trim()) return `[${p.character_name}]: ${p.prompt.trim()}`;
      if (suppressAfkGuides) return `[${p.character_name}]: (no action — AFK guides suppressed by host)`;
      // No prompt — check for AFK personality guide
      const member = partyMembers.find(m => m.user_id === p.user_id);
      const status = member?.character_status as Record<string, unknown> | undefined;
      const guide = status?.afkPersonalityGuide as string | null;
      if (guide) return `[${p.character_name}] (Autopilot): ${guide}`;
      return `[${p.character_name}]: (no action)`;
    };

    const insertPartyMessage = (insertData: Record<string, unknown>) => insertPartyMessageHelper(partyId, insertData);

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

    // Re-fetch latest dragon configs right before generation for accuracy
    let freshDragonConfigs = partyDragonConfigs;
    if (sessionConfig?.campaignType === 'empyrean' && partyId) {
      try {
        const { data: freshBonds } = await (supabase.from('party_shared_state') as any)
          .select('user_id, state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'dragon_bond');
        if (freshBonds && freshBonds.length > 0) {
          freshDragonConfigs = freshBonds.map((row: any) => ({
            userId: row.user_id,
            characterName: partyMembers.find(m => m.user_id === row.user_id)?.character_name || 'Unknown',
            config: {
              dragonName: row.state_data?.dragonName || '',
              signetType: row.state_data?.signetType || '',
              bond: row.state_data?.bond ?? 15,
              trust: row.state_data?.trust ?? 10,
              mood: row.state_data?.mood || 'calm',
              burnout: row.state_data?.burnout ?? 0,
            },
          }));
        }
      } catch (err) {
        console.warn('[PartyDM] Failed to refresh dragon configs, using cached:', err);
      }
    }

    let freshDragonBondsSection = '';
    if (sessionConfig?.campaignType === 'empyrean' && freshDragonConfigs && freshDragonConfigs.length > 0) {
      const bondedRiders = freshDragonConfigs.filter((d: any) => d.config.dragonName);
      if (bondedRiders.length > 0) {
        const lines = bondedRiders.map((d: any) => {
          const bondDesc = getBondDescriptor(d.config.bond);
          return `- ${d.config.dragonName} (bonded to ${d.characterName}, mood: ${d.config.mood}, bond: ${bondDesc}): Use whisper tag ">>${d.characterName}" to send dragon telepathy`;
        }).join('\n');
        freshDragonBondsSection = `## PARTY DRAGON BONDS\nMultiple riders have bonded dragons. Generate whisper tags for each rider's dragon when appropriate:\n${lines}\n\nEach dragon has its own personality. Address their riders by name through the bond. Dragon whispers should feel telepathic — sensory impressions, emotions, short warnings.\n\nReflect each dragon's current mood in its telepathic whispers:\n- distant: colder, shorter, more withholding\n- protective: more urgent about threats, proactive warnings\n- alert: heightened sensory impressions, vigilance\n- playful: dry humor, teasing (still dragon-like)\n- ancestral: older voice, echoes of ancient memories/visions\n- calm: measured, steady, unhurried`;
      }
    }

    const freshPartyMembersSummary = partyMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      let line = `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
      if (sessionConfig?.campaignType === 'empyrean' && freshDragonConfigs) {
        const dc = freshDragonConfigs.find((d: any) => d.userId === m.user_id);
        if (dc) {
          line += ` | Dragon: ${dc.config.dragonName}, Signet: ${dc.config.signetType || 'unknown'}, Bond: ${getBondDescriptor(dc.config.bond)}, Burnout: ${dc.config.burnout}/${dc.config.bond >= 76 ? 9 : dc.config.bond >= 51 ? 7 : dc.config.bond >= 26 ? 5 : 4}`;
        }
      }
      return line;
    }).join('\n');

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

        const splitResponseModePrompt = resolveResponseModePrompt(sessionConfig.responseMode);

        // --- Team Alpha ---
        if (alphaPrompts.length > 0) {
          const { guidesSection: alphaAfkGuides, promptSection: alphaAfkPrompts, consumedCascades: alphaConsumed } = suppressAfkGuides
            ? { guidesSection: '', promptSection: '', consumedCascades: [] }
            : buildAfkGuidesContext(alphaPrompts, splitState.alphaMembers);
          allConsumedCascades = [...allConsumedCascades, ...alphaConsumed];
          const alphaRawCombined = alphaPrompts
            .map(formatPromptLine)
            .join('\n') + alphaAfkPrompts;

          const alphaForAI = alphaRawCombined;

          await insertPartyMessage({
            party_id: partyId,
            role: 'user',
            content: alphaRawCombined,
            sender_user_id: user.id,
            sender_name: splitState.alphaName || 'Team Alpha',
            team: 'alpha',
          });

          const alphaMembersSummary = buildPartyMembersGuide(splitState.alphaMembers);
          const alphaApiMsgs = alphaMessages.map(m => ({ role: m.role, content: m.content }));
          alphaApiMsgs.push({ role: 'user', content: alphaForAI });
          const alphaPartyContext = [
            `## PARTY SPLIT — ${splitState.alphaName || 'Team Alpha'}\nThe party has split up. You are narrating ONLY for "${splitState.alphaName || 'Team Alpha'}".\n${alphaMembersSummary}\nDo NOT narrate what the other team ("${splitState.betaName || 'Team Beta'}") is doing. Focus solely on this group's adventure. Refer to this group as "${splitState.alphaName || 'Team Alpha'}" in your narration.`,
            freshDragonBondsSection,
            splitState.betaSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${splitState.betaName || 'Team Beta'}"'s adventure summary (for narrative coherence only — do NOT reveal to "${splitState.alphaName || 'Team Alpha'}"):\n${splitState.betaSummary}` : '',
            splitState.alphaSummary ? `\n\n## PREVIOUS "${splitState.alphaName || 'Team Alpha'}" SUMMARY\n${splitState.alphaSummary}` : '',
            alphaAfkGuides,
            splitResponseModePrompt,
          ].filter(Boolean).join('\n\n');

          const alphaContent = await streamAIResponse(alphaApiMsgs, customGuidesContent || '', abortRef.current!.signal, alphaPartyContext, undefined, empyreanPersonaPrompt);

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
          const { guidesSection: betaAfkGuides, promptSection: betaAfkPrompts, consumedCascades: betaConsumed } = suppressAfkGuides
            ? { guidesSection: '', promptSection: '', consumedCascades: [] }
            : buildAfkGuidesContext(betaPrompts, splitState.betaMembers);
          allConsumedCascades = [...allConsumedCascades, ...betaConsumed];
          const betaRawCombined = betaPrompts
            .map(formatPromptLine)
            .join('\n') + betaAfkPrompts;

          const betaForAI = betaRawCombined;

          await insertPartyMessage({
            party_id: partyId,
            role: 'user',
            content: betaRawCombined,
            sender_user_id: user.id,
            sender_name: splitState.betaName || 'Team Beta',
            team: 'beta',
          });

          const betaMembersSummary = buildPartyMembersGuide(splitState.betaMembers);
          const betaApiMsgs = betaMessages.map(m => ({ role: m.role, content: m.content }));
          betaApiMsgs.push({ role: 'user', content: betaForAI });

          const betaPartyContext = [
            `## PARTY SPLIT — ${splitState.betaName || 'Team Beta'}\nThe party has split up. You are narrating ONLY for "${splitState.betaName || 'Team Beta'}".\n${betaMembersSummary}\nDo NOT narrate what the other team ("${splitState.alphaName || 'Team Alpha'}") is doing. Focus solely on this group's adventure. Refer to this group as "${splitState.betaName || 'Team Beta'}" in your narration.`,
            splitState.alphaSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${splitState.alphaName || 'Team Alpha'}"'s adventure summary (for narrative coherence only — do NOT reveal to "${splitState.betaName || 'Team Beta'}"):\n${splitState.alphaSummary}` : '',
            splitState.betaSummary ? `\n\n## PREVIOUS "${splitState.betaName || 'Team Beta'}" SUMMARY\n${splitState.betaSummary}` : '',
            betaAfkGuides,
            splitResponseModePrompt,
          ].filter(Boolean).join('\n\n');

          const betaContent = await streamAIResponse(betaApiMsgs, customGuidesContent || '', abortRef.current!.signal, betaPartyContext, undefined, empyreanPersonaPrompt);

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
        const { guidesSection: afkGuidesSection, promptSection: afkPromptSection, consumedCascades: normalConsumed } = suppressAfkGuides
          ? { guidesSection: '', promptSection: '', consumedCascades: [] }
          : buildAfkGuidesContext(readyPrompts);
        const rawCombined = readyPrompts
          .map(formatPromptLine)
          .join('\n') + afkPromptSection;

        const combined = rawCombined;

        const isApprovalMode = (sessionConfig.dmMode || 'ai') === 'ai-approval';

        // In approval mode, don't insert user message yet — defer to approveDraft
        let insertedUserMsgId: string | null = null;
        if (!isApprovalMode) {
          const insertedMsg = await insertPartyMessageHelper(partyId, {
            party_id: partyId,
            role: 'user',
            content: rawCombined,
            sender_user_id: user.id,
            sender_name: 'Party',
          });
          insertedUserMsgId = insertedMsg?.id || null;
        }

        const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
        apiMessages.push({ role: 'user', content: combined });

        const responseModePrompt = resolveResponseModePrompt(sessionConfig.responseMode);
        const campaignIntro = sessionConfig.campaignType === 'empyrean'
          ? 'This is a multiplayer Empyrean campaign set at Basgiath War College. Players are dragon riders in training. '
          : '';
        const dragonBondsSection = freshDragonBondsSection;
        const partyContextStr = [
          `## PARTY MEMBERS\n${campaignIntro}This is a multiplayer session. Multiple players are acting simultaneously each round.\n${freshPartyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
          dragonBondsSection,
          afkGuidesSection,
          responseModePrompt,
        ].filter(Boolean).join('\n\n');

        const assistantContent = await streamAIResponse(apiMessages, customGuidesContent || '', abortRef.current!.signal, partyContextStr, undefined, empyreanPersonaPrompt);

        if (assistantContent?.trim()) {
          if (isApprovalMode) {
            setPendingDraft({
              content: assistantContent,
              userContent: combined,
              userSenderName: 'Party',
            });
          } else {
            await insertPartyMessage({
              party_id: partyId,
              role: 'assistant',
              content: assistantContent,
              sender_user_id: null,
              sender_name: 'DM',
            });

            const updatedMessages = [...messages,
              { id: '', party_id: partyId, role: 'user' as const, content: combined, sender_user_id: user.id, sender_name: 'Party', created_at: '' },
              { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
            ];
            triggerSummaryIfNeeded(updatedMessages);
            silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
          }
        } else if (insertedUserMsgId) {
          // AI returned empty — roll back the orphaned user message to prevent
          // consecutive same-role messages from snowballing future failures
          console.warn('[PartyDM] AI returned empty response, rolling back user message', insertedUserMsgId);
          await (supabase.from('party_dm_messages') as any)
            .delete()
            .eq('id', insertedUserMsgId);
          setMessages(prev => prev.filter(m => m.id !== insertedUserMsgId));
          toast.error('DM generation returned empty. Please try again.');
        }

        // Consume used cascade prompts for normal mode
        if (normalConsumed.length > 0) {
          await consumeCascadePrompts(normalConsumed);
        }
      }

      // Clear prompts and start new round
      // In split mode: always clear (no draft review step) and only clear the team that generated
      // In normal mode: skip clearing in ai-approval (deferred to approveDraft)
      const shouldClear = isSplitActive || (sessionConfig.dmMode || 'ai') !== 'ai-approval';
      if (shouldClear) {
        if (isSplitActive) {
          // Only delete prompts from the team(s) that actually generated
          const generatedUserIds = readyPrompts.map(p => p.user_id);
          for (const uid of generatedUserIds) {
            await (supabase.from('party_dm_prompts') as any)
              .delete()
              .eq('party_id', partyId)
              .eq('round_id', sessionConfig.currentRoundId)
              .eq('user_id', uid);
          }
          // Only remove the generated team's prompts from local state
          setCurrentPrompts(prev => prev.filter(p => !generatedUserIds.includes(p.user_id)));
        } else {
          await (supabase.from('party_dm_prompts') as any)
            .delete()
            .eq('party_id', partyId)
            .eq('round_id', sessionConfig.currentRoundId);
          setCurrentPrompts([]);
        }
        lastGeneratedRoundRef.current = sessionConfig.currentRoundId;

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
      } else {
        // Just release the generation lock (ai-approval normal mode)
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: { ...sessionConfig, isGenerating: false } })
          .eq('party_id', partyId)
          .eq('state_type', 'dm_session');
      }

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
  }, [partyId, user, sessionConfig, isGenerating, currentPrompts, messages, characterContext, partyMembers, customGuidesContent, triggerSummaryIfNeeded, silentAutoSave, isSplitActive, splitState, streamAIResponse, buildPartyMembersGuide, generateSplitSummary, buildAfkGuidesContext, consumeCascadePrompts, insertPartyMessageHelper, empyreanPersonaPrompt, buildDragonBondsSection]);

  // Auto-trigger generation when all ready (host only) — only in AI mode
  const currentDmMode = sessionConfig?.dmMode || 'ai';
  useEffect(() => {
    if (!isCreator || !allReady || isGenerating) return;
    // Don't auto-generate in human mode — AI and AI-approval both auto-trigger
    if (currentDmMode === 'human' || currentDmMode === 'dialogue') return;
    if (lastGeneratedRoundRef.current === sessionConfig?.currentRoundId) return;
    if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    autoGenTimerRef.current = setTimeout(() => {
      generateResponse();
    }, 2000);
    return () => {
      if (autoGenTimerRef.current) clearTimeout(autoGenTimerRef.current);
    };
  }, [allReady, isCreator, isGenerating, generateResponse, currentDmMode]);

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

  // === DIALOGUE MODE: Insert in-character message directly (no prompt queue) ===
  const sendDialogueMessage = useCallback(async (content: string) => {
    if (!partyId || !user || !content.trim()) return;
    const formattedContent = `[${characterName}]: ${content.trim()}`;

    await insertPartyMessageHelper(partyId, {
      party_id: partyId,
      role: 'user',
      content: formattedContent,
      sender_user_id: user.id,
      sender_name: characterName,
    });

    sendTelegramNotification({
      type: 'custom',
      partyId: partyId ?? undefined,
      targetUserIds: partyMembers
        .filter(m => m.user_id !== user.id)
        .map(m => m.user_id),
      title: '💬 Dialogue',
      body: `[${characterName}]: ${content.trim().substring(0, 200)}${content.trim().length > 200 ? '…' : ''}`,
      mode: 'party',
    });
  }, [partyId, user, characterName, partyMembers, insertPartyMessageHelper]);

  // === DIALOGUE MODE: Send a whisper to another player ===
  const sendWhisper = useCallback(async (content: string, targetUserId: string, targetName: string) => {
    if (!partyId || !user || !content.trim()) return;
    const formattedContent = `[Whisper from ${characterName} to ${targetName}]: "${content.trim()}"`;
    await insertPartyMessageHelper(partyId, {
      party_id: partyId,
      role: 'user',
      content: formattedContent,
      sender_user_id: user.id,
      sender_name: characterName,
      team: `whisper:${user.id}:${targetUserId}`,
    });
  }, [partyId, user, characterName, insertPartyMessageHelper]);

  // === DIALOGUE MODE: Call the DM to continue narrative without prompt queue ===
  const callDM = useCallback(async () => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;

    setIsGenerating(true);

    // Atomic database lock
    const { data: lockData, error: stateErr } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .not('state_data->isGenerating', 'eq', true)
      .select('id');
    if (stateErr) console.error('[PartyDM] Failed to set isGenerating state:', stateErr);

    if (!lockData || lockData.length === 0) {
      console.log('[PartyDM] Generation already in progress on another client, skipping');
      toast('The DM is already responding...', { duration: 2000, icon: '⏳' });
      setIsGenerating(false);
      return;
    }

    abortRef.current = new AbortController();
    try {
      // Insert synthetic system message requesting DM continuation
      await insertPartyMessageHelper(partyId, {
        party_id: partyId,
        role: 'user',
        content: '[System]: The players request the DM continue the narrative based on the dialogue above.',
        sender_user_id: user.id,
        sender_name: 'System',
      });

      const partyMembersSummary = buildPartyMembersGuide();
      const apiMessages = [...messages, {
        role: 'user' as const,
        content: '[System]: The players request the DM continue the narrative based on the dialogue above.',
      }].map(m => ({ role: m.role, content: m.content }));

      const responseModePrompt = resolveResponseModePrompt(sessionConfig.responseMode);
      const campaignIntro = sessionConfig.campaignType === 'empyrean'
        ? 'This is a multiplayer Empyrean campaign set at Basgiath War College. Players are dragon riders in training. '
        : '';
      const dragonBondsSection = buildDragonBondsSection();
      const partyContextStr = [
        `## PARTY MEMBERS\n${campaignIntro}This is a multiplayer session in dialogue mode. Players speak in-character directly. Respond to their dialogue naturally and advance the narrative.\n${partyMembersSummary}\nAddress each player character by name.`,
        dragonBondsSection,
        responseModePrompt,
      ].filter(Boolean).join('\n\n');

      const assistantContent = await streamAIResponse(apiMessages, customGuidesContent || '', abortRef.current!.signal, partyContextStr, undefined, empyreanPersonaPrompt);

      if (assistantContent?.trim()) {
        await insertPartyMessageHelper(partyId, {
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: 'DM',
        });

        const updatedMessages = [...messages,
          { id: '', party_id: partyId, role: 'user' as const, content: '[System]: The players request the DM continue the narrative based on the dialogue above.', sender_user_id: user.id, sender_name: 'System', created_at: '' },
          { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
        ];
        triggerSummaryIfNeeded(updatedMessages);
        silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
      }

      // Release generation lock (no round advancement)
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('Party DM callDM error:', error);
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
  }, [partyId, user, sessionConfig, isGenerating, messages, characterContext, customGuidesContent, streamAIResponse, buildPartyMembersGuide, triggerSummaryIfNeeded, silentAutoSave, insertPartyMessageHelper, empyreanPersonaPrompt, buildDragonBondsSection]);

  // === DIALOGUE MODE: Voice an NPC in response to player dialogue ===
  const voiceNPC = useCallback(async (npcNames: string | string[], playerMessage: string) => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;

    const names = Array.isArray(npcNames) ? npcNames : [npcNames];
    const nameLabel = names.join(' & ');

    setIsGenerating(true);

    const formattedContent = `[${characterName}]: (to ${nameLabel}) "${playerMessage.trim()}"`;

    // Insert user message
    await insertPartyMessageHelper(partyId, {
      party_id: partyId,
      role: 'user',
      content: formattedContent,
      sender_user_id: user.id,
      sender_name: characterName,
    });

    // Atomic database lock
    const { data: lockData, error: stateErr } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .not('state_data->isGenerating', 'eq', true)
      .select('id');
    if (stateErr) console.error('[PartyDM] Failed to set isGenerating state:', stateErr);

    if (!lockData || lockData.length === 0) {
      console.log('[PartyDM] Generation already in progress on another client, skipping');
      toast('The DM is already responding...', { duration: 2000, icon: '⏳' });
      setIsGenerating(false);
      return;
    }

    abortRef.current = new AbortController();
    try {
      const apiMessages = [...messages, {
        role: 'user' as const,
        content: formattedContent,
      }].map(m => ({ role: m.role, content: m.content }));

      const npcContext = names.length === 1
        ? `## NPC VOICING MODE\nYou are responding AS the NPC named ${names[0]} ONLY.\nWrite 1-3 sentences of in-character dialogue from their perspective.\nDo NOT write scene narration, do NOT describe player character actions, do NOT include mechanical information.\nJust write what they say, prefixed with their name in bold.\nFormat: **${names[0]}:** Their dialogue here.\nStay consistent with how this NPC has been portrayed in the campaign so far.`
        : `## NPC VOICING MODE\nYou are responding AS the following NPCs: ${names.join(', ')}.\nWrite exactly 1 sentence of pure in-character dialogue PER NPC.\nDo NOT write scene narration, do NOT describe player character actions, do NOT include mechanical information.\nFormat each line as: **NPC Name:** Their dialogue here.\nOrder: ${names.map((n, i) => `${i + 1}. ${n}`).join(', ')}.\nEach NPC must respond on a separate line.\nStay consistent with how each NPC has been portrayed in the campaign so far.`;

      const assistantContent = await streamAIResponse(apiMessages, customGuidesContent || '', abortRef.current!.signal, npcContext, undefined, empyreanPersonaPrompt);

      if (assistantContent?.trim()) {
        await insertPartyMessageHelper(partyId, {
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: nameLabel,
        });

        const updatedMessages = [...messages,
          { id: '', party_id: partyId, role: 'user' as const, content: formattedContent, sender_user_id: user.id, sender_name: characterName, created_at: '' },
          { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: nameLabel, created_at: '' },
        ];
        triggerSummaryIfNeeded(updatedMessages);
        silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
      }

      // Release generation lock
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('Party DM voiceNPC error:', error);
        toast.error(error instanceof Error ? error.message : 'NPC voicing failed');
      }

      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, messages, characterName, customGuidesContent, streamAIResponse, triggerSummaryIfNeeded, silentAutoSave, insertPartyMessageHelper, empyreanPersonaPrompt]);

  // === DIALOGUE MODE: Generate a recap of recent dialogue ===
  const generateDialogueRecap = useCallback(async (): Promise<string | null> => {
    if (!partyId || !user || !sessionConfig) return null;

    // Find all messages since the last DM assistant message
    const lastDMIndex = messages.length - 1 - [...messages].reverse().findIndex(m => m.role === 'assistant' && m.sender_name === 'DM');
    const dialogueMessages = lastDMIndex >= 0 && lastDMIndex < messages.length
      ? messages.slice(lastDMIndex + 1)
      : messages.slice(-20);

    if (dialogueMessages.length < 2) return null;

    const dialogueText = dialogueMessages
      .filter(m => m.role === 'user' && m.sender_name !== 'System')
      .map(m => m.content)
      .join('\n');

    if (!dialogueText.trim()) return null;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Summarize this player dialogue in 2-3 sentences as a narrative bridge. Focus on what was decided, revealed, or emotionally significant. Write in past tense as if recapping for a DM who needs to continue the story:\n\n${dialogueText}` }],
          campaignSummary: sessionConfig.campaignSummary || undefined,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.summary || data?.content || null;
    } catch {
      return null;
    }
  }, [partyId, user, sessionConfig, messages]);

  // === DIALOGUE MODE: Auto-intervention monitor ===
  const DIALOGUE_TRIGGER_PATTERN = /attack|strike|cast|stab|shoot|kill|fight|draw.*(sword|weapon|blade|bow)|initiative|persuade|deceive|intimidate|steal|sneak|investigate|search|perception|insight|roll|check|save|trap|danger|ambush/i;

  useEffect(() => {
    if (sessionConfig?.dmMode !== 'dialogue' || !sessionConfig.dialogueAutoIntervene || isGenerating) return;

    const threshold = sessionConfig.dialogueAutoInterveneThreshold || 6;

    let userMsgsSinceLastDM = 0;
    const recentUserMessages: string[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') break;
      if (messages[i].role === 'user') {
        userMsgsSinceLastDM++;
        recentUserMessages.push(messages[i].content);
      }
    }

    if (userMsgsSinceLastDM <= lastAutoInterveneMsgCountRef.current) return;

    if (userMsgsSinceLastDM >= threshold) {
      const hasTriggered = recentUserMessages.some(content => DIALOGUE_TRIGGER_PATTERN.test(content));
      if (hasTriggered) {
        console.log(`[PartyDM] Auto-intervene triggered: ${userMsgsSinceLastDM} msgs since last DM, trigger pattern found`);
        lastAutoInterveneMsgCountRef.current = userMsgsSinceLastDM;
        callDM();
      }
    }
  }, [messages, sessionConfig?.dmMode, sessionConfig?.dialogueAutoIntervene, sessionConfig?.dialogueAutoInterveneThreshold, isGenerating, callDM]);

  // Reset auto-intervene counter when a new DM response arrives
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      lastAutoInterveneMsgCountRef.current = 0;
    }
  }, [messages]);


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
      let regenPartyContext = '';
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
        regenPartyContext = [
          `## PARTY SPLIT — ${teamName}\nThe party has split up. You are narrating ONLY for "${teamName}".\n${membersSummary}\nDo NOT narrate what the other team ("${otherTeamName}") is doing. Focus solely on this group's adventure. Refer to this group as "${teamName}" in your narration.`,
          otherSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${otherTeamName}"'s adventure summary (for narrative coherence only — do NOT reveal to "${teamName}"):\n${otherSummary}` : '',
          thisSummary ? `\n\n## PREVIOUS "${teamName}" SUMMARY\n${thisSummary}` : '',
        ].filter(Boolean).join('\n\n');
        guides = customGuidesContent || '';
      } else {
        // Normal mode
        historyMessages = messages.slice(0, msgIndex);
        apiMessages = historyMessages.map(m => ({ role: m.role, content: m.content }));

        const partyMembersSummary = buildPartyMembersGuide();
        regenPartyContext = [
          `## PARTY MEMBERS\nThis is a multiplayer session. Multiple players are acting simultaneously each round.\n${partyMembersSummary}\nResolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.`,
        ].filter(Boolean).join('\n\n');
        guides = customGuidesContent || '';
      }

      const assistantContent = await streamAIResponse(apiMessages, guides, abortRef.current!.signal, regenPartyContext);

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
        setMessages(prev => prev.map(m => m.id === messageId ? enrichMessageWithWhispers({ ...m, content: newContent }, characterName, myDragonName) : m));
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

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
    // Release the generation lock
    if (partyId && sessionConfig) {
      (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session')
        .then(() => {});
    }
  }, [partyId, sessionConfig]);

  // === SPLIT PARTY FUNCTIONS ===

  const initiateSplit = useCallback(async (alphaMembers: string[], alphaName?: string, betaName?: string) => {
    if (!partyId || !user || !isCreator || !sessionConfig) return;
    if (isSplitActive) {
      toast.error('A split is already active');
      return;
    }
    if (isGenerating) {
      toast.error('Cannot split while generating a response');
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

    // Seed each team's chat with the last DM message for narrative context
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg) {
      await (supabase.from('party_dm_messages') as any).insert({
        party_id: partyId,
        role: 'assistant',
        content: lastAssistantMsg.content,
        sender_user_id: null,
        sender_name: 'DM',
        team: 'alpha',
      });
      await (supabase.from('party_dm_messages') as any).insert({
        party_id: partyId,
        role: 'assistant',
        content: lastAssistantMsg.content,
        sender_user_id: null,
        sender_name: 'DM',
        team: 'beta',
      });
    }

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
      // Delete pending prompts only — preserve all messages (split + pre-split)
      await (supabase.from('party_dm_prompts') as any)
        .delete()
        .eq('party_id', partyId);

      // Build AI context from existing messages (use snapshot for concise context)
      const contextApiMsgs = splitState.snapshotMessages.map(m => ({
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

      contextApiMsgs.push({ role: 'user', content: `[DM Note]: The party regroups. ${reunionPrompt}` });

      abortRef.current = new AbortController();
      const unificationContent = await streamAIResponse(contextApiMsgs, unificationGuides, abortRef.current.signal);

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
    if (!partyId) return;

    const base = await resolveSessionConfig();
    if (!base) {
      console.warn('[PartyDM] updateSessionConfig: no session config found, cannot update');
      return;
    }

    const updated: DmSessionConfig = { ...base, ...patch };
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updated })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    setSessionConfig(updated);
  }, [partyId, resolveSessionConfig]);

  // Full campaign summarization — processes entire chat history in batches
  const fullSummarize = useCallback(async () => {
    if (!partyId || !user) {
      toast.error('Cannot summarize without an active party');
      return;
    }

    setIsFullSummarizing(true);
    try {
      let allMsgs: Array<{ role: string; content: string }> = [];
      let from = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data, error } = await (supabase.from('party_dm_messages') as any)
          .select('role, content, created_at, sender_name')
          .eq('party_id', partyId)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allMsgs = allMsgs.concat(data.map((m: any) => ({ role: m.role, content: `[${m.sender_name}]: ${m.content}` })));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (allMsgs.length === 0) {
        toast.info('No messages to summarize');
        return;
      }

      // Larger batches for more thorough coverage — 40 messages per batch
      const BATCH_SIZE = 40;
      const batches: Array<Array<{ role: string; content: string }>> = [];
      for (let i = 0; i < allMsgs.length; i += BATCH_SIZE) {
        batches.push(allMsgs.slice(i, i + BATCH_SIZE));
      }

      const authToken = await getAuthToken();
      let runningSummary = '';

      for (let i = 0; i < batches.length; i++) {
        toast.info(`Summarizing batch ${i + 1}/${batches.length}...`, { duration: 2000 });

        const response = await fetch(SUMMARIZE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: batches[i],
            previousSummary: runningSummary || undefined,
            worldContext: customGuidesContent ? customGuidesContent.slice(0, 4000) : undefined,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[FullSummarize] Batch ${i + 1} failed:`, response.status, errText);
          if (response.status === 429) {
            toast.error('Rate limited. Try again in a moment.');
            return;
          }
          throw new Error(`Batch ${i + 1} failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.summary) {
          runningSummary = data.summary;
        }
      }

      if (runningSummary) {
        await updateSessionConfig({ campaignSummary: runningSummary });
        await silentAutoSave(messages, runningSummary);
        toast.success('Full campaign summary generated!');
      }
    } catch (error) {
      console.error('[FullSummarize] Error:', error);
      toast.error('Failed to generate full summary');
    } finally {
      setIsFullSummarizing(false);
    }
  }, [partyId, user, messages, updateSessionConfig, silentAutoSave, customGuidesContent]);


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

  // Manual DM message (Human DM mode): insert content as assistant role
  const sendManualDmMessage = useCallback(async (content: string) => {
    if (!partyId || !user || !sessionConfig) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    let promptTeam: string | null = null;

    // 1. Check for ready prompts and insert consolidated user message FIRST
    const readyPrompts = currentPrompts.filter(p => p.is_ready && memberUserIds.has(p.user_id));
    if (readyPrompts.length > 0) {
      promptTeam = isSplitActive && splitState && readyPrompts.length > 0
        ? readyPrompts[0].team || null
        : null;

      const userContent = readyPrompts
        .map(p => `[${p.character_name}]: ${p.prompt.trim() || '(no action)'}`)
        .join('\n');

      const { data: userData } = await (supabase.from('party_dm_messages') as any)
        .insert({
          party_id: partyId,
          role: 'user',
          content: userContent,
          sender_user_id: user.id,
          sender_name: readyPrompts.map(p => p.character_name).join(', '),
          team: promptTeam,
        })
        .select('*')
        .single();

      if (userData) {
        setMessages(prev => {
          if (prev.some(m => m.id === userData.id)) return prev;
          return [...prev, userData as PartyDmMessage];
        });
      }

      // Delete prompts
      await (supabase.from('party_dm_prompts') as any)
        .delete()
        .eq('party_id', partyId)
        .eq('round_id', sessionConfig.currentRoundId);
    }

    // 2. Insert DM's assistant message SECOND
    const insertData: Record<string, unknown> = {
      party_id: partyId,
      role: 'assistant',
      content: trimmed,
      sender_user_id: user.id,
      sender_name: 'DM',
      team: promptTeam,
    };

    const { data, error } = await (supabase.from('party_dm_messages') as any)
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to send DM message');
      console.error('[PartyDM] sendManualDmMessage error:', error);
      return;
    }

    if (data) {
      const enriched = enrichMessageWithWhispers(data as PartyDmMessage, characterName, myDragonName);
      setMessages(prev => {
        if (prev.some(m => m.id === enriched.id)) return prev;
        return [...prev, enriched];
      });
    }

    // Advance round
    const newRoundId = crypto.randomUUID();
    await updateSessionConfig({ currentRoundId: newRoundId });
    setCurrentPrompts([]);

    // Auto-save
    const allMsgs = [...messages, ...(data ? [enrichMessageWithWhispers(data as PartyDmMessage, characterName, myDragonName)] : [])];
    silentAutoSave(allMsgs, sessionConfig.campaignSummary || null);
  }, [partyId, user, sessionConfig, isSplitActive, splitState, characterName, currentPrompts, updateSessionConfig, silentAutoSave, messages]);

  // Approve AI draft (AI Approval mode): insert edited content as assistant message
  const approveDraft = useCallback(async (editedContent: string) => {
    if (!partyId || !user || !sessionConfig || !pendingDraft) return;
    const trimmed = editedContent.trim();
    if (!trimmed) return;

    // Insert user message first
    const { data: userData } = await (supabase.from('party_dm_messages') as any)
      .insert({
        party_id: partyId,
        role: 'user',
        content: pendingDraft.userContent,
        sender_user_id: user.id,
        sender_name: pendingDraft.userSenderName,
      })
      .select('*')
      .single();

    if (userData) {
      setMessages(prev => {
        if (prev.some(m => m.id === userData.id)) return prev;
        return [...prev, userData as PartyDmMessage];
      });
    }

    // Insert approved assistant message
    const { data: assistantData } = await (supabase.from('party_dm_messages') as any)
      .insert({
        party_id: partyId,
        role: 'assistant',
        content: trimmed,
        sender_user_id: null,
        sender_name: 'DM',
      })
      .select('*')
      .single();

    if (assistantData) {
      const enriched = enrichMessageWithWhispers(assistantData as PartyDmMessage, characterName, myDragonName);
      setMessages(prev => {
        if (prev.some(m => m.id === enriched.id)) return prev;
        return [...prev, enriched];
      });
    }

    // Trigger summary and auto-save
    const updatedMessages = [...messages,
      { id: '', party_id: partyId, role: 'user' as const, content: pendingDraft.userContent, sender_user_id: user.id, sender_name: pendingDraft.userSenderName, created_at: '' },
      { id: '', party_id: partyId, role: 'assistant' as const, content: trimmed, sender_user_id: null, sender_name: 'DM', created_at: '' },
    ];
    triggerSummaryIfNeeded(updatedMessages);
    silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);

    // Clear draft
    setPendingDraft(null);

    // Clear prompts and advance round
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('round_id', sessionConfig.currentRoundId);

    const newRoundId = crypto.randomUUID();
    await updateSessionConfig({ currentRoundId: newRoundId });
    setCurrentPrompts([]);
  }, [partyId, user, sessionConfig, pendingDraft, characterName, messages, triggerSummaryIfNeeded, silentAutoSave, updateSessionConfig]);

  const discardDraft = useCallback(() => {
    setPendingDraft(null);
  }, []);


  const computedIsGenerating = isGenerating || (sessionConfig?.isGenerating ?? false);

  return useMemo(() => ({
    messages: filteredMessages,
    allMessages: messages,
    currentPrompts,
    sessionConfig,
    isActive,
    isGenerating: computedIsGenerating,
    isSummarizing,
    isFullSummarizing,
    fullSummarize,
    allReady,
    myPrompt,
    activeCampaignId,
    lastAutoSaveTime,
    splitState,
    isSplitActive,
    myTeam,
    pendingDraft,
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
    sendManualDmMessage,
    approveDraft,
    discardDraft,
    editMessage,
    deleteMessage,
    sendDialogueMessage,
    sendWhisper,
    callDM,
    voiceNPC,
    generateDialogueRecap,
    regenerateMessage,
    regenerateWhispers,
    addMediaMessage,
    stopGeneration,
    initiateSplit,
    regroupParty,
    updateSessionConfig,
    // Timer
    setTimerConfig,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    requestExtension,
    approveExtension,
    dismissExtensions,
  }), [
    filteredMessages, messages, currentPrompts, sessionConfig, isActive,
    computedIsGenerating, isSummarizing, isFullSummarizing, fullSummarize, allReady, myPrompt, activeCampaignId,
    lastAutoSaveTime, splitState, isSplitActive, myTeam, pendingDraft,
    startSession, endSession, startNewCampaign, saveCampaign, loadCampaign,
    submitPrompt, editPrompt, retractPrompt, setReady, unready,
    generateResponse, sendManualDmMessage, approveDraft, discardDraft,
    editMessage, deleteMessage, sendDialogueMessage, sendWhisper, callDM, voiceNPC, generateDialogueRecap, regenerateMessage, regenerateWhispers,
    addMediaMessage, stopGeneration, initiateSplit, regroupParty,
    updateSessionConfig, setTimerConfig, startTimer, pauseTimer, resumeTimer,
    cancelTimer, requestExtension, approveExtension, dismissExtensions,
  ]);
}
