import { useState, useMemo } from 'react';
import { Check, Copy, RefreshCw, Camera, Star, Lock, RotateCcw, AlertTriangle, Download, ImageOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DiceOddsWidget } from './DiceOddsWidget';
import { GameModeSettings } from './GameModeSettings';
import { XPProgressionWidget, XPProgressionMode } from './XPProgressionWidget';
import { GMGuidePrompts } from './GMGuidePrompts';
import { CustomizationsPanel } from './CustomizationsPanel';
import { DiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SettingsTab } from './MobileSettingsTabs';

import { PartyPanel } from '@/components/party';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';

interface SettingsContentProps {
  activeTab: SettingsTab;
  characterName: string;
  onEditCharacter: () => void;
  onNewCharacter?: () => void;
  onClose: () => void;
  prestigeData?: {
    totalPrestigePoints: number;
    prestigeLevel: number;
  };
  onResetComplete?: () => void;
  // Game mode state
  gameModeSettings: GameModeSettingsType;
  onGameModeChange: (settings: GameModeSettingsType) => void;
  // XP Progression state
  xpProgressionMode: XPProgressionMode;
  onXPProgressionChange: (mode: XPProgressionMode) => void;
  // Dice state
  diceOddsMode: DiceOddsMode;
  onDiceOddsChange: (mode: DiceOddsMode) => void;
  // Dynamic guide data
  dynamicGuide: string | null;
  stateSummary: string | null;
  fullGuide: string;
  // Custom images
  equipmentImageCount?: number;
  abilityImageCount?: number;
  onClearEquipmentImages?: () => void;
  onClearAbilityImages?: () => void;
  onClearAllCustomImages?: () => void;
  // Party system
  partySync?: UsePartySyncReturn;
  isAuthenticated?: boolean;
  userId?: string;
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  ac?: number;
  characterLevel?: number;
}

