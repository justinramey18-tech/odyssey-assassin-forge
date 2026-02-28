import { useState, useMemo } from 'react';
import { Check, Copy, RefreshCw, Camera, Star, Lock, RotateCcw, AlertTriangle, Download, ImageOff, Users, User, BookOpen, Database } from 'lucide-react';
import { AppModeSettings } from './AppModeSettings';
import type { AppMode, CustomOverrides } from '@/lib/app-modes';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
import { EmpyreanCampaignPack } from './EmpyreanCampaignPack';
import { EmpyreanPromptLibrary } from './EmpyreanPromptLibrary';
import { DiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SettingsTab } from './MobileSettingsTabs';
import { SettingsSection } from './SettingsSection';
import { SystemPreferences } from './SystemPreferences';
import { ApiCredentials } from './ApiCredentials';
import { ElevenLabsSettingsTab } from './ElevenLabsSettingsTab';

import { PartyPanel } from '@/components/party';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';
import { CloudSaveDebugPanel } from './CloudSaveDebugPanel';
import { CharacterRenameWidget } from './CharacterRenameWidget';
import { DevToolsPanel } from './DevToolsPanel';

interface SettingsContentProps {
  activeTab: SettingsTab;
  characterName: string;
  onEditCharacter: () => void;
  
  onClose: () => void;
  prestigeData?: {
    totalPrestigePoints: number;
    prestigeLevel: number;
  };
  onResetComplete?: () => void;
  gameModeSettings: GameModeSettingsType;
  onGameModeChange: (settings: GameModeSettingsType) => void;
  xpProgressionMode: XPProgressionMode;
  onXPProgressionChange: (mode: XPProgressionMode) => void;
  diceOddsMode: DiceOddsMode;
  onDiceOddsChange: (mode: DiceOddsMode) => void;
  dynamicGuide: string | null;
  stateSummary: string | null;
  fullGuide: string;
  equipmentImageCount?: number;
  abilityImageCount?: number;
  onClearEquipmentImages?: () => void;
  onClearAbilityImages?: () => void;
  onClearAllCustomImages?: () => void;
  partySync?: UsePartySyncReturn;
  isAuthenticated?: boolean;
  userId?: string;
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  ac?: number;
  characterLevel?: number;
  playMode?: 'solo' | 'party';
  onPlayModeChange?: (mode: 'solo' | 'party') => void;
  appMode?: AppMode;
  onAppModeChange?: (mode: AppMode) => void;
  customOverrides?: CustomOverrides;
  onCustomOverride?: (featureId: string, visible: boolean) => void;
  onResetCustomizations?: () => void;
  isFeatureVisible?: (id: string) => boolean;
  onRenameCharacter?: (name: string) => void;
}

