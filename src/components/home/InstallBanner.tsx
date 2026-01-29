import { useState } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function InstallBanner() {
  const { isInstallable, isInstalled, installApp, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    // Check if user has dismissed the banner recently (within 7 days)
    const dismissedAt = localStorage.getItem('pwa-banner-dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed < 7;
    }
    return false;
  });
  const navigate = useNavigate();

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      handleDismiss();
    }
  };

  const handleLearnMore = () => {
    navigate('/install');
  };

  // Don't show if already installed, dismissed, or not installable (except iOS which shows manual instructions)
  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <div className="absolute top-16 left-4 right-4 z-30 animate-in slide-in-from-top-2 duration-300">
      <div className="relative bg-gradient-to-r from-primary/90 to-primary/70 backdrop-blur-md rounded-xl border border-primary/30 shadow-lg shadow-primary/20 p-3">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-primary-foreground/80" />
        </button>

        <div className="flex items-center gap-3 pr-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            {isIOS ? (
              <Share className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Download className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary-foreground">
              Install for Offline Access
            </p>
            <p className="text-xs text-primary-foreground/70 truncate">
              {isIOS ? 'Add to Home Screen via Share' : 'Quick install, no app store needed'}
            </p>
          </div>

          {isInstallable ? (
            <Button
              onClick={handleInstall}
              size="sm"
              variant="secondary"
              className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
            >
              Install
            </Button>
          ) : (
            <Button
              onClick={handleLearnMore}
              size="sm"
              variant="secondary"
              className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
            >
              How?
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
