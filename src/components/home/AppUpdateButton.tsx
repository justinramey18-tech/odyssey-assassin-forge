import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import homeBtnUpdateAsset from '@/assets/home/home-btn-update.png.asset.json';

interface AppUpdateButtonProps {
  className?: string;
}

/** Home-screen button that checks for a new app version and applies it. */
export function AppUpdateButton({ className }: AppUpdateButtonProps) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      if (!('serviceWorker' in navigator)) {
        toast.info('Updates not supported', { description: 'Try refreshing the page.' });
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        toast.info('No update service found', { description: 'Refreshing the page will pick up any updates.' });
        return;
      }
      await registration.update();

      if (registration.waiting) {
        toast.success('Update found! Applying...', { description: 'The app will reload with the latest version.', duration: 2000 });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => { window.location.reload(); }, 8000);
        return;
      }

      if (registration.installing) {
        toast.info('Update installing...', { description: 'Please wait.' });
        const installing = registration.installing;
        const onStateChange = () => {
          if (installing.state === 'installed') {
            installing.postMessage({ type: 'SKIP_WAITING' });
            installing.removeEventListener('statechange', onStateChange);
            setTimeout(() => { window.location.reload(); }, 8000);
          }
        };
        installing.addEventListener('statechange', onStateChange);
        return;
      }

      toast.success('You have the latest version', { description: 'No updates available right now.' });
    } catch (error) {
      console.error('[AppUpdateButton] Update check failed:', error);
      toast.error('Update check failed', { description: 'Try refreshing the app instead.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <button
      onClick={handleCheck}
      disabled={checking}
      className={cn('relative block w-[52%] max-w-[220px] mx-auto active:scale-[0.98] transition-transform disabled:opacity-60', className)}
      style={{ touchAction: 'manipulation' }}
      aria-label="Check for app updates"
    >
      <img
        src={homeBtnUpdateAsset.url}
        alt=""
        draggable={false}
        className={cn('block w-full', checking && 'opacity-60')}
      />
      {checking && <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-amber-300 animate-spin" />}
    </button>
  );
}
