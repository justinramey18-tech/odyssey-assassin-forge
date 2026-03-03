import { useState, useCallback, useMemo, useRef } from 'react';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { useCampaignSessions } from '@/hooks/use-campaign-sessions';
import { PartyDMScreen } from './PartyDMScreen';
import { GMGuidesManager } from './GMGuidesManager';
import { InlineBattleMap } from './InlineBattleMap';
import { PartyCampaignSaves } from './PartyCampaignSaves';
import type { CharacterContext } from '@/components/oracle/types';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { MapMarker } from '@/components/party/battlemap/types';

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
  // Party map sync props
  partyMapBackgroundUrl?: string;
  partyMapBackgroundOpacity?: number;
  partyMapTierBackgrounds?: { tierId: string; imageUrl: string }[];
  partyMapCustomTiers?: { id: string; distancePerSquare: number; distanceUnit: string }[];
  onPartyMapBackgroundChange?: (url: string | undefined) => Promise<void>;
  onPartyMapBackgroundOpacityChange?: (opacity: number) => Promise<void>;
  onPartyMapTierBackgroundsChange?: (tierBackgrounds: { tierId: string; imageUrl: string }[]) => Promise<void>;
  onPartyMapCustomTiersChange?: (customTiers: { id: string; distancePerSquare: number; distanceUnit: string }[]) => Promise<void>;
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
  partyMapBackgroundUrl,
  partyMapBackgroundOpacity,
  partyMapTierBackgrounds,
  partyMapCustomTiers,
  onPartyMapBackgroundChange,
  onPartyMapBackgroundOpacityChange,
  onPartyMapTierBackgroundsChange,
  onPartyMapCustomTiersChange,
}: StandalonePartyDMScreenProps) {
  const [showGuides, setShowGuides] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [showBattleMap, setShowBattleMap] = useState(false);
  const [pendingMapAdds, setPendingMapAdds] = useState<MapMarker[]>([]);
  const [pendingMapRemovals, setPendingMapRemovals] = useState<string[]>([]);
  const battleMapMarkersRef = useRef<MapMarker[]>([]);
  const battleMapGridSizeRef = useRef<number>(25);

  // Campaign sessions (for dropdown)
  const campaignSessions = useCampaignSessions();

  // GM Guides
  const gmGuides = useGMGuides();

  // Stabilize partyMembers for usePartyDm
  const stablePartyMembers = useMemo(() =>
    partyMembers.map(m => ({
      character_name: m.character_name,
      character_status: m.character_status as Record<string, unknown>,
      user_id: m.user_id,
    })),
    [partyMembers]
  );

  // Party DM hook — standalone initialization
  const partyDm = usePartyDm({
    partyId: partyId || null,
    isCreator: isPartyCreator,
    memberCount: partyMembers.length,
    characterName,
    characterContext,
    partyMembers: stablePartyMembers,
    customGuidesContent: gmGuides.enabledContent,
  });

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: useCallback((markersToAdd: MapMarker[], namesToRemove: string[]) => {
      if (markersToAdd.length > 0) setPendingMapAdds(markersToAdd);
      if (namesToRemove.length > 0) setPendingMapRemovals(namesToRemove);
    }, []),
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => battleMapMarkersRef.current, []),
    getGridSize: useCallback(() => battleMapGridSizeRef.current as any, []),
  });

  // Battle map callbacks
  const handleCloseBattleMap = useCallback(() => setShowBattleMap(false), []);
  const handlePendingProcessed = useCallback(() => { setPendingMapAdds([]); setPendingMapRemovals([]); }, []);
  const handleMarkersChange = useCallback((markers: MapMarker[]) => { battleMapMarkersRef.current = markers; }, []);
  const handleGridSizeChange = useCallback((size: any) => { battleMapGridSizeRef.current = size; }, []);

  // Campaign load handler for dropdown
  const handleLoadCampaign = useCallback((session: import('@/hooks/use-campaign-sessions').CampaignSession) => {
    if (partyDm.messages.length > 0) {
      partyDm.saveCampaign('Party Campaign', partyDm.activeCampaignId || undefined);
    }
    partyDm.loadCampaign(session.id, session.messages, session.campaign_summary);
  }, [partyDm.messages.length, partyDm.saveCampaign, partyDm.activeCampaignId, partyDm.loadCampaign]);

  // Auto-start session for creator if not already active
  // (The host needs to start the session; non-creators see "Waiting for Host")

  if (!partyDm.isActive && !isPartyCreator) {
    // Show a waiting state
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

  const battleMapContent = (
    <InlineBattleMap
      characterName={characterName}
      pendingMarkerAdds={pendingMapAdds}
      pendingMarkerRemovals={pendingMapRemovals}
      onPendingProcessed={handlePendingProcessed}
      onMarkersChange={handleMarkersChange}
      onGridSizeChange={handleGridSizeChange}
      onClose={handleCloseBattleMap}
      isHost={isPartyCreator}
      partyBackgroundUrl={partyMapBackgroundUrl}
      partyBackgroundOpacity={partyMapBackgroundOpacity}
      partyTierBackgrounds={partyMapTierBackgrounds}
      partyCustomTiers={partyMapCustomTiers}
      onPartyBackgroundChange={onPartyMapBackgroundChange}
      onPartyBackgroundOpacityChange={onPartyMapBackgroundOpacityChange}
      onPartyTierBackgroundsChange={onPartyMapTierBackgroundsChange}
      onPartyCustomTiersChange={onPartyMapCustomTiersChange}
    />
  );

  return (
    <div className="fixed inset-0 z-[60]">
      <PartyDMScreen
        onBack={onBack}
        partyId={partyId}
        partyDm={partyDm}
        isCreator={isPartyCreator}
        currentUserId={userId}
        memberCount={partyMembers.length}
        members={partyMembers.map(m => ({ user_id: m.user_id, character_name: m.character_name, character_status: m.character_status as Record<string, unknown> }))}
        onShowGuides={() => setShowGuides(true)}
        onShowMap={() => setShowBattleMap(true)}
        onShowSaves={() => setShowSaves(true)}
        onShowChat={onShowChat}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        isExtracting={autoSync.isExtracting}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        characterContext={characterContext}
        showBattleMap={showBattleMap}
        battleMapContent={battleMapContent}
        campaignSessions={campaignSessions.sessions}
        campaignSessionsLoading={campaignSessions.isLoading}
        campaignSessionsSignedIn={campaignSessions.isSignedIn}
        onNewGame={partyDm.startNewCampaign}
        onLoadCampaign={handleLoadCampaign}
        onRefreshCampaigns={campaignSessions.refreshSessions}
      />

      {/* GM Guides Overlay */}
      {showGuides && (
        <GMGuidesManager
          onBack={() => setShowGuides(false)}
          guides={gmGuides.guides}
          totalChars={gmGuides.totalChars}
          campaignSummary={null}
          onCampaignSummaryChange={() => {}}
          onAdd={gmGuides.addGuide}
          onUpdate={gmGuides.updateGuide}
          onDelete={gmGuides.deleteGuide}
          onToggle={gmGuides.toggleGuide}
          chatMessages={partyDm.messages.slice(-20).map(m => ({ role: m.role, content: m.content }))}
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
          isCreator={isPartyCreator}
        />
      )}
    </div>
  );
}
