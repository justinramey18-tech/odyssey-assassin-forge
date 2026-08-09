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
import { loadApiKey, isFeatureSkipped } from '@/lib/api-keys';
import { buildNarrationStyleBlock } from '@/lib/narrationStyle';
import { fetchPartyNarrationStyle } from '@/hooks/use-party-narration-style';
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

function extractOocDirectivesFromText(content: string): string[] {
  if (!content?.trim()) return [];
  const directives: string[] = [];
  const bracketPattern = /\[\s*OOC\s*:?\s*([\s\S]*?)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = bracketPattern.exec(content)) !== null) {
    const directive = match[1]?.replace(/\s+/g, ' ').trim();
    if (directive) directives.push(directive);
  }

  const withoutBracketedOoc = content.replace(bracketPattern, '');
  const linePattern = /(?:^|\n)\s*(?:OOC|Out of character)\s*:\s*([^\n]+)/gi;
  while ((match = linePattern.exec(withoutBracketedOoc)) !== null) {
    const directive = match[1]?.replace(/\s+/g, ' ').trim();
    if (directive) directives.push(directive);
  }

  const hiddenCommandPattern = /out-of-character command:\s*["“]([\s\S]*?)["”]\s*(?:\n|$)/gi;
  while ((match = hiddenCommandPattern.exec(content)) !== null) {
    const directive = match[1]?.replace(/\s+/g, ' ').trim();
    if (directive) directives.push(directive);
  }

  return Array.from(new Set(directives)).slice(0, 12);
}

function formatCanonValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 240 ? `${serialized.slice(0, 240)}…` : serialized;
  } catch {
    return null;
  }
}

