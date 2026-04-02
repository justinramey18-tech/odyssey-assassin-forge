import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { usePartyMemoryAnchors } from '@/hooks/use-party-memory-anchors';
import { usePartyMemoryExtraction } from '@/hooks/use-party-memory-extraction';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { useCampaignSessions } from '@/hooks/use-campaign-sessions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PartyDMScreen } from './PartyDMScreen';
import { GMGuidesManager } from './GMGuidesManager';

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
  const [showOocChat, setShowOocChat] = useState(false);
  const [partyCreatorId, setPartyCreatorId] = useState<string | null>(null);
  const [coHostIds, setCoHostIds] = useState<string[]>([]);

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

  const handleBurnoutDetected = useCallback((level: number) => {
    dragonBonds.updateBurnout(level);
  }, [dragonBonds.updateBurnout]);

  const handleBurnoutTickDetected = useCallback((reason: string) => {
    // Read latest values directly from dragonBonds to avoid stale closures
    const currentBurnout = dragonBonds.myDragon?.burnout ?? 0;
    const bond = dragonBonds.myDragon?.bond ?? 15;
    const maxBurnout = bond >= 76 ? 12 : bond >= 51 ? 11 : bond >= 26 ? 10 : 8;
    const nextBurnout = Math.min(currentBurnout + 1, maxBurnout);
    dragonBonds.updateBurnout(nextBurnout);
    toast('Signet strain: ' + reason, { icon: '🔥' });
  }, [dragonBonds]);

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

  // Non-hosts (and non-co-hosts) wait for session to start
  if (!partyDm.isActive && !isHost) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]", embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <span className="text-white/80 text-sm font-cinzel">← Back</span>
        </button>
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
    <div className="fixed inset-0 z-[60]">
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
            onComplete={handleCampaignBuilderComplete}
            onSkip={() => {
              setShowCampaignBuilder(false);
              partyDm.startNewCampaign();
              memoryAnchors.clearAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
