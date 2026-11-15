// Sign-in page for the separate Empyrean account (account-space.ts). Shown when the phone
// is in the Empyrean space with no login: the first switch, or after signing out there.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Loader2, User, Lock, Copy, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { AI_CREATION_DRAFT_KEY } from '@/lib/creation-guard';
import { currentSpace, takeSwitchError } from '@/lib/account-space';
import { returnToOdyssey } from '@/lib/account-space-switch';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(24, 'Username must be at most 24 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscore or hyphen only');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const RESERVED = new Set(['admin', 'support', 'system', 'root', 'odyssey', 'null', 'undefined', 'lovable']);

type View = 'login' | 'signup' | 'recovery';

function toAuthEmail(usernameOrEmail: string): string {
  const v = usernameOrEmail.trim();
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@odyssey.local`;
}

const tap = { touchAction: 'manipulation' as const };

export default function EmpyreanAuth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [view, setView] = useState<View>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [codeSaved, setCodeSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Where to go once signed in: back to an AI rider that was waiting, else Home. */
  const goIn = () => {
    let draft = false;
    try { draft = !!localStorage.getItem(AI_CREATION_DRAFT_KEY); } catch { /* ignore */ }
    navigate(draft ? '/ai-create' : '/', { replace: true });
  };

  useEffect(() => {
    const msg = takeSwitchError();
    if (msg) toast.error(msg);
  }, []);

  // This page only belongs to the Empyrean space; already signed in → straight in.
  useEffect(() => {
    if (currentSpace() !== 'empyrean') { navigate('/', { replace: true }); return; }
    if (!authLoading && user && view !== 'recovery') goIn();
  }, [authLoading, user, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchView = (v: View) => { setView(v); setError(null); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError('Enter your Empyrean username'); return; }
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) { setError(pw.error.errors[0].message); return; }
    setBusy(true);
    try {
      const { error: err } = await signIn(toAuthEmail(username), password);
      if (err) setError(err.message.includes('Invalid login credentials') ? 'Username or password is incorrect.' : err.message);
      else goIn();
    } catch {
      setError('Sign in failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = usernameSchema.safeParse(username);
    if (!u.success) { setError(u.error.errors[0].message); return; }
    const lower = username.trim().toLowerCase();
    if (RESERVED.has(lower)) { setError('That username is reserved'); return; }
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) { setError(pw.error.errors[0].message); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setBusy(true);
    try {
      try {
        const { data: check } = await supabase.functions.invoke('check-username', { body: { username: lower } });
        if (check && check.available === false) {
          setError(check.error === 'reserved' ? 'That username is reserved.' : 'That username is taken.');
          return;
        }
      } catch { /* non-fatal */ }

      const email = `${lower}@odyssey.local`;
      const { error: err } = await signUp(email, password);
      if (err) {
        setError(err.message.includes('already registered') || err.message.includes('already been registered') ? 'That username is taken.' : err.message);
        return;
      }
      const { data: signed, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      if (siErr || !signed?.session) {
        setPassword(''); setConfirmPassword('');
        setView('login');
        setError('Your Empyrean account was created, but we couldn’t sign you in yet. Sign in with the new username and password.');
        return;
      }
      const code = generateRecoveryCode();
      const { error: rcErr } = await supabase.functions.invoke('set-recovery-code', { body: { code } });
      if (rcErr) toast.error('Your recovery code wasn’t saved yet. You can set one later from Account Settings.');
      setRecoveryCode(code);
      setUsername(''); setPassword(''); setConfirmPassword('');
      setView('recovery');
    } catch (err: any) {
      setError(err?.message || 'Creating the account failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Long-press the code to select it.');
    }
  };

  const input = 'w-full min-h-[48px] rounded-lg bg-black/40 border border-amber-500/25 pl-10 pr-3 text-base text-white placeholder:text-white/35 focus:outline-none focus:border-amber-400/60';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120b1f] via-[#0d0d12] to-[#1a1006] text-white flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🐉</div>
          <h1 className="text-2xl font-cinzel font-bold text-amber-300">Empyrean Account</h1>
          <p className="text-sm text-white/60 mt-2">
            Your riders, dragons and campaigns live here, apart from your Odyssey characters.
          </p>
        </div>

        {view === 'recovery' ? (
          <div className="rounded-xl border border-amber-500/30 bg-black/40 p-4 space-y-4">
            <p className="text-sm text-white/80">Save this recovery code. It is the only way back into this account if you forget the password.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-lg tracking-widest font-mono text-amber-200 bg-black/50 rounded-lg py-3 select-all">{recoveryCode}</code>
              <button onClick={copyCode} style={tap} aria-label="Copy recovery code" className="min-w-[48px] min-h-[48px] rounded-lg border border-amber-500/30 flex items-center justify-center">
                {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5 text-amber-300" />}
              </button>
            </div>
            <label className="flex items-center gap-3 text-sm text-white/75 min-h-[44px]" style={tap}>
              <input type="checkbox" checked={codeSaved} onChange={e => setCodeSaved(e.target.checked)} className="w-5 h-5 accent-amber-400" />
              I saved my recovery code
            </label>
            <button
              onClick={() => { if (!codeSaved) { toast.error('Please confirm you saved your recovery code.'); return; } goIn(); }}
              style={tap}
              className="w-full min-h-[48px] rounded-lg bg-amber-500 text-black font-semibold"
            >
              Enter the Empyrean
            </button>
          </div>
        ) : (
          <form onSubmit={view === 'login' ? handleSignIn : handleSignUp} className="space-y-3">
            <div className="flex rounded-lg border border-amber-500/25 overflow-hidden mb-2">
              {(['login', 'signup'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => switchView(v)}
                  style={tap}
                  className={`flex-1 min-h-[44px] text-sm font-semibold ${view === v ? 'bg-amber-500/20 text-amber-200' : 'text-white/55'}`}
                >
                  {v === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <div className="relative">
              <User className="w-4 h-4 text-amber-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={input} placeholder="Empyrean username" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-amber-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={input} type="password" placeholder="Password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {view === 'signup' && (
              <div className="relative">
                <Lock className="w-4 h-4 text-amber-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={input} type="password" placeholder="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            )}
            {view === 'signup' && (
              <p className="text-xs text-white/45">Use a different username from your Odyssey account, for example yourname-rider.</p>
            )}
            {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
            <button type="submit" disabled={busy} style={tap} className="w-full min-h-[48px] rounded-lg bg-amber-500 text-black font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {view === 'login' ? 'Sign in to the Empyrean' : 'Create Empyrean account'}
            </button>
          </form>
        )}

        {view !== 'recovery' && (
          <button
            onClick={() => { void returnToOdyssey(); }}
            style={tap}
            className="mt-8 w-full min-h-[48px] rounded-lg border border-white/15 text-white/70 text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Odyssey
          </button>
        )}
      </div>
    </div>
  );
}
