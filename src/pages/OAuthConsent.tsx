import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id') ?? '';
  const [details, setDetails] = useState<any>(null);
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!authorizationId) return setError('This connection link is missing its request code.');
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          const next = window.location.pathname + window.location.search;
          window.location.href = '/auth?next=' + encodeURIComponent(next);
          return;
        }
        setEmail(sess.session.user.email ?? '');
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load this request.');
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) { setBusy(false); return setError(error.message); }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); return setError('No return address was given.'); }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : (approve ? 'Approve failed.' : 'Deny failed.'));
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? 'An app';
  const redirect = details?.redirect_uri ?? details?.client?.redirect_uris?.[0];

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4">
        {error ? (
          <p className="text-destructive text-sm">Could not load this connection request: {error}</p>
        ) : !details ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="font-cinzel text-xl">Connect {clientName} to Odyssey</h1>
            <p className="text-sm text-muted-foreground">This lets {clientName} use this app as you{email ? ` (${email.replace('@odyssey.local', '')})` : ''}.</p>
            {redirect && <p className="text-xs text-muted-foreground break-all">Returns to: {redirect}</p>}
            {details?.scope && <p className="text-xs text-muted-foreground">Requested: {String(details.scope)}</p>}
            <p className="text-xs text-muted-foreground">Only the app owner's account is allowed to use the data bridge.</p>
            <Button className="w-full min-h-12" style={{ touchAction: 'manipulation' }} disabled={busy} onClick={() => decide(true)}>Approve</Button>
            <Button variant="outline" className="w-full min-h-12" style={{ touchAction: 'manipulation' }} disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
          </>
        )}
      </div>
    </main>
  );
}
