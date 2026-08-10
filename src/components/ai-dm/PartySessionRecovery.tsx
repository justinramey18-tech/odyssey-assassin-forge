import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw, LogIn, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JoinPartyDialog } from '@/components/party/JoinPartyDialog';
import { setScopedItem } from '@/lib/scoped-storage';

interface PartySessionRecoveryProps {
  /** Leave the party screen */
  onBack: () => void;
  /** Seconds of spinner before the recovery panel appears */
  delayMs?: number;
}

/**
 * Shown instead of an endless "Loading session..." spinner when the app can't
 * work out which party the player belongs to. After a short delay it offers a
 * retry (live membership lookup), a rejoin-by-code path, and a way out.
 */
export function PartySessionRecovery({ onBack, delayMs = 5000 }: PartySessionRecoveryProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowPanel(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const enterParty = useCallback((partyId: string) => {
    // Tell the on-load party lookup exactly which party to connect to
    setScopedItem('odyssey-active-party-id', partyId);
    window.location.reload();
  }, []);

  const handleRetry = useCallback(async () => {
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        toast.error('Sign in to rejoin your party');
        return;
      }
      const { data } = await supabase
        .from('party_members')
        .select('party_id, joined_at, parties!inner(is_active)')
        .eq('user_id', userId)
        .eq('parties.is_active', true)
        .order('joined_at', { ascending: false })
        .limit(1) as { data: Array<{ party_id: string }> | null };

      if (data && data.length > 0) {
        toast.success('Party found — reconnecting');
        enterParty(data[0].party_id);
        return;
      }
      toast.error("You're not in an active party yet — try the link code");
    } catch {
      toast.error('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }, [enterParty]);

  const handleJoin = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('party-link', {
        body: { action: 'join', linkCode: code, characterName: 'Adventurer', characterStatus: {} },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const partyId = res.data?.party?.id;
      if (res.error || res.data?.error || !partyId) {
        toast.error(res.data?.error || 'Could not join with that code');
        return;
      }
      toast.success('Joined — opening the session');
      enterParty(partyId);
    } catch {
      toast.error('Could not join with that code');
    } finally {
      setBusy(false);
      setJoinOpen(false);
    }
  }, [enterParty]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {!showPanel ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-white/50">Loading session...</p>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-cinzel text-foreground">Still finding your party</h2>
            <p className="text-sm text-muted-foreground">
              We couldn't work out which party this character belongs to. Reconnect below —
              your campaign and its history are safe.
            </p>
          </div>
          <div className="space-y-2.5">
            <Button
              onClick={handleRetry}
              disabled={busy}
              className="w-full h-12 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              style={{ touchAction: 'manipulation' }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => setJoinOpen(true)}
              disabled={busy}
              className="w-full h-12 gap-2"
              style={{ touchAction: 'manipulation' }}
            >
              <LogIn className="w-4 h-4" />
              Rejoin with code
            </Button>
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full h-12 gap-2 text-muted-foreground"
              style={{ touchAction: 'manipulation' }}
            >
              <Home className="w-4 h-4" />
              Back
            </Button>
          </div>
        </div>
      )}

      <JoinPartyDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoin={handleJoin}
        isLoading={busy}
      />
    </div>
  );
}
