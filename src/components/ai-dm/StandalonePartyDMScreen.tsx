import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { usePartyMemoryAnchors } from '@/hooks/use-party-memory-anchors';
import { usePartyMemoryExtraction } from '@/hooks/use-party-memory-extraction';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useWeather } from '@/hooks/use-weather';
import { weatherToNarrativeContext } from '@/lib/weather';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { useCampaignSessions } from '@/hooks/use-campaign-sessions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PartyDMScreen } from './PartyDMScreen';
import { GMGuidesManager } from './GMGuidesManager';
import { PlayerOnboardingScreen } from './PlayerOnboardingScreen';
import { HostStartCampaignPanel, type PartyMemberOnboardingView } from './HostStartCampaignPanel';
import { PlayerLockedOutScreen } from './PlayerLockedOutScreen';
import { PlayerRedoRequestDialog } from './PlayerRedoRequestDialog';
import { HostOnboardingRequestsPanel } from './HostOnboardingRequestsPanel';
import { usePartyOnboardingRequests } from '@/hooks/use-party-onboarding-requests';
import { PartyDirectorScreen } from './PartyDirectorScreen';
import { HostDirectorEscalationsPanel } from './HostDirectorEscalationsPanel';
import { usePartyDirectorEscalations } from '@/hooks/use-party-director-escalations';
import { Play, MessageCircle, AlertTriangle } from 'lucide-react';

import { PartyCampaignSaves } from './PartyCampaignSaves';
import CampaignBuilderChat from './CampaignBuilderChat';
import { AnimatePresence } from 'framer-motion';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import type { CharacterContext } from '@/components/oracle/types';
import { useOocDmChat } from '@/hooks/use-ooc-dm-chat';
import { OocDmChat } from './OocDmChat';
import { EMPYREAN_LORE_GUIDES } from '@/lib/empyreanGMGuides';
import { getBondDescriptor, getTrustDescriptor, savePartyHP } from '@/lib/dragonBondState';
import { usePartyDragonBonds } from '@/hooks/use-party-dragon-bonds';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { SwipeHandlers } from '@/components/empyrean/EmpyreanDMContainer';

