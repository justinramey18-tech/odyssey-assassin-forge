import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, CheckCircle, Smartphone, Share, PlusSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Install() {
  const { isInstallable, isInstalled, installApp, isIOS, isAndroid } = usePWAInstall();
  const navigate = useNavigate();

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      // Optionally navigate somewhere after install
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/20 bg-card/95 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Install Assassin's Ledger</CardTitle>
          <CardDescription>
            Install this app on your device for offline access and a native app experience
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-500">
                <CheckCircle className="w-6 h-6" />
                <span className="text-lg font-medium">App Installed!</span>
              </div>
              <p className="text-muted-foreground text-sm">
                You can now use Assassin's Ledger from your home screen, even without internet.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Open App
              </Button>
            </div>
          ) : isInstallable ? (
            <div className="space-y-4">
              <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                <Download className="w-5 h-5" />
                Install App
              </Button>
              <p className="text-muted-foreground text-sm text-center">
                Quick install - no app store needed!
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Share className="w-5 h-5" />
                  Install on iPhone/iPad
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Tap the <strong>Share</strong> button in Safari</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>"Add"</strong> in the top right</li>
                  <li>Open the app from your Home Screen and <strong>sign in again</strong></li>
                </ol>
              </div>

              {/* iOS-specific auth warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Important for iPhone users</p>
                  <p className="text-muted-foreground mt-1">
                    The installed app uses separate storage from Safari. You'll need to <strong>sign in again</strong> after installing. This also enables push notifications.
                  </p>
                </div>
              </div>

              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Continue in Browser
              </Button>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <PlusSquare className="w-5 h-5" />
                  Install on Android
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Tap the <strong>menu</strong> (⋮) in your browser</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
                  <li>Confirm the installation</li>
                </ol>
              </div>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Continue in Browser
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm text-center">
                Visit this page on a mobile device to install the app.
              </p>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Continue to App
              </Button>
            </div>
          )}

          {/* Features list */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3">What you get:</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Works offline - no internet required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Fast loading from home screen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Full-screen experience
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                All character data saved locally
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Push notifications for party events
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