export function SettingsContent({
  activeTab,
  characterName,
  onEditCharacter,
  
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
  playMode = 'party',
  onPlayModeChange,
  appMode,
  onAppModeChange,
  customOverrides,
  onCustomOverride,
  onResetCustomizations,
  isFeatureVisible: isFeatureVisibleProp,
  onRenameCharacter,
}: SettingsContentProps) {
  const [copiedStatic, setCopiedStatic] = useState(false);
  const [copiedDynamic, setCopiedDynamic] = useState(false);
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);
  const [showDynamic, setShowDynamic] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearImagesDialog, setShowClearImagesDialog] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [showSoloConfirmSettings, setShowSoloConfirmSettings] = useState(false);
  const [showEmpyreanPack, setShowEmpyreanPack] = useState(false);
  const [showEmpyreanPrompts, setShowEmpyreanPrompts] = useState(false);
  
  const gmGuides = useGMGuides();
  const { prestigeRespecDisabled } = useGameMode();

  const hasDynamicData = !!dynamicGuide;
  const hasPrestigePoints = prestigeData && prestigeData.totalPrestigePoints > 0;
  const totalCustomImages = equipmentImageCount + abilityImageCount;
  const hasCustomImages = totalCustomImages > 0;

  // Check for service worker updates
  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true);
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            toast.success('Update found! Refreshing app...', { description: 'The app will reload with the latest version.', duration: 2000 });
            setTimeout(() => window.location.reload(), 1500);
          } else if (registration.installing) {
            toast.info('Update installing...', { description: 'A new version is being installed.' });
            registration.installing.addEventListener('statechange', (e) => {
              const sw = e.target as ServiceWorker;
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 1500);
              }
            });
          } else {
            toast.success('You have the latest version!', { description: 'No updates available.' });
          }
        } else {
          toast.info('No service worker registered', { description: 'Updates are handled automatically on page refresh.' });
        }
      } else {
        toast.info('Updates not supported', { description: 'Try refreshing the page.' });
      }
    } catch (error) {
      console.error('[Settings] Update check failed:', error);
      toast.error('Update check failed', { description: 'Please try refreshing the page manually.' });
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const handleCopyFullGuide = async () => {
    try {
      await navigator.clipboard.writeText(fullGuide);
      setCopiedStatic(true);
      toast.success('Complete GM Guide copied!');
      setTimeout(() => setCopiedStatic(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleCopyDynamicOnly = async () => {
    if (!dynamicGuide) { toast.error('No character data available'); return; }
    try {
      await navigator.clipboard.writeText(dynamicGuide);
      setCopiedDynamic(true);
      toast.success('Current build snapshot copied!');
      setTimeout(() => setCopiedDynamic(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleCopySnapshot = async () => {
    if (!stateSummary) { toast.error('No character data available'); return; }
    try {
      await navigator.clipboard.writeText(stateSummary);
      setCopiedSnapshot(true);
      toast.success('📋 State snapshot copied!');
      setTimeout(() => setCopiedSnapshot(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleReset = () => {
    try {
      setShowResetDialog(false);
      onClose();
      if (onResetComplete) onResetComplete();
    } catch (error) {
      console.error('[AppReset] Reset failed:', error);
      toast.error('Reset failed. Please refresh the page and try again.');
    }
  };

  // ─── CHARACTER & PARTY ───
  if (activeTab === 'character') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-3 pb-6">
          <SettingsSection title="Character Profile">
            {/* Character Card */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/50">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Current Character</p>
                  {onRenameCharacter ? (
                    <CharacterRenameWidget currentName={characterName} onRename={onRenameCharacter} />
                  ) : (
                    <p className="font-cinzel font-bold text-lg truncate">{characterName || 'Unnamed'}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => { onClose(); onEditCharacter(); }} className="shrink-0">Edit</Button>
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
                  <div className={cn("p-2 rounded-lg shrink-0", prestigeRespecDisabled ? "bg-muted/30" : "bg-amber-500/20")}>
                    <Star className={cn("w-5 h-5", prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400 fill-amber-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={cn("font-display font-semibold", prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400")}>
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
                      {prestigeData!.totalPrestigePoints} points (Level {prestigeData!.prestigeLevel})
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Party Settings">
            {/* Solo/Party Mode Toggle */}
            {partySync?.party?.partyId && onPlayModeChange && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20 shrink-0">
                      {playMode === 'party' ? <Users className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <h3 className="font-cinzel font-semibold text-sm">Play Mode</h3>
                      <p className="text-xs text-muted-foreground">
                        {playMode === 'party' ? 'Party features active — syncing with teammates' : 'Solo mode — party sync paused'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (playMode === 'party') setShowSoloConfirmSettings(true);
                      else onPlayModeChange(playMode === 'solo' ? 'party' : 'solo');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-cinzel uppercase tracking-wider transition-colors border",
                      playMode === 'party'
                        ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-300"
                        : "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                    )}
                  >
                    {playMode === 'party' ? <><Users className="w-3 h-3" /><span>Party</span></> : <><User className="w-3 h-3" /><span>Solo</span></>}
                  </button>
                  <AlertDialog open={showSoloConfirmSettings} onOpenChange={setShowSoloConfirmSettings}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-cinzel">Switch to Solo Mode?</AlertDialogTitle>
                        <AlertDialogDescription>Party sync will be paused. You won't send or receive updates until you switch back.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onPlayModeChange?.('solo')}>Switch to Solo</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Party Panel */}
            {partySync && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                <PartyPanel
                  partySync={partySync}
                  characterName={characterName}
                  currentStatus={{ currentHP, maxHP, tempHP, ac, level: characterLevel }}
                  isAuthenticated={isAuthenticated}
                  userId={userId}
                />
              </div>
            )}

            {!partySync?.party?.partyId && !partySync && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Party features require authentication. Sign in to create or join a party.
              </p>
            )}
          </SettingsSection>
        </div>
      </div>
    );
  }

  // ─── GAMEPLAY ───
  if (activeTab === 'gameplay') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-3 pb-6">
          <SettingsSection title="Game Rules">
            <GameModeSettings settings={gameModeSettings} onChange={onGameModeChange} />
          </SettingsSection>

          <SettingsSection title="Progression">
            <XPProgressionWidget value={xpProgressionMode} onChange={onXPProgressionChange} />
          </SettingsSection>

          <SettingsSection title="Tools">
            <DiceOddsWidget value={diceOddsMode} onChange={onDiceOddsChange} />
          </SettingsSection>
        </div>
      </div>
    );
  }

  // ─── CUSTOMIZATIONS ───
  if (activeTab === 'customizations') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh] overscroll-contain">
        <div className="space-y-3 pb-6">
          <SettingsSection title="Homebrew Content">
            <CustomizationsPanel onClose={onClose} />
          </SettingsSection>

          <SettingsSection title="Custom Images">
            {hasCustomImages ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {totalCustomImages} image{totalCustomImages !== 1 ? 's' : ''} stored
                </p>
                {equipmentImageCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-sm">{equipmentImageCount} equipment slot{equipmentImageCount !== 1 ? 's' : ''}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { onClearEquipmentImages?.(); toast.success(`Cleared ${equipmentImageCount} equipment image${equipmentImageCount !== 1 ? 's' : ''}`); }} className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10">Clear</Button>
                  </div>
                )}
                {abilityImageCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-sm">{abilityImageCount} ability node{abilityImageCount !== 1 ? 's' : ''}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { onClearAbilityImages?.(); toast.success(`Cleared ${abilityImageCount} ability image${abilityImageCount !== 1 ? 's' : ''}`); }} className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10">Clear</Button>
                  </div>
                )}
                {equipmentImageCount > 0 && abilityImageCount > 0 && (
                  <AlertDialog open={showClearImagesDialog} onOpenChange={setShowClearImagesDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2 h-10 border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
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
                            <p className="text-sm">This will remove all uploaded images.</p>
                            <p className="text-xs text-muted-foreground">Default icons will be restored.</p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
                        <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { onClearAllCustomImages?.(); setShowClearImagesDialog(false); toast.success('All custom images cleared'); }} className="w-full sm:w-auto bg-amber-600 text-white hover:bg-amber-500">
                          Clear All Images
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom images uploaded yet. Upload images from equipment or ability screens.
              </p>
            )}
          </SettingsSection>
        </div>
      </div>
    );
  }

  // ─── GAME MASTER ───
  if (activeTab === 'gameMaster') {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[70vh] w-full max-w-full min-w-0 overscroll-contain">
        <div className="space-y-3 pb-8 w-full max-w-full min-w-0 overflow-hidden">
          <SettingsSection title="GM Synchronization">
            <div className="space-y-3">
              {hasDynamicData && (
                <Button variant="outline" size="lg" onClick={handleCopySnapshot} className={cn(
                  "w-full gap-2 border-2 h-14",
                  copiedSnapshot ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400"
                )}>
                  {copiedSnapshot ? <><Check className="w-5 h-5" />Snapshot Copied!</> : <><Camera className="w-5 h-5" />Generate State Summary</>}
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="default" onClick={handleCopyFullGuide} className="gap-2 flex-1 h-12">
                  {copiedStatic ? <><Check className="w-4 h-4 text-green-300" />Copied!</> : <><Copy className="w-4 h-4" />Full Guide</>}
                </Button>
                {hasDynamicData && (
                  <Button variant="outline" onClick={handleCopyDynamicOnly} className="gap-2 flex-1 h-12">
                    {copiedDynamic ? <><Check className="w-4 h-4 text-green-500" />Copied!</> : <><RefreshCw className="w-4 h-4" />Build Only</>}
                  </Button>
                )}
              </div>
              {hasDynamicData && stateSummary && (
                <div className="space-y-2 min-w-0 max-w-full">
                  <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">📋 State Snapshot Preview</Badge>
                  <pre className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs font-mono whitespace-pre-wrap break-words max-h-[25vh] overflow-y-auto overflow-x-hidden leading-relaxed w-full">
                    {stateSummary}
                  </pre>
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Campaign & Prompts">
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowEmpyreanPack(true)} className="flex-1 gap-2 h-10 border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                <BookOpen className="w-4 h-4" />GM Guides
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEmpyreanPrompts(true)} className="flex-1 gap-2 h-10 border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                🐉 Prompts
              </Button>
            </div>
            <GMGuidePrompts />
          </SettingsSection>

          {hasDynamicData && (
            <SettingsSection title="Legacy View">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant={showDynamic ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowDynamic(true)} className="flex-1 h-9 text-xs">Current Build</Button>
                  <Button variant={!showDynamic ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowDynamic(false)} className="flex-1 h-9 text-xs">System Rules</Button>
                </div>
                {showDynamic ? (
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">Live Character Data</Badge>
                    <pre className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">{dynamicGuide}</pre>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs">System Reference (Full)</Badge>
                    <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">{fullGuide}</pre>
                  </div>
                )}
              </div>
            </SettingsSection>
          )}

          {!hasDynamicData && (
            <SettingsSection title="System Reference">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">System Reference (Full)</Badge>
                <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">{fullGuide}</pre>
              </div>
            </SettingsSection>
          )}

          {/* Empyrean drawers */}
          <EmpyreanCampaignPack
            open={showEmpyreanPack}
            onOpenChange={setShowEmpyreanPack}
            guides={gmGuides.guides}
            addGuide={gmGuides.addGuide}
            deleteGuide={gmGuides.deleteGuide}
            updateGuide={gmGuides.updateGuide}
          />
          <EmpyreanPromptLibrary
            open={showEmpyreanPrompts}
            onOpenChange={setShowEmpyreanPrompts}
            characterName={characterName}
          />
        </div>
      </div>
    );
  }

  // ─── ELEVENLABS ───
  if (activeTab === 'elevenlabs') {
    return <ElevenLabsSettingsTab />;
  }

  // ─── APP & SYSTEM ───
  if (activeTab === 'appSystem') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-3 pb-6">
          {appMode && onAppModeChange && onCustomOverride && onResetCustomizations && isFeatureVisibleProp && (
            <SettingsSection title="App Configuration">
              <AppModeSettings
                appMode={appMode}
                onModeChange={onAppModeChange}
                customOverrides={customOverrides ?? {}}
                onCustomOverride={onCustomOverride}
                onResetCustomizations={onResetCustomizations}
                isFeatureVisible={isFeatureVisibleProp}
              />
            </SettingsSection>
          )}

          <SettingsSection title="System Preferences">
            <SystemPreferences />
          </SettingsSection>

          <SettingsSection title="Updates & API">
            {/* Check for Updates */}
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleCheckForUpdates}
                disabled={isCheckingForUpdates}
                className="w-full gap-2 h-12 border-primary/30 hover:bg-primary/10"
              >
                {isCheckingForUpdates ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Checking for updates...</>
                ) : (
                  <><Download className="w-4 h-4" />Check for Updates</>
                )}
              </Button>
              <Separator className="bg-border/30" />
              <ApiCredentials />
            </div>
          </SettingsSection>

          <SettingsSection title="Danger Zone" variant="danger">
            <div className="space-y-4">
              <div className="bg-background/50 rounded-md p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">This will delete:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-3">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-destructive/70" />All levels, XP, and abilities</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-destructive/70" />Equipment & achievements</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-destructive/70" />Drizzt's Legacy progress</li>
                </ul>
              </div>
              <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2 h-12">
                    <RotateCcw className="w-4 h-4" />Reset Entire App
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />Reset Application?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm">Permanently delete all data for:</p>
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="font-semibold text-sm text-foreground">{characterName || 'Unnamed Character'}</p>
                          {prestigeData && prestigeData.prestigeLevel > 0 && (
                            <p className="text-xs text-amber-400 mt-1">Prestige Level {prestigeData.prestigeLevel}</p>
                          )}
                        </div>
                        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                          <p className="text-xs font-semibold text-destructive">⚠️ This cannot be undone</p>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SettingsSection>

          <SettingsSection title="Cloud Save Debug" icon={<Database className="w-4 h-4 text-muted-foreground" />}>
            <CloudSaveDebugPanel userId={userId} />
          </SettingsSection>
        </div>
      </div>
    );
  }

  // ─── DEV TOOLS ───
  if (activeTab === 'devTools') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <DevToolsPanel />
      </div>
    );
  }

  return null;
}
