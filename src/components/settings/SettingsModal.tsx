import { useState, useMemo } from 'react';
import { Settings, User, Dices, Gamepad2, RotateCcw, Star, Lock, FileText, Copy, Check, RefreshCw, Camera, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DiceOddsWidget } from './DiceOddsWidget';
import { GameModeSettings } from './GameModeSettings';
import { XPProgressionWidget, XPProgressionMode, loadXPProgressionMode } from './XPProgressionWidget';
import { DiceOddsMode, loadDiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType, loadGameModeSettings, saveGameModeSettings } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Character, Ability } from '@/lib/types';
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { generateDynamicGMGuide, generateCurrentStateSummary, STATIC_GM_GUIDE, CharacterBuildData } from '@/lib/gmGuideGenerator';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prestigeData?: {
    totalPrestigePoints: number;
    prestigeLevel: number;
  };
  onPrestigeRespec?: () => void;
  // New props for dynamic GM guide
  character?: Character;
  abilities?: Ability[];
  unlockedAbilities?: Map<string, number>;
  equippedGear?: Record<EquipmentSlotType, EquipmentItem | null>;
  prestigeLevel?: number;
  aggregatedStats?: CharacterBuildData['aggregatedStats'];
}

export function SettingsModal({ 
  characterName, 
  onEditCharacter, 
  open: controlledOpen, 
  onOpenChange,
  prestigeData,
  onPrestigeRespec,
  character,
  abilities,
  unlockedAbilities,
  equippedGear,
  prestigeLevel,
  aggregatedStats,
}: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [gameModeSettings, setGameModeSettings] = useState<GameModeSettingsType>(() => loadGameModeSettings());
  const [xpProgressionMode, setXPProgressionMode] = useState<XPProgressionMode>(() => loadXPProgressionMode());
  const [copiedStatic, setCopiedStatic] = useState(false);
  const [copiedDynamic, setCopiedDynamic] = useState(false);
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);
  const [showDynamic, setShowDynamic] = useState(true);
  
  const { prestigeRespecDisabled } = useGameMode();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  // Generate dynamic guide based on current character state
  const dynamicGuide = useMemo(() => {
    if (!character || !abilities || !unlockedAbilities || !equippedGear) {
      return null;
    }
    return generateDynamicGMGuide({
      character,
      abilities,
      unlockedAbilities,
      equippedGear,
      prestigeLevel,
      aggregatedStats,
    });
  }, [character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats]);

  // Generate compact state summary
  const stateSummary = useMemo(() => {
    if (!character || !abilities || !unlockedAbilities || !equippedGear) {
      return null;
    }
    return generateCurrentStateSummary({
      character,
      abilities,
      unlockedAbilities,
      equippedGear,
      prestigeLevel,
      aggregatedStats,
    });
  }, [character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats]);

  // Combined guide for copying
  const fullGuide = useMemo(() => {
    if (dynamicGuide) {
      return `${dynamicGuide}\n\n${'='.repeat(60)}\n\n${STATIC_GM_GUIDE}`;
    }
    return STATIC_GM_GUIDE;
  }, [dynamicGuide]);

  const handleGameModeChange = (settings: GameModeSettingsType) => {
    setGameModeSettings(settings);
    saveGameModeSettings(settings);
  };

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

  const hasPrestigePoints = prestigeData && prestigeData.totalPrestigePoints > 0;
  // Prestige respec is no longer needed since points are unified
  const hasDynamicData = !!dynamicGuide;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 font-cinzel">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="game" className="flex-1">
          <TabsList className="w-full justify-start gap-1 p-2 bg-muted/20 border-b border-border/30 rounded-none">
            <TabsTrigger value="game" className="gap-1 text-xs">
              <Gamepad2 className="w-3.5 h-3.5" />
              Game Mode
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Set Up
            </TabsTrigger>
            <TabsTrigger value="character" className="gap-1 text-xs">
              <User className="w-3.5 h-3.5" />
              Character
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1 text-xs">
              <Dices className="w-3.5 h-3.5" />
              Dice
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh]">
            <div className="p-4">
              <TabsContent value="game" className="mt-0 space-y-6">
                <GameModeSettings settings={gameModeSettings} onChange={handleGameModeChange} />
                
                <div className="border-t border-border/30 pt-4">
                  <XPProgressionWidget value={xpProgressionMode} onChange={setXPProgressionMode} />
                </div>
              </TabsContent>

              <TabsContent value="setup" className="mt-0 space-y-4">
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <h3 className="font-cinzel font-semibold text-sm">AI GM Synchronization Guide</h3>
                    <p className="text-xs text-muted-foreground">
                      Copy and paste to your AI Dungeon Master to sync with your character
                    </p>
                  </div>

                  {/* State Snapshot Button - Prominent */}
                  {hasDynamicData && (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleCopySnapshot}
                      className={cn(
                        "w-full gap-2 border-2",
                        copiedSnapshot 
                          ? "border-green-500/50 bg-green-500/10 text-green-400" 
                          : "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400"
                      )}
                    >
                      {copiedSnapshot ? (
                        <>
                          <Check className="w-4 h-4" />
                          Snapshot Copied!
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          Generate Current State Summary
                        </>
                      )}
                    </Button>
                  )}

                  {/* Copy Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCopyFullGuide}
                      className="gap-1.5 flex-1"
                    >
                      {copiedStatic ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-300" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Full Guide
                        </>
                      )}
                    </Button>
                    
                    {hasDynamicData && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyDynamicOnly}
                        className="gap-1.5"
                      >
                        {copiedDynamic ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Build Only
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Snapshot Preview */}
                  {hasDynamicData && stateSummary && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
                          📋 State Snapshot Preview
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Compact format for mid-session updates
                        </span>
                      </div>
                      <pre className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs font-mono whitespace-pre-wrap max-h-[25vh] overflow-y-auto leading-relaxed">
                        {stateSummary}
                      </pre>
                    </div>
                  )}

                  <Separator className="bg-border/30" />

                  {/* Toggle between dynamic and static */}
                  {hasDynamicData && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant={showDynamic ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setShowDynamic(true)}
                        className="text-xs h-7"
                      >
                        Current Build
                      </Button>
                      <Button
                        variant={!showDynamic ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setShowDynamic(false)}
                        className="text-xs h-7"
                      >
                        System Rules
                      </Button>
                    </div>
                  )}

                  {/* Dynamic Build Section */}
                  {showDynamic && hasDynamicData && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">
                          Live Character Data
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Auto-updates with your build
                        </span>
                      </div>
                      <div className="relative">
                        <pre className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-mono whitespace-pre-wrap max-h-[35vh] overflow-y-auto leading-relaxed">
                          {dynamicGuide}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Static System Rules Section */}
                  {(!showDynamic || !hasDynamicData) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          System Reference
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Core mechanics & rules
                        </span>
                      </div>
                      <div className="relative">
                        <pre className="p-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[35vh] overflow-y-auto leading-relaxed">
                          {STATIC_GM_GUIDE}
                        </pre>
                      </div>
                    </div>
                  )}

                  <Separator className="bg-border/30" />

                  <p className="text-xs text-muted-foreground text-center">
                    {hasDynamicData 
                      ? '💡 "Full Guide" includes your current build + system rules. "Build Only" is for quick updates.'
                      : '💡 Configure your character to enable dynamic build snapshots.'}
                  </p>

                  <Separator className="bg-border/30" />

                  {/* Replay Tutorial */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">Tutorial</p>
                      <p className="text-xs text-muted-foreground">Replay the onboarding walkthrough</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem(ONBOARDING_STORAGE_KEY);
                        toast.success('Tutorial reset! Refresh to replay.');
                        setOpen(false);
                      }}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Replay
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="character" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Character</p>
                      <p className="font-cinzel font-bold text-lg">{characterName || 'Unnamed'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onEditCharacter();
                      }}
                    >
                      Edit Character
                    </Button>
                  </div>
                </div>

                {hasPrestigePoints && (
                  <div className={cn(
                    "p-4 rounded-lg border",
                    prestigeRespecDisabled 
                      ? "border-muted/50 bg-muted/20" 
                      : "border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-orange-900/20"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        prestigeRespecDisabled ? "bg-muted/30" : "bg-amber-500/20"
                      )}>
                        <Star className={cn(
                          "w-5 h-5",
                          prestigeRespecDisabled ? "text-muted-foreground" : "text-amber-400 fill-amber-400"
                        )} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
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
                          {prestigeData.totalPrestigePoints} prestige points earned (Prestige Level {prestigeData.prestigeLevel})
                        </p>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          Prestige points are unified with regular ability points and can be spent on any ability.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  Character editing opens the setup wizard
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-0 space-y-4">
                <DiceOddsWidget value={diceOddsMode} onChange={setDiceOddsMode} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