function stripOocDirectivesForNarrative(content: string): string {
  if (!content?.trim()) return '';
  return content
    .replace(/\[\s*OOC\s*:?\s*[\s\S]*?\]/gi, '')
    .replace(/(?:^|\n)\s*(?:OOC|Out of character)\s*:\s*[^\n]+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  is_afk_marker?: boolean;
}

/**
 * Parse whispers from an assistant message, filter by character name,
 * and return the message with clean content + filtered whispers.
 */
const BURNOUT_TAG_RE = /<!--BURNOUT:\d+-->/g;
const BURNOUT_TICK_TAG_RE = /<!--BURNOUT_TICK:.+?-->/g;
const BOND_STRAIN_TAG_RE = /<!--BOND_STRAIN:.+?-->/g;
const BOND_GROWTH_TAG_RE = /<!--BOND_GROWTH:.+?-->/g;
const DRAGON_MEMORY_TAG_RE = /<!--DRAGON_MEMORY:.+?-->/g;
const DRAGON_BOND_FORMED_TAG_RE = /<!--DRAGON_BOND_FORMED-->/g;
const THRESHING_AUTHORIZED_TAG_RE = /<!--THRESHING_AUTHORIZED:.+?-->/g;

function enrichMessageWithWhispers(msg: PartyDmMessage, myCharacterName?: string, myDragonName?: string): PartyDmMessage {
  if (msg.role !== 'assistant') return msg;
  const { narrative, whispers } = parseWhispers(msg.content);
  // Strip burnout and bond strain tags from narrative
  const cleanNarrative = narrative.replace(BURNOUT_TAG_RE, '').replace(BURNOUT_TICK_TAG_RE, '').replace(BOND_STRAIN_TAG_RE, '').replace(BOND_GROWTH_TAG_RE, '').replace(DRAGON_MEMORY_TAG_RE, '').replace(DRAGON_BOND_FORMED_TAG_RE, '').replace(THRESHING_AUTHORIZED_TAG_RE, '').replace(/<[^>]*>/g, '').trim();
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
  signet_intensity?: number | null;
}

export type DmMode = 'ai' | 'human' | 'ai-approval' | 'dialogue' | 'turnBased';

export interface DmSessionConfig {
  active: boolean;
  mode: 'shared' | 'private';
  currentRoundId: string;
  campaignSummary: string | null;
  isGenerating: boolean;
  splitActive?: boolean;
  dmMode?: DmMode; // 'ai' (default) | 'human' | 'ai-approval' | 'dialogue' | 'turnBased'
  // Couples Mode (turnBased dmMode): whose turn it currently is. Null/undefined = unclaimed,
  // first ready submission in turnBased mode claims it as the starting player.
  turnUserId?: string | null;
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
  // NPC Conversational Scene
  npcSceneActive?: boolean;
  npcSceneNpcs?: string[];        // 2-6 NPC names
  npcScenePrompt?: string;        // scene-setting prompt
  npcSceneMaxMessages?: number;   // message cap (default 12)
  npcSceneMessageCount?: number;  // messages generated so far
}

export interface PartyDragonConfig {
  dragonName: string;
  dragonColor?: string;
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
  totalChatExchanges?: number;
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
  worldStatePrompt?: string;
  partyDragonConfigs?: Array<{ userId: string; characterName: string; config: { dragonName: string; signetType: string; bond: number; trust: number; mood: string; burnout: number } }>;
  myDragonName?: string;
  onBurnoutDetected?: (level: number) => void;
  onBurnoutTickDetected?: (reason: string) => void;
  onBondStrainDetected?: (reason: string) => void;
  onBondGrowthDetected?: (reason: string) => void;
  onDragonMemoryDetected?: (memory: string) => void;
  onDragonBondFormed?: () => void;
  isSoloEmpyrean?: boolean;
}

export function usePartyDm({ partyId, isCreator, memberCount, characterName, characterContext, partyMembers, customGuidesContent, memoryAnchorsContent, worldStatePrompt, partyDragonConfigs, myDragonName, onBurnoutDetected, onBurnoutTickDetected, onBondStrainDetected, onBondGrowthDetected, onDragonMemoryDetected, onDragonBondFormed, isSoloEmpyrean }: UsePartyDmOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PartyDmMessage[]>([]);
  const [currentPrompts, setCurrentPrompts] = useState<PartyDmPrompt[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFullSummarizing, setIsFullSummarizing] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<DmSessionConfig | null>(null);
  const sessionConfigRef = useRef<DmSessionConfig | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);

  // Keep ref in sync for use in async callbacks
  useEffect(() => {
    sessionConfigRef.current = sessionConfig;
    currentRoundIdRef.current = sessionConfig?.currentRoundId ?? null;
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

  // Detect BURNOUT, BOND_STRAIN, BOND_GROWTH, and DRAGON_MEMORY tags from new assistant messages in Empyrean campaigns
  const onBurnoutRef = useRef(onBurnoutDetected);
  const onBurnoutTickRef = useRef(onBurnoutTickDetected);
  const onBondStrainRef = useRef(onBondStrainDetected);
  const onBondGrowthRef = useRef(onBondGrowthDetected);
  const onDragonMemoryRef = useRef(onDragonMemoryDetected);
  const onDragonBondFormedRef = useRef(onDragonBondFormed);
  useEffect(() => { onBurnoutRef.current = onBurnoutDetected; }, [onBurnoutDetected]);
  useEffect(() => { onBurnoutTickRef.current = onBurnoutTickDetected; }, [onBurnoutTickDetected]);
  useEffect(() => { onBondStrainRef.current = onBondStrainDetected; }, [onBondStrainDetected]);
  useEffect(() => { onBondGrowthRef.current = onBondGrowthDetected; }, [onBondGrowthDetected]);
  useEffect(() => { onDragonMemoryRef.current = onDragonMemoryDetected; }, [onDragonMemoryDetected]);
  useEffect(() => { onDragonBondFormedRef.current = onDragonBondFormed; }, [onDragonBondFormed]);
  const lastParsedMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionConfig?.campaignType !== 'empyrean') return;
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;
    if (lastMsg.id === lastParsedMsgIdRef.current) return;
    lastParsedMsgIdRef.current = lastMsg.id;

    // BURNOUT and BURNOUT_TICK tags are deprecated — burnout is now app-controlled, not AI-controlled.
    // Tags are still stripped from displayed text (see BURNOUT_TAG_RE above), but no longer mutate state.

    const strainMatch = lastMsg.content.match(/<!--BOND_STRAIN:(.+?)-->/);
    if (strainMatch) {
      onBondStrainRef.current?.(strainMatch[1]);
    }


    // Parse BOND_GROWTH: increase bond by 3
    const bondGrowthMatch = lastMsg.content.match(/<!--BOND_GROWTH:(.+?)-->/);
    if (bondGrowthMatch) {
      onBondGrowthRef.current?.(bondGrowthMatch[1]);
    }

    // Parse DRAGON_MEMORY: store a persistent memory
    const dragonMemoryMatch = lastMsg.content.match(/<!--DRAGON_MEMORY:(.+?)-->/);
    if (dragonMemoryMatch) {
      onDragonMemoryRef.current?.(dragonMemoryMatch[1]);
    }

    // Detect dragon bond formation
    if (lastMsg.content.includes('<!--DRAGON_BOND_FORMED-->')) {
      onDragonBondFormedRef.current?.();
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
  const [activeMoodPresetId, setActiveMoodPresetIdState] = useState<string | null>(null);

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

  const isTurnBasedMode = (sessionConfig?.dmMode || 'ai') === 'turnBased';

  // In turnBased mode, only the current turn-holder's ready prompt matters.
  // If no turn is claimed yet, ANY member's ready prompt counts (first-to-submit claims it).
  const turnReady = (() => {
    if (!isTurnBasedMode) return false;
    const claimedTurnUserId = sessionConfig?.turnUserId;
    if (claimedTurnUserId) {
      return activePrompts.some(p => p.user_id === claimedTurnUserId && p.is_ready);
    }
    return activePrompts.some(p => p.is_ready);
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
      const roundId = sessionConfig?.currentRoundId;
      const [msgsRes, promptsRes] = await Promise.all([
        (supabase.from('party_dm_messages') as any)
          .select('*')
          .eq('party_id', partyId)
          .order('created_at', { ascending: false })
          .limit(200),
        roundId
          ? (supabase.from('party_dm_prompts') as any)
              .select('*')
              .eq('party_id', partyId)
              .eq('round_id', roundId)
          : Promise.resolve({ data: null }),
      ]);

      const msgs = msgsRes.data ? [...msgsRes.data].reverse() : [];
      setMessages(msgs);
      if (promptsRes.data) {
        // Dedupe per user: prefer a real (non-blank) prompt over a blank placeholder;
        // among rows of equal "realness", prefer the newest. Guards against legacy dupes.
        const byUser = new Map<string, PartyDmPrompt>();
        const hasText = (r: PartyDmPrompt) => !!(r.prompt && String(r.prompt).trim());
        for (const row of promptsRes.data as PartyDmPrompt[]) {
          const existing = byUser.get(row.user_id);
          if (!existing) { byUser.set(row.user_id, row); continue; }
          const rowReal = hasText(row);
          const existReal = hasText(existing);
          if (rowReal && !existReal) { byUser.set(row.user_id, row); continue; }
          if (!rowReal && existReal) continue;
          if (new Date(row.created_at as any) > new Date(existing.created_at as any)) {
            byUser.set(row.user_id, row);
          }
        }
        setCurrentPrompts(Array.from(byUser.values()));
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

      // Load persisted active mood preset for this party (per-partyId persistence).
      try {
        const { data: moodRow } = await (supabase.from('party_shared_state') as any)
          .select('state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'active_mood')
          .maybeSingle();
        if (moodRow?.state_data?.presetId) {
          setActiveMoodPresetIdState(moodRow.state_data.presetId as string);
        }
      } catch (e) {
        console.error('[PartyDM] failed to load active_mood:', e);
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
          // If an NPC scene is active and this is a player message, signal the scene loop
          if (npcSceneActiveRef.current && newMsg.role === 'user' && newMsg.sender_name) {
            npcSceneInterjectionRef.current = {
              content: newMsg.content,
              senderName: newMsg.sender_name,
            };
          }
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
        const hasText = (r: Partial<PartyDmPrompt>) => !!(r.prompt && String(r.prompt).trim());
        if (payload.eventType === 'INSERT') {
          const p = payload.new as PartyDmPrompt;
          // Ignore prompts that don't belong to the current round (prevents cross-round leakage).
          if (currentRoundIdRef.current && p.round_id !== currentRoundIdRef.current) return;
          setCurrentPrompts(prev => {
            if (prev.some(x => x.id === p.id)) return prev;
            // Real-time dedupe: if a same-user row already exists, keep whichever has real text.
            const sameUser = prev.find(x => x.user_id === p.user_id);
            let next: PartyDmPrompt[];
            if (sameUser && hasText(sameUser) && !hasText(p)) {
              // Existing real prompt beats an incoming blank placeholder.
              next = prev;
            } else {
              next = [...prev.filter(x => x.user_id !== p.user_id), p];
            }
            if (p.is_ready && p.user_id !== user?.id) {
              const readyCount = next.filter(x => x.is_ready).length;
              sendReadyUpNotification(p.character_name, readyCount, memberCount);
            }
            return next;
          });
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as PartyDmPrompt;
          const oldPrompt = payload.old as Partial<PartyDmPrompt>;
          if (currentRoundIdRef.current && p.round_id !== currentRoundIdRef.current) return;
          setCurrentPrompts(prev => {
            const exists = prev.some(x => x.id === p.id);
            const sameUserOther = prev.find(x => x.user_id === p.user_id && x.id !== p.id);
            // If a same-user real prompt already exists and the incoming update is blank, ignore it.
            if (!exists && sameUserOther && hasText(sameUserOther) && !hasText(p)) {
              return prev;
            }
            const base = exists
              ? prev.map(x => x.id === p.id ? p : x)
              : [...prev.filter(x => x.user_id !== p.user_id), p];
            if (p.is_ready && !oldPrompt.is_ready && p.user_id !== user?.id) {
              const readyCount = base.filter(x => x.is_ready).length;
              sendReadyUpNotification(p.character_name, readyCount, memberCount);
            }
            return base;
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
          if (old.state_type === 'active_mood') {
            setActiveMoodPresetIdState(null);
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
        if (row.state_type === 'active_mood') {
          const data = row.state_data as { presetId?: string | null };
          setActiveMoodPresetIdState(data?.presetId ?? null);
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

  // Shared active mood preset (one row per party, any host/co-host can update).
  const setActiveMoodPreset = useCallback(async (presetId: string | null) => {
    if (!partyId || !user) return;
    setActiveMoodPresetIdState(presetId);
    try {
      const { data: existing } = await (supabase.from('party_shared_state') as any)
        .select('id')
        .eq('party_id', partyId)
        .eq('state_type', 'active_mood')
        .maybeSingle();
      const payload = { presetId, updatedAt: new Date().toISOString() };
      if (existing?.id) {
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: payload })
          .eq('id', existing.id);
      } else {
        await (supabase.from('party_shared_state') as any)
          .insert({ party_id: partyId, user_id: user.id, state_type: 'active_mood', state_data: payload });
      }
    } catch (e) {
      console.error('[PartyDM] failed to write active_mood:', e);
    }
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

  const submitPrompt = useCallback(async (text: string, signetIntensity?: number) => {
    if (!partyId || !user) return;
    if (submitLockRef.current) return;
    const resolvedConfig = await resolveSessionConfig();
    if (!resolvedConfig) { toast.error('No active session'); return; }
    const existing = currentPrompts.find(p => p.user_id === user.id);
    if (existing) {
      // If this is a real, current-round row, block (genuine duplicate).
      if (existing.round_id === resolvedConfig.currentRoundId) {
        toast.error('You already submitted a prompt this round');
        return;
      }
      // Otherwise it's a stale row from a prior round left in state — clear it and proceed.
      setCurrentPrompts(prev => prev.filter(p => p.user_id !== user.id));
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
      signet_intensity: signetIntensity ?? null,
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
      signet_intensity: signetIntensity ?? null,
    };
    setCurrentPrompts(prev => [...prev.filter(p => p.user_id !== user.id), optimisticPrompt]);
    try {
      const { error } = await (supabase.from('party_dm_prompts') as any)
        .upsert(insertData, { onConflict: 'party_id,round_id,user_id' });
      if (error) {
        setCurrentPrompts(prev => prev.filter(p => p.id !== optimisticId));
        console.error('[PartyDM] submitPrompt insert failed:', error);
        toast.error(`Failed to submit: ${error.message || error.code || 'unknown error'}`);
      }
    } catch (e: any) {
      setCurrentPrompts(prev => prev.filter(p => p.id !== optimisticId));
      console.error('[PartyDM] submitPrompt threw:', e);
      toast.error(`Failed to submit: ${e?.message || 'unexpected error'}`);
    } finally {
      submitLockRef.current = false;
    }

  }, [partyId, user, resolveSessionConfig, characterName, currentPrompts, isSplitActive, myTeam]);

  const setReady = useCallback(async () => {
    if (!user || !partyId) return;
    const resolvedConfig = await resolveSessionConfig();
    if (!resolvedConfig) { toast.error('No active session'); return; }

    // Couples Mode: claim the turn on first submission, or block if not your turn.
    const inTurnBased = (resolvedConfig.dmMode || 'ai') === 'turnBased';
    if (inTurnBased) {
      if (!resolvedConfig.turnUserId) {
        // Conditional claim: re-check under fresh read to avoid double-claim race.
        const { data: freshState } = await supabase
          .from('party_shared_state')
          .select('state_data')
          .eq('party_id', partyId)
          .eq('state_type', 'dm_session')
          .maybeSingle();
        const freshTurnUserId = (freshState?.state_data as any)?.turnUserId;
        if (!freshTurnUserId) {
          const patched = { ...(freshState?.state_data as any || resolvedConfig), turnUserId: user.id };
          await (supabase.from('party_shared_state') as any)
            .update({ state_data: patched })
            .eq('party_id', partyId)
            .eq('state_type', 'dm_session');
        } else if (freshTurnUserId !== user.id) {
          toast.error("It's not your turn yet.");
          return;
        }
      } else if (resolvedConfig.turnUserId !== user.id) {
        toast.error("It's not your turn yet.");
        return;
      }
    }

    // Authoritative: read THIS user's current-round row straight from the DB (not stale local state).
    const { data: existingRow } = await (supabase.from('party_dm_prompts') as any)
      .select('id, prompt')
      .eq('party_id', partyId)
      .eq('user_id', user.id)
      .eq('round_id', resolvedConfig.currentRoundId)
      .maybeSingle();

    const myPrompt = currentPrompts.find(p => p.user_id === user.id);

    if (existingRow) {
      // A real prompt row exists — just mark it ready. NEVER insert a blank duplicate.
      setCurrentPrompts(prev => prev.map(p => p.user_id === user.id ? { ...p, is_ready: true } : p));
      await (supabase.from('party_dm_prompts') as any)
        .update({ is_ready: true })
        .eq('id', existingRow.id);
      const hasText = !!(existingRow.prompt && String(existingRow.prompt).trim());
      toast.success(hasText ? 'Ready — your submitted prompt will be used' : 'Ready — no action this round');
    } else {
      // No prompt exists for this user this round → genuine "ready with no action".
      // Use insert-ignore-on-conflict so a concurrent real submitPrompt is NEVER overwritten
      // with blank. Then flip is_ready=true without touching the prompt column.
      const nowIso = new Date().toISOString();
      const insertData: Record<string, unknown> = {
        party_id: partyId,
        user_id: user.id,
        character_name: characterName,
        prompt: '',
        is_ready: true,
        round_id: resolvedConfig.currentRoundId,
      };
      if (isSplitActive && myTeam) insertData.team = myTeam;
      setCurrentPrompts(prev => {
        const withoutSelf = prev.filter(p => p.user_id !== user.id);
        return [...withoutSelf, {
          id: crypto.randomUUID(),
          party_id: partyId,
          user_id: user.id,
          character_name: characterName,
          prompt: '',
          is_ready: true,
          round_id: resolvedConfig.currentRoundId,
          created_at: nowIso,
          team: (isSplitActive && myTeam) ? myTeam : null,
        } as PartyDmPrompt];
      });
      // 1) Insert-if-missing (never overwrite existing prompt text on conflict).
      await (supabase.from('party_dm_prompts') as any)
        .upsert(insertData, { onConflict: 'party_id,round_id,user_id', ignoreDuplicates: true });
      // 2) Guarantee is_ready=true on whichever row now exists (real or blank).
      const { data: nowRow } = await (supabase.from('party_dm_prompts') as any)
        .update({ is_ready: true })
        .eq('party_id', partyId)
        .eq('user_id', user.id)
        .eq('round_id', resolvedConfig.currentRoundId)
        .select('prompt')
        .maybeSingle();
      const nowHasText = !!(nowRow?.prompt && String(nowRow.prompt).trim());
      toast.success(nowHasText ? 'Ready — your submitted prompt will be used' : 'Ready — no action this round');
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
    // "Save credits" toggle — skip background summaries.
    if (isFeatureSkipped('summaries')) return;


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

  const buildCanonGuardrailContext = useCallback((
    apiMessages: Array<{ role: string; content: string }>,
    extraGuides: string,
    explicitOocDirectives: string[] = [],
  ) => {
    const extractedOoc = apiMessages
      .filter(m => m.role === 'user')
      .slice(-8)
      .flatMap(m => extractOocDirectivesFromText(m.content));
    const currentOocDirectives = Array.from(new Set([...explicitOocDirectives, ...extractedOoc]))
      .filter(Boolean)
      .slice(0, 12);

    const rosterLines = partyMembers.map(member => {
      const status = member.character_status as Record<string, unknown>;
      const details: string[] = [];
      const className = formatCanonValue(status?.className);
      const level = formatCanonValue(status?.level);
      const race = formatCanonValue(status?.race);
      const gender = formatCanonValue(status?.gender);
      if (level || className) details.push(`Level/Class: ${[level, className].filter(Boolean).join(' ')}`);
      if (race || gender) details.push(`Identity: ${[gender, race].filter(Boolean).join(' ')}`);

      const statusKeys = [
        'horseName', 'horse_name', 'mountName', 'mount_name', 'companionName', 'companion_name',
        'dragonName', 'dragon_name', 'signetType', 'signet_type', 'yearAtBasgiath', 'year_at_basgiath',
        'relationship', 'relationships', 'lover', 'partner', 'spouse', 'personality',
      ];
      for (const key of statusKeys) {
        const value = formatCanonValue(status?.[key]);
        if (value) details.push(`${key}: ${value}`);
      }

      const suffix = details.length > 0 ? ` — ${details.join('; ')}` : '';
      return `- ${member.character_name}: PLAYER CHARACTER controlled by a human player; do not treat as an NPC.${suffix}`;
    });

    return [
      '## CURRENT CANON GUARDRAILS (READ BEFORE WRITING)',
      'Before writing the response, silently check the next answer against these facts. If prior AI narration, campaign summaries, or old chat history conflict with these guardrails, repair continuity using these guardrails now.',
      '',
      'Priority order for this response:',
      '1. Current-round OOC directives below are immediate factual corrections/instructions. Apply them exactly. Do not quote or narrate the OOC text to players.',
      '2. Enabled GM Guides are campaign law. Use them for names, relationships, lore, ownership, tone, secrets, and world rules. Never contradict them.',
      '3. Memory Anchors are established continuity facts. Use them for who-is-who, relationships, mounts/companions, unresolved consequences, locations, and social context.',
      '4. The party roster below lists human-controlled player characters. Do not demote them into NPCs or speak for them unless their submitted prompt explicitly gives dialogue/action.',
      '5. Player-written quoted in-character dialogue remains verbatim, but OOC notes are instructions only and must not appear as spoken dialogue.',
      '',
      currentOocDirectives.length > 0
        ? `### CURRENT-ROUND OOC DIRECTIVES (HIGHEST PRIORITY)\n${currentOocDirectives.map(d => `- ${d}`).join('\n')}`
        : '### CURRENT-ROUND OOC DIRECTIVES\n- None detected in the latest submitted prompts.',
      '',
      `### PARTY ROSTER CANON\n${rosterLines.join('\n') || '- No party roster available.'}`,
      '',
      '### LOADED CANON SOURCES',
      `- GM Guides: ${extraGuides?.trim() ? 'enabled and included below as campaign law' : 'none enabled for this call'}`,
      `- Memory Anchors: ${memoryAnchorsContent?.trim() ? 'enabled and included below as established continuity facts' : 'none available for this call'}`,
    ].join('\n');
  }, [partyMembers, memoryAnchorsContent]);

  // Helper: stream an AI response and return the content
  const streamAIResponse = useCallback(async (
    apiMessages: Array<{ role: string; content: string }>,
    extraGuides: string,
    signal: AbortSignal,
    partyContext?: string,
    responseModePrompt?: string,
    dmPersonaPrompt?: string,
    currentOocDirectives?: string[],
    liveTable?: { mode: 'chat' | 'live'; chaosLevel: number; hasTableTalk: boolean; hasInCharacter: boolean },
  ): Promise<string> => {

    // Ensure strictly alternating roles before sending to AI
    const sanitizedMessages = mergeConsecutiveRoles(apiMessages);

    // Fetch recent party chat for DM awareness
    const recentPartyChat = await fetchRecentPartyChat();
    const recentDragonChat = await fetchRecentDragonChat();
    const recentDragonNetwork = await fetchRecentDragonNetwork();

    // Fetch unconsumed Director private actions per player (privacy: keyed by user_id internally only)
    const directorPrivatesMap: Record<string, string[]> = await (async () => {
      if (!partyId) return {};
      try {
        const { data, error } = await (supabase as any)
          .from('party_director_messages')
          .select('user_id, content, created_at')
          .eq('party_id', partyId)
          .eq('category', 'private_action')
          .eq('consumed_by_dm', false)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(50);
        if (error || !data) return {};
        const grouped: Record<string, string[]> = {};
        for (const row of data as any[]) {
          const uid = row.user_id;
          if (!uid) continue;
          if (!grouped[uid]) grouped[uid] = [];
          grouped[uid].push(row.content || '');
        }
        return grouped;
      } catch (e) {
        console.error('[party-dm] fetchUnconsumedDirectorPrivates failed:', e);
        return {};
      }
    })();

    const directorPrivatesContext = (() => {
      const entries: string[] = [];
      for (const member of partyMembers) {
        const uid = (member as any).user_id;
        const name = (member as any).character_name || 'Player';
        const privates = directorPrivatesMap[uid];
        if (privates && privates.length > 0) {
          entries.push(`### ${name}'s private notes to the DM (NOT visible to other players):\n${privates.map(p => `- ${p}`).join('\n')}`);
        }
      }
      if (entries.length === 0) return undefined;
      return [
        '## PRIVATE PLAYER ACTIONS (FROM DIRECTOR CHANNEL)',
        'Each player has a private channel to share secret moves and hidden character details.',
        'These notes are HIDDEN from other players. Use them when generating narrative — but DO NOT explicitly call them out as "secret" in your response. Surface them naturally only if they\'re relevant to the current scene; otherwise hold them as DM knowledge for later.',
        '',
        ...entries,
      ].join('\n');
    })();

    const canonGuardrailsContext = buildCanonGuardrailContext(sanitizedMessages, extraGuides, currentOocDirectives);
    const voiceTagDirective = [
      'SPEAKER TAGS FOR NARRATION (formatting only):',
      'Wrap every line of spoken dialogue in [VOICE:Name] ... [/VOICE], where Name is the exact speaker (an NPC, a player character, or the narrator persona speaking aloud).',
      'Example: [VOICE:Kaelen]"You should not have come here."[/VOICE]',
      'Only spoken words go inside the tags — narration, action, and description stay outside them. Never tag a block of prose, never nest tags, and never mention the tags to the players.',
    ].join('\n');
    const enhancedPartyContext = [canonGuardrailsContext, voiceTagDirective, partyContext, directorPrivatesContext].filter(Boolean).join('\n\n') || undefined;

    const narrationStyleBlock = buildNarrationStyleBlock(await fetchPartyNarrationStyle(partyId));

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
        partyContext: enhancedPartyContext,
        memoryAnchors: memoryAnchorsContent || undefined,
        worldStatePrompt: worldStatePrompt || undefined,
        recentPartyChat: recentPartyChat.length > 0 ? recentPartyChat : undefined,
        recentDragonChat: recentDragonChat.length > 0 ? recentDragonChat : undefined,
        recentDragonNetwork: recentDragonNetwork.length > 0 ? recentDragonNetwork : undefined,
        responseModePrompt: responseModePrompt || undefined,
        dmPersonaPrompt: dmPersonaPrompt || undefined,
        directorPrivatesContext: directorPrivatesContext || undefined,
        model: loadSelectedModel(),
        user_api_key: loadApiKey('anthropic') || undefined,
        user_openai_key: loadApiKey('openai') || undefined,
        user_perplexity_key: loadApiKey('perplexity') || undefined,
        user_xai_key: loadApiKey('xai') || undefined,
        narrationStylePrompt: narrationStyleBlock || undefined,
        liveTable: liveTable || undefined,

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

    // Mark consumed private_actions after successful generation (do not block response on errors)
    if (partyId && Object.keys(directorPrivatesMap).length > 0) {
      try {
        await (supabase as any)
          .from('party_director_messages')
          .update({
            consumed_by_dm: true,
            consumed_at: new Date().toISOString(),
          })
          .eq('party_id', partyId)
          .eq('category', 'private_action')
          .eq('consumed_by_dm', false)
          .eq('role', 'user');
      } catch (e) {
        console.error('[party-dm] mark consumed failed:', e);
      }
    }

    return assistantContent;
  }, [characterContext, sessionConfig?.campaignSummary, memoryAnchorsContent, worldStatePrompt, mergeConsecutiveRoles, fetchRecentPartyChat, fetchRecentDragonChat, fetchRecentDragonNetwork, buildCanonGuardrailContext, partyId, partyMembers]);


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
          line += ` | Dragon: ${dc.config.dragonName}, Signet: ${dc.config.signetType || 'unknown'}, Bond: ${getBondDescriptor(dc.config.bond)}, Burnout: ${dc.config.burnout}/8`;
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
      return `- ${d.config.dragonName} (bonded to ${d.characterName}, mood: ${mood}, bond: ${bondDesc})`;
    }).join('\n');
    return `## PARTY DRAGON BONDS\nThese riders have bonded dragons:\n${lines}\n\nIMPORTANT RULES FOR DRAGON DEPICTION IN NARRATIVE:\n- NEVER write dragon telepathic dialogue, speech, or thoughts in the narrative. Dragons communicate with their riders privately through the bond — that happens off-screen in a separate channel.\n- DO NOT use whisper tags (>>CharacterName) for dragon communication. Those are no longer used.\n- DO describe dragons through BODY LANGUAGE and PHYSICAL ACTIONS only: wing movements, tail flicks, rumbles, growls, eye contact, scales shifting color, heat radiating, positioning relative to their rider, protective stances, head tilts, etc.\n- The dragons are present and reactive. They notice things. Show this through what they DO, not what they say.\n- Examples of good dragon depiction: "Tairn's massive head swings toward the treeline, nostrils flaring." / "Andarna presses closer to Violet, a low vibration building in her chest." / "The golden dragon's eyes narrow, claws scoring deep furrows in the stone."\n- Examples of what NOT to write: Any quoted dragon speech, any italicized telepathic messages, any "Dragon says through the bond" phrasing.`;
  }, [sessionConfig?.campaignType, partyDragonConfigs]);

  // Generate split summary for a team
  const generateSplitSummary = useCallback(async (teamMessages: PartyDmMessage[], previousSummary: string | null): Promise<string | null> => {
    // "Save credits" toggle — skip split-team summaries.
    if (isFeatureSkipped('summaries')) return previousSummary;
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
  const buildAfkGuidesContext = useCallback((readyPrompts: PartyDmPrompt[], teamMemberIds?: string[], coveredUserIds?: string[]) => {
    const relevantMembers = teamMemberIds
      ? partyMembers.filter(m => teamMemberIds.includes(m.user_id))
      : partyMembers;
    const covered = new Set(coveredUserIds || []);
    const absentMembers = relevantMembers.filter(
      m => !covered.has(m.user_id) && !readyPrompts.some(p => p.user_id === m.user_id)
    );
    const afkLines: string[] = [];
    const afkPromptLines: string[] = [];
    const afkEntries: Array<{ userId: string; characterName: string; content: string }> = [];
    const consumedCascades: { userId: string; remainingCascade: string[] }[] = [];

    for (const m of absentMembers) {
      const status = m.character_status as Record<string, unknown>;
      const cascade = status?.afkPromptCascade as string[] | null;
      const guide = status?.afkPersonalityGuide as string | null;

      if (cascade && cascade.length > 0) {
        // Use the first cascade prompt
        const nextPrompt = cascade[0];
        const remaining = cascade.slice(1);
        const line = `[${m.character_name}] (AFK — Cascade Prompt): ${nextPrompt}`;
        afkPromptLines.push(line);
        afkLines.push(`- ${m.character_name}: ${guide || '(no general guide)'}`);
        consumedCascades.push({ userId: m.user_id, remainingCascade: remaining });
        afkEntries.push({ userId: m.user_id, characterName: m.character_name, content: line });
      } else if (guide) {
        const line = `[${m.character_name}] (AFK): ${guide}`;
        afkLines.push(`- ${m.character_name}: ${guide}`);
        afkPromptLines.push(line);
        afkEntries.push({ userId: m.user_id, characterName: m.character_name, content: line });
      } else {
        const line = `[${m.character_name}]: Holds their action`;
        afkPromptLines.push(line);
        afkEntries.push({ userId: m.user_id, characterName: m.character_name, content: line });
      }
    }
    const guidesSection = afkLines.length > 0
      ? `\n\n## AFK CHARACTER GUIDES\nRoleplay the following absent characters in-character based on their personality descriptions:\n${afkLines.join('\n')}`
      : '';
    const promptSection = afkPromptLines.length > 0 ? '\n' + afkPromptLines.join('\n') : '';
    return { guidesSection, promptSection, consumedCascades, afkEntries };
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
    // When the host inserts a user-role row on behalf of another player (private mode round advance),
    // the new privacy SELECT policy hides that row from the host. Using INSERT...RETURNING via .select()
    // would then fail RLS (42501). Detect that case and skip the RETURNING — realtime will deliver the
    // row to the row's owner, and the host shouldn't see it under private mode anyway.
    const role = insertData.role as string | undefined;
    const senderUserId = insertData.sender_user_id as string | undefined;
    const isAfkMarker = insertData.is_afk_marker === true;
    const team = insertData.team as string | undefined;
    const isWhisper = typeof team === 'string' && team.startsWith('whisper:');
    const isProxyUserInsert =
      role === 'user' &&
      !isAfkMarker &&
      !isWhisper &&
      !!senderUserId &&
      !!user?.id &&
      senderUserId !== user.id;

    if (isProxyUserInsert) {
      const { error } = await (supabase.from('party_dm_messages') as any).insert(insertData);
      if (error) {
        throw new Error(`Failed to save message: ${error.message}`);
      }
      // No local state update — realtime delivers to the owning subscriber; host is filtered out by RLS.
      return null;
    }

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
  }, [user]);

  const generateResponse = useCallback(async (options?: {
    coveredUserIds?: string[];
    /**
     * Chat Rounds / Live DM: the ticked chat lines ARE the round prompt.
     * When present we bypass the ready-up prompt table entirely.
     */
    directPrompt?: {
      text: string;
      participants: Array<{ userId: string; characterName: string; text: string }>;
    };
    /** Chat Rounds / Live DM: table rules + chaos tone applied backend-side. */
    liveTable?: {
      mode: 'chat' | 'live';
      chaosLevel: number;
      hasTableTalk: boolean;
      hasInCharacter: boolean;
    };
  }) => {
    const directPrompt = options?.directPrompt;
    const liveTable = options?.liveTable;

    const coveredUserIds = options?.coveredUserIds
      ?? (directPrompt ? directPrompt.participants.map(p => p.userId) : undefined);
    if (!partyId || !user || !sessionConfig || isGenerating) return;


    const isTurnBased = (sessionConfig.dmMode || 'ai') === 'turnBased';
    const rawReadyPrompts = directPrompt
      ? directPrompt.participants.map((p, i) => ({
          id: `direct-${i}`,
          party_id: partyId,
          user_id: p.userId,
          character_name: p.characterName || 'Player',
          prompt: p.text,
          is_ready: true,
          round_id: sessionConfig.currentRoundId,
          created_at: new Date().toISOString(),
          team: null,
        }) as unknown as PartyDmPrompt)
      : isTurnBased
      ? currentPrompts.filter(p => p.is_ready && memberUserIds.has(p.user_id) && p.user_id === sessionConfig.turnUserId)
      : currentPrompts.filter(p => p.is_ready && memberUserIds.has(p.user_id));
    // Dedupe per user: prefer non-blank prompts over blank "(no action)", then newest.
    const byUser = new Map<string, PartyDmPrompt>();
    for (const p of rawReadyPrompts) {
      const existing = byUser.get(p.user_id);
      if (!existing) { byUser.set(p.user_id, p); continue; }
      const existingBlank = !existing.prompt || existing.prompt.trim() === '';
      const currentBlank = !p.prompt || p.prompt.trim() === '';
      if (existingBlank && !currentBlank) byUser.set(p.user_id, p);
      else if (existingBlank === currentBlank && new Date(p.created_at as any) > new Date(existing.created_at as any)) byUser.set(p.user_id, p);
    }
    const readyPrompts = Array.from(byUser.values());
    if (readyPrompts.length === 0 && !(directPrompt && directPrompt.text.trim())) {
      toast.error('No ready prompts to generate from');
      return;
    }


    // ── OOC Override Detection ──
    // Check if any ready prompt (especially the host's) contains an OOC directive
    // to ignore AFK guides. If so, we strip all AFK guide content at the code level.
    const OOC_IGNORE_AFK_PATTERN = /(?:ooc\s*:|^\s*\[ooc\]|\[.*?\])\s*ignore\s+(?:afk|autopilot)\s*(?:guides?|personality)?/im;
    const suppressAfkGuides = readyPrompts.some(p => OOC_IGNORE_AFK_PATTERN.test(p.prompt));
    const currentRoundOocDirectives = readyPrompts.flatMap(p => extractOocDirectivesFromText(p.prompt));

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

    const formatPromptLineForAI = (p: PartyDmPrompt) => {
      const cleanedPrompt = stripOocDirectivesForNarrative(p.prompt);
      if (cleanedPrompt) return `[${p.character_name}]: ${cleanedPrompt}`;
      if (p.prompt.trim() && currentRoundOocDirectives.length > 0) return `[${p.character_name}]: (OOC directive only — no in-character action submitted)`;
      return formatPromptLine(p);
    };

    const insertPartyMessage = (insertData: Record<string, unknown>) => insertPartyMessageHelper(partyId, insertData);

    setIsGenerating(true);

    // ── DB-level per-round claim ticket ──
    // The party_round_locks table has PK (party_id, round_id), so at most ONE
    // insert per round can ever succeed. This is the authoritative gate that
    // prevents two devices (or a rapid double-tap) from starting narration
    // twice for the same round. Stale locks (past expires_at) can be taken over.
    const lockRoundId = sessionConfig.currentRoundId;
    let lockClaimed = false;
    try {
      const { error: claimErr } = await (supabase.from('party_round_locks') as any)
        .insert({
          party_id: partyId,
          round_id: lockRoundId,
          holder_user_id: user.id,
          status: 'in_progress',
          expires_at: new Date(Date.now() + 90_000).toISOString(),
        });
      if (!claimErr) {
        lockClaimed = true;
      } else {
        // Insert lost the race — check if the existing lock is stale and steal it.
        const { data: existing } = await (supabase.from('party_round_locks') as any)
          .select('holder_user_id, expires_at, status')
          .eq('party_id', partyId)
          .eq('round_id', lockRoundId)
          .maybeSingle();
        const isStale = existing && (existing.status === 'completed' || (existing.expires_at && new Date(existing.expires_at) < new Date()));
        if (isStale) {
          const { data: stolen } = await (supabase.from('party_round_locks') as any)
            .update({
              holder_user_id: user.id,
              status: 'in_progress',
              started_at: new Date().toISOString(),
              completed_at: null,
              expires_at: new Date(Date.now() + 90_000).toISOString(),
            })
            .eq('party_id', partyId)
            .eq('round_id', lockRoundId)
            .select('holder_user_id');
          if (stolen && stolen.length > 0) lockClaimed = true;
        }
      }
    } catch (e) {
      console.error('[PartyDM] Round lock claim failed:', e);
    }
    if (!lockClaimed) {
      console.log('[PartyDM] Another device is already narrating this round, skipping');
      setIsGenerating(false);
      return;
    }

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
      // Release DB round lock so a subsequent retry isn't wedged.
      await (supabase.from('party_round_locks') as any)
        .delete()
        .eq('party_id', partyId)
        .eq('round_id', lockRoundId)
        .eq('holder_user_id', user.id);
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
          return `- ${d.config.dragonName} (bonded to ${d.characterName}, mood: ${d.config.mood}, bond: ${bondDesc})`;
        }).join('\n');
        freshDragonBondsSection = `## PARTY DRAGON BONDS\nThese riders have bonded dragons:\n${lines}\n\nIMPORTANT RULES FOR DRAGON DEPICTION IN NARRATIVE:\n- NEVER write dragon telepathic dialogue, speech, or thoughts in the narrative. Dragons communicate with their riders privately through the bond — that happens off-screen in a separate channel.\n- DO NOT use whisper tags (>>CharacterName) for dragon communication. Those are no longer used.\n- DO describe dragons through BODY LANGUAGE and PHYSICAL ACTIONS only: wing movements, tail flicks, rumbles, growls, eye contact, scales shifting color, heat radiating, positioning relative to their rider, protective stances, head tilts, etc.\n- The dragons are present and reactive. They notice things. Show this through what they DO, not what they say.\n- Examples of good dragon depiction: "Tairn's massive head swings toward the treeline, nostrils flaring." / "Andarna presses closer to Violet, a low vibration building in her chest." / "The golden dragon's eyes narrow, claws scoring deep furrows in the stone."\n- Examples of what NOT to write: Any quoted dragon speech, any italicized telepathic messages, any "Dragon says through the bond" phrasing.`;
      }
    }

    const freshPartyMembersSummary = partyMembers.map(m => {
      const s = m.character_status as Record<string, unknown>;
      let line = `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
      if (sessionConfig?.campaignType === 'empyrean' && freshDragonConfigs) {
        const dc = freshDragonConfigs.find((d: any) => d.userId === m.user_id);
        if (dc) {
          line += ` | Dragon: ${dc.config.dragonName}, Signet: ${dc.config.signetType || 'unknown'}, Bond: ${getBondDescriptor(dc.config.bond)}, Burnout: ${dc.config.burnout}/8`;
        }
      }
      return line;
    }).join('\n');

    abortRef.current = new AbortController();
    try {
      if (isSplitActive && splitState && !directPrompt) {
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
          const { guidesSection: alphaAfkGuides, promptSection: alphaAfkPrompts, consumedCascades: alphaConsumed, afkEntries: alphaAfkEntries } = suppressAfkGuides
            ? { guidesSection: '', promptSection: '', consumedCascades: [], afkEntries: [] as Array<{ userId: string; characterName: string; content: string }> }
            : buildAfkGuidesContext(alphaPrompts, splitState.alphaMembers, coveredUserIds);
          allConsumedCascades = [...allConsumedCascades, ...alphaConsumed];
          const alphaRawCombined = alphaPrompts
            .map(formatPromptLineForAI)
            .join('\n') + alphaAfkPrompts;

          const alphaForAI = alphaRawCombined;

          // Insert one row per ready player on Team Alpha (privacy: each row carries player's user_id)
          for (const p of alphaPrompts) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: formatPromptLine(p),
              sender_user_id: p.user_id,
              sender_name: p.character_name || 'Player',
              team: 'alpha',
            });
          }
          // Insert one row per AFK Team Alpha member
          for (const entry of alphaAfkEntries) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: entry.content,
              sender_user_id: entry.userId,
              sender_name: entry.characterName || 'Player',
              team: 'alpha',
              is_afk_marker: true,
            });
          }

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

          const alphaContent = await streamAIResponse(alphaApiMsgs, customGuidesContent || '', abortRef.current!.signal, alphaPartyContext, undefined, empyreanPersonaPrompt, currentRoundOocDirectives);

          if (alphaContent?.trim()) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'assistant',
              content: alphaContent,
              sender_user_id: null,
              sender_name: 'DM',
              team: 'alpha',
            });

            sendTelegramNotification({
              type: 'custom',
              partyId,
              targetUserIds: splitState.alphaMembers,
              title: `📖 ${splitState.alphaName || 'Team Alpha'} — DM Update`,
              body: alphaContent.substring(0, 300) + (alphaContent.length > 300 ? '…' : ''),
              mode: sessionConfig?.campaignType === 'empyrean' ? 'empyrean' : 'party',
            });
          }
        }

        // --- Team Beta ---
        if (betaPrompts.length > 0) {
          const { guidesSection: betaAfkGuides, promptSection: betaAfkPrompts, consumedCascades: betaConsumed, afkEntries: betaAfkEntries } = suppressAfkGuides
            ? { guidesSection: '', promptSection: '', consumedCascades: [], afkEntries: [] as Array<{ userId: string; characterName: string; content: string }> }
            : buildAfkGuidesContext(betaPrompts, splitState.betaMembers, coveredUserIds);
          allConsumedCascades = [...allConsumedCascades, ...betaConsumed];
          const betaRawCombined = betaPrompts
            .map(formatPromptLineForAI)
            .join('\n') + betaAfkPrompts;

          const betaForAI = betaRawCombined;

          // Insert one row per ready player on Team Beta (privacy: each row carries player's user_id)
          for (const p of betaPrompts) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: formatPromptLine(p),
              sender_user_id: p.user_id,
              sender_name: p.character_name || 'Player',
              team: 'beta',
            });
          }
          // Insert one row per AFK Team Beta member
          for (const entry of betaAfkEntries) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: entry.content,
              sender_user_id: entry.userId,
              sender_name: entry.characterName || 'Player',
              team: 'beta',
              is_afk_marker: true,
            });
          }

          const betaMembersSummary = buildPartyMembersGuide(splitState.betaMembers);
          const betaApiMsgs = betaMessages.map(m => ({ role: m.role, content: m.content }));
          betaApiMsgs.push({ role: 'user', content: betaForAI });

          const betaPartyContext = [
            `## PARTY SPLIT — ${splitState.betaName || 'Team Beta'}\nThe party has split up. You are narrating ONLY for "${splitState.betaName || 'Team Beta'}".\n${betaMembersSummary}\nDo NOT narrate what the other team ("${splitState.alphaName || 'Team Alpha'}") is doing. Focus solely on this group's adventure. Refer to this group as "${splitState.betaName || 'Team Beta'}" in your narration.`,
            freshDragonBondsSection,
            splitState.alphaSummary ? `\n\n## OTHER TEAM CONTEXT (hidden from players)\n"${splitState.alphaName || 'Team Alpha'}"'s adventure summary (for narrative coherence only — do NOT reveal to "${splitState.betaName || 'Team Beta'}"):\n${splitState.alphaSummary}` : '',
            splitState.betaSummary ? `\n\n## PREVIOUS "${splitState.betaName || 'Team Beta'}" SUMMARY\n${splitState.betaSummary}` : '',
            betaAfkGuides,
            splitResponseModePrompt,
          ].filter(Boolean).join('\n\n');

          const betaContent = await streamAIResponse(betaApiMsgs, customGuidesContent || '', abortRef.current!.signal, betaPartyContext, undefined, empyreanPersonaPrompt, currentRoundOocDirectives);

          if (betaContent?.trim()) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'assistant',
              content: betaContent,
              sender_user_id: null,
              sender_name: 'DM',
              team: 'beta',
            });

            sendTelegramNotification({
              type: 'custom',
              partyId,
              targetUserIds: splitState.betaMembers,
              title: `📖 ${splitState.betaName || 'Team Beta'} — DM Update`,
              body: betaContent.substring(0, 300) + (betaContent.length > 300 ? '…' : ''),
              mode: sessionConfig?.campaignType === 'empyrean' ? 'empyrean' : 'party',
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
        const { guidesSection: afkGuidesSection, promptSection: afkPromptSection, consumedCascades: normalConsumed, afkEntries: normalAfkEntries } = suppressAfkGuides
          ? { guidesSection: '', promptSection: '', consumedCascades: [], afkEntries: [] as Array<{ userId: string; characterName: string; content: string }> }
          : buildAfkGuidesContext(readyPrompts, isTurnBased && sessionConfig.turnUserId ? [sessionConfig.turnUserId] : undefined, coveredUserIds);
        const rawCombined = (directPrompt
          ? directPrompt.text.trim()
          : readyPrompts.map(formatPromptLineForAI).join('\n')) + afkPromptSection;


        const combined = rawCombined;

        const isApprovalMode = (sessionConfig.dmMode || 'ai') === 'ai-approval';

        // In approval mode, don't insert user message yet — defer to approveDraft
        let insertedUserMsgId: string | null = null;
        if (!isApprovalMode) {
          // Insert one row per ready player (privacy: each row carries player's own user_id)
          for (const p of readyPrompts) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: formatPromptLine(p),
              sender_user_id: p.user_id,
              sender_name: p.character_name || 'Player',
            });
          }
          // Insert one row per AFK member
          for (const entry of normalAfkEntries) {
            await insertPartyMessage({
              party_id: partyId,
              role: 'user',
              content: entry.content,
              sender_user_id: entry.userId,
              sender_name: entry.characterName || 'Player',
              is_afk_marker: true,
            });
          }
          // Per-player rows mean there's no single bundle id to track for rollback;
          // downstream rollback via insertedUserMsgId is now a no-op.
          insertedUserMsgId = null;
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

        const assistantContent = await streamAIResponse(apiMessages, customGuidesContent || '', abortRef.current!.signal, partyContextStr, undefined, empyreanPersonaPrompt, currentRoundOocDirectives);

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

            sendTelegramNotification({
              type: 'custom',
              partyId,
              title: '📖 The DM Has Spoken',
              body: assistantContent.substring(0, 300) + (assistantContent.length > 300 ? '…' : ''),
              mode: sessionConfig?.campaignType === 'empyrean' ? 'empyrean' : 'party',
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

      // === Deterministic signet burnout (Empyrean only) ===
      // Host-side: for each ready player, +signet_intensity (cap 8) if they channeled.
      // For all other party members with a dragon_bond row, -1 recovery (floor 0).
      // Burnout is fully app-controlled — the AI does not mutate it.
      if (sessionConfig.campaignType === 'empyrean' && isCreator) {
        try {
          const { data: bondRows } = await (supabase.from('party_shared_state') as any)
            .select('id, user_id, state_data')
            .eq('party_id', partyId)
            .eq('state_type', 'dragon_bond');
          if (bondRows && bondRows.length > 0) {
            const intensityByUser = new Map<string, number>();
            for (const p of readyPrompts) {
              const intensity = Math.max(0, Math.min(8, (p as any).signet_intensity || 0));
              if (intensity > 0) intensityByUser.set(p.user_id, intensity);
            }
            for (const row of bondRows as Array<{ id: string; user_id: string; state_data: any }>) {
              const cfg = row.state_data || {};
              const cur = typeof cfg.burnout === 'number' ? cfg.burnout : 0;
              const intensity = intensityByUser.get(row.user_id) || 0;
              const next = intensity > 0
                ? Math.min(8, cur + intensity)
                : Math.max(0, cur - 1);
              if (next !== cur) {
                await (supabase.from('party_shared_state') as any)
                  .update({ state_data: { ...cfg, burnout: next }, updated_at: new Date().toISOString() })
                  .eq('id', row.id);
              }
            }
          }
        } catch (err) {
          console.warn('[PartyDM] Failed to apply deterministic burnout:', err);
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
        let nextTurnUserId = sessionConfig.turnUserId;
        if (isTurnBased) {
          const otherMember = partyMembers.find(m => m.user_id !== sessionConfig.turnUserId);
          nextTurnUserId = otherMember?.user_id ?? sessionConfig.turnUserId;
        }
        const newConfig: DmSessionConfig = {
          ...sessionConfig,
          currentRoundId: newRoundId,
          isGenerating: false,
          // Auto-start timer for new round if enabled
          timerStartedAt: sessionConfig.timerEnabled ? new Date().toISOString() : null,
          timerPausedRemaining: null,
          extensionRequests: [],
          ...(isTurnBased ? { turnUserId: nextTurnUserId } : {}),
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
      // Release the DB-level per-round claim ticket so the next round starts clean.
      try {
        await (supabase.from('party_round_locks') as any)
          .delete()
          .eq('party_id', partyId)
          .eq('round_id', lockRoundId)
          .eq('holder_user_id', user.id);
      } catch (e) {
        console.warn('[PartyDM] Failed to release round lock:', e);
      }
      setIsGenerating(false);
      abortRef.current = null;
    }

  }, [partyId, user, sessionConfig, isGenerating, currentPrompts, messages, characterContext, partyMembers, customGuidesContent, triggerSummaryIfNeeded, silentAutoSave, isSplitActive, splitState, streamAIResponse, buildPartyMembersGuide, generateSplitSummary, buildAfkGuidesContext, consumeCascadePrompts, insertPartyMessageHelper, empyreanPersonaPrompt, buildDragonBondsSection]);



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
        ? `## NPC VOICING MODE — DIALOGUE ONLY\nYou ARE ${names[0]}. Respond with ONLY:\n1. One brief italicized body-language beat (gesture, expression, or micro-reaction — 10 words max, present tense).\n2. One line of spoken dialogue, prefixed with **${names[0]}:**\n\nRules:\n- NO prose, NO narration, NO scene-setting, NO describing what the player does.\n- NO mechanical info (dice, DCs, stats).\n- Keep the total response under 40 words.\n- Stay consistent with how this NPC has been portrayed so far.\n- This is a CONVERSATION, not a story. Write like a person talking, not a narrator describing.`
        : `## NPC VOICING MODE — DIALOGUE ONLY\nWrite a SHORT exchange between ${names.join(' and ')} responding to the player. Rules:\n\n1. Each NPC gets ONE line of dialogue prefixed with **NPC Name:** and ONE brief italicized body-language beat (10 words max).\n2. NPCs react to each other — not just the player.\n3. End on a beat that invites the player back in (a question, a look, a pause).\n4. NO prose, NO narration, NO scene-setting, NO describing player actions.\n5. NO mechanical info (dice, DCs, stats).\n6. Keep the TOTAL response under 80 words. This is a conversation, not a story.\n7. Stay consistent with how each NPC has been portrayed so far.`;

      const authToken = await getAuthToken();
      const sanitizedMessages = apiMessages.map(m => ({ role: m.role, content: m.content }));
      const npcSystemPrompt = [
        buildCanonGuardrailContext(sanitizedMessages, customGuidesContent || ''),
        customGuidesContent?.trim()
          ? `## CAMPAIGN WORLD BIBLE (ABSOLUTE AUTHORITY)\nUse this as canon for NPC identity, relationships, lore, tone, and what is true. Never contradict it.\n\n${customGuidesContent.slice(0, 60000)}`
          : '',
        memoryAnchorsContent?.trim()
          ? `## MEMORY ANCHORS (ESTABLISHED CONTINUITY FACTS)\nUse these as established facts for this NPC response.\n\n${memoryAnchorsContent.slice(0, 8000)}`
          : '',
        npcContext,
      ].filter(Boolean).join('\n\n');

      const npcResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: sanitizedMessages.slice(-50),
          characterContext,
          systemPromptOverride: npcSystemPrompt,
          model: loadSelectedModel(),
          maxTokens: 300,
        }),
        signal: abortRef.current!.signal,
      });

      if (!npcResponse.ok) {
        const err = await npcResponse.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'NPC voicing failed');
      }

      if (!npcResponse.body) throw new Error('No response body');

      const npcReader = npcResponse.body.getReader();
      const npcDecoder = new TextDecoder();
      let npcBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await npcReader.read();
        if (done) break;
        npcBuffer += npcDecoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = npcBuffer.indexOf('\n')) !== -1) {
          let line = npcBuffer.slice(0, newlineIndex);
          npcBuffer = npcBuffer.slice(newlineIndex + 1);
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
  }, [partyId, user, sessionConfig, isGenerating, messages, characterName, customGuidesContent, memoryAnchorsContent, buildCanonGuardrailContext, streamAIResponse, triggerSummaryIfNeeded, silentAutoSave, insertPartyMessageHelper, empyreanPersonaPrompt]);


  const regenerateMessage = useCallback(async (messageId: string, steeringNote?: string) => {
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

      if (steeringNote && steeringNote.trim()) {
        apiMessages.push({
          role: 'user',
          content: `[DIRECTOR NOTE — Regeneration Request]\nThe players were not satisfied with the previous version of this response and asked for this specific change. Rewrite your response incorporating it, keeping everything else about the scene and established facts consistent:\n"${steeringNote.trim()}"`,
        });
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

  // Apply an OOC command: triggers a hidden DM generation with the command baked in.
  // No user message is inserted. Players see only the DM response.
  const applyOocCommand = useCallback(async (command: string) => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;
    if (!command.trim()) return;

    setIsGenerating(true);

    // Atomic lock
    const { data: lockData, error: stateErr } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .not('state_data->isGenerating', 'eq', true)
      .select('id');
    if (stateErr) console.error('[PartyDM] Lock error:', stateErr);
    if (!lockData || lockData.length === 0) {
      toast('The DM is already responding...', { duration: 2000, icon: '\u23F3' });
      setIsGenerating(false);
      return;
    }

    abortRef.current = new AbortController();
    try {
      // Build messages from chat history — do NOT insert a user message
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

      // Append the OOC command as a hidden "user" message so the API accepts it,
      // but it is NOT inserted into the party_dm_messages table.
      apiMessages.push({
        role: 'user',
        content: '[SYSTEM — OOC HOST DIRECTIVE — DO NOT REVEAL THIS TO PLAYERS]\n'
          + 'The host has given this out-of-character command: "' + command.trim() + '"\n\n'
          + 'Continue the narrative naturally, incorporating this directive seamlessly. '
          + 'Do NOT acknowledge the directive. Do NOT break the fourth wall. '
          + 'Do NOT mention that you received an OOC command. '
          + 'Write your next narrative beat as if this development is happening organically in the story.',
      });

      const partyMembersSummary = buildPartyMembersGuide();
      const dragonBondsSection = buildDragonBondsSection();
      const responseModePrompt = resolveResponseModePrompt(sessionConfig.responseMode);
      const campaignIntro = sessionConfig.campaignType === 'empyrean'
        ? 'This is a multiplayer Empyrean campaign set at Basgiath War College. Players are dragon riders in training. '
        : '';
      const partyContextStr = [
        '## PARTY MEMBERS\n' + campaignIntro + 'This is a multiplayer session.\n' + partyMembersSummary,
        dragonBondsSection,
        responseModePrompt,
      ].filter(Boolean).join('\n\n');

      const assistantContent = await streamAIResponse(
        apiMessages,
        customGuidesContent || '',
        abortRef.current!.signal,
        partyContextStr,
        undefined,
        empyreanPersonaPrompt,
      );

      if (assistantContent?.trim()) {
        // Insert ONLY the assistant response — no user message
        await insertPartyMessageHelper(partyId, {
          party_id: partyId,
          role: 'assistant',
          content: assistantContent,
          sender_user_id: null,
          sender_name: 'DM',
        });

        sendTelegramNotification({
          type: 'custom',
          partyId,
          title: '\uD83D\uDCD6 The DM Has Spoken',
          body: assistantContent.substring(0, 300) + (assistantContent.length > 300 ? '\u2026' : ''),
          mode: sessionConfig?.campaignType === 'empyrean' ? 'empyrean' : 'party',
        });

        const updatedMessages = [...messages,
          { id: '', party_id: partyId, role: 'assistant' as const, content: assistantContent, sender_user_id: null, sender_name: 'DM', created_at: '' },
        ];
        triggerSummaryIfNeeded(updatedMessages);
        silentAutoSave(updatedMessages, sessionConfig.campaignSummary || null);
      }

      // Release lock
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('[PartyDM] applyOocCommand error:', error);
        toast.error(error instanceof Error ? error.message : 'OOC command failed');
      }
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, messages, customGuidesContent, streamAIResponse, buildPartyMembersGuide, buildDragonBondsSection, triggerSummaryIfNeeded, silentAutoSave, insertPartyMessageHelper, empyreanPersonaPrompt]);

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

  // Host-only: reclaim the current turn in Couples/turn-based mode so the host can go again.
  const reclaimTurn = useCallback(async () => {
    if (!partyId || !user || !isCreator) return;
    const base = await resolveSessionConfig();
    if (!base) { toast.error('No active session'); return; }
    if ((base.dmMode || 'ai') !== 'turnBased') {
      toast.error('Reclaim turn only works in Couples Mode');
      return;
    }
    // Clear any lingering ready prompts for the current round so a stale ready
    // doesn't immediately auto-generate.
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('round_id', base.currentRoundId);
    setCurrentPrompts([]);
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...base, turnUserId: user.id, isGenerating: false } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    setSessionConfig({ ...base, turnUserId: user.id, isGenerating: false });
    toast.success("Turn reclaimed — it's your turn again.");
  }, [partyId, user, isCreator, resolveSessionConfig]);

  // Host-only: undo the most recent round. Deletes the last assistant message
  // and the immediately-preceding user prompt message, clears any pending
  // prompts, starts a fresh round, and (in turn-based mode) sets the turn back
  // to whoever went last so the host can effectively "redo" the round.
  const redoLastRound = useCallback(async () => {
    if (!partyId || !user || !isCreator) return;
    const base = await resolveSessionConfig();
    if (!base) { toast.error('No active session'); return; }

    // Find most recent assistant message and immediately-preceding user message
    const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant');
    const assistantIdx = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
    const assistantMsg = assistantIdx >= 0 ? messages[assistantIdx] : null;
    const precedingUserMsg = assistantIdx > 0
      ? [...messages.slice(0, assistantIdx)].reverse().find(m => m.role === 'user')
      : (messages.length > 0 && messages[messages.length - 1].role === 'user' ? messages[messages.length - 1] : null);

    const idsToDelete: string[] = [];
    if (assistantMsg?.id) idsToDelete.push(assistantMsg.id);
    if (precedingUserMsg?.id) idsToDelete.push(precedingUserMsg.id);

    if (idsToDelete.length > 0) {
      await (supabase.from('party_dm_messages') as any)
        .delete()
        .eq('party_id', partyId)
        .in('id', idsToDelete);
      setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    }

    // Clear any prompts (any round — the round is being redone)
    await (supabase.from('party_dm_prompts') as any)
      .delete()
      .eq('party_id', partyId);
    setCurrentPrompts([]);

    // Start a fresh round. In turn-based mode, hand the turn back to whoever
    // went last (the user_id on the preceding user prompt message).
    const newRoundId = crypto.randomUUID();
    const isTurnBased = (base.dmMode || 'ai') === 'turnBased';
    const lastActorUserId = precedingUserMsg?.sender_user_id || user.id;
    const newConfig: DmSessionConfig = {
      ...base,
      currentRoundId: newRoundId,
      isGenerating: false,
      timerStartedAt: base.timerEnabled ? new Date().toISOString() : null,
      timerPausedRemaining: null,
      extensionRequests: [],
      ...(isTurnBased ? { turnUserId: lastActorUserId } : {}),
    };
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: newConfig })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session');
    setSessionConfig(newConfig);
    // Reset the auto-generate guard so a fresh ready in this new round can fire.
    lastGeneratedRoundRef.current = null;
    toast.success('Last round undone — go again.');
  }, [partyId, user, isCreator, resolveSessionConfig, messages]);


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


  // === NPC Conversational Scene ===

  /** Pick the next NPC to speak using weighted random selection. */
  function pickNextNpc(
    npcs: string[],
    lastSpeaker: string | null,
    lastMessage: string,
    turnsSinceSpeaking: Map<string, number>,
  ): string {
    const weights = new Map<string, number>();
    for (const npc of npcs) {
      let w = 1;
      if (npc === lastSpeaker) {
        weights.set(npc, 0);
        continue;
      }
      const nameParts = npc.split(/\s+/);
      const firstName = nameParts[0];
      const msgLower = lastMessage.toLowerCase();
      if (msgLower.includes(npc.toLowerCase())) {
        w += 4;
      } else if (firstName.length >= 3 && msgLower.includes(firstName.toLowerCase())) {
        w += 3;
      }
      const silence = turnsSinceSpeaking.get(npc) || 0;
      if (silence >= 3) {
        w += 2;
      } else if (silence >= 2) {
        w += 1;
      }
      weights.set(npc, w);
    }
    const entries = Array.from(weights.entries()).filter(([, w]) => w > 0);
    if (entries.length === 0) {
      const candidates = npcs.filter(n => n !== lastSpeaker);
      return candidates[Math.floor(Math.random() * candidates.length)] || npcs[0];
    }
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;
    for (const [npc, w] of entries) {
      roll -= w;
      if (roll <= 0) return npc;
    }
    return entries[entries.length - 1][0];
  }

  const npcSceneActiveRef = useRef(false);
  const npcSceneInterjectionRef = useRef<{ content: string; senderName: string } | null>(null);

  const startNpcScene = useCallback(async (npcs: string[], scenePrompt: string, maxMessages: number = 12) => {
    if (!partyId || !user || !sessionConfig || isGenerating) return;
    if (npcs.length < 2 || npcs.length > 6) {
      toast.error('NPC scene requires 2-6 NPCs');
      return;
    }

    setIsGenerating(true);
    npcSceneActiveRef.current = true;

    updateSessionConfig({
      npcSceneActive: true,
      npcSceneNpcs: npcs,
      npcScenePrompt: scenePrompt,
      npcSceneMaxMessages: maxMessages,
      npcSceneMessageCount: 0,
    });

    const { data: lockData, error: stateErr } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...sessionConfig, isGenerating: true, npcSceneActive: true, npcSceneNpcs: npcs, npcScenePrompt: scenePrompt, npcSceneMaxMessages: maxMessages, npcSceneMessageCount: 0 } })
      .eq('party_id', partyId)
      .eq('state_type', 'dm_session')
      .not('state_data->isGenerating', 'eq', true)
      .select('id');
    if (stateErr) console.error('[PartyDM] Failed to set isGenerating state:', stateErr);

    if (!lockData || lockData.length === 0) {
      console.log('[PartyDM] Generation already in progress on another client, skipping');
      toast('The DM is already responding...', { duration: 2000, icon: '⏳' });
      npcSceneActiveRef.current = false;
      setIsGenerating(false);
      updateSessionConfig({ npcSceneActive: false });
      return;
    }

    abortRef.current = new AbortController();
    try {
      await insertPartyMessageHelper(partyId, {
        party_id: partyId,
        role: 'assistant',
        content: `*${scenePrompt}*`,
        sender_user_id: null,
        sender_name: 'DM',
      });

      const contextMessages = [...messages].map(m => ({ role: m.role, content: m.content }));
      const sceneMessages: Array<{ role: string; content: string }> = [];
      let messageCount = 0;
      let lastSpeaker: string | null = null;
      let lastNpcMessage = '';
      const turnsSinceSpeaking = new Map<string, number>();
      for (const npc of npcs) turnsSinceSpeaking.set(npc, 0);

      for (let turn = 0; turn < maxMessages; turn++) {
        if (!npcSceneActiveRef.current) break;
        if (abortRef.current?.signal.aborted) break;

        // Weighted NPC selection based on conversation context
        const currentNpc = turn === 0
          ? npcs[Math.floor(Math.random() * npcs.length)]  // random first speaker
          : pickNextNpc(npcs, lastSpeaker, lastNpcMessage, turnsSinceSpeaking);
        const otherNpcs = npcs.filter(n => n !== currentNpc);

        if (turn > 0) {
          // Variable pacing: faster for reactive lines, slower for thoughtful ones
          const prevMsg = lastNpcMessage.toLowerCase();
          const isReactive = /[?!]/.test(prevMsg) || /\b(why|how dare|what did|you (liar|fool|coward)|shut up|enough|stop|never|accus|betray|explain|answer me)\b/i.test(prevMsg);
          const hasInterjection = !!npcSceneInterjectionRef.current;
          let delay: number;
          if (hasInterjection) {
            delay = 600 + Math.random() * 400; // 0.6-1.0s — quick reaction to player
          } else if (isReactive) {
            delay = 800 + Math.random() * 700; // 0.8-1.5s — snappy retort
          } else {
            delay = 1400 + Math.random() * 1100; // 1.4-2.5s — measured response
          }
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, delay);
            const onAbort = () => { clearTimeout(timeout); reject(new DOMException('Aborted', 'AbortError')); };
            abortRef.current?.signal.addEventListener('abort', onAbort, { once: true });
          });
        }

        if (!npcSceneActiveRef.current) break;
        if (abortRef.current?.signal.aborted) break;

        // Check for player interjection
        const interjection = npcSceneInterjectionRef.current;
        if (interjection) {
          npcSceneInterjectionRef.current = null;
          // Add the player's message to the scene context so the next NPC reacts to it
          sceneMessages.push({ role: 'user', content: interjection.content });
          lastNpcMessage = interjection.content; // player's words influence who speaks next
        }

        // ~15% chance this NPC is interrupting (not on the first line)
        const isInterrupting = turn > 0 && Math.random() < 0.15;

        const npcSystemPrompt = `## NPC SCENE — SINGLE LINE ONLY
You ARE ${currentNpc}. This is a multi-NPC conversation scene.
Scene context: "${scenePrompt}"
Other NPCs present: ${otherNpcs.join(', ')}

Write ONLY ${currentNpc}'s next line:
1. One brief italicized body-language beat (10 words max).
2. One line of spoken dialogue, prefixed with **${currentNpc}:**

Rules:
- This is line ${turn + 1} of an ongoing scene between ${npcs.join(', ')}.
- React to what the other NPCs have said so far.${interjection ? `\n- A player (${interjection.senderName}) just spoke. React to them naturally based on your relationship to them in this scene — they may be a known ally, a stranger, an authority figure, or anything else the scene context implies. Do not assume they are an outsider unless the scene context says so.` : ''}${isInterrupting ? `\n- You are INTERRUPTING. Start your dialogue with a dash or ellipsis, as if cutting someone off mid-sentence. Be abrupt and urgent. Your body-language beat should be sudden (leaning forward, standing up, slamming something, pointing). Keep it under 25 words total.` : ''}
- NO prose, NO narration, NO scene-setting.
- NO mechanical info (dice, DCs, stats).${isInterrupting ? '' : '\n- Keep the total under 40 words.'}
- Stay in character as ${currentNpc} has been portrayed.`;

        const apiMessages = [...contextMessages.slice(-40), ...sceneMessages].map(m => ({ role: m.role, content: m.content }));

        const authToken = await getAuthToken();
        const npcResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: apiMessages.slice(-50),
            characterContext,
            systemPromptOverride: npcSystemPrompt,
            model: loadSelectedModel(),
            maxTokens: 200,
          }),
          signal: abortRef.current!.signal,
        });

        if (!npcResponse.ok) {
          const err = await npcResponse.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'NPC scene generation failed');
        }

        if (!npcResponse.body) throw new Error('No response body');

        const npcReader = npcResponse.body.getReader();
        const npcDecoder = new TextDecoder();
        let npcBuffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await npcReader.read();
          if (done) break;
          npcBuffer += npcDecoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = npcBuffer.indexOf('\n')) !== -1) {
            let line = npcBuffer.slice(0, newlineIndex);
            npcBuffer = npcBuffer.slice(newlineIndex + 1);
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

        if (!npcSceneActiveRef.current) break;
        if (abortRef.current?.signal.aborted) break;

        if (assistantContent?.trim()) {
          await insertPartyMessageHelper(partyId, {
            party_id: partyId,
            role: 'assistant',
            content: assistantContent.trim(),
            sender_user_id: null,
            sender_name: currentNpc,
          });
          sceneMessages.push({ role: 'assistant', content: `[${currentNpc}]: ${assistantContent.trim()}` });
          messageCount++;
          await updateSessionConfig({ npcSceneMessageCount: messageCount });
        }

        // Update turn tracking for weighted selection
        lastSpeaker = currentNpc;
        lastNpcMessage = assistantContent?.trim() || '';
        for (const npc of npcs) {
          if (npc === currentNpc) {
            turnsSinceSpeaking.set(npc, 0);
          } else {
            turnsSinceSpeaking.set(npc, (turnsSinceSpeaking.get(npc) || 0) + 1);
          }
        }
      }

      triggerSummaryIfNeeded([...messages]);
      silentAutoSave([...messages], sessionConfig.campaignSummary || null);

    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (!isAbort) {
        console.error('Party DM NPC scene error:', error);
        toast.error(error instanceof Error ? error.message : 'NPC scene failed');
      }
    } finally {
      npcSceneActiveRef.current = false;
      await (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false, npcSceneActive: false, npcSceneMessageCount: 0 } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session');
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [partyId, user, sessionConfig, isGenerating, messages, characterContext, updateSessionConfig, insertPartyMessageHelper, triggerSummaryIfNeeded, silentAutoSave]);

  const stopNpcScene = useCallback(() => {
    npcSceneActiveRef.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
    if (partyId && sessionConfig) {
      (supabase.from('party_shared_state') as any)
        .update({ state_data: { ...sessionConfig, isGenerating: false, npcSceneActive: false } })
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session')
        .then(() => {});
    }
  }, [partyId, sessionConfig]);

  const submitNpcInterjection = useCallback(async (content: string) => {
    if (!partyId || !user || !content.trim()) return;
    if (!npcSceneActiveRef.current) return;

    const formattedContent = `[${characterName}]: ${content.trim()}`;

    // Insert the player message into chat immediately
    await insertPartyMessageHelper(partyId, {
      party_id: partyId,
      role: 'user',
      content: formattedContent,
      sender_user_id: user.id,
      sender_name: characterName,
    });

    // Signal the scene loop that a player interjected
    npcSceneInterjectionRef.current = {
      content: formattedContent,
      senderName: characterName,
    };
  }, [partyId, user, characterName, insertPartyMessageHelper]);

  // === DIALOGUE MODE: Generate a recap of recent dialogue ===
  const generateDialogueRecap = useCallback(async (): Promise<string | null> => {
    if (!partyId || !user || !sessionConfig) return null;

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
    // "Save credits" toggle — skip dialogue-mode narrative bridge.
    if (isFeatureSkipped('summaries')) return null;

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

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      lastAutoInterveneMsgCountRef.current = 0;
    }
  }, [messages]);

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

    sendTelegramNotification({
      type: 'custom',
      partyId,
      title: '📖 The DM Has Spoken',
      body: trimmed.substring(0, 300) + (trimmed.length > 300 ? '…' : ''),
      mode: sessionConfig?.campaignType === 'empyrean' ? 'empyrean' : 'party',
    });

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
    isTurnBasedMode,
    turnReady,
    currentTurnUserId: sessionConfig?.turnUserId ?? null,
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
    startNpcScene,
    stopNpcScene,
    submitNpcInterjection,
    generateDialogueRecap,
    regenerateMessage,
    regenerateWhispers,
    addMediaMessage,
    stopGeneration,
    applyOocCommand,
    initiateSplit,
    regroupParty,
    updateSessionConfig,
    reclaimTurn,
    redoLastRound,
    // Timer
    setTimerConfig,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    requestExtension,
    approveExtension,
    dismissExtensions,
    activeMoodPresetId,
    setActiveMoodPreset,
  }), [
    filteredMessages, messages, currentPrompts, sessionConfig, isActive,
    computedIsGenerating, isSummarizing, isFullSummarizing, fullSummarize, allReady, isTurnBasedMode, turnReady, myPrompt, activeCampaignId,
    lastAutoSaveTime, splitState, isSplitActive, myTeam, pendingDraft,
    startSession, endSession, startNewCampaign, saveCampaign, loadCampaign,
    submitPrompt, editPrompt, retractPrompt, setReady, unready,
    generateResponse, sendManualDmMessage, approveDraft, discardDraft,
    editMessage, deleteMessage, sendDialogueMessage, sendWhisper, callDM, voiceNPC, startNpcScene, stopNpcScene, submitNpcInterjection, generateDialogueRecap, regenerateMessage, regenerateWhispers,
    addMediaMessage, stopGeneration, applyOocCommand, initiateSplit, regroupParty,
    updateSessionConfig, reclaimTurn, redoLastRound, setTimerConfig, startTimer, pauseTimer, resumeTimer,
    cancelTimer, requestExtension, approveExtension, dismissExtensions,
    activeMoodPresetId, setActiveMoodPreset,
  ]);
}
