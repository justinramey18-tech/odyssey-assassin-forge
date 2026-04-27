import { useState, useCallback } from 'react';
import { Loader2, Check, X, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { OnboardingRequest } from '@/hooks/use-party-onboarding-requests';

interface HostOnboardingRequestsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingRequests: OnboardingRequest[];
  memberDisplayNames: Record<string, string>;
  onApprove: (request: OnboardingRequest) => Promise<boolean>;
  onDeny: (requestId: string) => Promise<boolean>;
}

export function HostOnboardingRequestsPanel({
  open, onOpenChange, pendingRequests, memberDisplayNames, onApprove, onDeny,
}: HostOnboardingRequestsPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = useCallback(async (request: OnboardingRequest) => {
    setBusyId(request.id);
    try {
      const ok = await onApprove(request);
      if (ok) toast.success('Request approved. Player will redo their character.');
      else toast.error('Failed to approve. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [onApprove]);

  const handleDeny = useCallback(async (request: OnboardingRequest) => {
    setBusyId(request.id);
    try {
      const ok = await onDeny(request.id);
      if (ok) toast.success('Request denied.');
      else toast.error('Failed to deny. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [onDeny]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[70vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Onboarding Requests
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <MessageCircle className="w-8 h-8 text-amber-400/30 mx-auto" />
              <p className="text-sm font-cinzel text-foreground">No pending requests</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Players can request to redo their character. Requests will appear here for your approval.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                Approving a request resets the player's character. They'll go through onboarding again.
              </p>
              {pendingRequests.map(req => {
                const playerName = memberDisplayNames[req.user_id] || 'Player';
                const isBusy = busyId === req.id;
                return (
                  <div key={req.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-200">{playerName}</p>
                      {req.reason ? (
                        <p className="text-xs text-white/85 italic leading-relaxed">"{req.reason}"</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No reason provided.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(req)}
                        disabled={isBusy}
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleDeny(req)}
                        disabled={isBusy}
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Deny
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
