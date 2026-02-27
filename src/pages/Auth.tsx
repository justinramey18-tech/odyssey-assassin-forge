import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
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
  const iconBoxClass = "absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-[#3a3228]/80 border-r-2 border-[#8b7355]/50 rounded-l-sm";
  const iconClass = "w-5 h-5 text-[#c4a96a]";
  const inputClass = "w-full pl-14 pr-4 py-3.5 bg-[#d4c8a8] border-2 border-[#9a8a6a] text-[#2a1f14] placeholder:text-[#7a6a4a] rounded-sm font-medium text-base focus:outline-none focus:border-[#d4a030] focus:ring-1 focus:ring-[#d4a030]/50 transition-colors ml-4";

  return (
    <BackgroundWrapper
      imagePath={homeBackground}
      videoSrc="/videos/auth-background.mp4"
      overlayOpacity={0}>

      <div className="min-h-screen flex-col p-4 flex items-center justify-center">
        {/* Container */}
        <div className="w-full max-w-[22rem] flex flex-col items-center scale-[0.64] origin-center mt-[11rem]">
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
              className="w-[calc(100%-3rem)] mx-auto py-3.5 mt-[2.5rem] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:border-[#d4a030] disabled:opacity-50 transition-colors rounded-sm flex items-center justify-center gap-2 bg-[#4b3d2f]/[0.07]"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(212,160,48,0.15), 0 2px 8px rgba(0,0,0,0.5)'
              }}>

                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Summon your hero'}
              </button>

              <div className="flex items-center justify-between mt-5">
                <button
                type="button"
                onClick={() => {switchView('forgot');setResetEmail(email);}}
                className="text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors">

                  Forgot Password?
                </button>
                <button
                type="button"
                onClick={() => switchView('signup')}
                className="text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel transition-colors">

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