export function SettingsContent({
  activeTab,
  characterName,
  onEditCharacter,
  onNewCharacter,
  onClose,
  prestigeData,
  onResetComplete,
  gameModeSettings,
  onGameModeChange,
  xpProgressionMode,
  onXPProgressionChange,
  diceOddsMode,
  onDiceOddsChange,
  dynamicGuide,
  stateSummary,
  fullGuide,
  equipmentImageCount = 0,
  abilityImageCount = 0,
  onClearEquipmentImages,
  onClearAbilityImages,
  onClearAllCustomImages,
  partySync,
  isAuthenticated = false,
  userId,
  currentHP,
  maxHP,
  tempHP,
  ac,
  characterLevel,
}: SettingsContentProps) {
  const [copiedStatic, setCopiedStatic] = useState(false);
  const [copiedDynamic, setCopiedDynamic] = useState(false);
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);
  const [showDynamic, setShowDynamic] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearImagesDialog, setShowClearImagesDialog] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  
  const { prestigeRespecDisabled } = useGameMode();

  // Check for service worker updates
  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration) {
          // Force check for updates
          await registration.update();
          
          // Check if there's a waiting worker (new version available)
          if (registration.waiting) {
            // Tell the waiting service worker to take control
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            toast.success('Update found! Refreshing app...', {
              description: 'The app will reload with the latest version.',
              duration: 2000,
            });
            
            // Reload after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else if (registration.installing) {
            toast.info('Update installing...', {
              description: 'A new version is being installed. Please wait.',
            });
            
            // Listen for the installing worker to become active
            registration.installing.addEventListener('statechange', (e) => {
              const sw = e.target as ServiceWorker;
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 1500);
              }
            });
          } else {
            toast.success('You have the latest version!', {
              description: 'No updates available at this time.',
            });
          }
        } else {
          toast.info('No service worker registered', {
            description: 'Updates are handled automatically on page refresh.',
          });
        }
      } else {
        toast.info('Updates not supported', {
          description: 'Your browser does not support automatic updates. Try refreshing the page.',
        });
      }
    } catch (error) {
      console.error('[Settings] Update check failed:', error);
      toast.error('Update check failed', {
        description: 'Please try refreshing the page manually.',
      });
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const hasDynamicData = !!dynamicGuide;
  const hasPrestigePoints = prestigeData && prestigeData.totalPrestigePoints > 0;
  const totalCustomImages = equipmentImageCount + abilityImageCount;
  const hasCustomImages = totalCustomImages > 0;

  const handleCopyFullGuide = async () => {
    try {
      await navigator.clipboard.writeText(fullGuide);
      setCopiedStatic(true);
      toast.success('Complete GM Guide copied!');
      setTimeout(() => setCopiedStatic(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleCopyDynamicOnly = async () => {
    if (!dynamicGuide) {
      toast.error('No character data available');
      return;
    }
    try {
      await navigator.clipboard.writeText(dynamicGuide);
      setCopiedDynamic(true);
      toast.success('Current build snapshot copied!');
      setTimeout(() => setCopiedDynamic(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleCopySnapshot = async () => {
    if (!stateSummary) {
      toast.error('No character data available');
      return;
    }
    try {
      await navigator.clipboard.writeText(stateSummary);
      setCopiedSnapshot(true);
      toast.success('📋 State snapshot copied!');
      setTimeout(() => setCopiedSnapshot(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleReset = () => {
    try {
      setShowResetDialog(false);
      onClose();
      
      if (onResetComplete) {
        onResetComplete();
      }
    } catch (error) {
      console.error('[AppReset] Reset failed:', error);
      toast.error('Reset failed. Please refresh the page and try again.');
    }
  };

  // Game Mode Tab
  if (activeTab === 'game') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-6 pb-6">
          <GameModeSettings settings={gameModeSettings} onChange={onGameModeChange} />
          <Separator className="bg-border/30" />
          <XPProgressionWidget value={xpProgressionMode} onChange={onXPProgressionChange} />
        </div>
      </div>
    );
  }

  // Customizations Tab
  if (activeTab === 'customizations') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh] overscroll-contain">
        <div className="pb-6">
          <CustomizationsPanel onClose={onClose} />
        </div>
      </div>
    );
  }

  // Setup Tab - Simple scrollable version with sticky headers
  if (activeTab === 'setup') {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[70vh] w-full max-w-full min-w-0 overscroll-contain">
        <div className="pb-8 w-full max-w-full min-w-0 overflow-hidden">
          
          {/* Section 1: AI GM Sync */}
          <div className="mb-4">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-1 px-1 border-b border-border/30 mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <h3 className="font-cinzel font-semibold text-sm">AI GM Sync</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Copy character data for your AI Dungeon Master
              </p>
            </div>
            
            <div className="space-y-3">
              {/* State Snapshot Button - Prominent */}
              {hasDynamicData && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCopySnapshot}
                  className={cn(
                    "w-full gap-2 border-2 h-14",
                    copiedSnapshot 
                      ? "border-green-500/50 bg-green-500/10 text-green-400" 
                      : "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400"
                  )}
                >
                  {copiedSnapshot ? (
                    <>
                      <Check className="w-5 h-5" />
                      Snapshot Copied!
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      Generate State Summary
                    </>
                  )}
                </Button>
              )}

              {/* Copy Buttons for Full/Build Only */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={handleCopyFullGuide}
                  className="gap-2 flex-1 h-12"
                >
                  {copiedStatic ? (
                    <>
                      <Check className="w-4 h-4 text-green-300" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Full Guide
                    </>
                  )}
                </Button>
                
                {hasDynamicData && (
                  <Button
                    variant="outline"
                    onClick={handleCopyDynamicOnly}
                    className="gap-2 flex-1 h-12"
                  >
                    {copiedDynamic ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Build Only
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Snapshot Preview */}
              {hasDynamicData && stateSummary && (
                <div className="space-y-2 min-w-0 max-w-full">
                  <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
                    📋 State Snapshot Preview
                  </Badge>
                  <pre className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs font-mono whitespace-pre-wrap break-words max-h-[25vh] overflow-y-auto overflow-x-hidden leading-relaxed w-full">
                    {stateSummary}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Modular GM Prompts */}
          <div className="mb-4">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-1 px-1 border-b border-border/30 mb-3">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                <h3 className="font-cinzel font-semibold text-sm">Modular GM Prompts</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                20 copyable prompts for selective AI integration
              </p>
            </div>
            
            <GMGuidePrompts />
          </div>

          {/* Section 3: Legacy View */}
          {hasDynamicData && (
            <div className="mb-4">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-1 px-1 border-b border-border/30 mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-cinzel font-semibold text-sm">Legacy View</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Full-text character build and system rules
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showDynamic ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setShowDynamic(true)}
                    className="flex-1 h-9 text-xs"
                  >
                    Current Build
                  </Button>
                  <Button
                    variant={!showDynamic ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setShowDynamic(false)}
                    className="flex-1 h-9 text-xs"
                  >
                    System Rules
                  </Button>
                </div>

                {/* Dynamic Build Section */}
                {showDynamic && (
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">
                      Live Character Data
                    </Badge>
                    <pre className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">
                      {dynamicGuide}
                    </pre>
                  </div>
                )}

                {/* Static System Rules Section */}
                {!showDynamic && (
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs">
                      System Reference (Full)
                    </Badge>
                    <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">
                      {fullGuide}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Static System Rules when no dynamic data */}
          {!hasDynamicData && (
            <div className="mb-4">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-1 px-1 border-b border-border/30 mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-cinzel font-semibold text-sm">System Reference</h3>
                </div>
              </div>
              
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">
                  System Reference (Full)
                </Badge>
                <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">
                  {fullGuide}
                </pre>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            {hasDynamicData 
              ? '💡 Use modular prompts above for selective AI DM integration'
              : '💡 Configure your character to enable build snapshots'}
          </p>
        </div>
      </div>
    );
  }


  // Character Tab
  if (activeTab === 'character') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-4 pb-6">
        {/* Character Card */}
        <div className="p-4 rounded-lg border border-border/50 bg-card/50">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Current Character</p>
              <p className="font-cinzel font-bold text-lg truncate">{characterName || 'Unnamed'}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEditCharacter();
              }}
              className="shrink-0"
            >
              Edit
            </Button>
            {onNewCharacter && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onClose();
                  onNewCharacter();
                }}
                className="shrink-0"
              >
                New
              </Button>
            )}
          </div>
        </div>

        {/* Prestige Info */}
        {hasPrestigePoints && (
          <div className={cn(
            "p-4 rounded-lg border",
            prestigeRespecDisabled 
              ? "border-muted/50 bg-muted/20" 
              : "border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-orange-900/20"
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                prestigeRespecDisabled ? "bg-muted/30" : "bg-amber-500/20"
              )}>
                <Star className={cn(
                  "w-5 h-5",
                  prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400 fill-amber-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={cn(
                    "font-display font-semibold",
                    prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400"
                  )}>
                    Prestige Points
                  </h4>
                  {prestigeRespecDisabled && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                      <Lock className="w-3 h-3" />
                      Honest Mode
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {prestigeData.totalPrestigePoints} points (Level {prestigeData.prestigeLevel})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Party Link Section */}
        {partySync && (
          <>
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <PartyPanel
                partySync={partySync}
                characterName={characterName}
                currentStatus={{
                  currentHP,
                  maxHP,
                  tempHP,
                  ac,
                  level: characterLevel,
                }}
                isAuthenticated={isAuthenticated}
                userId={userId}
              />
            </div>
            <Separator className="bg-border/30" />
          </>
        )}

        <Separator className="bg-border/30" />

        {/* App Updates Section */}
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/20 shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-display font-semibold text-primary">
                App Updates
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Check for and install the latest version of the app.
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={handleCheckForUpdates}
            disabled={isCheckingForUpdates}
            className="w-full gap-2 h-12 border-primary/30 hover:bg-primary/10"
          >
            {isCheckingForUpdates ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking for updates...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Check for Updates
              </>
            )}
          </Button>
        </div>

        <Separator className="bg-border/30" />

        {/* Clear Custom Images */}
        {hasCustomImages && (
          <>
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 shrink-0">
                  <ImageOff className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-display font-semibold text-amber-400">
                    Custom Images
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalCustomImages} image{totalCustomImages !== 1 ? 's' : ''} stored
                  </p>
                </div>
              </div>
              
              {/* Individual category rows with clear buttons */}
              <div className="space-y-2 mt-3">
                {equipmentImageCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-sm">{equipmentImageCount} equipment slot{equipmentImageCount !== 1 ? 's' : ''}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onClearEquipmentImages?.();
                        toast.success(`Cleared ${equipmentImageCount} equipment image${equipmentImageCount !== 1 ? 's' : ''}`);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                
                {abilityImageCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-sm">{abilityImageCount} ability node{abilityImageCount !== 1 ? 's' : ''}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onClearAbilityImages?.();
                        toast.success(`Cleared ${abilityImageCount} ability image${abilityImageCount !== 1 ? 's' : ''}`);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Clear All button - only show if both types exist */}
              {equipmentImageCount > 0 && abilityImageCount > 0 && (
                <AlertDialog open={showClearImagesDialog} onOpenChange={setShowClearImagesDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2 h-10 mt-3 border-amber-500/30 hover:bg-amber-500/10 text-amber-400"
                    >
                      <ImageOff className="w-4 h-4" />
                      Clear All ({totalCustomImages})
                    </Button>
                  </AlertDialogTrigger>
                  
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
                        <ImageOff className="w-5 h-5" />
                        Clear All Custom Images?
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3 pt-2">
                          <p className="text-sm">
                            This will remove all uploaded images from:
                          </p>
                          
                          <div className="bg-muted/50 rounded-md p-3 space-y-2">
                            <p className="text-sm text-foreground flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              {equipmentImageCount} equipment slot{equipmentImageCount !== 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-foreground flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              {abilityImageCount} ability node{abilityImageCount !== 1 ? 's' : ''}
                            </p>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Default icons will be restored. Your character data is not affected.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
                      <AlertDialogCancel className="w-full sm:w-auto">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onClearAllCustomImages?.();
                          setShowClearImagesDialog(false);
                          toast.success('All custom images cleared');
                        }}
                        className="w-full sm:w-auto bg-amber-600 text-white hover:bg-amber-500"
                      >
                        Clear All Images
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            <Separator className="bg-border/30" />
          </>
        )}

        {/* Danger Zone */}
        <div className="border-2 border-destructive/50 rounded-lg p-4 bg-destructive/5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-display font-semibold text-destructive">
                Danger Zone
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently delete all data and start fresh.
              </p>
            </div>
          </div>

          <div className="bg-background/50 rounded-md p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">This will delete:</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-3">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-destructive/70" />
                All levels, XP, and abilities
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-destructive/70" />
                Equipment & achievements
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-destructive/70" />
                Drizzt's Legacy progress
              </li>
            </ul>
          </div>

          <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full gap-2 h-12"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Entire App
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Reset Application?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 pt-2">
                    <p className="text-sm">
                      Permanently delete all data for:
                    </p>
                    
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="font-semibold text-sm text-foreground">
                        {characterName || 'Unnamed Character'}
                      </p>
                      {prestigeData && prestigeData.prestigeLevel > 0 && (
                        <p className="text-xs text-amber-400 mt-1">
                          Prestige Level {prestigeData.prestigeLevel}
                        </p>
                      )}
                    </div>

                    <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                      <p className="text-xs font-semibold text-destructive">
                        ⚠️ This cannot be undone
                      </p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
                <AlertDialogCancel className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </div>
      </div>
    );
  }

  // Dice Tools Tab
  if (activeTab === 'tools') {
    return (
      <div className="space-y-4">
        <DiceOddsWidget value={diceOddsMode} onChange={onDiceOddsChange} />
      </div>
    );
  }

  return null;
}
