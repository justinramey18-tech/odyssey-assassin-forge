import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, User, Lock, KeyRound } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';
import assassinLogo from '@/assets/assassin-logo.png';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthView = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, loading: authLoading } = useAuth();
  
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setSuccess(null);
  };

  const validateInputs = (isSignUp: boolean): boolean => {
    setError(null);
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) { setError(emailResult.error.errors[0].message); return false; }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) { setError(passwordResult.error.errors[0].message); return false; }
    if (isSignUp && password !== confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(false)) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message.includes('Invalid login credentials')
          ? 'Invalid email or password. Please try again.'
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(true)) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message.includes('already registered')
          ? 'This email is already registered. Please sign in instead.'
          : error.message);
      } else {
        setSuccess('Account created successfully! You can now sign in.');
        setEmail(''); setPassword(''); setConfirmPassword('');
      }
    } catch {
      setError('Sign up failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    const result = emailSchema.safeParse(resetEmail);
    if (!result.success) { setError(result.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); }
    else { setSuccess('If an account exists with that email, a password reset link has been sent.'); setResetEmail(''); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Shared input styles
  const inputClass = "w-full pl-11 pr-4 py-3 bg-[#c4b99a]/90 border-2 border-[#8b7355] text-[#2a1f14] placeholder:text-[#6b5a45] rounded-sm font-medium text-sm focus:outline-none focus:border-[#d4a030] focus:ring-1 focus:ring-[#d4a030]/50 transition-colors";
  const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b5a45]";

  return (
    <BackgroundWrapper
      imagePath={homeBackground}
      overlayOpacity={90}
    >
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 flex items-center gap-2 text-[#d4c4a0]/70 hover:text-[#d4a030] transition-colors font-cinzel text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Container */}
        <div className="w-full max-w-xs flex flex-col items-center">
          {/* Emblem */}
          <img
            src={assassinLogo}
            alt="Assassin Ledger Emblem"
            className="w-24 h-24 object-contain mb-4 opacity-90"
          />

          {/* Title */}
          <h1 className="font-cinzel text-[#d4a030] text-2xl tracking-[0.2em] uppercase mb-1">
            Assassin Ledger
          </h1>

          {/* Ornament divider */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-px bg-[#8b7355]" />
            <span className="text-[#d4a030] text-xs">✦</span>
            <div className="w-8 h-px bg-[#8b7355]" />
          </div>

          {/* Alerts */}
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

          {/* LOGIN VIEW */}
          {view === 'login' && (
            <form onSubmit={handleSignIn} className="w-full space-y-4">
              <div className="relative">
                <User className={iconClass} />
                <input
                  type="email"
                  placeholder="Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5a4a3a] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.15em] text-sm hover:bg-[#6b5a45] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log In'}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => { switchView('forgot'); setResetEmail(email); }}
                  className="text-[#d4c4a0]/60 hover:text-[#d4a030] text-xs font-cinzel transition-colors"
                >
                  Forgot Password?
                </button>
                <button
                  type="button"
                  onClick={() => switchView('signup')}
                  className="text-[#d4c4a0]/60 hover:text-[#d4a030] text-xs font-cinzel transition-colors"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP VIEW */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="w-full space-y-4">
              <div className="relative">
                <User className={iconClass} />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5a4a3a] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.15em] text-sm hover:bg-[#6b5a45] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full text-center text-[#d4c4a0]/60 hover:text-[#d4a030] text-xs font-cinzel transition-colors pt-2"
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="w-full space-y-4">
              <p className="text-[#d4c4a0]/70 text-xs text-center font-cinzel mb-2">
                Enter your email to receive a reset link
              </p>
              <div className="relative">
                <KeyRound className={iconClass} />
                <input
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5a4a3a] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.15em] text-sm hover:bg-[#6b5a45] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full text-center text-[#d4c4a0]/60 hover:text-[#d4a030] text-xs font-cinzel transition-colors pt-2"
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* Footer */}
          <p className="text-[#6b5a45] text-[10px] text-center mt-8 font-cinzel tracking-wider">
            Your data is encrypted and stored securely
          </p>
        </div>
      </div>
    </BackgroundWrapper>
  );
}
