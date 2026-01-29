import { useState, useEffect } from 'react';
import { Layers, Shield, Moon, Power, Smartphone, AlertCircle, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  FloatingOverlaySettings as OverlaySettings,
  getFloatingOverlaySettings,
  saveFloatingOverlaySettings,
  isNativeApp,
  getPlatform,
  requestOverlayPermission,
  startFloatingOverlay,
  stopFloatingOverlay,
} from '@/lib/floatingOverlay';

interface FloatingOverlaySettingsProps {
  className?: string;
}

export function FloatingOverlaySettings({ className }: FloatingOverlaySettingsProps) {
  const [settings, setSettings] = useState<OverlaySettings>(getFloatingOverlaySettings);
  const [isRequesting, setIsRequesting] = useState(false);
  const isNative = isNativeApp();
  const platform = getPlatform();

  useEffect(() => {
    setSettings(getFloatingOverlaySettings());
  }, []);

  const updateSetting = <K extends keyof OverlaySettings>(
    key: K,
    value: OverlaySettings[K]
  ) => {
    const updated = saveFloatingOverlaySettings({ [key]: value });
    setSettings(updated);
  };

  const handleRequestOverlayPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestOverlayPermission();
      if (granted) {
        updateSetting('overlayPermissionGranted', true);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    updateSetting('enabled', enabled);
    
    if (enabled && settings.overlayPermissionGranted) {
      await startFloatingOverlay();
    } else {
      await stopFloatingOverlay();
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Floating Overlay Mode
        </CardTitle>
        <CardDescription>
          Keep the side navigation drawers accessible as floating buttons even when the app is minimized
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Platform Info */}
        {!isNative && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertTitle>Native App Required</AlertTitle>
            <AlertDescription>
              Floating overlay mode requires the native mobile app. Export this project to run as a native Android app to enable this feature.
            </AlertDescription>
          </Alert>
        )}

        {isNative && platform === 'ios' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>iOS Limitation</AlertTitle>
            <AlertDescription>
              iOS does not support floating overlays outside of apps due to system restrictions.
            </AlertDescription>
          </Alert>
        )}

        {/* Overlay Permission */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                Overlay Permission
              </Label>
              <p className="text-sm text-muted-foreground">
                Required to draw floating buttons over other apps
              </p>
            </div>
            {settings.overlayPermissionGranted ? (
              <span className="text-sm text-green-500 font-medium">Granted ✓</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestOverlayPermission}
                disabled={!isNative || platform !== 'android' || isRequesting}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                {isRequesting ? 'Requesting...' : 'Grant Permission'}
              </Button>
            )}
          </div>

          <Separator />

          {/* Main Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Power className="w-4 h-4 text-primary" />
                Enable Floating Drawers
              </Label>
              <p className="text-sm text-muted-foreground">
                Show drawer triggers when app is in background
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={!settings.overlayPermissionGranted}
            />
          </div>

          <Separator />

          {/* Background Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-blue-500" />
                Background Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Keep app running in background for instant access
              </p>
            </div>
            <Switch
              checked={settings.backgroundModeEnabled}
              onCheckedChange={(checked) => updateSetting('backgroundModeEnabled', checked)}
              disabled={!settings.enabled}
            />
          </div>

          <Separator />

          {/* Auto-Launch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-500" />
                Auto-Launch on Boot
              </Label>
              <p className="text-sm text-muted-foreground">
                Start floating drawers when device restarts
              </p>
            </div>
            <Switch
              checked={settings.autoLaunchOnBoot}
              onCheckedChange={(checked) => updateSetting('autoLaunchOnBoot', checked)}
              disabled={!settings.enabled}
            />
          </div>
        </div>

        {/* Status Summary */}
        {settings.enabled && settings.overlayPermissionGranted && (
          <Alert className="bg-primary/10 border-primary/20">
            <Layers className="h-4 w-4" />
            <AlertTitle>Floating Mode Active</AlertTitle>
            <AlertDescription>
              When you minimize the app, the side navigation triggers will remain accessible as floating buttons on your screen.
            </AlertDescription>
          </Alert>
        )}

        {/* Native Setup Instructions */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Setup Required:</strong> After exporting to GitHub, run{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">npx cap add android</code>{' '}
            and{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">npx cap sync</code>{' '}
            to build the native app with overlay capabilities.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
