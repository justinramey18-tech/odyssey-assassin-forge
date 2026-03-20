import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, KeyRound } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';

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
    if (!emailResult.success) {setError(emailResult.error.errors[0].message);return false;}
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {setError(passwordResult.error.errors[0].message);return false;}
    if (isSignUp && password !== confirmPassword) {setError('Passwords do not match');return false;}
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
        setError(error.message.includes('Invalid login credentials') ?
        'Invalid email or password. Please try again.' :
        error.message);
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
    setError(null);
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        setError(error.message || 'Google sign-in failed. Please try again.');
        setLoading(false);
      }
      // If no error, the page will redirect — no need to setLoading(false)
    } catch {
      setError('Google sign-in failed. Please check your connection and try again.');
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
        setError(error.message.includes('already registered') ?
        'This email is already registered. Please sign in instead.' :
        error.message);
      } else {
        setSuccess('Account created successfully! You can now sign in.');
        setEmail('');setPassword('');setConfirmPassword('');
      }
    } catch {
      setError('Sign up failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);setSuccess(null);
    const result = emailSchema.safeParse(resetEmail);
    if (!result.success) {setError(result.error.errors[0].message);return;}
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    if (error) {setError(error.message);} else
    {setSuccess('If an account exists with that email, a password reset link has been sent.');setResetEmail('');}
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>);

  }

  // Icon box style (dark square with icon)
  const iconBoxClass = "absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-transparent border-none rounded-l-sm";
  const iconClass = "w-5 h-5 text-[#8b7355]";
  const inputClass = "w-full pl-14 pr-4 py-3.5 bg-[#c4b196] border-0 border-none outline-none shadow-none text-[#2a1f14] placeholder:text-[#8a7a60] rounded-sm font-medium text-base focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none appearance-none transition-colors ml-4";

  return (
    <BackgroundWrapper
      imagePath={homeBackground}
      overlayOpacity={70}>

      <div className="min-h-screen flex-col p-4 flex items-center justify-center">
        {/* Container */}
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Alerts */}
          {error &&
          <Alert variant="destructive" className="mb-4 w-full border-red-800/50 bg-red-900/30">
              <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
            </Alert>
          }
          {success &&
          <Alert className="mb-4 w-full border-green-700/50 bg-green-900/30">
              <AlertDescription className="text-green-300 text-sm">{success}</AlertDescription>
            </Alert>
          }

          {/* LOGIN VIEW */}
          {view === 'login' &&
          <form onSubmit={handleSignIn} className="w-full">
              <div className="relative mb-3">
                <div className={iconBoxClass}>
                  <User className={iconClass} />
                </div>
                <input
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass} />

              </div>
              <div className="relative">
                <div className={iconBoxClass}>
                  <Lock className={iconClass} />
                </div>
                <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass} />

              </div>

              <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-4 bg-[#4a3c2e] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:bg-[#5a4a3a] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(212,160,48,0.15), 0 2px 8px rgba(0,0,0,0.5)'
              }}>

                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Summon your hero'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-3 w-[calc(100%-1rem)] mx-auto">
                <div className="flex-1 h-px bg-[#8b7355]/40" />
                <span className="text-[#c4a96a]/50 text-xs font-cinzel uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-[#8b7355]/40" />
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
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

              <div className="flex items-center justify-between -mt-1">
                <button
                type="button"
                onClick={() => {switchView('forgot');setResetEmail(email);}}
                className="text-transparent text-sm font-cinzel transition-colors">

                  Forgot Password?
                </button>
                <button
                type="button"
                onClick={() => switchView('signup')}
                className="text-transparent text-sm font-cinzel transition-colors">

                  Create Account
                </button>
              </div>
            </form>
          }

          {/* SIGNUP VIEW */}
          {view === 'signup' &&
          <form onSubmit={handleSignUp} className="w-full space-y-3">
              <div className="relative">
                <div className={iconBoxClass}>
                  <User className={iconClass} />
                </div>
                <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass} />

              </div>
              <div className="relative">
                <div className={iconBoxClass}>
                  <Lock className={iconClass} />
                </div>
                <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClass} />

              </div>
              <div className="relative">
                <div className={iconBoxClass}>
                  <Lock className={iconClass} />
                </div>
                <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClass} />

              </div>

              <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-1 bg-[#4a3c2e] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:bg-[#5a4a3a] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(212,160,48,0.15), 0 2px 8px rgba(0,0,0,0.5)'
              }}>

                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </button>

              <button
              type="button"
              onClick={() => switchView('login')}
              className="w-full text-center text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors pt-3">

                ← Back to Login
              </button>
            </form>
          }

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' &&
          <form onSubmit={handleForgotPassword} className="w-full space-y-3">
              <p className="text-[#c4a96a]/70 text-sm text-center font-cinzel mb-2">
                Enter your email to receive a reset link
              </p>
              <div className="relative">
                <div className={iconBoxClass}>
                  <KeyRound className={iconClass} />
                </div>
                <input
                type="email"
                placeholder="Email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass} />

              </div>

              <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-1 bg-[#4a3c2e] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:bg-[#5a4a3a] hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(212,160,48,0.15), 0 2px 8px rgba(0,0,0,0.5)'
              }}>

                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </button>

              <button
              type="button"
              onClick={() => switchView('login')}
              className="w-full text-center text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors pt-3">

                ← Back to Login
              </button>
            </form>
          }
        </div>
      </div>
    </BackgroundWrapper>);

}