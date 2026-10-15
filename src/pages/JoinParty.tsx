import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Swords, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import homeBackground from '@/assets/ai-creation-bg.jpeg';
import { clearJoinIntent, isValidPartyCode, normalizePartyCode, readJoinIntent, saveJoinIntent } from '@/lib/party-join-intent';
import { writeReceipt } from '@/lib/ai-creation/party-build-save';

interface SessionRow { sessionId: string; partyId: string; sessionStatus: string; completedSaveId: string | null; campaignLabel: string }

const MESSAGES: Record<string, string> = {
  invalid_code: 'That party code wasn’t found. Check it with your host.',
  party_inactive: 'That party is no longer running.',
  full: 'That party is full (6 players).',
  conflict: 'You’re already in another party. Leave it from that party’s settings first — nothing was changed.',
  rate_limited: 'Too many tries. Wait a few minutes and try again.',
  receipt_not_rejoinable: 'You already finished a character for this party, but your seat is gone. Ask the host to invite you again.',
  context_error: 'The campaign couldn’t be prepared right now. Your code is kept — try again shortly.',
};

/** Party signup entrance: code entry → authenticated begin → creator, or straight to an existing seat. */
export default function JoinParty() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [code, setCode] = useState(() => readJoinIntent()?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [changing, setChanging] = useState(false);

  const openTable = useCallback((s: { sessionId: string; partyId: string; completedSaveId: string }) => {
    if (!user) return;
    const receipt = { sessionId: s.sessionId, partyId: s.partyId, saveId: s.completedSaveId, userId: user.id };
    writeReceipt({ ...receipt, consumed: false });
    clearJoinIntent();
    navigate('/', { replace: true, state: { partyCreationReceipt: receipt } });
  }, [user, navigate]);

  const loadSessions = useCallback(async (): Promise<SessionRow[]> => {
    const { data, error } = await supabase.functions.invoke('party-link', { body: { action: 'onboarding_list' } });
    if (error || !Array.isArray(data)) return [];
    return data as SessionRow[];
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let live = true;
    loadSessions().then(rows => { if (live) setSessions(rows); });
    return () => { live = false; };
  }, [authLoading, user, loadSessions]);

  const submit = useCallback(async () => {
    const c = normalizePartyCode(code);
    setCode(c); setError(null);
    if (!isValidPartyCode(c)) { setError('Party codes are 6 letters or numbers.'); return; }
    saveJoinIntent(c);
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('party-link', { body: { action: 'onboarding_begin', linkCode: c } });
      const status = data?.status as string | undefined;
      if (status && ['ready', 'preparing', 'context_error'].includes(status) && data.sessionId && data.sessionStatus === 'in_progress') {
        clearJoinIntent();
        navigate(`/ai-create?creationSession=${encodeURIComponent(data.sessionId)}`);
        return;
      }
      if (status === 'already_member') {
        const rows = await loadSessions();
        const done = rows.filter(r => r.partyId === data.partyId && r.sessionStatus === 'complete' && r.completedSaveId);
        if (done.length === 1) { openTable({ ...done[0], completedSaveId: done[0].completedSaveId! }); return; }
        clearJoinIntent();
        setError('You’re already in this party. Pick your character from the roster to open its table.');
        return;
      }
      setError(error && !status ? 'We couldn’t reach the server. Your code is kept — try again.' : (MESSAGES[status ?? ''] || 'We couldn’t join right now. Your code is kept — try again.'));
    } finally {
      setBusy(false);
    }
  }, [code, user, navigate, loadSessions, openTable]);

  const goAuth = (view: 'signup' | 'login') => {
    const c = normalizePartyCode(code);
    if (c && !isValidPartyCode(c)) { setError('Party codes are 6 letters or numbers.'); return; }
    if (c) saveJoinIntent(c);
    navigate(`/auth?join=1&view=${view}`);
  };

  const unfinished = (sessions || []).filter(s => s.sessionStatus === 'in_progress');
  const completed = (sessions || []).filter(s => s.sessionStatus === 'complete' && s.completedSaveId);
  const showChoices = !!user && !changing && (unfinished.length > 0 || completed.length > 0);

  return (
    <BackgroundWrapper imagePath={homeBackground} overlayOpacity={70}>
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-primary/40 bg-black/70 p-5">
          <h1 className="font-cinzel text-xl text-primary text-center tracking-widest">Join a Campaign</h1>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {authLoading || (user && sessions === null) ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : showChoices ? (
            <div className="space-y-3">
              {unfinished.map(s => (
                <Button key={s.sessionId} className="w-full min-h-12 justify-start" style={{ touchAction: 'manipulation' }}
                  onClick={() => navigate(`/ai-create?creationSession=${encodeURIComponent(s.sessionId)}`)}>
                  <Swords className="w-4 h-4 mr-2" /> Continue character · {s.campaignLabel}
                </Button>
              ))}
              {completed.map(s => (
                <Button key={s.sessionId} variant="secondary" className="w-full min-h-12 justify-start" style={{ touchAction: 'manipulation' }}
                  onClick={() => openTable({ ...s, completedSaveId: s.completedSaveId! })}>
                  Open table · {s.campaignLabel}
                </Button>
              ))}
              <Button variant="outline" className="w-full min-h-12" style={{ touchAction: 'manipulation' }} onClick={() => setChanging(true)}>
                <KeyRound className="w-4 h-4 mr-2" /> Use a different party code
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input value={code} onChange={e => setCode(normalizePartyCode(e.target.value))} placeholder="Party code (6 characters)"
                inputMode="text" autoCapitalize="characters" autoComplete="off"
                className="w-full h-12 text-lg tracking-[0.3em] text-center font-mono" aria-label="Party code" />
              <p className="text-xs text-muted-foreground text-right">{code.length}/6</p>
              {user ? (
                <Button disabled={busy} onClick={submit} className="w-full min-h-12 font-cinzel tracking-wider" style={{ touchAction: 'manipulation' }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join party'}
                </Button>
              ) : (
                <>
                  <Button onClick={() => goAuth('signup')} className="w-full min-h-12 font-cinzel tracking-wider" style={{ touchAction: 'manipulation' }}>
                    Create account & join
                  </Button>
                  <Button variant="secondary" onClick={() => goAuth('login')} className="w-full min-h-12" style={{ touchAction: 'manipulation' }}>
                    I have an account — sign in to join
                  </Button>
                </>
              )}
              {user && changing && (
                <Button variant="ghost" className="w-full min-h-12" onClick={() => setChanging(false)} style={{ touchAction: 'manipulation' }}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" className="w-full min-h-12 text-muted-foreground" style={{ touchAction: 'manipulation' }}
            onClick={() => { clearJoinIntent(); navigate(user ? '/roster' : '/auth'); }}>
            {user ? 'Go to my characters' : 'Back to sign in'}
          </Button>
        </div>
      </div>
    </BackgroundWrapper>
  );
}
