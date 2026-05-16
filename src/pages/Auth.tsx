import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { toast } from 'sonner';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(24, 'Username must be at most 24 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscore or hyphen only');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const RESERVED = new Set(['admin', 'support', 'system', 'root', 'odyssey', 'null', 'undefined', 'lovable']);

type AuthView = 'login' | 'signup' | 'recovery-shown';

function toAuthEmail(usernameOrEmail: string): string {
  const v = usernameOrEmail.trim();
  if (v.includes('@')) return v.toLowerCase();
  return `${v.toLowerCase()}@odyssey.local`;
}

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, loading: authLoading } = useAuth();

  const [view, setView] = useState<AuthView>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Recovery-shown view state
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setSuccess(null);
  };

  const validateLogin = (): boolean => {
    setError(null);
    if (!username.trim()) { setError('Enter your username'); return false; }
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) { setError(pw.error.errors[0].message); return false; }
    return true;
  };

  const validateSignup = (): boolean => {
    setError(null);
    const u = usernameSchema.safeParse(username);
    if (!u.success) { setError(u.error.errors[0].message); return false; }
    if (RESERVED.has(username.trim().toLowerCase())) { setError('That username is reserved'); return false; }
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) { setError(pw.error.errors[0].message); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true); setError(null);
    try {
      const email = toAuthEmail(username);
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message.includes('Invalid login credentials')
          ? 'Username or password is incorrect.'
          : error.message);
      } else {
        navigate('/roster');
      }
    } catch {
      setError('Sign in failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null); setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (error) { setError(error.message || 'Google sign-in failed.'); setLoading(false); }
    } catch {
      setError('Google sign-in failed. Please check your connection.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignup()) return;
    setLoading(true); setError(null);

    try {
      // Pre-check username availability
      const lower = username.trim().toLowerCase();
      try {
        const { data: check } = await supabase.functions.invoke('check-username', { body: { username: lower } });
        if (check && check.available === false) {
          setError(check.error === 'reserved' ? 'That username is reserved.' : 'That username is taken.');
          setLoading(false); return;
        }
      } catch { /* non-fatal */ }

      const email = `${lower}@odyssey.local`;
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message.includes('already registered') || error.message.includes('already been registered')
          ? 'That username is taken.' : error.message);
        setLoading(false);
        return;
      }

      // Ensure session (auto-confirm is on, but signIn to be sure)
      await supabase.auth.signInWithPassword({ email, password });

      // Generate code, store hash via edge function
      const code = generateRecoveryCode();
      const { error: rcErr } = await supabase.functions.invoke('set-recovery-code', { body: { code } });
      if (rcErr) {
        // Account exists; surface but continue to recovery view so user has at least a chance to save it
        console.error('[Auth] set-recovery-code failed', rcErr);
        toast.error('Could not save recovery code. You can generate one later from Account Settings.');
      }
      setRecoveryCode(code);
      setUsername(''); setPassword(''); setConfirmPassword('');
      setView('recovery-shown');
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
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

  const continueAfterRecovery = () => {
    if (!saved) {
      toast.error('Please confirm you saved your recovery code.');
      return;
    }
    navigate('/roster');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const iconBoxClass = 'absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-transparent border-none rounded-l-sm';
  const iconClass = 'w-5 h-5 text-[#8b7355]';
  const inputClass = 'w-full pl-14 pr-4 py-3.5 bg-[#c4b196] border-0 border-none outline-none shadow-none text-[#2a1f14] placeholder:text-[#8a7a60] rounded-sm font-medium text-base focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none appearance-none transition-colors ml-4';
  const goldBtn = 'w-full py-3.5 mt-4 bg-[#4a3c2e] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:bg-[#5a4a3a] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2';
  const goldBtnStyle = { boxShadow: 'inset 0 1px 0 rgba(212,160,48,0.15), 0 2px 8px rgba(0,0,0,0.5)' };

  return (
    <BackgroundWrapper imagePath={homeBackground} overlayOpacity={70}>
      <div className="min-h-screen flex-col p-4 flex items-center justify-center">
        <div className="w-full max-w-sm flex flex-col items-center">
          {error && (
            <Alert variant="destructive" className="mb-4 w-full border-red-800/50 bg-red-900/30">
              <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 w-full border-green-700/50 bg-green-900/30">
              <AlertDescription className="text-green-300 text-sm">{success}</AlertDescription>
            </Alert>
          )}

          {view === 'login' && (
            <form onSubmit={handleSignIn} className="w-full">
              <div className="relative mb-3">
                <div className={iconBoxClass}><User className={iconClass} /></div>
                <input
                  type="text" placeholder="Username" value={username}
                  onChange={(e) => setUsername(e.target.value)} required
                  autoComplete="username" className={inputClass}
                />
              </div>
              <div className="relative">
                <div className={iconBoxClass}><Lock className={iconClass} /></div>
                <input
                  type="password" placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  autoComplete="current-password" className={inputClass}
                />
              </div>

              <button type="submit" disabled={loading} className={goldBtn} style={goldBtnStyle}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Summon your hero'}
              </button>

              <div className="flex items-center gap-3 my-3 w-[calc(100%-1rem)] mx-auto">
                <div className="flex-1 h-px bg-[#8b7355]/40" />
                <span className="text-[#c4a96a]/50 text-xs font-cinzel uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-[#8b7355]/40" />
              </div>

              <button
                type="button" onClick={handleGoogleSignIn} disabled={loading}
                className="w-[calc(100%-1rem)] mx-auto py-3 bg-[#c4b196] border-none text-[#2a1f14] font-cinzel uppercase tracking-[0.15em] text-sm disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2.5 hover:bg-[#d4c4a8]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center justify-between -mt-1 mt-3">
                <button type="button" onClick={() => navigate('/recover-account')}
                  className="text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors">
                  Forgot Password?
                </button>
                <button type="button" onClick={() => switchView('signup')}
                  className="text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors">
                  Create Account
                </button>
              </div>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="w-full space-y-3">
              <div className="relative">
                <div className={iconBoxClass}><User className={iconClass} /></div>
                <input
                  type="text" placeholder="Username (3-24 chars)" value={username}
                  onChange={(e) => setUsername(e.target.value)} required
                  autoComplete="username" className={inputClass}
                />
              </div>
              <div className="relative">
                <div className={iconBoxClass}><Lock className={iconClass} /></div>
                <input
                  type="password" placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  autoComplete="new-password" className={inputClass}
                />
              </div>
              <div className="relative">
                <div className={iconBoxClass}><Lock className={iconClass} /></div>
                <input
                  type="password" placeholder="Confirm Password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} required
                  autoComplete="new-password" className={inputClass}
                />
              </div>

              <button type="submit" disabled={loading} className={goldBtn} style={goldBtnStyle}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </button>

              <button type="button" onClick={() => switchView('login')}
                className="w-full text-center text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors pt-3">
                ← Back to Login
              </button>
            </form>
          )}

          {view === 'recovery-shown' && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-center gap-2 text-[#d4a030] font-cinzel uppercase tracking-widest text-sm">
                <ShieldAlert className="w-5 h-5" />
                Save Your Recovery Code
              </div>
              <p className="text-[#c4a96a]/80 text-sm text-center leading-relaxed">
                This is the <span className="text-[#d4a030] font-bold">only</span> way to reset your password.
                We have no email to send a reset link to. Write it down or store it in a password manager.
                You will not see it again.
              </p>

              <div className="bg-[#1a1410] border-2 border-[#8b7355] rounded-sm p-4">
                <div className="font-mono text-center text-2xl text-[#d4c4a0] tracking-[0.2em] select-all break-all">
                  {recoveryCode}
                </div>
              </div>

              <button onClick={copyCode}
                className="w-full py-3 bg-[#c4b196] text-[#2a1f14] font-cinzel uppercase tracking-[0.15em] text-sm rounded-sm flex items-center justify-center gap-2 hover:bg-[#d4c4a8]">
                {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Code</>}
              </button>

              <label className="flex items-start gap-2 text-[#c4a96a]/80 text-sm cursor-pointer">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#d4a030]" />
                <span>I have saved my recovery code somewhere safe.</span>
              </label>

              <button onClick={continueAfterRecovery} disabled={!saved}
                className={goldBtn} style={goldBtnStyle}>
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </BackgroundWrapper>
  );
}
