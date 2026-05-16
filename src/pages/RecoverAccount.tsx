import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, KeyRound, Lock, Check } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';

const usernameSchema = z
  .string()
  .trim()
  .min(3).max(24)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscore or hyphen only');

export default function RecoverAccount() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = usernameSchema.safeParse(username);
    if (!u.success) { setError('Enter a valid username.'); return; }
    if (code.replace(/[-\s]/g, '').length < 12) { setError('Enter your full recovery code.'); return; }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('recover-password', {
        body: { username: username.trim(), recoveryCode: code, newPassword },
      });
      if (fnErr) { setError(fnErr.message || 'Recovery failed.'); return; }
      if (data?.error) { setError(data.error); return; }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Recovery failed.');
    } finally {
      setLoading(false);
    }
  };

  const iconBoxClass = 'absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center';
  const iconClass = 'w-5 h-5 text-[#8b7355]';
  const inputClass = 'w-full pl-14 pr-4 py-3.5 bg-[#c4b196] text-[#2a1f14] placeholder:text-[#8a7a60] rounded-sm font-medium text-base ml-4';
  const goldBtn = 'w-full py-3.5 mt-2 bg-[#4a3c2e] border-2 border-[#8b7355] text-[#d4c4a0] font-cinzel uppercase tracking-[0.2em] text-base hover:bg-[#5a4a3a] disabled:opacity-50 rounded-sm flex items-center justify-center gap-2';

  return (
    <BackgroundWrapper imagePath={homeBackground} overlayOpacity={70}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="font-cinzel uppercase tracking-widest text-[#d4a030] text-center text-lg mb-4">
            Recover Account
          </h1>

          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-[#c4a96a]">Password updated. You can now sign in.</p>
              <button onClick={() => navigate('/auth')} className={goldBtn}>Back to Sign In</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-[#c4a96a]/80 text-sm text-center mb-2">
                Enter your username and the recovery code shown when you signed up.
              </p>

              {error && (
                <Alert variant="destructive" className="border-red-800/50 bg-red-900/30">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="relative">
                <div className={iconBoxClass}><User className={iconClass} /></div>
                <input type="text" placeholder="Username" value={username}
                  onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
              </div>

              <div className="relative">
                <div className={iconBoxClass}><KeyRound className={iconClass} /></div>
                <input type="text" placeholder="Recovery Code" value={code}
                  onChange={(e) => setCode(e.target.value)} required
                  className={inputClass + ' font-mono tracking-widest'} />
              </div>

              <div className="relative">
                <div className={iconBoxClass}><Lock className={iconClass} /></div>
                <input type="password" placeholder="New Password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} required className={inputClass} />
              </div>

              <div className="relative">
                <div className={iconBoxClass}><Lock className={iconClass} /></div>
                <input type="password" placeholder="Confirm Password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required className={inputClass} />
              </div>

              <button type="submit" disabled={loading} className={goldBtn}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>

              <button type="button" onClick={() => navigate('/auth')}
                className="w-full text-center text-[#c4a96a]/70 hover:text-[#d4a030] text-sm font-cinzel pt-3">
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </BackgroundWrapper>
  );
}
