// "Become a Dragon Rider" (route /empyrean-create): the Empyrean Guide builds a new solo rider,
// their dragon and their first campaign in one chat. Begin hands the rider to the main page the
// same way the AI Creation Assistant does (it is applied and saved to the cloud there); the
// campaign setup waits in a launch note and is applied once the rider is saved, then the first
// scene opens.

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { EmpyreanOnboardingChat } from '@/components/empyrean/EmpyreanOnboardingChat';
import { onboardingDraftKey } from '@/hooks/use-empyrean-onboarding-chat';
import { canonLoreText, prepareRiderCharacter, saveLaunch, type OnboardingResult } from '@/lib/empyrean-onboarding';
import { savePendingAiCharacter } from '@/lib/creation-guard';
import { shouldEnterEmpyreanSeparately } from '@/lib/account-space';
import { enterEmpyreanAccount } from '@/lib/account-space-switch';

export default function EmpyreanOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [beginning, setBeginning] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const handleBegin = useCallback((result: OnboardingResult) => {
    if (result.kind !== 'rider' || beginning) return;
    // Separate Empyrean account (D-28): the rider belongs there. The chat moves along; Begin again there.
    if (shouldEnterEmpyreanSeparately()) {
      toast('Opening your Empyrean account', { description: 'Tap Begin again there to create your rider.' });
      void enterEmpyreanAccount({ carry: [onboardingDraftKey('rider')], returnTo: '/empyrean-create' });
      return;
    }
    setBeginning(true);
    try {
      const wizardState = prepareRiderCharacter(result.character);
      saveLaunch(result.character.name, result.empyrean, result.campaign);
      try { localStorage.removeItem(onboardingDraftKey('rider')); } catch { /* ignore */ }
      // The same hand-off as the AI Creation Assistant: the main page applies the rider and saves it.
      savePendingAiCharacter(wizardState);
      navigate('/', { state: { aiCreatedCharacter: wizardState } });
    } catch (e) {
      console.error('[EmpyreanOnboarding] Begin failed:', e);
      toast.error('Could not create your rider. Tap Begin again.');
      setBeginning(false);
    }
  }, [beginning, navigate]);

  if (signedIn === null) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!signedIn) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-4xl">🐉</p>
        <p className="font-cinzel text-lg text-primary">Sign in to become a dragon rider</p>
        <p className="text-sm text-muted-foreground max-w-sm">Your rider, dragon and campaign are kept in your account, and the campaign's rules, map and fights run on the server.</p>
        <Button onClick={() => navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)} className="min-h-[48px] px-6" style={{ touchAction: 'manipulation' }}>Sign in</Button>
        <Button variant="ghost" onClick={() => navigate('/')} className="min-h-[48px]" style={{ touchAction: 'manipulation' }}>Back</Button>
      </div>
    );
  }
  return (
    <EmpyreanOnboardingChat
      mode="rider"
      getLore={canonLoreText}
      beginning={beginning}
      onBegin={handleBegin}
      onClose={() => navigate('/')}
    />
  );
}
