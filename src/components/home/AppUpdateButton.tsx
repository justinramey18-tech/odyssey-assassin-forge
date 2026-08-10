import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      className={cn('py-3 px-6 flex flex-col items-center gap-1 text-white disabled:opacity-60', className)}
      style={{ touchAction: 'manipulation' }}
      aria-label="Check for app updates"
    >
      {checking ? (
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
      ) : (
        <Download className="w-5 h-5 text-cyan-400" />
      )}
      <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
        {checking ? 'Checking...' : 'Update App'}
      </span>
    </button>
  );
}
