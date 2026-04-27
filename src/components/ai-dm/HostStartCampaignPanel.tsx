import { useState, useCallback } from 'react';
import { Loader2, Play, Check, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface PartyMemberOnboardingView {
  user_id: string;
  display_name?: string;
  onboarding_status: 'pending' | 'in_progress' | 'complete';
}

interface HostStartCampaignPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string | null;
  hostUserId: string | null;
  members: PartyMemberOnboardingView[];
  onCampaignStarted: () => void;
}

export function HostStartCampaignPanel({
  open,
  onOpenChange,
  partyId,
  hostUserId,
  members,
  onCampaignStarted,
}: HostStartCampaignPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const hostMember = members.find((m) => m.user_id === hostUserId);
  const otherMembers = members.filter((m) => m.user_id !== hostUserId);
  const hostComplete = hostMember?.onboarding_status === 'complete';
  const allComplete = members.every((m) => m.onboarding_status === 'complete');
  const incompleteCount = members.filter((m) => m.onboarding_status !== 'complete').length;

  const handleStart = useCallback(async () => {
    if (!partyId) return;
    setIsStarting(true);
    try {
      const { error } = await supabase
        .from('parties')
        .update({
          campaign_started: true,
          campaign_started_at: new Date().toISOString(),
        })
        .eq('id', partyId);
      if (error) {
        toast.error(error.message || 'Failed to start campaign.');
        return;
      }
      toast.success('Campaign started.');
      setShowConfirm(false);
      onOpenChange(false);
      onCampaignStarted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start campaign.';
      toast.error(msg);
    } finally {
      setIsStarting(false);
    }
  }, [partyId, onOpenChange, onCampaignStarted]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-cinzel">
              <Play className="w-5 h-5 text-amber-400" />
              Start Campaign
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Each player must finish their character before they can play. You can start the
              campaign whenever you're ready — players who haven't finished will be asked to
              complete their character before they can join.
            </p>

            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Player status
              </h3>
              {hostMember && <MemberStatusRow member={hostMember} isHost />}
              {otherMembers.map((m) => (
                <MemberStatusRow key={m.user_id} member={m} isHost={false} />
              ))}
              {otherMembers.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-2 py-3">
                  No other players have joined yet.
                </p>
              )}
            </div>

            {!allComplete && hostComplete && (
              <div className="flex gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-100">
                  {incompleteCount} {incompleteCount === 1 ? 'player has' : 'players have'} not
                  finished onboarding. They'll be locked out until they complete their character.
                </p>
              </div>
            )}

            {!hostComplete && (
              <div className="flex gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-100">
                  Finish your own character (via the architect) before starting the campaign.
                </p>
              </div>
            )}

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!hostComplete || isStarting}
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {allComplete ? 'Start Campaign' : `Start Anyway (${incompleteCount} locked out)`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {allComplete
                ? 'All players have finished their characters. The campaign will begin now.'
                : `${incompleteCount} ${incompleteCount === 1 ? 'player has' : 'players have'} not finished onboarding. They will be locked out of the campaign until they complete their character. You can continue playing without them.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStart} disabled={isStarting}>
              {isStarting ? 'Starting...' : 'Start Campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MemberStatusRow({
  member,
  isHost,
}: {
  member: PartyMemberOnboardingView;
  isHost: boolean;
}) {
  const status = member.onboarding_status;
  const config = (() => {
    if (status === 'complete')
      return {
        icon: Check,
        color: 'text-emerald-300',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        label: 'Ready',
      };
    if (status === 'in_progress')
      return {
        icon: Clock,
        color: 'text-amber-300',
        bg: 'bg-amber-500/10 border-amber-500/30',
        label: 'Onboarding',
      };
    return {
      icon: Clock,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10 border-slate-500/30',
      label: 'Pending',
    };
  })();
  const Icon = config.icon;
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border ${config.bg}`}>
      <div className="text-sm text-foreground truncate">
        {isHost ? 'You (host)' : member.display_name || 'Player'}
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </div>
    </div>
  );
}
