import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, KeyRound, Check } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import homeBackground from '@/assets/home-background.jpg';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase will auto-detect the recovery token from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (user may have already been recovered)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <BackgroundWrapper
      imagePath={homeBackground}
      overlayOpacity={85}
      tintColor="purple"
      tintOpacity={20}
    >
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/90 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              {success ? (
                <Check className="w-6 h-6 text-emerald-400" />
              ) : (
                <KeyRound className="w-6 h-6 text-primary" />
              )}
            </div>
            <CardTitle className="font-cinzel text-2xl">
              {success ? 'Password Updated' : 'Set New Password'}
            </CardTitle>
            <CardDescription>
              {success
                ? 'Your password has been changed successfully'
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert className="border-green-500/50 bg-green-500/10">
                  <AlertDescription className="text-green-400">
                    Password updated! You can now sign in with your new password.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" onClick={() => navigate('/auth')}>
                  Go to Sign In
                </Button>
              </div>
            ) : !sessionReady ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">
                  Verifying your reset link...
                </p>
                <Button variant="link" onClick={() => navigate('/auth')} className="text-xs">
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Set New Password
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BackgroundWrapper>
  );
}
