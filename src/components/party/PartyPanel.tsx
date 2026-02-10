import { useState } from 'react';
import { Users, Plus, LogIn, LogOut, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PartyMemberCard } from './PartyMemberCard';
import { CreatePartyDialog } from './CreatePartyDialog';
import { JoinPartyDialog } from './JoinPartyDialog';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';

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
  const { party } = partySync;

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-lg border border-border/40 bg-card/40 text-center space-y-2">
        <Users className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Sign in to join a party</p>
      </div>
    );
  }

  const otherMembers = party.members.filter(m => m.user_id !== userId);

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

      {/* Members */}
      <div className="space-y-2">
        {party.members.map(member => (
          <PartyMemberCard
            key={member.id}
            member={member}
            isSelf={member.user_id === userId}
          />
        ))}
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
