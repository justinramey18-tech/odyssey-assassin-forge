import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, Lock, KeyRound } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';
import authVideo from '@/assets/auth-background.mp4';
import authEmblem from '@/assets/auth-emblem.png';

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
        setSuccess('Account created! You can now sign in.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setView('login');
      }
    } catch {
      setError('Sign up failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const result = emailSchema.safeParse(email);
    if (!result.success) { setError(result.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); }
    else { setSuccess('If an account exists with that email, a reset link has been sent.'); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BackgroundWrapper
      imagePath={homeBackground}
      videoSrc={authVideo}
      overlayOpacity={40}
    >
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* Emblem */}
        <img
          src={authEmblem}
          alt="Assassin Ledger Emblem"
          className="w-28 h-28 object-contain mb-2 drop-shadow-[0_0_20px_rgba(212,175,55,0.4)]"
        />

        {/* Title */}
        <h1
          className="font-cinzel text-3xl sm:text-4xl tracking-[0.2em] text-center mb-1"
          style={{ color: '#d4af37', textShadow: '0 0 20px rgba(212,175,55,0.5), 0 2px 4px rgba(0,0,0,0.8)' }}
        >
          ASSASSIN LEDGER
        </h1>

        {/* Decorative divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-px" style={{ background: 'linear-gradient(to right, transparent, #d4af37)' }} />
          <span style={{ color: '#d4af37' }} className="text-xs">✦</span>
          <div className="w-8 h-px" style={{ background: 'linear-gradient(to left, transparent, #d4af37)' }} />
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="w-full max-w-xs mb-3 px-3 py-2 rounded border text-sm text-center"
            style={{ borderColor: 'rgba(220,38,38,0.5)', background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="w-full max-w-xs mb-3 px-3 py-2 rounded border text-sm text-center"
            style={{ borderColor: 'rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={view === 'login' ? handleSignIn : view === 'signup' ? handleSignUp : handleForgotPassword}
          className="w-full max-w-xs space-y-3"
        >
          {/* Email */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#d4af37' }} />
            <input
              type="email"
              placeholder={view === 'forgot' ? 'Email address' : 'Username'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full pl-10 pr-4 py-3 rounded font-cinzel text-sm tracking-wide placeholder:text-stone-500 focus:outline-none focus:ring-1"
              style={{
                background: 'linear-gradient(to right, rgba(62,50,30,0.85), rgba(82,68,40,0.85))',
                border: '1px solid rgba(212,175,55,0.3)',
                color: '#e8dcc8',
                
              }}
            />
          </div>

          {/* Password */}
          {view !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#d4af37' }} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-4 py-3 rounded font-cinzel text-sm tracking-wide placeholder:text-stone-500 focus:outline-none focus:ring-1"
                style={{
                  background: 'linear-gradient(to right, rgba(62,50,30,0.85), rgba(82,68,40,0.85))',
                  border: '1px solid rgba(212,175,55,0.3)',
                  color: '#e8dcc8',
                }}
              />
            </div>
          )}

          {/* Confirm Password */}
          {view === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#d4af37' }} />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded font-cinzel text-sm tracking-wide placeholder:text-stone-500 focus:outline-none focus:ring-1"
                style={{
                  background: 'linear-gradient(to right, rgba(62,50,30,0.85), rgba(82,68,40,0.85))',
                  border: '1px solid rgba(212,175,55,0.3)',
                  color: '#e8dcc8',
                }}
              />
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-cinzel text-base tracking-[0.15em] uppercase transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'linear-gradient(to bottom, rgba(212,175,55,0.9), rgba(160,120,30,0.9))',
              border: '1px solid rgba(212,175,55,0.6)',
              color: '#1a1206',
              textShadow: '0 1px 0 rgba(255,255,255,0.2)',
              boxShadow: '0 4px 15px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : view === 'login' ? (
              'Log In'
            ) : view === 'signup' ? (
              'Create Account'
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Send Reset Link
              </>
            )}
          </button>
        </form>

        {/* Bottom links */}
        <div className="flex items-center gap-6 mt-5">
          {view === 'login' && (
            <>
              <button
                onClick={() => switchView('forgot')}
                className="font-cinzel text-xs tracking-wide transition-colors hover:underline"
                style={{ color: '#b8a472' }}
              >
                Forgot Password?
              </button>
              <button
                onClick={() => switchView('signup')}
                className="font-cinzel text-xs tracking-wide transition-colors hover:underline"
                style={{ color: '#b8a472' }}
              >
                Create Account
              </button>
            </>
          )}
          {view === 'signup' && (
            <button
              onClick={() => switchView('login')}
              className="font-cinzel text-xs tracking-wide transition-colors hover:underline"
              style={{ color: '#b8a472' }}
            >
              ← Back to Log In
            </button>
          )}
          {view === 'forgot' && (
            <button
              onClick={() => switchView('login')}
              className="font-cinzel text-xs tracking-wide transition-colors hover:underline"
              style={{ color: '#b8a472' }}
            >
              ← Back to Log In
            </button>
          )}
        </div>

        <p className="text-xs mt-6 text-center" style={{ color: 'rgba(184,164,114,0.5)' }}>
          Your character data is encrypted and stored securely
        </p>
      </div>
    </BackgroundWrapper>
  );
}
