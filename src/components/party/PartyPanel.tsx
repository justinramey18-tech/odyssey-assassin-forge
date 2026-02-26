import { useState, useMemo, useCallback } from 'react';
import { Users, Plus, LogIn, LogOut, Trash2, Copy, Check, Dices, Package, Crosshair, MessageSquare, Vote, Map, Swords, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PartyMemberCard } from './PartyMemberCard';
import { PartyPingBar } from './PartyPingBar';
import { CreatePartyDialog } from './CreatePartyDialog';
import { JoinPartyDialog } from './JoinPartyDialog';
import { PartyRollFeed } from './PartyRollFeed';
import { PartyFocusTargetBanner } from './PartyFocusTargetBanner';
import { PartyLootQueue } from './PartyLootQueue';
import { PartyMemberQuickActionsViewer } from './PartyMemberQuickActionsViewer';
import { PartyChat } from './PartyChat';
import { PartyVote } from './PartyVote';
import { PartyBattleMap } from './PartyBattleMap';
import { PartyCombatLog } from './PartyCombatLog';
import { SendItemScreen } from './SendItemScreen';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { requestPartyNotificationPermission } from '@/lib/party-notifications';
import type { UsePartySyncReturn, PartyMember } from '@/hooks/use-party-sync';
import { useOnlineStatus } from '@/hooks/use-online-status';
import type { InventoryItem } from '@/lib/consumables/types';
import type { CharacterEquipment } from '@/lib/inventory/types';
import type { LootItem } from '@/lib/loot/types';
import { supabase } from '@/integrations/supabase/client';
import { MAX_BACKGROUND_SIZE_MB } from './battlemap/types';

interface PartyPanelProps {
  partySync: UsePartySyncReturn;
  characterName: string;
  currentStatus: {
    currentHP?: number;
    maxHP?: number;
    tempHP?: number;
    ac?: number;
    conditions?: string[];
    level?: number;
    className?: string;
  };
  isAuthenticated: boolean;
  userId?: string;
  onOpenAIDM?: () => void;
  // Trade props
  currentGold?: number;
  consumablesInventory?: InventoryItem[];
  equipment?: CharacterEquipment;
  lootItems?: LootItem[];
  onSendGold?: (targetUserId: string, amount: number) => void;
  onSendConsumable?: (targetUserId: string, item: InventoryItem) => void;
  onSendGear?: (targetUserId: string, item: import('@/lib/inventory/types').EquipmentItem) => void;
  onSendLoot?: (targetUserId: string, item: LootItem) => void;
}

