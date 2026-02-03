import { useState, useMemo } from 'react';
import { Check, Copy, RefreshCw, Camera, Star, Lock, RotateCcw, AlertTriangle, HelpCircle, Download, ImageOff } from 'lucide-react';
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
import { DiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType } from '@/lib/gameModes';
import { useGameMode } from '@/hooks/use-game-mode';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SettingsTab } from './MobileSettingsTabs';

// FAQ Data
const FAQ_ITEMS = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I navigate the app?",
        a: "The Home Screen is your hub. Use the 'Quick Menus' card to access drawers (Oracle, Conditions, Stats, etc.) or tap 'The Main HUD' for combat. The third card changes based on what needs your attention.",
      },
      {
        q: "How do I unlock abilities?",
        a: "Go to the Abilities tab from Home or via Quick Menus. Tap any ability node to view details and spend points. Each ability has 3 tiers - 1 point per tier.",
      },
      {
        q: "What are the three skill trees?",
        a: "Hunter focuses on ranged attacks and tracking. Warrior emphasizes melee combat and defense. Assassin specializes in stealth, critical strikes, and evasion.",
      },
      {
        q: "How do I level up?",
        a: "Gain XP through gameplay. When ready, the 'Level Up!' button in the Home footer glows and pulses. Tap it to advance.",
      },
    ],
  },
  {
    category: "Home Screen",
    questions: [
      {
        q: "What are the status badges at the top?",
        a: "They show real-time info: active conditions (tap to manage), ready cooldowns (tap to view timers), concentration status when casting, and expiring shop items with countdown.",
      },
      {
        q: "What does the health bar show?",
        a: "Your current HP with color-coded urgency (green → amber → red). Temp HP appears as a cyan overlay. AC and Initiative are shown below.",
      },
      {
        q: "What's the 'Available Points' widget?",
        a: "When you have unspent ability points, this amber glowing widget appears. Tap 'Spend Now' to go directly to the Abilities tab.",
      },
      {
        q: "How do I roll dice?",
        a: "Tap the large D20 in the center of the Home Screen to open the full dice roller with multiple dice types and modifiers.",
      },
    ],
  },
  {
    category: "Abilities & Combat",
    questions: [
      {
        q: "What's the difference between Active and Passive abilities?",
        a: "Active abilities require an action to use (action, bonus action, or reaction). Passive abilities are always active once unlocked and provide constant benefits.",
      },
      {
        q: "How do ability loadout slots work?",
        a: "Equip active abilities to loadout slots for quick access during combat. The number of slots increases with your level. Open an ability's detail panel and tap 'Equip to Loadout'.",
      },
      {
        q: "What do the tier levels mean?",
        a: "Each ability has 3 tiers (I, II, III). Higher tiers provide stronger effects. Tier III is the 'Mastered' state, shown with a golden glow.",
      },
      {
        q: "Can I refund ability points?",
        a: "Yes! Tap an unlocked ability and use 'Refund Tier' to reclaim your point. This lets you experiment with different builds.",
      },
    ],
  },
  {
    category: "Drizzt's Legacy",
    questions: [
      {
        q: "What is Drizzt's Legacy?",
        a: "An advanced prestige tree with powerful abilities. Unlock access as you progress and earn prestige levels through extended gameplay.",
      },
      {
        q: "How do I unlock Legacy abilities?",
        a: "Legacy abilities use unified ability points like regular skills. Spend points on any branch, though some have prerequisites.",
      },
      {
        q: "What are the Legacy branches?",
        a: "Five branches representing Drizzt's aspects: Shadow, Hunter, Protector, Blademaster, and Survivor. Each offers unique abilities.",
      },
    ],
  },
  {
    category: "Equipment & Gear",
    questions: [
      {
        q: "How do I equip items?",
        a: "Go to the Gear tab and tap an equipment slot. Select an item from your inventory. Different slots accept different item types.",
      },
      {
        q: "What are Set Bonuses?",
        a: "Legendary sets grant bonus effects when you equip multiple pieces. Check the Set Bonus panel (via Quick Menus → Set Bonus) for details.",
      },
      {
        q: "How do I unlock better gear?",
        a: "Legendary items unlock at higher levels. Check the Gear tab to see what's available at your current level.",
      },
    ],
  },
  {
    category: "Oracle & AI",
    questions: [
      {
        q: "What is the Oracle?",
        a: "An AI assistant accessible via Quick Menus → Oracle. It's character-aware and can answer questions about your build, suggest tactics, or roleplay as various personalities.",
      },
      {
        q: "What personalities can the Oracle use?",
        a: "Choose from The Thunderhead (omniscient), JARVIS (formal), Deadpool (chaotic), Gandalf (wizard), Jarlaxle (mercenary), or The Investigator (analytical).",
      },
      {
        q: "How do I sync with my AI GM?",
        a: "Go to Settings → Set Up tab. Use 'Generate State Summary' to copy your character's current build, then paste it into your AI GM chat.",
      },
    ],
  },
  {
    category: "Rests & Resources",
    questions: [
      {
        q: "What's the difference between Short and Long Rest?",
        a: "Short Rest is a quick tap to recover some resources. Long Rest requires holding the button for 0.8 seconds to prevent accidents - it fully restores HP and resets all cooldowns.",
      },
      {
        q: "How do cooldowns work?",
        a: "Some abilities have cooldowns (per-rest or time-based). View them via the status badge or Quick Menus → Timers. They reset on the appropriate rest type.",
      },
      {
        q: "What are conditions?",
        a: "Status effects like Poisoned, Frightened, or Concentrating. Manage them via the Conditions badge or Quick Menus → Conditions drawer.",
      },
    ],
  },
  {
    category: "Data & Saving",
    questions: [
      {
        q: "Is my progress saved automatically?",
        a: "Yes! Character data, abilities, and equipment save to your browser automatically. Use Cloud Save for backup across devices.",
      },
      {
        q: "How do I use Cloud Save?",
        a: "Sign in with your account and enable Cloud Save. Your progress syncs across devices and is protected from data loss.",
      },
      {
        q: "How do I reset everything?",
        a: "Go to Settings → Character tab → Danger Zone. Use 'Reset Entire App' to start fresh. Warning: This is permanent!",
      },
    ],
  },
];

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
  onClearAllCustomImages?: () => void;
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
  onClearAllCustomImages,
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

  // FAQ Tab
  if (activeTab === 'faq') {
    return (
      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        <div className="space-y-4 pb-6">
          <div>
            <h3 className="font-cinzel font-semibold text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              Help & FAQ
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Answers to common questions
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((category, catIdx) => (
              <div key={catIdx} className="space-y-2">
                <Badge variant="secondary" className="text-xs">
                  {category.category}
                </Badge>
                <Accordion type="single" collapsible className="space-y-1">
                  {category.questions.map((item, qIdx) => (
                    <AccordionItem 
                      key={qIdx} 
                      value={`${catIdx}-${qIdx}`}
                      className="border border-border/30 rounded-lg px-3 bg-muted/20"
                    >
                      <AccordionTrigger className="text-sm text-left py-3 hover:no-underline">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-3">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
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
                    {equipmentImageCount > 0 && `${equipmentImageCount} equipment`}
                    {equipmentImageCount > 0 && abilityImageCount > 0 && ' + '}
                    {abilityImageCount > 0 && `${abilityImageCount} ability`}
                    {' '}image{totalCustomImages !== 1 ? 's' : ''} stored
                  </p>
                </div>
              </div>
              
              <AlertDialog open={showClearImagesDialog} onOpenChange={setShowClearImagesDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-12 border-amber-500/30 hover:bg-amber-500/10 text-amber-400"
                  >
                    <ImageOff className="w-4 h-4" />
                    Clear All Custom Images
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
                          {equipmentImageCount > 0 && (
                            <p className="text-sm text-foreground flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              {equipmentImageCount} equipment slot{equipmentImageCount !== 1 ? 's' : ''}
                            </p>
                          )}
                          {abilityImageCount > 0 && (
                            <p className="text-sm text-foreground flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              {abilityImageCount} ability node{abilityImageCount !== 1 ? 's' : ''}
                            </p>
                          )}
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
