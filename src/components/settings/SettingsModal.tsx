import { useState } from 'react';
import { Settings, User, Layers, Dices, Gamepad2, RotateCcw, Star, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloatingOverlaySettings } from './FloatingOverlaySettings';
import { DiceOddsWidget } from './DiceOddsWidget';
import { GameModeSettings } from './GameModeSettings';
import { XPProgressionWidget, XPProgressionMode, loadXPProgressionMode } from './XPProgressionWidget';
import { DiceOddsMode, loadDiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType, loadGameModeSettings, saveGameModeSettings } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Prestige respec props
  prestigeData?: {
    totalPrestigePoints: number;
    spentPrestigePoints: number;
    availablePrestigePoints: number;
  };
  onPrestigeRespec?: () => void;
}

export function SettingsModal({ 
  characterName, 
  onEditCharacter, 
  open: controlledOpen, 
  onOpenChange,
  prestigeData,
  onPrestigeRespec,
}: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [gameModeSettings, setGameModeSettings] = useState<GameModeSettingsType>(() => loadGameModeSettings());
  const [xpProgressionMode, setXPProgressionMode] = useState<XPProgressionMode>(() => loadXPProgressionMode());
  
  const { prestigeRespecDisabled } = useGameMode();

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const handleGameModeChange = (settings: GameModeSettingsType) => {
    setGameModeSettings(settings);
    saveGameModeSettings(settings);
  };

  const hasPrestigePoints = prestigeData && prestigeData.totalPrestigePoints > 0;
  const hasSpentPoints = prestigeData && prestigeData.spentPrestigePoints > 0;
  const canRespec = hasSpentPoints && !prestigeRespecDisabled && onPrestigeRespec;

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
            <TabsTrigger value="app" className="gap-1 text-xs">
              <Layers className="w-3.5 h-3.5" />
              App
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

              <TabsContent value="app" className="mt-0 space-y-4">
                {/* Floating Overlay Settings */}
                <FloatingOverlaySettings />

                {/* Future app settings can go here */}
                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  More app settings coming soon
                </div>
              </TabsContent>

              <TabsContent value="character" className="mt-0 space-y-4">
                {/* Character Name Display */}
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

                {/* Prestige Respec Section */}
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
                          {prestigeData.spentPrestigePoints} of {prestigeData.totalPrestigePoints} points spent
                        </p>
                        
                        <div className="mt-3 flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canRespec}
                            onClick={onPrestigeRespec}
                            className={cn(
                              "gap-1.5",
                              canRespec && "border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
                            )}
                          >
                            {prestigeRespecDisabled ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Reset Prestige Points
                          </Button>
                          
                          {!hasSpentPoints && !prestigeRespecDisabled && (
                            <span className="text-xs text-muted-foreground">
                              No points to reset
                            </span>
                          )}
                        </div>
                        
                        {prestigeRespecDisabled && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Disable "No Prestige Respec" in Game Mode settings to enable respec.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/30">
                  Character editing opens the setup wizard
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-0 space-y-4">
                {/* Dice Odds Widget */}
                <DiceOddsWidget value={diceOddsMode} onChange={setDiceOddsMode} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
