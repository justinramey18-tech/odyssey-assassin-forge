import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { usePartyMemoryAnchors } from '@/hooks/use-party-memory-anchors';
import { usePartyMemoryExtraction } from '@/hooks/use-party-memory-extraction';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { useCampaignSessions } from '@/hooks/use-campaign-sessions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PartyDMScreen } from './PartyDMScreen';
import { GMGuidesManager } from './GMGuidesManager';

import { PartyCampaignSaves } from './PartyCampaignSaves';
import CampaignBuilderChat from './CampaignBuilderChat';
import { AnimatePresence } from 'framer-motion';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import type { CharacterContext } from '@/components/oracle/types';
import { EMPYREAN_LORE_GUIDES } from '@/lib/empyreanGMGuides';
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
}: StandalonePartyDMScreenProps) {
  const [showGuides, setShowGuides] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
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

  // Campaign sessions (for dropdown)
  const sessionMode = isSoloEmpyrean ? 'solo-empyrean' as const : 'party' as const;
  const campaignSessions = useCampaignSessions(sessionMode);

  // GM Guides — co-hosts load the host's guides via ownerUserId
  const gmGuidesOwner = isCoHost && partyCreatorId ? partyCreatorId : undefined;
  const gmGuides = useGMGuides(gmGuidesOwner, sessionMode);

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

  const handleBondStrainDetected = useCallback((reason: string) => {
    dragonBonds.updateBondAndTrust(0, -5);
    toast.error(`Bond strained: ${reason}`);
  }, [dragonBonds.updateBondAndTrust]);

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
    onBondStrainDetected: handleBondStrainDetected,
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

  // Non-hosts (and non-co-hosts) wait for session to start
  if (!partyDm.isActive && !isHost) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
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
        gmGuidesContent={(gmGuides.enabledContent || '') + (empyreanGuidesContent ? '\n\n' + empyreanGuidesContent : '')}
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
