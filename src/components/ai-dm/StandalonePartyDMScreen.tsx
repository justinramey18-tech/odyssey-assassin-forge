import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { usePartyMemoryAnchors } from '@/hooks/use-party-memory-anchors';
import { usePartyMemoryExtraction } from '@/hooks/use-party-memory-extraction';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useWeather } from '@/hooks/use-weather';
import { getCachedWeather, buildWeatherPrompt, loadWeatherEnabled } from '@/lib/weather';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { usePartyQuests } from '@/hooks/use-party-quests';
import { useQuestRewardSplit } from '@/hooks/use-quest-reward-split';
import { questRewardShare, applyShare } from '@/lib/questRewardSplit';
import { findCanonViolations, buildCanonCorrectionPrompt, buildCanonLockBlock, violationSummary } from '@/lib/worldStateGuard';
import { Quest, RawQuestOffer, questFromOffer, questTitle, applyQuestProgress, withQuestEvent, rewardSummary, worldEntryFromQuest, worldStateContextLines } from '@/lib/quests';
import { useCampaignSessions } from '@/hooks/use-campaign-sessions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PartyDMScreen } from './PartyDMScreen';
import { GMGuidesManager } from './GMGuidesManager';
import { CharacterGuideBuilder } from './CharacterGuideBuilder';

import { PlayerRedoRequestDialog } from './PlayerRedoRequestDialog';
import { HostOnboardingRequestsPanel } from './HostOnboardingRequestsPanel';
import { usePartyOnboardingRequests } from '@/hooks/use-party-onboarding-requests';
import { PartyDirectorScreen } from './PartyDirectorScreen';
import { HostDirectorEscalationsPanel } from './HostDirectorEscalationsPanel';
import { usePartyDirectorEscalations } from '@/hooks/use-party-director-escalations';
import { MessageCircle, AlertTriangle } from 'lucide-react';

import { PartyCampaignSaves } from './PartyCampaignSaves';
import CampaignBuilderChat from './CampaignBuilderChat';
import { AnimatePresence } from 'framer-motion';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import type { CharacterContext } from '@/components/oracle/types';
import { useOocDmChat } from '@/hooks/use-ooc-dm-chat';
import { OocDmChat } from './OocDmChat';
import { EMPYREAN_LORE_GUIDES } from '@/lib/empyreanGMGuides';
import { detectCampaignType } from '@/lib/campaignTypeDetect';
import { getBondDescriptor, getTrustDescriptor, savePartyHP } from '@/lib/dragonBondState';
import { usePartyDragonBonds } from '@/hooks/use-party-dragon-bonds';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { SwipeHandlers } from '@/components/empyrean/EmpyreanDMContainer';

import type { UseWildShapeReturn } from '@/hooks/use-wild-shape';
import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { getScopedItem } from '@/lib/scoped-storage';
import { addPendingDmItems } from '@/lib/pendingDmItems';
import { buildQuestScanText } from '@/lib/questScanSource';

// Stable no-op fallbacks (module-level for referential stability)
const NOOP = () => {};
const NOOP_TWO_ARG = () => {};
const NOOP_RETURN_ZERO = () => 0;

interface StandalonePartyDMScreenProps {
  onBack: () => void;
  characterContext: CharacterContext;
  partyId: string | null;
  isPartyCreator: boolean;
  partyMembers: PartyMember[];
  userId: string;
  characterName: string;
  onShowChat?: () => void;
  autoSyncCallbacks?: {
    onHPChange: (change: number, type: 'damage' | 'healing') => void;
    onHPSet?: (hp: number) => void;
    onUseConsumableByName?: (name: string, quantity?: number) => boolean;
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
  /** Lifetime XP total, for the party character sheet */
  currentXP?: number;
  /** Manual level advance used by the character sheet */
  onManualLevelUp?: () => void;
  /** Accept an item awarded by the AI DM into the loot inventory */
  onAcceptItem?: (name: string, quantity: number, details?: { goldValue?: number; description?: string; rarity?: string; category?: string; effect?: string; dice?: string }) => void;
  /** Open the per-campaign character picker for party mode */
  onOpenCharacterPicker?: () => void;
  wildShape?: UseWildShapeReturn;
  isMomoMoonDruid?: boolean;
  isSoloEmpyrean?: boolean;
  embedded?: boolean;
  swipeHandlers?: SwipeHandlers;
  autoOpenCampaignBuilder?: boolean;
}

export function StandalonePartyDMScreen({
  onBack,
  characterContext,
  partyId,
  isPartyCreator,
  partyMembers,
  userId,
  characterName,
  onShowChat,
  autoSyncCallbacks,
  currentXP,
  onManualLevelUp,
  onAcceptItem,
  onOpenCharacterPicker,
  wildShape,
  isMomoMoonDruid,
  isSoloEmpyrean,
  embedded = false,
  swipeHandlers,
  autoOpenCampaignBuilder,
}: StandalonePartyDMScreenProps) {
  const [showGuides, setShowGuides] = useState(false);
  const [showCharacterGuideBuilder, setShowCharacterGuideBuilder] = useState(false);

  // Save party HP snapshot for homescreen dual bars
  useEffect(() => {
    const save = () => {
      const current = autoSyncCallbacks?.getCurrentHP() ?? characterContext?.currentHP ?? 0;
      const max = characterContext?.maxHP ?? 0;
      if (max > 0) savePartyHP({ current, max });
    };
    save();
    const interval = setInterval(save, 3000);
    return () => { clearInterval(interval); save(); };
  }, [autoSyncCallbacks, characterContext?.currentHP, characterContext?.maxHP]);
  const [showSaves, setShowSaves] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showDirectorScreen, setShowDirectorScreen] = useState(false);
  const [showOocChat, setShowOocChat] = useState(false);
  const [partyCreatorId, setPartyCreatorId] = useState<string | null>(null);
  const [coHostIds, setCoHostIds] = useState<string[]>([]);