import type { UseWildShapeReturn } from '@/hooks/use-wild-shape';

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
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
  wildShape?: UseWildShapeReturn;
  isMomoMoonDruid?: boolean;
  isSoloEmpyrean?: boolean;
  embedded?: boolean;
  swipeHandlers?: SwipeHandlers;
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
  wildShape,
  isMomoMoonDruid,
  isSoloEmpyrean,
  embedded = false,
  swipeHandlers,
}: StandalonePartyDMScreenProps) {
  const [showGuides, setShowGuides] = useState(false);

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
  const [showStartCampaignPanel, setShowStartCampaignPanel] = useState(false);
  const [forceShowOnboarding, setForceShowOnboarding] = useState(false);
  const [justAppliedOnboarding, setJustAppliedOnboarding] = useState(false);
  const [campaignStarted, setCampaignStarted] = useState<boolean>(false);
  const [memberDisplayNames, setMemberDisplayNames] = useState<Record<string, string>>({});
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [showDirectorEscalationsPanel, setShowDirectorEscalationsPanel] = useState(false);
  const onboardingRequests = usePartyOnboardingRequests({ partyId });
  const directorEscalations = usePartyDirectorEscalations({ partyId });
  const promotedToInProgressRef = useRef(false);

  // Late-joiner: promote 'pending' onboarding_status to 'in_progress' once when overlay opens
  useEffect(() => {
    if (promotedToInProgressRef.current) return;
    if (isPartyCreator) return;
    if (!partyId || !userId) return;
    const myMember = partyMembers.find(m => m.user_id === userId);
    const myOnboardingStatus = (myMember as any)?.onboarding_status || 'pending';
    if (myOnboardingStatus !== 'pending') return;
    promotedToInProgressRef.current = true;
    supabase
      .from('party_members')
      .update({
        onboarding_status: 'in_progress',
        onboarding_started_at: new Date().toISOString(),
      })
      .eq('party_id', partyId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) {
          console.error('[late-joiner] promote to in_progress failed:', error);
        }
      });
  }, [partyMembers, isPartyCreator, partyId, userId]);

  // Once realtime confirms onboarding is complete, drop the optimistic flag.
  // Future re-onboarding (status reset to 'in_progress' via host approval) still works.
  useEffect(() => {
    if (!justAppliedOnboarding) return;
    const myMember = partyMembers.find(m => m.user_id === userId);
    const status = (myMember as any)?.onboarding_status;
    if (status === 'complete') {
      setJustAppliedOnboarding(false);
    }
  }, [justAppliedOnboarding, partyMembers, userId]);

  // Safety net: if realtime never confirms after apply, drop the flag after 10s
  // so the screen logic re-evaluates. In a healthy session, this never fires
  // because the realtime path resets the flag much faster.
  useEffect(() => {
    if (!justAppliedOnboarding) return;
    const t = setTimeout(() => {
      setJustAppliedOnboarding(false);
    }, 10000);
    return () => clearTimeout(t);
  }, [justAppliedOnboarding]);

  // Fetch + subscribe to parties.campaign_started
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    supabase
      .from('parties')
      .select('campaign_started')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setCampaignStarted(data.campaign_started === true);
      });
    const channel = supabase
      .channel(`party-campaign-started-${partyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` },
        (payload) => {
          const next = (payload.new as { campaign_started?: boolean } | null)?.campaign_started;
          if (typeof next === 'boolean') setCampaignStarted(next);
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
    campaignType: isSoloEmpyrean ? 'empyrean' : 'dnd',
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
  const weatherWorldState = useMemo(() => {
    if (!weather) return undefined;
    return '## CURRENT WEATHER (REAL-WORLD SYNC — MANDATORY)\n' + weatherToNarrativeContext(weather) + '\nYou MUST incorporate this weather into your narration. Rules:\n1. Your FIRST response in any new scene or session MUST describe the weather as part of the environment — use sensory details (sound of rain, feel of wind, visibility in fog, cold of snow).\n2. In subsequent outdoor responses, reference the weather at least briefly — how it affects the ground, visibility, comfort, or mood.\n3. If the party is indoors, mention the weather through windows, sounds on the roof, drafts under doors, or characters arriving wet/cold.\n4. In combat outdoors, note how weather affects the battlefield — slippery ground, obscured vision, wind affecting projectiles.\n5. Do NOT repeat the same weather description verbatim — vary your phrasing each time.\n6. Do NOT state the temperature as a number. Describe it through sensation (biting cold, oppressive heat, comfortable warmth).';
  }, [weather]);

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

  // Auto-extract memory anchors from new DM responses (host-only to avoid duplicates)
  usePartyMemoryExtraction({
    messages: partyDm.messages,
    anchors: memoryAnchors.anchors,
    addMemoryAnchor: memoryAnchors.addMemoryAnchor,
    characterContext,
    enabled: isHost,
  });

  // Campaign Builder completion handler
  const handleCampaignBuilderComplete = useCallback(async (data: CampaignBuildData) => {
    setShowCampaignBuilder(false);

    // 1. Start fresh campaign with the generated name
    await partyDm.startNewCampaign(data.campaignName);
    memoryAnchors.clearAll();

    // 2. Set the campaign summary, save GM guide, seed anchors, post opening scene
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


  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: useCallback(() => {}, []),
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => [], []),
    getGridSize: useCallback(() => 25 as any, []),
  });


  // Campaign load handler for dropdown
  const handleLoadCampaign = useCallback((session: import('@/hooks/use-campaign-sessions').CampaignSession) => {
    if (partyDm.messages.length > 0) {
      partyDm.saveCampaign('Party Campaign', partyDm.activeCampaignId || undefined);
    }
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

  // Non-hosts wait for session to start — UNLESS they still need to onboard,
  // in which case the onboarding screen takes priority (they can build their
  // character while the host finishes the architect).
  if (!partyDm.isActive && !isHost) {
    const myMember = partyMembers.find(m => m.user_id === userId);
    const myOnboardingStatus = (myMember as any)?.onboarding_status || 'pending';
    const needsOnboarding = !isPartyCreator
      && myOnboardingStatus !== 'complete'
      && !justAppliedOnboarding;

    if (needsOnboarding) {
      const hostMember = partyMembers.find(m => m.user_id !== userId && (m as any).onboarding_status === 'complete')
        || partyMembers.find(m => m.user_id !== userId);
      const campaignPlan = (partyDm.sessionConfig as any)?.campaignSummary || '';
      const hostStatus = (hostMember as any)?.character_status || {};
      const hostCharacterSummary = hostMember
        ? `Host's character: ${hostMember.character_name}${hostStatus?.signet_type ? ` (signet: ${hostStatus.signet_type})` : ''}${hostStatus?.dragon_name ? `, bonded to ${hostStatus.dragon_name}` : ''}.`
        : '';
      return (
        <PlayerOnboardingScreen
          open={true}
          partyId={partyId}
          userId={userId}
          campaignPlan={campaignPlan}
          hostCharacterSummary={hostCharacterSummary}
          onComplete={() => {
            setForceShowOnboarding(false);
            setJustAppliedOnboarding(true);
          }}
        />
      );
    }

    return (
      <div className={cn("flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]", embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
        {!embedded && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="text-white/80 text-sm font-cinzel">← Back</span>
          </button>
        )}
        <div className="text-center px-6">
          <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-lg font-cinzel text-emerald-200 mb-2">Waiting for Host</h2>
          <p className="text-sm text-white/40 max-w-[280px]">
            The party creator needs to start the DM session before you can join.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
      {!showCampaignBuilder && (
        <button
          onClick={() => setShowDirectorScreen(true)}
          className="absolute right-2 z-[61] inline-flex items-center justify-center w-9 h-9 rounded-full bg-red-600/85 border border-red-400/40 hover:bg-red-600 active:bg-red-700 transition-colors shadow-lg"
          aria-label="Talk to the DM"
          style={{ bottom: '11rem', touchAction: 'manipulation' }}
        >
          <span className="text-white text-base font-bold">?</span>
        </button>
      )}
      <PartyDirectorScreen
        open={showDirectorScreen}
        onClose={() => setShowDirectorScreen(false)}
        partyId={partyId}
        userId={userId}
        campaignPlan={(partyDm.sessionConfig as any)?.campaignSummary || ''}
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
      {isPartyCreator && !campaignStarted && (
        <button
          onClick={() => setShowStartCampaignPanel(true)}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-[61] px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-md text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-2"
          style={{ touchAction: 'manipulation' }}
        >
          <Play className="w-3.5 h-3.5" />
          Manage start of campaign
        </button>
      )}
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
        members={partyMembers.map(m => ({ user_id: m.user_id, character_name: m.character_name, character_status: m.character_status as Record<string, unknown> }))}
        onShowGuides={() => setShowGuides(true)}
        
        onShowSaves={() => setShowSaves(true)}
        onShowChat={onShowChat}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        isExtracting={autoSync.isExtracting}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        gmGuidesContent={(gmGuides.enabledContent || '') + (empyreanGuidesContent ? '\n\n' + empyreanGuidesContent : '') + dragonContextForDM}
        onShowOocChat={() => setShowOocChat(true)}
        memoryAnchorsContent={memoryAnchors.formattedForOracle}
        memoryAnchors={memoryAnchors.anchors}
        onAddMemoryAnchor={memoryAnchors.addMemoryAnchor}
        onRemoveMemoryAnchor={memoryAnchors.removeMemoryAnchor}
        characterContext={characterContext}
        campaignSessions={campaignSessions.sessions}
        campaignSessionsLoading={campaignSessions.isLoading}
        campaignSessionsSignedIn={campaignSessions.isSignedIn}
        onNewGame={() => setShowCampaignBuilder(true)}
        onLoadCampaign={handleLoadCampaign}
          onRefreshCampaigns={campaignSessions.refreshSessions}
          wildShape={wildShape}
          isMomoMoonDruid={isMomoMoonDruid}
          onHPChange={autoSyncCallbacks?.onHPChange}
          swipeHandlers={swipeHandlers}
          onRequestCharacterRedo={(() => {
            const myMember = partyMembers.find(m => m.user_id === userId);
            const myStatus = (myMember as any)?.onboarding_status || 'pending';
            if (isPartyCreator || myStatus !== 'complete' || !campaignStarted) return undefined;
            return () => setShowRedoDialog(true);
          })()}
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
        campaignType={isSoloEmpyrean ? 'empyrean' : 'dnd'}
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

      {/* Player Onboarding Overlay (non-host players whose status is in_progress, or who tapped "Build my character" from lockout) */}
      {(() => {
        const myMember = partyMembers.find(m => m.user_id === userId);
        const myOnboardingStatus = (myMember as any)?.onboarding_status || 'pending';
        const playerOnboardingNeeded = !isPartyCreator && myOnboardingStatus !== 'complete';
        const showPlayerOnboarding = playerOnboardingNeeded
          && (myOnboardingStatus === 'in_progress' || myOnboardingStatus === 'pending' || forceShowOnboarding)
          && !justAppliedOnboarding;
        if (!showPlayerOnboarding) return null;

        const hostMember = partyMembers.find(m => m.user_id !== userId && (m as any).onboarding_status === 'complete')
          || partyMembers.find(m => m.user_id !== userId);
        const campaignPlan = (partyDm.sessionConfig as any)?.campaignSummary || '';
        const hostStatus = (hostMember as any)?.character_status || {};
        const hostCharacterSummary = hostMember
          ? `Host's character: ${hostMember.character_name}${hostStatus?.signet_type ? ` (signet: ${hostStatus.signet_type})` : ''}${hostStatus?.dragon_name ? `, bonded to ${hostStatus.dragon_name}` : ''}.`
          : '';

        return (
          <PlayerOnboardingScreen
            open={showPlayerOnboarding}
            partyId={partyId}
            userId={userId}
            campaignPlan={campaignPlan}
            hostCharacterSummary={hostCharacterSummary}
            onComplete={() => {
              setForceShowOnboarding(false);
              setJustAppliedOnboarding(true);
            }}
          />
        );
      })()}

      {/* Lock-out screen for non-host players who haven't completed onboarding after host started campaign */}
      {(() => {
        const myMember = partyMembers.find(m => m.user_id === userId);
        const myOnboardingStatus = (myMember as any)?.onboarding_status || 'pending';
        const showLockOutScreen = !isPartyCreator
          && campaignStarted
          && myOnboardingStatus !== 'complete'
          && myOnboardingStatus !== 'in_progress'
          && myOnboardingStatus !== 'pending'
          && !forceShowOnboarding;
        if (!showLockOutScreen) return null;
        return (
          <PlayerLockedOutScreen onOpenOnboarding={() => setForceShowOnboarding(true)} />
        );
      })()}

      {/* Host's Start Campaign panel */}
      <HostStartCampaignPanel
        open={showStartCampaignPanel}
        onOpenChange={setShowStartCampaignPanel}
        partyId={partyId}
        hostUserId={isPartyCreator ? userId : null}
        members={partyMembers.map<PartyMemberOnboardingView>((m) => ({
          user_id: m.user_id,
          display_name: memberDisplayNames[m.user_id],
          onboarding_status: ((m as any).onboarding_status || 'pending') as PartyMemberOnboardingView['onboarding_status'],
        }))}
        onCampaignStarted={() => setCampaignStarted(true)}
      />

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
