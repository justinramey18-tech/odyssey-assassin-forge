import { useState, useCallback } from 'react';
import { Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { DirectorEscalation } from '@/hooks/use-party-director-escalations';

interface HostDirectorEscalationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingEscalations: DirectorEscalation[];
  memberDisplayNames: Record<string, string>;
  hostUserId: string | null;
  onApprove: (escalation: DirectorEscalation, hostUserId: string, comment: string) => Promise<boolean>;
  onDeny: (escalation: DirectorEscalation, hostUserId: string, comment: string) => Promise<boolean>;
}

export function HostDirectorEscalationsPanel({
  open, onOpenChange, pendingEscalations, memberDisplayNames, hostUserId, onApprove, onDeny,
}: HostDirectorEscalationsPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const handleApprove = useCallback(async (esc: DirectorEscalation) => {
    if (!hostUserId) return;
    setBusyId(esc.id);
    try {
      const comment = comments[esc.id] || '';
      const ok = await onApprove(esc, hostUserId, comment);
      if (ok) toast.success('Request approved.');
      else toast.error('Failed to approve. Try again.');
    } finally {
      setBusyId(null);
    }
  }, [comments, onApprove, hostUserId]);

  const handleDeny = useCallback(async (esc: DirectorEscalation) => {
    if (!hostUserId) return;
    setBusyId(esc.id);
    try {
      const comment = comments[esc.id] || '';
      const ok = await onDeny(esc, hostUserId, comment);
      if (ok) toast.success('Request denied.');
      else toast.error('Failed to deny. Try again.');
    } finally {
      setBusyId(null);
    }
  }, [comments, onDeny, hostUserId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Director Requests
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {pendingEscalations.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400/30 mx-auto" />
              <p className="text-sm font-cinzel text-foreground">No pending requests</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Players' requests that need your approval will appear here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                These are private requests from your players that the AI flagged for your review.
              </p>
              {pendingEscalations.map(esc => {
                const playerName = memberDisplayNames[esc.user_id] || 'Player';
                const isBusy = busyId === esc.id;
                return (
                  <div key={esc.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-amber-200">{playerName}</p>
                      <p className="text-xs text-white/85 leading-relaxed">"{esc.request_text}"</p>
                      {esc.ai_rationale && (
                        <p className="text-[11px] text-amber-300/70 italic">AI flagged: {esc.ai_rationale}</p>
                      )}
                    </div>
                    <Textarea
                      value={comments[esc.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [esc.id]: e.target.value }))}
                      placeholder="Optional comment (visible to player)"
                      rows={2}
                      maxLength={400}
                      className="text-xs resize-none"
                      disabled={isBusy}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(esc)}
                        disabled={isBusy}
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleDeny(esc)}
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
