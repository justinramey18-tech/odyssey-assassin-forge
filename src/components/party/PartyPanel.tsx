import { useState, useMemo } from 'react';
import { Users, Plus, LogIn, LogOut, Trash2, Copy, Check, Dices, Package, Crosshair, MessageSquare, Vote, Map, Swords } from 'lucide-react';
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type { UsePartySyncReturn, PartyMember } from '@/hooks/use-party-sync';

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
}

export function PartyPanel({ partySync, characterName, currentStatus, isAuthenticated, userId }: PartyPanelProps) {
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
  const { party } = partySync;

  const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];
  const memberColors = useMemo(() => {
    const colors: Record<string, string> = {};
    party.members.forEach((m, i) => {
      colors[m.user_id] = MEMBER_COLORS[i % MEMBER_COLORS.length];
    });
    return colors;
  }, [party.members]);

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
            {party.members.length}/4
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
      <div className="space-y-2">
        {party.members.map(member => (
          <PartyMemberCard
            key={member.id}
            member={member}
            isSelf={member.user_id === userId}
            onViewActions={(m) => setSelectedMember(m)}
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
        <Collapsible open={showChat} onOpenChange={setShowChat}>
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

      {/* Actions */}
      <div className="pt-2 border-t border-border/30">
        {party.isCreator ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={partySync.disbandParty}
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
    </div>
  );
}