export function PartyPanel({ partySync, characterName, currentStatus, isAuthenticated, userId, onOpenAIDM, currentGold, consumablesInventory, equipment, lootItems, onSendGold, onSendConsumable, onSendGear, onSendLoot }: PartyPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showRolls, setShowRolls] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showCombatLog, setShowCombatLog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<PartyMember | null>(null);
  const [sendToMember, setSendToMember] = useState<PartyMember | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgOpacity, setBgOpacity] = useState<number>(1);
  const { party } = partySync;
  const onlineStatusMap = useOnlineStatus(party.members);

  const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];
  const memberColors = useMemo(() => {
    const colors: Record<string, string> = {};
    party.members.forEach((m, i) => {
      colors[m.user_id] = MEMBER_COLORS[i % MEMBER_COLORS.length];
    });
    return colors;
  }, [party.members]);

  const handleTierBackgroundUpload = useCallback(async (tierId: string, file: File) => {
    if (file.size > MAX_BACKGROUND_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_BACKGROUND_SIZE_MB}MB`);
      return;
    }
    setBgUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `battlemap-backgrounds/party-${party.partyId}-tier-${tierId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('gear-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('gear-images').getPublicUrl(path);
      const updated = [...partySync.mapTierBackgrounds.filter(b => b.tierId !== tierId), { tierId, imageUrl: publicUrl }];
      await partySync.updateMapTierBackgrounds(updated);
      toast.success('Layer image set');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBgUploading(false);
    }
  }, [party.partyId, partySync]);

  const handleTierBackgroundRemove = useCallback(async (tierId: string) => {
    const updated = partySync.mapTierBackgrounds.filter(b => b.tierId !== tierId);
    await partySync.updateMapTierBackgrounds(updated);
    toast.success('Layer image removed');
  }, [partySync]);

  const handleOpacityChange = useCallback(async (opacity: number) => {
    setBgOpacity(opacity);
    await partySync.updateMapBackgroundOpacity(opacity);
  }, [partySync]);

  const handleTierConfigChange = useCallback(async (tierId: string, updates: Partial<{ distancePerSquare: number; distanceUnit: string }>) => {
    const current = partySync.mapCustomTiers || [];
    const updated = current.map(t => t.id === tierId ? { ...t, ...updates } : t);
    // If the tier isn't in the array yet, add it
    if (!updated.find(t => t.id === tierId)) {
      updated.push({ id: tierId, distancePerSquare: updates.distancePerSquare ?? 5, distanceUnit: updates.distanceUnit ?? 'ft' });
    }
    await partySync.updateMapCustomTiers(updated);
  }, [partySync]);

  const handleChatOpenChange = useCallback((open: boolean): void => {
    setShowChat(open);
    if (open) {
      void requestPartyNotificationPermission();
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-lg border border-border/40 bg-card/40 text-center space-y-2">
        <Users className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Sign in to join a party</p>
      </div>
    );
  }

  // Not in a party
  if (!party.partyId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-cinzel font-semibold text-sm">Party Link</span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreate(true)}
            className="flex-1 gap-2 h-12"
            disabled={party.isLoading}
          >
            <Plus className="w-4 h-4" />
            Create Party
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowJoin(true)}
            className="flex-1 gap-2 h-12"
            disabled={party.isLoading}
          >
            <LogIn className="w-4 h-4" />
            Join Party
          </Button>
        </div>

        <CreatePartyDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onConfirm={async () => {
            const code = await partySync.createParty(characterName, currentStatus);
            if (code) {
              setShowCreate(false);
            }
          }}
          isLoading={party.isLoading}
        />

        <JoinPartyDialog
          open={showJoin}
          onOpenChange={setShowJoin}
          onJoin={async (code) => {
            const success = await partySync.joinParty(code, characterName, currentStatus);
            if (success) {
              setShowJoin(false);
            }
          }}
          isLoading={party.isLoading}
        />
      </div>
    );
  }

  // In a party
  const handleCopyCode = async () => {
    if (party.linkCode) {
      await navigator.clipboard.writeText(party.linkCode);
      setCodeCopied(true);
      toast.success('Party code copied!');
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with code */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-cinzel font-semibold text-sm">Party</span>
          <span className="text-[10px] text-muted-foreground">
            {party.members.length}/6
          </span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
        >
          <span className="font-mono text-xs font-bold text-primary tracking-wider">
            {party.linkCode}
          </span>
          {codeCopied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-primary" />
          )}
        </button>
      </div>

      {/* Focus Target Banner */}
      {partySync.focusTarget && (
        <PartyFocusTargetBanner
          target={partySync.focusTarget}
          onClear={partySync.clearFocusTarget}
          canClear={true}
        />
      )}

      {/* Members */}
      <div className={cn(
        party.members.length >= 5
          ? "grid grid-cols-2 gap-2"
          : "space-y-2"
      )}>
        {party.members.map(member => (
          <PartyMemberCard
            key={member.id}
            member={member}
            isSelf={member.user_id === userId}
            onViewActions={(m) => setSelectedMember(m)}
            onSendItem={(m) => setSendToMember(m)}
            onlineInfo={onlineStatusMap[member.user_id]}
            compact={party.members.length >= 5}
          />
        ))}
      </div>

      {/* Quick Actions Viewer */}
      <PartyMemberQuickActionsViewer
        member={selectedMember}
        open={!!selectedMember}
        onOpenChange={(open) => { if (!open) setSelectedMember(null); }}
      />

      {/* Tactical Pings */}
      <div className="pt-2 border-t border-border/30">
        <PartyPingBar
          onSendPing={(pingType) => partySync.sendPing(pingType, characterName)}
        />
      </div>

      {/* Shared Dice Rolls - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showRolls} onOpenChange={setShowRolls}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <Dices className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Party Rolls</span>
            {partySync.partyRolls.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {partySync.partyRolls.length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyRollFeed rolls={partySync.partyRolls} currentUserId={userId} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Party Loot Queue - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showLoot} onOpenChange={setShowLoot}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Party Loot</span>
            {partySync.partyLoot.filter(l => !l.claimed_by_user_id).length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 rounded-full ml-auto">
                {partySync.partyLoot.filter(l => !l.claimed_by_user_id).length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyLootQueue
              loot={partySync.partyLoot}
              currentUserId={userId}
              characterName={characterName}
              onClaim={partySync.claimLoot}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Party Chat - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showChat} onOpenChange={handleChatOpenChange}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Party Chat</span>
            {!showChat && partySync.partyMessages.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {partySync.partyMessages.length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyChat
              messages={partySync.partyMessages}
              currentUserId={userId}
              onSend={(msg) => partySync.sendMessage(msg, characterName)}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Party Votes - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showVotes} onOpenChange={setShowVotes}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <Vote className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Party Votes</span>
            {partySync.activeVote && !partySync.activeVote.closed && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded-full ml-auto">
                Active
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyVote
              activeVote={partySync.activeVote}
              currentUserId={userId}
              characterName={characterName}
              memberCount={party.members.length}
              onStartVote={(q, opts) => partySync.startVote(q, opts, characterName)}
              onCastVote={(label) => partySync.castVote(label, characterName)}
              onCloseVote={partySync.closeVote}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Battle Map - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showMap} onOpenChange={setShowMap}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <Map className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Battle Map</span>
            {partySync.mapMarkers.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {partySync.mapMarkers.length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyBattleMap
              markers={partySync.mapMarkers}
              currentUserId={userId}
              characterName={characterName}
              memberColors={memberColors}
              onPlaceMarker={async (marker) => {
                const newMarkers = [...partySync.mapMarkers.filter(m => !(m.ownerUserId === userId && !m.isEnemy && !marker.isEnemy)), { ...marker, ownerUserId: userId! }];
                await partySync.updateMapMarkers(newMarkers);
              }}
              onRemoveMarker={async (x, y) => {
                const newMarkers = partySync.mapMarkers.filter(m => !(m.x === x && m.y === y));
                await partySync.updateMapMarkers(newMarkers);
              }}
              onMoveMarker={async (fromX, fromY, toX, toY) => {
                const newMarkers = partySync.mapMarkers.map(m =>
                  m.x === fromX && m.y === fromY ? { ...m, x: toX, y: toY } : m
                );
                await partySync.updateMapMarkers(newMarkers);
              }}
              backgroundUrl={partySync.mapBackgroundUrl}
              backgroundUploading={bgUploading}
              backgroundOpacity={partySync.mapBackgroundOpacity}
              onBackgroundOpacityChange={handleOpacityChange}
              tierBackgrounds={partySync.mapTierBackgrounds}
              onTierBackgroundUpload={handleTierBackgroundUpload}
              onTierBackgroundRemove={handleTierBackgroundRemove}
              customTiers={partySync.mapCustomTiers}
              onTierConfigChange={handleTierConfigChange}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Party Combat Log - Collapsible */}
      <div className="pt-2 border-t border-border/30">
        <Collapsible open={showCombatLog} onOpenChange={setShowCombatLog}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/10 rounded px-1 transition-colors">
            <Swords className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Combat Log</span>
            {partySync.combatLog.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {partySync.combatLog.length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <PartyCombatLog
              entries={partySync.combatLog}
              currentUserId={userId}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Party DM Session */}
      <div className="pt-2 border-t border-border/30">
        <button
          onClick={onOpenAIDM}
          className="flex items-center gap-2 w-full py-1.5 hover:bg-muted/10 rounded px-1 transition-colors"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold">Party DM</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {party.isCreator ? 'Host' : 'Join'}
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-border/30">
      {party.isCreator ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              toast('Are you sure you want to disband the party?', {
                description: 'This will remove all members and cannot be undone.',
                action: {
                  label: 'Disband',
                  onClick: () => partySync.disbandParty(),
                },
                cancel: {
                  label: 'Cancel',
                  onClick: () => {},
                },
                duration: 10000,
              });
            }}
            className="w-full gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Disband Party
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={partySync.leaveParty}
            className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave Party
          </Button>
        )}
      </div>

      {/* Send Item Screen (full-screen overlay) */}
      {sendToMember && (
        <SendItemScreen
          targetMember={sendToMember}
          currentGold={currentGold ?? 0}
          consumablesInventory={consumablesInventory ?? []}
          equipment={equipment ?? { slots: {} as any, inventory: [] }}
          lootItems={lootItems ?? []}
          onSendGold={(amount) => {
            onSendGold?.(sendToMember.user_id, amount);
            setSendToMember(null);
          }}
          onSendConsumable={(item) => {
            onSendConsumable?.(sendToMember.user_id, item);
            setSendToMember(null);
          }}
          onSendGear={(item) => {
            onSendGear?.(sendToMember.user_id, item);
            setSendToMember(null);
          }}
          onSendLoot={(item) => {
            onSendLoot?.(sendToMember.user_id, item);
            setSendToMember(null);
          }}
          onClose={() => setSendToMember(null)}
        />
      )}
    </div>
  );
}