  const [partyCampaignType, setPartyCampaignType] = useState<'dnd' | 'empyrean'>('dnd');
  const [memberDisplayNames, setMemberDisplayNames] = useState<Record<string, string>>({});
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [showDirectorEscalationsPanel, setShowDirectorEscalationsPanel] = useState(false);
  const onboardingRequests = usePartyOnboardingRequests({ partyId });
  const directorEscalations = usePartyDirectorEscalations({ partyId });

  // Auto-open campaign builder when triggered from home screen
  useEffect(() => {
    if (autoOpenCampaignBuilder && isPartyCreator) {
      setShowCampaignBuilder(true);
    }
  }, [autoOpenCampaignBuilder, isPartyCreator]);




  // Fetch + subscribe to parties.campaign_started and parties.campaign_type
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    supabase
      .from('parties')
      .select('campaign_started, campaign_type')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        // campaign_started gate removed
        const ct = (data as any).campaign_type;
        if (ct === 'empyrean' || ct === 'dnd') setPartyCampaignType(ct);
      });
    const channel = supabase
      .channel(`party-campaign-started-${partyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` },
        (payload) => {
          const row = payload.new as { campaign_started?: boolean; campaign_type?: string } | null;
          // campaign_started gate removed
          if (row?.campaign_type === 'empyrean' || row?.campaign_type === 'dnd') {
            setPartyCampaignType(row.campaign_type);
          }
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  // Fetch display names for party members (for the host's start panel)
  useEffect(() => {
    if (!isPartyCreator || partyMembers.length === 0) return;
    const ids = partyMembers.map((m) => m.user_id);
    supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data as Array<{ user_id: string; display_name: string | null }>) {
          if (row.display_name) map[row.user_id] = row.display_name;
        }
        setMemberDisplayNames(map);
      });
  }, [isPartyCreator, partyMembers]);

  // Fetch party creator ID (for non-creators)
  useEffect(() => {
    if (!partyId || isPartyCreator) return;
    supabase
      .from('parties')
      .select('created_by')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.created_by) setPartyCreatorId(data.created_by);
      });
  }, [partyId, isPartyCreator]);

  // Fetch co-host state on mount
  useEffect(() => {
    if (!partyId) return;
    (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'co_hosts')
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.state_data?.userIds) {
          setCoHostIds(data.state_data.userIds);
        }
      });
  }, [partyId]);

  // Realtime subscription for co-host changes
  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`co-hosts-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type === 'co_hosts') {
          setCoHostIds(row.state_data?.userIds ?? []);
        }
        if (payload.eventType === 'DELETE') {
          const old = payload.old as any;
          if (old?.state_type === 'co_hosts') setCoHostIds([]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  // Compute host status
  const isCoHost = coHostIds.includes(userId);
  const isHost = isPartyCreator || isCoHost;

  // Promote/demote callbacks
  const promoteCoHost = useCallback(async (targetUserId: string) => {
    if (!partyId || !userId || !isPartyCreator) return;
    const next = [...new Set([...coHostIds, targetUserId])];
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: userId,
      state_type: 'co_hosts',
      state_data: { userIds: next },
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, isPartyCreator, coHostIds]);

  const demoteCoHost = useCallback(async (targetUserId: string) => {
    if (!partyId || !userId || !isPartyCreator) return;
    const next = coHostIds.filter(id => id !== targetUserId);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: userId,
      state_type: 'co_hosts',
      state_data: { userIds: next },
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId, isPartyCreator, coHostIds]);

  const sessionMode = isSoloEmpyrean ? 'solo-empyrean' as const : 'party' as const;
  const campaignSessions = useCampaignSessions(sessionMode);

  // GM Guides — co-hosts load the host's guides via ownerUserId
  const gmGuidesOwner = isCoHost && partyCreatorId ? partyCreatorId : undefined;
  const gmGuides = useGMGuides(gmGuidesOwner, sessionMode);

  const oocDmChat = useOocDmChat({
    characterContext,
    campaignSummary: null,
    customGuidesContent: gmGuides.enabledContent,
    // Source of truth: solo flag for solo entry; the parties row otherwise.
    // (Previously hard-coded 'dnd' for multiplayer, silently disabling
    // Empyrean persona/pills/burnout for Fourth Wing parties.)
    campaignType: isSoloEmpyrean ? 'empyrean' : partyCampaignType,
    selectedModel: undefined,
    preserveFullCommand: true,
  });

  // Memory Anchors — long-term campaign facts shared across party
  const memoryAnchors = usePartyMemoryAnchors({ partyId: partyId || null });

  const stablePartyMembers = useMemo(() =>
    partyMembers.map(m => ({
      character_name: m.character_name,
      character_status: m.character_status as Record<string, unknown>,
      user_id: m.user_id,
    })),
    [partyMembers]
  );

  // Pre-built character summary for the player onboarding AI. If the player
  // already built a character via the AI Creation Assistant (or any wizard),
  // hand that to the onboarding assistant so it confirms and fits-to-world
  // instead of asking the player to start from scratch.
  const { driftZone, historyCount: alignmentHistoryCount } = useAlignmentDrift();

  const playerExistingCharacter = useMemo(() => {
    const myMember = partyMembers.find(m => m.user_id === userId);
    const myStatus = (myMember?.character_status as Record<string, any>) || {};

    // Narrative fields written by AI Creation Assistant live in scoped localStorage,
    // not on the characterContext object. Read them directly.
    const storedBackstory = getScopedItem('dnd-character-backstory') || '';
    const storedGender = getScopedItem('dnd-character-gender') || '';
    const storedRace = getScopedItem('dnd-character-race') || '';
    const storedRelationshipsRaw = getScopedItem('dnd-character-relationships') || '';

    const lines: string[] = [];

    const name = characterContext?.name || characterName || myMember?.character_name || '';
    if (name) lines.push(`Name: ${name}`);
    if (characterContext?.level) lines.push(`Level: ${characterContext.level}`);
    const classBits: string[] = [];
    if (characterContext?.multiclassBreakdown && Object.keys(characterContext.multiclassBreakdown).length) {
      classBits.push(Object.entries(characterContext.multiclassBreakdown).map(([c, l]) => `${c} ${l}`).join(' / '));
    } else if (characterContext?.characterClass) {
      classBits.push(characterContext.characterClass);
    }
    if (characterContext?.subclass) classBits.push(`(${characterContext.subclass})`);
    if (classBits.length) lines.push(`Class: ${classBits.join(' ')}`);

    const gender = storedGender || characterContext?.gender || '';
    const race = storedRace || characterContext?.race || '';
    if (gender || race) lines.push(`Identity: ${[gender, race].filter(Boolean).join(' ')}`);

    if (characterContext?.deity) lines.push(`Deity: ${characterContext.deity}`);
    if (characterContext?.domain) lines.push(`Domain: ${characterContext.domain}`);

    if (driftZone && alignmentHistoryCount > 0) {
      lines.push(`Alignment: ${driftZone}`);
    }

    const backstory = (storedBackstory || characterContext?.backstory || '').trim();
    if (backstory) lines.push(`Backstory: ${backstory.slice(0, 1200)}`);

    let relationshipsText = '';
    if (storedRelationshipsRaw) {
      try {
        const parsed = JSON.parse(storedRelationshipsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          relationshipsText = parsed
            .slice(0, 5)
            .map((r: any) => {
              if (typeof r === 'string') return r;
              const n = r?.name || '';
              const d = r?.disposition ? ` (${r.disposition})` : '';
              const note = r?.notes ? ` — ${r.notes}` : '';
              return `${n}${d}${note}`.trim();
            })
            .filter(Boolean)
            .join('; ');
        } else if (typeof parsed === 'string' && parsed.trim()) {
          relationshipsText = parsed.trim();
        }
      } catch {
        relationshipsText = storedRelationshipsRaw.trim();
      }
    }
    if (!relationshipsText && characterContext?.relationships && characterContext.relationships.length) {
      relationshipsText = characterContext.relationships
        .slice(0, 5)
        .map(r => `${r.name}${r.disposition ? ` (${r.disposition})` : ''}${r.notes ? ` — ${r.notes}` : ''}`)
        .join('; ');
    }
    if (relationshipsText) lines.push(`Relationships: ${relationshipsText.slice(0, 600)}`);

    if (myStatus.personality) lines.push(`Personality: ${myStatus.personality}`);

    if (myStatus.dragon_name) lines.push(`Dragon: ${myStatus.dragon_name}${myStatus.dragon_color ? ` (${myStatus.dragon_color})` : ''}`);
    if (myStatus.signet_type) lines.push(`Signet: ${myStatus.signet_type}`);
    if (myStatus.year_at_basgiath) lines.push(`Year at Basgiath: ${myStatus.year_at_basgiath}`);

    const equipped = (characterContext?.equipment || []).slice(0, 6).map(e => e.name).filter(Boolean);
    if (equipped.length) lines.push(`Equipped: ${equipped.join(', ')}`);
    const abilities = (characterContext?.abilities || []).slice(0, 6).map(a => a.name).filter(Boolean);
    if (abilities.length) lines.push(`Signature abilities: ${abilities.join(', ')}`);

    return lines.join('\n');
  }, [partyMembers, userId, characterContext, characterName, driftZone, alignmentHistoryCount]);



  // Dragon bonds for Empyrean campaigns
  const dragonBonds = usePartyDragonBonds(partyId || null, userId || null, stablePartyMembers);
  const partyDragonConfigs = useMemo(() => {
    if (!dragonBonds.allDragonConfigs.length) return undefined;
    return dragonBonds.allDragonConfigs.map(d => {
      const member = partyMembers.find(m => m.user_id === d.userId);
      return {
        userId: d.userId,
        characterName: member?.character_name || 'Unknown',
        config: {
          dragonName: d.config.dragonName,
          signetType: d.config.signetType,
          bond: d.config.bond,
          trust: d.config.trust,
          mood: d.config.mood,
          burnout: d.config.burnout,
        },
      };
    });
  }, [dragonBonds.allDragonConfigs, partyMembers]);

  // Burnout is now app-controlled (deterministic) via use-party-dm round resolution.
  // The legacy AI-driven BURNOUT/BURNOUT_TICK callbacks are no longer wired.
  const handleBurnoutDetected = useCallback((_level: number) => {}, []);
  const handleBurnoutTickDetected = useCallback((_reason: string) => {}, []);

  const handleBondStrainDetected = useCallback((reason: string) => {
    dragonBonds.updateBondAndTrust(0, -5);
    toast.error(`Bond strained: ${reason}`);
  }, [dragonBonds.updateBondAndTrust]);

  const handleBondGrowthDetected = useCallback((reason: string) => {
    dragonBonds.updateBondAndTrust(3, 2);
    toast.success(`Bond deepens: ${reason}`, { icon: '🐉' });
  }, [dragonBonds.updateBondAndTrust]);

  const handleDragonMemoryDetected = useCallback((memory: string) => {
    if (!dragonBonds.myDragon) return;
    const currentMemories = dragonBonds.myDragon.memories || [];
    const newMemory = {
      id: crypto.randomUUID(),
      text: memory,
      source: 'campaign' as const,
      createdAt: new Date().toISOString(),
    };
    dragonBonds.updateMyDragon({
      memories: [...currentMemories, newMemory].slice(-30),
    });
    toast('Dragon remembers: ' + memory, { icon: '🐉', duration: 3000 });
  }, [dragonBonds.myDragon, dragonBonds.updateMyDragon]);

  const { weather } = useWeather();
  // Shared party quest board + world-state log (declared here so the DM prompt can read it).
  const partyQuests = usePartyQuests(partyId, userId);

  // Backfill identity fields for party members whose client has not reopened
  // since these fields were added to the broadcast. Reads their latest cloud
  // save server-side and merges backstory, race and the Cosmic Chef label into
  // party_members, so the DM prompt is complete without waiting on anyone.
  const identityBackfillRan = useRef(false);
  useEffect(() => {
    if (identityBackfillRan.current) return;
    if (!partyId || !isHost) return;
    identityBackfillRan.current = true;

    supabase.functions
      .invoke('party-sync-identity', { body: { partyId } })
      .then(({ data, error }) => {
        if (error) {
          console.error('[PartyIdentitySync] failed:', error);
          return;
        }
        console.log('[PartyIdentitySync]', data);
      })
      .catch(err => console.error('[PartyIdentitySync] threw:', err));
  }, [partyId, isHost]);


  const weatherWorldState = useMemo(() => {
    const parts: string[] = [];
    if (loadWeatherEnabled()) {
      const block = buildWeatherPrompt(weather || getCachedWeather());
      if (block) parts.push(block);
    }
    // Established outcomes are facts. The DM must never contradict them.
    const canonBlock = buildCanonLockBlock(partyQuests.worldState);
    if (canonBlock) parts.push(canonBlock);
    return parts.length ? parts.join('\n\n') : undefined;
  }, [weather, partyQuests.worldState]);


  // Party DM hook — pass isHost as isCreator so co-hosts get host abilities
  const partyDm = usePartyDm({
    partyId: partyId || null,
    isCreator: isHost,
    memberCount: partyMembers.length,
    characterName,
    characterContext,
    partyMembers: stablePartyMembers,
    customGuidesContent: gmGuides.enabledContent,
    memoryAnchorsContent: memoryAnchors.formattedForOracle,
    worldStatePrompt: weatherWorldState,
    partyDragonConfigs,
    myDragonName: dragonBonds.myDragon?.dragonName,
    onBurnoutDetected: handleBurnoutDetected,
    onBurnoutTickDetected: handleBurnoutTickDetected,
    onBondStrainDetected: handleBondStrainDetected,
    onBondGrowthDetected: handleBondGrowthDetected,
    onDragonMemoryDetected: handleDragonMemoryDetected,
    isSoloEmpyrean,
  });

  const directorCampaignContext = useMemo(() => [
    gmGuides.enabledContent ? `## GM GUIDES (CAMPAIGN WORLD BIBLE — ABSOLUTE CANON)\n${gmGuides.enabledContent}` : '',
    memoryAnchors.formattedForOracle ? `## MEMORY ANCHORS (ESTABLISHED FACTS)\n${memoryAnchors.formattedForOracle}` : '',
    (partyDm.sessionConfig as any)?.campaignSummary ? `## CAMPAIGN SUMMARY\n${(partyDm.sessionConfig as any).campaignSummary}` : '',
  ].filter(Boolean).join('\n\n'), [
    gmGuides.enabledContent,
    memoryAnchors.formattedForOracle,
    partyDm.sessionConfig,
  ]);

  // Auto-extract memory anchors from new DM responses (host-only to avoid duplicates)
  usePartyMemoryExtraction({
    messages: partyDm.messages,
    anchors: memoryAnchors.anchors,
    addMemoryAnchor: memoryAnchors.addMemoryAnchor,
    characterContext,
    enabled: isHost,
  });

  // Sync parties.campaign_type into the active session config (host-only writes).
  // This fixes legacy multiplayer Empyrean sessions whose sessionConfig was
  // stuck on 'dnd' due to the long-standing line-301 bug.
  useEffect(() => {
    if (!isHost) return;
    if (!partyDm.isActive) return;
    const current = partyDm.sessionConfig?.campaignType;
    if (current !== partyCampaignType) {
      partyDm.updateSessionConfig({ campaignType: partyCampaignType });
    }
  }, [isHost, partyDm.isActive, partyDm.sessionConfig?.campaignType, partyCampaignType, partyDm.updateSessionConfig]);

  // Campaign Builder completion handler
  const handleCampaignBuilderComplete = useCallback(async (data: CampaignBuildData) => {
    setShowCampaignBuilder(false);

    // 1. Start fresh campaign with the generated name
    await partyDm.startNewCampaign(data.campaignName);
    memoryAnchors.clearAll();

    // 2. Auto-detect campaign type from the generated content and persist
    //    it on the parties row so the party is filed under the correct mode.
    if (isHost && partyId) {
      try {
        const blob = [data.campaignName, data.campaignSummary, data.gmGuide]
          .filter(Boolean).join(' ');
        const detected = detectCampaignType(blob);
        await supabase.from('parties').update({ campaign_type: detected }).eq('id', partyId);
        setPartyCampaignType(detected);
      } catch (e) {
        console.error('[campaign-type] auto-detect/persist failed:', e);
      }
    }

    // 3. Set the campaign summary, save GM guide, seed anchors, post opening scene
    setTimeout(async () => {
      partyDm.updateSessionConfig({ campaignSummary: data.campaignSummary });

      // 3. Save the GM guide
      gmGuides.addGuide(`📖 ${data.campaignName}`, data.gmGuide);

      // 4. Seed memory anchors
      for (const anchor of data.memoryAnchors) {
        memoryAnchors.addMemoryAnchor({
          category: anchor.category,
          key: anchor.key,
          value: anchor.value,
        });
      }

      // 5. Post opening scene as first DM message
      if (data.openingScene) {
        setTimeout(() => {
          partyDm.sendManualDmMessage(data.openingScene);
        }, 300);
      }
    }, 300);
  }, [partyDm, memoryAnchors, gmGuides]);


  // ─── Party quest board ──────────────────────────────────────────────────────
  const questRewardSplit = useQuestRewardSplit(partyId, userId);
  const partyQuestsRef = useRef<Quest[]>([]);
  useEffect(() => { partyQuestsRef.current = partyQuests.quests; }, [partyQuests.quests]);

  /** Rewards land on each player's own sheet; only the host writes the shared board. */
  const payPartyQuestRewards = useCallback((quest: Quest) => {
    if (quest.rewardsPaid) return;
    const roster = partyMembers.map(m => ({
      user_id: m.user_id,
      character_name: m.character_name,
      level: (m.character_status as { level?: number } | undefined)?.level,
    }));
    const share = questRewardShare(questRewardSplit.mode, quest, roster, userId);
    const xp = applyShare(quest.xpReward, share);
    if (xp > 0) autoSyncCallbacks?.onAddXP?.(xp, `Quest: ${questTitle(quest)}`);
    const gp = applyShare(quest.goldReward, share);
    if (gp > 0) autoSyncCallbacks?.onGoldChange?.(gp);
    const items = (quest.itemRewards ?? []).map(it => ({
      name: it.name,
      quantity: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Math.min(99, Math.floor(Number(it.quantity))) : 1,
      gold_value: it.gold_value,
      description: it.description,
      rarity: it.rarity,
      category: it.category,
    })).filter(it => it.name);
    if (items.length) addPendingDmItems(items as any);
    const shareNote = questRewardSplit.mode === 'full' || share >= 1
      ? ''
      : share <= 0
        ? ' — no reward share for you'
        : ` — your share: ${xp} XP, ${gp} gp`;
    toast.success(`Quest complete: ${questTitle(quest)}${shareNote}`);
  }, [autoSyncCallbacks, partyMembers, questRewardSplit.mode, userId]);

  const handlePartyQuestUpdate = useCallback((offers: RawQuestOffer[], progress: any[]) => {
    const current = partyQuestsRef.current;
    for (const offer of offers ?? []) {
      const quest = questFromOffer(offer);
      if (!quest) continue;
      if (current.some(q => q.key === quest.key)) continue;
      if (isHost) partyQuests.upsertQuest(quest);
    }
    for (const update of progress ?? []) {
      const key = String(update?.key ?? '');
      const existing = current.find(q => q.key === key);
      if (!existing || existing.status !== 'active') continue;
      let next = applyQuestProgress(existing, update);
      if (next.status === 'completed' && !existing.rewardsPaid) {
        payPartyQuestRewards(next);
        next.rewardsPaid = true;
        next = withQuestEvent(next, 'rewards', `Rewards paid out: ${rewardSummary(next)}.`);
      }
      if (next.status !== existing.status && (next.status === 'completed' || next.status === 'failed') && isHost) {
        partyQuests.recordWorldState([worldEntryFromQuest(next)]);
      }
      if (isHost) partyQuests.upsertQuest(next);
    }
  }, [isHost, partyQuests, payPartyQuestRewards]);

  /** Only the host writes the shared world-state log; everyone reads it in realtime. */
  const handleWorldStateUpdate = useCallback((changes: any[]) => {
    if (!isHost) return;
    const incoming = (changes ?? []).map((c: any) => ({
      title: c?.title,
      consequence: c?.consequence,
      scope: c?.scope,
      impact: c?.impact,
      questKey: c?.quest_key ?? c?.questKey ?? undefined,
    }));
    partyQuests.recordWorldState(incoming).then(added => {
      if (added.length === 0) return;
      toast.info(added.length === 1 ? 'The world has changed' : `${added.length} things changed the world`, {
        description: added.map(e => e.title).join(' · '),
      });
    }).catch(() => {});
  }, [isHost, partyQuests]);


  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onHPSet: autoSyncCallbacks?.onHPSet,
    onUseConsumableByName: autoSyncCallbacks?.onUseConsumableByName,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: useCallback(() => {}, []),
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => [], []),
    getGridSize: useCallback(() => 25 as any, []),
    getActiveQuests: useCallback(() => partyQuestsRef.current, []),
    onQuestUpdate: handlePartyQuestUpdate,
    onWorldStateUpdate: handleWorldStateUpdate,
  } as Parameters<typeof useDmAutoSync>[0]);

  // Run auto-sync on each newly arrived DM message.
  //
  // The solo screen fires this from an onMessageComplete callback. Party messages
  // arrive over Supabase realtime and are shared by everyone, so instead we watch
  // the list and extract from assistant messages we have not processed yet.
  //
  // Two guards matter:
  //  - only the newest assistant message is processed, never the backlog, or
  //    loading a campaign would re-apply every XP and gold award in its history
  //  - each message id is recorded, so a re-render or realtime echo cannot
  //    double-apply the same award
  const processedSyncIds = useRef<Set<string>>(new Set());
  const hasSeededSyncHistory = useRef(false);

  useEffect(() => {
    const msgs = partyDm.messages;
    if (!msgs || msgs.length === 0) return;

    // First pass after mount or campaign load: mark everything already on screen
    // as processed. Those awards were applied when they originally happened.
    if (!hasSeededSyncHistory.current) {
      hasSeededSyncHistory.current = true;
      for (const m of msgs) processedSyncIds.current.add(m.id);
      return;
    }

    if (!autoSync.autoSyncEnabled) return;
    if (partyDm.isGenerating) return; // wait for the message to finish

    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (!last.content || last.content.trim().length === 0) return;
    if (processedSyncIds.current.has(last.id)) return;

    processedSyncIds.current.add(last.id);

    // Canon guard: flag any beat that reverses an already-settled outcome.
    const violations = findCanonViolations(last.content, partyQuests.worldState);
    if (violations.length > 0) {
      toast.warning('That beat breaks established world state', {
        description: violationSummary(violations),
        duration: 12000,
        action: isHost
          ? {
              label: 'Ask the DM to fix it',
              onClick: () => { partyDm.applyOocCommand(buildCanonCorrectionPrompt(violations)); },
            }
          : undefined,
      });
    }

    autoSync.extractAndApply(last.content, characterContext)
      .then(result => {
        if (result?.items_acquired?.length) {
          addPendingDmItems(result.items_acquired);
        }
      })
      .catch(() => {});
  }, [
    partyDm.messages,
    partyDm.isGenerating,
    autoSync.autoSyncEnabled,
    autoSync.extractAndApply,
    characterContext,
    partyQuests.worldState,
    isHost,
    partyDm.applyOocCommand,
  ]);


  /** Manual pull: re-read the DM's latest response and lift any quests out of it. */
  const handleScanQuests = useCallback(() => {
    // Whispers are stripped off content by parseWhispers and kept on
    // message.whispers, so the scan has to read both or it misses anything
    // the DM dropped into the whisper tray. In party mode the whispers on a
    // message are already filtered to this player, which is what we want.
    const last = [...partyDm.messages].reverse().find(
      (m: any) => m.role === 'assistant' && (m.content?.trim() || m.whispers?.length)
    );
    const scanText = buildQuestScanText(last);
    if (!last || !scanText.trim()) {
      toast.info('No DM response to read yet.');
      return;
    }
    toast.info("Reading the DM's last response and whispers for quests…");
    autoSync.extractAndApply(scanText, characterContext)
      .then(result => {
        if (!result?.quests_offered?.length && !result?.quest_progress?.length) {
          toast.info('No quests found in that response.', {
            description: 'Ask the DM to lay out the jobs on offer, then try again.',
          });
        }
      })
      .catch(() => {});
  }, [partyDm.messages, characterContext, autoSync.extractAndApply]);

  // Campaign load handler for dropdown
  const handleLoadCampaign = useCallback((session: import('@/hooks/use-campaign-sessions').CampaignSession) => {
    if (partyDm.messages.length > 0) {
      partyDm.saveCampaign('Party Campaign', partyDm.activeCampaignId || undefined);
    }
    // A loaded campaign brings its whole history with it. Re-seed so auto-sync
    // treats all of it as already applied instead of replaying old awards.
    hasSeededSyncHistory.current = false;
    processedSyncIds.current.clear();
    partyDm.loadCampaign(session.id, session.messages, session.campaign_summary);
  }, [partyDm.messages.length, partyDm.saveCampaign, partyDm.activeCampaignId, partyDm.loadCampaign]);

  const empyreanGuidesContent = useMemo(() => {
    if (partyDm.sessionConfig?.campaignType !== 'empyrean') return '';
    return EMPYREAN_LORE_GUIDES
      .map(g => g.content)
      .join('\n\n');
  }, [partyDm.sessionConfig?.campaignType]);

  // Build full dragon context for DM awareness (bond status + memories + private chat transcript)
  const dragonContextForDM = useMemo(() => {
    const dragon = dragonBonds.myDragon;
    if (!dragon?.dragonName) return '';

    const bond = dragon.bond ?? 15;
    const trust = dragon.trust ?? 10;
    const mood = dragon.mood ?? 'calm';

    const sections: string[] = [];

    // Bond status section
    sections.push(`## DRAGON-RIDER BOND STATUS

Bond Level: ${getBondDescriptor(bond)} (${bond}/100)
Trust Level: ${getTrustDescriptor(trust)} (${trust}/100)
Dragon Mood: ${mood}

Narrate the dragon-rider dynamic based on these levels. Reflect the dragon's current mood in whispers/telepathy:
- distant: colder, shorter, withholding
- protective: urgent warnings, proactive threat assessment
- alert: heightened sensory impressions, vigilance
- playful: dry humor/teasing (still ancient/proud)
- ancestral: echoes of older voices, visions, ancient memory
- calm: measured, steady, unhurried`);

    // Persistent memories
    const memories = (dragon.memories ?? []).slice(-20);
    if (memories.length > 0) {
      sections.push(`## DRAGON'S PERSISTENT MEMORIES
These are established facts about the dragon's personality, opinions, and experiences — formed through actual gameplay. Treat them as canon and reference them naturally:

${memories.map(m => '- ' + m.text).join('\n')}`);
    }

    // Private chat transcript
    const chatMessages = dragonBonds.dragonChatMessages;
    if (chatMessages?.length) {
      const DRAGON_TAG_RE = /<!--(?:DRAGON_MOOD|DRAGON_MEMORY|DRAGON_HABIT|BOND_SENSE):[^>]*-->/g;
      const last15 = chatMessages.slice(-15);
      const lines = last15.map(m => {
        const cleanContent = m.content.replace(DRAGON_TAG_RE, '').trim();
        return m.role === 'user' ? `${characterName}: ${cleanContent}` : `${dragon.dragonName}: ${cleanContent}`;
      }).join('\n');
      const truncated = lines.length > 2000 ? lines.slice(0, 2000) + '…' : lines;
      sections.push(`## RECENT DRAGON-RIDER PRIVATE COMMUNICATION
The rider recently had this private telepathic exchange with their dragon (outside the main narrative). Use this context to inform dragon behavior in scenes:
${truncated}`);
    }

    // Recent mood shift hint (expires after 5 minutes)
    const shift = dragonBonds.lastMoodShift;
    if (shift) {
      const shiftAge = Date.now() - new Date(shift.timestamp).getTime();
      if (shiftAge < 5 * 60 * 1000) {
        sections.push(`[Dragon mood shift: ${dragon.dragonName} shifted from ${shift.from} to ${shift.to}. Reflect this in dragon whispers and behavior this scene.]`);
      }
    }

    // Rider emotional state from bond log
    const emotionalLog = (dragon as any).riderEmotionalLog ?? [];
    if (emotionalLog.length > 0) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentEmotions = emotionalLog
        .filter((e: any) => new Date(e.timestamp).getTime() > fiveMinutesAgo)
        .map((e: any) => e.tag);
      if (recentEmotions.length > 0) {
        const counts: Record<string, number> = {};
        recentEmotions.forEach((tag: string) => { counts[tag] = (counts[tag] ?? 0) + 1; });
        const summary = Object.entries(counts).map(([tag, n]) => n > 1 ? `${tag} (×${n})` : tag).join(', ');
        sections.push(`## RIDER EMOTIONAL STATE (from bond log)\nRecent emotional signals detected through the bond: ${summary}\nLet this color the scene's atmosphere and any NPC reactions to the rider.`);
      }
    }

    return '\n\n' + sections.join('\n\n');
  }, [dragonBonds.myDragon, dragonBonds.dragonChatMessages, dragonBonds.lastMoodShift]);




  return (
    <div className={cn(embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
      <PartyDirectorScreen
        open={showDirectorScreen}
        onClose={() => setShowDirectorScreen(false)}
        partyId={partyId}
        userId={userId}
        campaignPlan={directorCampaignContext}
        characterContext={(() => {
          const myMember = partyMembers.find(m => m.user_id === userId);
          const status = (myMember as any)?.character_status || {};
          const parts: string[] = [];
          if (myMember?.character_name) parts.push(`Name: ${myMember.character_name}`);
          if (status.dragon_name) parts.push(`Dragon: ${status.dragon_name}${status.dragon_color ? ` (${status.dragon_color})` : ''}`);
          if (status.signet_type) parts.push(`Signet: ${status.signet_type}`);
          if (status.year_at_basgiath) parts.push(`Year: ${status.year_at_basgiath}`);
          if (status.backstory) parts.push(`Backstory: ${status.backstory}`);
          if (status.personality) parts.push(`Personality: ${status.personality}`);
          return parts.join('\n');
        })()}
        onPublicAction={(actionText) => {
          partyDm.submitPrompt(actionText);
        }}
      />
      {isPartyCreator && onboardingRequests.pendingRequests.length > 0 && (
        <button
          onClick={() => setShowRequestsPanel(true)}
          className="absolute top-12 left-1/2 -translate-x-1/2 z-[61] px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-2"
          style={{ touchAction: 'manipulation' }}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Onboarding requests
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-amber-950 text-[10px] font-bold">
            {onboardingRequests.pendingRequests.length}
          </span>
        </button>
      )}
      {isPartyCreator && directorEscalations.pendingEscalations.length > 0 && (
        <button
          onClick={() => setShowDirectorEscalationsPanel(true)}
          className="absolute top-[5.5rem] left-1/2 -translate-x-1/2 z-[61] px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-2"
          style={{ touchAction: 'manipulation' }}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Director requests
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-amber-950 text-[10px] font-bold">
            {directorEscalations.pendingEscalations.length}
          </span>
        </button>
      )}
      <PartyDMScreen
        onBack={onBack}
        partyId={partyId}
        partyDm={partyDm}
        isCreator={isHost}
        isOriginalCreator={isPartyCreator}
        coHostIds={coHostIds}
        onPromoteCoHost={promoteCoHost}
        onDemoteCoHost={demoteCoHost}
        currentUserId={userId}
        memberCount={partyMembers.length}
        members={partyMembers.map(m => ({ user_id: m.user_id, character_name: m.character_name, character_status: m.character_status as Record<string, unknown>, updated_at: m.updated_at }))}
        onShowGuides={() => setShowGuides(true)}
        onShowCharacterGuideBuilder={() => setShowCharacterGuideBuilder(true)}
        
        onShowSaves={() => setShowSaves(true)}
        onShowChat={onShowChat}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        isExtracting={autoSync.isExtracting}
        onScanQuests={handleScanQuests}
        worldState={partyQuests.worldState}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        guides={gmGuides.guides}
        gmGuidesContent={(gmGuides.enabledContent || '') + (empyreanGuidesContent ? '\n\n' + empyreanGuidesContent : '') + dragonContextForDM}
        onShowOocChat={() => setShowOocChat(true)}
        memoryAnchorsContent={memoryAnchors.formattedForOracle}
        memoryAnchors={memoryAnchors.anchors}
        onAddMemoryAnchor={memoryAnchors.addMemoryAnchor}
        onRemoveMemoryAnchor={memoryAnchors.removeMemoryAnchor}
        characterContext={characterContext}
        currentXP={currentXP}
        onManualLevelUp={onManualLevelUp}
        onAcceptItem={onAcceptItem}
        onOpenCharacterPicker={onOpenCharacterPicker}
        campaignSessions={campaignSessions.sessions}
        campaignSessionsLoading={campaignSessions.isLoading}
        campaignSessionsSignedIn={campaignSessions.isSignedIn}
        onNewGame={() => setShowCampaignBuilder(true)}
        onLoadCampaign={handleLoadCampaign}
          onRefreshCampaigns={campaignSessions.refreshSessions}
          wildShape={wildShape}
          isMomoMoonDruid={isMomoMoonDruid}
          onHPChange={autoSyncCallbacks?.onHPChange}
          onRestOccurred={autoSyncCallbacks?.onRestOccurred}
          onUseConsumableByName={autoSyncCallbacks?.onUseConsumableByName}
          swipeHandlers={swipeHandlers}
          onRequestCharacterRedo={(() => {
            const myMember = partyMembers.find(m => m.user_id === userId);
            const myStatus = (myMember as any)?.onboarding_status || 'pending';
            if (isPartyCreator || myStatus !== 'complete') return undefined;
            return () => setShowRedoDialog(true);
          })()}
          onOpenDirector={partyId && userId ? () => setShowDirectorScreen(true) : undefined}
          hasPendingRedoRequest={!!(userId && onboardingRequests.myPendingRequest(userId))}
        />

      <OocDmChat
        open={showOocChat}
        onClose={() => setShowOocChat(false)}
        messages={oocDmChat.messages}
        isLoading={oocDmChat.isLoading}
        onSendMessage={oocDmChat.sendMessage}
        onCancelRequest={oocDmChat.cancelRequest}
        onClearChat={oocDmChat.clearChat}
        onDeleteMessage={oocDmChat.deleteMessage}
        pendingCommand={oocDmChat.pendingCommand}
        onApply={(command) => {
          oocDmChat.clearPendingCommand();
          setShowOocChat(false);
          setTimeout(() => {
            partyDm.applyOocCommand(command);
          }, 300);
        }}
        onDismissCommand={oocDmChat.clearPendingCommand}
        campaignType={isSoloEmpyrean ? 'empyrean' : partyCampaignType}
      />

      {/* GM Guides Overlay */}
      {showGuides && (
        <GMGuidesManager
          onBack={() => setShowGuides(false)}
          guides={gmGuides.guides}
          totalChars={gmGuides.totalChars}
          campaignSummary={partyDm.sessionConfig?.campaignSummary ?? null}
          onCampaignSummaryChange={(summary: string) => {
            partyDm.updateSessionConfig({ campaignSummary: summary });
          }}
          onAdd={gmGuides.addGuide}
          onUpdate={gmGuides.updateGuide}
          onDelete={gmGuides.deleteGuide}
          onToggle={gmGuides.toggleGuide}
          chatMessages={partyDm.messages.slice(-20).map(m => ({ role: m.role, content: m.content }))}
          onFullSummarize={partyDm.fullSummarize}
          isFullSummarizing={partyDm.isFullSummarizing}
        />
      )}

      {/* Character Guide Builder */}
      <CharacterGuideBuilder
        open={showCharacterGuideBuilder}
        onClose={() => setShowCharacterGuideBuilder(false)}
        campaignType={isSoloEmpyrean ? 'empyrean' : partyCampaignType}
        campaignPlan={(partyDm.sessionConfig as any)?.campaignSummary || ''}
        onGuideCreated={(name, content) => {
          gmGuides.addGuide(name, content);
        }}
      />

      {/* Campaign Saves Overlay */}
      {showSaves && (
        <PartyCampaignSaves
          onBack={() => setShowSaves(false)}
          activeCampaignId={partyDm.activeCampaignId}
          hasMessages={partyDm.messages.length > 0}
          onSave={partyDm.saveCampaign}
          onLoad={partyDm.loadCampaign}
          isCreator={isHost}
        />
      )}

      {/* Campaign Builder Chat Overlay */}
      <AnimatePresence>
        {showCampaignBuilder && (
          <CampaignBuilderChat
            partyMembers={partyMembers}
            characterName={characterName}
            characterLevel={characterContext.level || 1}
            characterIdentity={{
              race: characterContext.race || undefined,
              gender: characterContext.gender || undefined,
              class: characterContext.characterClass || undefined,
              backstory: characterContext.backstory || undefined,
            }}
            existingGuidesContent={gmGuides.enabledContent}
            mode={isPartyCreator ? 'party-host' : 'standalone-party'}
            onComplete={handleCampaignBuilderComplete}
            onApplyHostOnboarding={async () => {
              if (!userId || !partyId || !isPartyCreator) return;
              try {
                const nowIso = new Date().toISOString();
                const { error: hostErr } = await supabase
                  .from('party_members')
                  .update({
                    onboarding_status: 'complete',
                    onboarding_completed_at: nowIso,
                  })
                  .eq('party_id', partyId)
                  .eq('user_id', userId);
                if (hostErr) console.error('[HostOnboarding] mark host complete failed:', hostErr);

                const { error: othersErr } = await supabase
                  .from('party_members')
                  .update({
                    onboarding_status: 'in_progress',
                    onboarding_started_at: nowIso,
                  })
                  .eq('party_id', partyId)
                  .neq('user_id', userId)
                  .eq('onboarding_status', 'pending');
                if (othersErr) console.error('[HostOnboarding] signal others failed:', othersErr);
              } catch (e) {
                console.error('[HostOnboarding] unexpected error:', e);
              }
            }}
            onSkip={() => {
              setShowCampaignBuilder(false);
              partyDm.startNewCampaign();
              memoryAnchors.clearAll();
            }}
          />
        )}
      </AnimatePresence>





      <PlayerRedoRequestDialog
        open={showRedoDialog}
        onOpenChange={setShowRedoDialog}
        onSubmit={async (reason) => {
          if (!userId) return false;
          return onboardingRequests.submitRequest(userId, reason);
        }}
        hasExistingPending={!!(userId && onboardingRequests.myPendingRequest(userId))}
      />

      <HostOnboardingRequestsPanel
        open={showRequestsPanel}
        onOpenChange={setShowRequestsPanel}
        pendingRequests={onboardingRequests.pendingRequests}
        memberDisplayNames={memberDisplayNames}
        onApprove={onboardingRequests.approveRequest}
        onDeny={onboardingRequests.denyRequest}
      />

      <HostDirectorEscalationsPanel
        open={showDirectorEscalationsPanel}
        onOpenChange={setShowDirectorEscalationsPanel}
        pendingEscalations={directorEscalations.pendingEscalations}
        memberDisplayNames={memberDisplayNames}
        hostUserId={userId}
        onApprove={directorEscalations.approve}
        onDeny={directorEscalations.deny}
      />
    </div>
  );
}
