import { useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, getLevelProgress, XP_PRESETS } from '@/lib/xpSystem';
import { ShopItem } from '@/lib/shop/types';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { 
  Settings, Coffee, Moon, TrendingUp,
  BookOpen, Sparkles, Timer, MessageCircle, Activity, Heart, Gem, Zap, PanelLeft, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { DiceRollerScreen } from '@/components/diceRoller';

// New redesigned components
import { CharacterNamePlaque } from './CharacterNamePlaque';
import { StatusIndicatorRow } from './StatusIndicatorRow';
import { DynamicHealthBar } from './DynamicHealthBar';
import { AvailablePointsWidget } from './AvailablePointsWidget';
import { EnlargedD20Section } from './EnlargedD20Section';
import { PrimaryNavigationCards } from './PrimaryNavigationCards';
import { BackgroundUploadButton } from './BackgroundUploadButton';

import homeBackground from '@/assets/home-background-new.jpg';

// Navigable tab types
type NavigableTab = 
  | 'skills' 
  | 'abilities' 
  | 'gear' 
  | 'feats' 
  | 'stars' 
  | 'scribe' 
  | 'combat' 
  | 'consumables' 
  | 'chronicle'
  | 'shop';

interface HomeScreenProps {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  currentXP: number;
  xpPreset: XPPreset;
  onBack: () => void;
  onNavigateToTab: (tab: NavigableTab) => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onAddXP: (amount: number, source: string) => void;
  onXPPresetChange: (preset: XPPreset) => void;
  onManualLevelUp: () => void;
  onReturnToBuilder: () => void;
  onOpenSettings?: () => void;
  onOpenFAQ?: () => void;
  // HP props
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  // Shop items for status indicators
  shopItems?: ShopItem[];
  // Initiative modifier (synced from ability scores)
  initiativeModifier?: number;
  // Custom background support
  customBackground?: string | null;
  onCustomBackgroundUpload?: (file: File) => Promise<void>;
  onCustomBackgroundClear?: () => void;
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

// Transparent button style
const transparentButtonBase = "border border-white/30 rounded-lg bg-transparent hover:bg-white/10 hover:border-white/50 transition-all duration-300";

export function HomeScreen({ 
  character, 
  equipment, 
  achievements,
  currentXP,
  xpPreset,
  onNavigateToTab,
  onShortRest,
  onLongRest,
  onManualLevelUp,
  onReturnToBuilder,
  onOpenSettings,
  onOpenFAQ,
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP = 0,
  shopItems = [],
  initiativeModifier = 0,
  customBackground,
  onCustomBackgroundUpload,
  onCustomBackgroundClear,
}: HomeScreenProps) {
  const isMobile = useIsMobile();
  const stats = useEquipmentStats(equipment);
  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const [showDrawersMenu, setShowDrawersMenu] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [initiativeRollResult, setInitiativeRollResult] = useState<{ roll: number; total: number; prompt: string } | null>(null);
  
  // Long Rest hold state
  const [longRestProgress, setLongRestProgress] = useState(0);
  const longRestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const LONG_REST_HOLD_DURATION = 800; // 0.8 seconds
  
  // Get drawer context
  let drawerContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    drawerContext = usePromptDrawers();
  } catch {
    // Not inside PromptDrawerProvider
  }

  // XP calculations
  const nextLevelXP = getXPForLevel(character.level + 1, multiplier);
  const canLevelUp = character.level < 20 && currentXP >= nextLevelXP;

  // Calculate HP values
  const defaultMaxHP = character.level * 8 + 10;
  const maxHP = propMaxHP ?? defaultMaxHP;
  const currentHP = propCurrentHP ?? maxHP;
  const tempHP = propTempHP;

  // Available ability points
  const availableAbilityPoints = useMemo(() => {
    return Math.max(0, getAbilityPointsForLevel(character.level) - getTotalPointsSpent(character.abilities));
  }, [character.level, character.abilities]);

  // Check for chronicle undo
  const hasChronicleUndo = !!localStorage.getItem('odyssey-chronicle-undo');
  
  // Check for new shop items (items added in last 10 minutes)
  const hasNewShopItems = useMemo(() => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return shopItems.some(item => new Date(item.detectedAt).getTime() > tenMinutesAgo);
  }, [shopItems]);

  // Get conditions data from drawer context
  const activeConditionCount = drawerContext?.conditions.activeCount ?? 0;
  const mostSevereCondition = useMemo(() => {
    if (!drawerContext) return null;
    const debuffs = drawerContext.conditions.debuffs;
    if (debuffs.length === 0) return null;
    // Get the first debuff name
    const firstDebuff = debuffs[0];
    return { name: firstDebuff?.name ?? 'Unknown', severity: 'moderate' as const };
  }, [drawerContext?.conditions.debuffs]);
  
  const hasConcentration = drawerContext?.conditions.hasConcentration ?? false;
  const concentrationSpell = drawerContext?.conditions.concentrationSpell;
  const concentrationSpellName = concentrationSpell?.name ?? null;

  // Cooldown summary
  const readyCooldownCount = drawerContext?.cooldownSummary.readyCount ?? 0;
  const coolingCooldownCount = drawerContext?.cooldownSummary.coolingCount ?? 0;

  // Initiative roll handler
  const handleInitiativeRoll = useCallback(() => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + initiativeModifier;
    
    // Generate AI DM prompt
    const rollQuality = roll === 20 ? 'NATURAL 20!' : roll === 1 ? 'NATURAL 1...' : roll >= 15 ? 'high' : roll <= 5 ? 'low' : 'moderate';
    const prompt = `🎲 **INITIATIVE ROLL**\n\n${character.name} rolls for initiative!\n\n**Roll:** ${roll} + ${initiativeModifier} (DEX) = **${total}**\n\n${roll === 20 ? '⚡ CRITICAL AWARENESS! ' + character.name + ' reacts with lightning reflexes, ready to strike before anyone else can blink.' : roll === 1 ? '😴 Caught completely off-guard... ' + character.name + ' is the last to realize combat has begun.' : `${character.name} enters the fray with ${rollQuality} awareness.`}\n\n*Narrate how ${character.name} enters combat with an initiative of ${total}.*`;
    
    setInitiativeRollResult({ roll, total, prompt });
    
    // Copy to clipboard
    navigator.clipboard.writeText(prompt).then(() => {
      triggerHaptic('medium');
    });
  }, [initiativeModifier, character.name]);

  const handleQuickAction = (action: 'shortRest' | 'longRest' | 'levelUp') => {
    triggerHaptic('medium');
    switch (action) {
      case 'shortRest':
        onShortRest();
        break;
      case 'longRest':
        onLongRest();
        break;
      case 'levelUp':
        onManualLevelUp();
        break;
    }
  };

  // Long Rest hold handlers
  const handleLongRestStart = useCallback(() => {
    setLongRestProgress(0);
    const startTime = Date.now();
    
    longRestTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / LONG_REST_HOLD_DURATION) * 100, 100);
      setLongRestProgress(progress);
      
      if (elapsed >= LONG_REST_HOLD_DURATION) {
        if (longRestTimerRef.current) {
          clearInterval(longRestTimerRef.current);
          longRestTimerRef.current = null;
        }
        handleQuickAction('longRest');
        setLongRestProgress(0);
      }
    }, 50);
  }, []);

  const handleLongRestEnd = useCallback(() => {
    if (longRestTimerRef.current) {
      clearInterval(longRestTimerRef.current);
      longRestTimerRef.current = null;
    }
    setLongRestProgress(0);
  }, []);

  // Drawer menu options
  const drawerOptions = [
    { id: 'oracle', label: 'Oracle', icon: MessageCircle, color: 'text-red-400', action: drawerContext?.openOracleDrawer },
    { id: 'conditions', label: 'Conditions', icon: Activity, color: 'text-rose-400', action: drawerContext?.openConditionsDrawer },
    { id: 'stats', label: 'Stats', icon: Heart, color: 'text-green-400', action: drawerContext?.openStatsDrawer },
    { id: 'setbonus', label: 'Set Bonus', icon: Sparkles, color: 'text-amber-400', action: drawerContext?.openSetBonusDrawer },
    { id: 'prompts', label: 'Prompts', icon: Gem, color: 'text-yellow-400', action: drawerContext?.openInfinityDrawer },
    { id: 'abilities', label: 'Abilities', icon: Zap, color: 'text-purple-400', action: drawerContext?.openAbilitiesDrawer },
    { id: 'scribe', label: 'Scribe', icon: BookOpen, color: 'text-orange-400', action: drawerContext?.openScribeDrawer },
    { id: 'timers', label: 'Timers', icon: Timer, color: 'text-cyan-400', action: drawerContext?.openCooldownDrawer },
  ];

  const handleDrawerOptionClick = (action?: () => void) => {
    if (action) {
      triggerHaptic('light');
      setShowDrawersMenu(false);
      action();
    }
  };

  const handleContextualCardClick = (cardId: string) => {
    triggerHaptic('light');
    if (cardId === 'shop') {
      onNavigateToTab('consumables'); // Shop is part of consumables/inventory
    } else {
      onNavigateToTab(cardId as NavigableTab);
    }
  };

  return (
    <BackgroundWrapper
      imagePath={customBackground || homeBackground}
      overlayOpacity={customBackground ? 55 : 45}
      tintColor="cyan"
      tintOpacity={8}
      fixed={true}
      backgroundSize={customBackground ? 'cover' : 'contain'}
      backgroundPosition="center center"
      className="fixed inset-0 z-50"
    >
      <div className="flex flex-col h-screen overflow-hidden relative z-10">
        {/* Install Banner */}
        <InstallBanner />

        {/* Minimal Utilities Header */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        >
          <ClockWidget />
          
          <div className="flex items-center gap-1">
            {/* Custom Background Upload Button */}
            {onCustomBackgroundUpload && onCustomBackgroundClear && (
              <BackgroundUploadButton
                hasCustomBackground={!!customBackground}
                onUpload={onCustomBackgroundUpload}
                onClear={onCustomBackgroundClear}
              />
            )}
            
            {onOpenFAQ && (
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  onOpenFAQ();
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Help & FAQ"
              >
                <HelpCircle className="w-5 h-5 text-white/80" />
              </button>
            )}
            {onOpenSettings && (
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  onOpenSettings();
                }}
                className="p-2 -mr-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5 text-white/80" />
              </button>
            )}
          </div>
        </motion.header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col gap-4 py-4">
            {/* Character Name Plaque - Full width thin bar */}
            <CharacterNamePlaque 
              name={character.name} 
              level={character.level} 
            />

            {/* Dynamic Health Bar */}
            <DynamicHealthBar
              currentHP={currentHP}
              maxHP={maxHP}
              tempHP={tempHP}
              ac={stats.totalAC}
              initiative={initiativeModifier}
              onInitiativeClick={handleInitiativeRoll}
            />

            {/* Live Status Indicator Row - Centered below AC/Init */}
            <StatusIndicatorRow
              activeConditionCount={activeConditionCount}
              mostSevereCondition={mostSevereCondition}
              hasConcentration={hasConcentration}
              concentrationSpellName={concentrationSpellName}
              readyCooldownCount={readyCooldownCount}
              coolingCooldownCount={coolingCooldownCount}
              shopItems={shopItems}
              onConditionsClick={() => drawerContext?.openConditionsDrawer()}
              onCooldownsClick={() => drawerContext?.openCooldownDrawer()}
              onShopClick={() => onNavigateToTab('consumables')}
            />

            {/* Initiative Roll Result Toast */}
            {initiativeRollResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/40 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                      initiativeRollResult.roll === 20 ? "bg-yellow-500 text-black" :
                      initiativeRollResult.roll === 1 ? "bg-red-500 text-white" :
                      "bg-yellow-500/30 text-yellow-400"
                    )}>
                      {initiativeRollResult.roll}
                    </div>
                    <div>
                      <p className="text-xs text-yellow-400/80 font-cinzel uppercase">Initiative</p>
                      <p className="font-bold text-white text-lg">
                        Total: {initiativeRollResult.total}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setInitiativeRollResult(null)}
                    className="text-white/60 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-yellow-400/60 mt-2">✓ Copied to clipboard for AI DM</p>
              </motion.div>
            )}

            {/* Available Points Widget (Conditional) */}
            <AvailablePointsWidget
              availablePoints={availableAbilityPoints}
              onSpendClick={() => {
                triggerHaptic('light');
                onNavigateToTab('abilities');
              }}
            />

            {/* Enlarged D20 Section */}
            <EnlargedD20Section 
              onClick={() => setShowDiceRoller(true)} 
            />

            {/* Quick Actions (moved from footer) */}
            <div className="px-4 py-2">
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                {/* Short Rest */}
                <button
                  className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 text-white")}
                  onClick={() => handleQuickAction('shortRest')}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Coffee className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Short Rest</span>
                </button>
                
                {/* Long Rest (Hold to activate) */}
                <button
                  className={cn(
                    transparentButtonBase, 
                    "py-3 flex flex-col items-center gap-1 text-white relative overflow-hidden"
                  )}
                  onTouchStart={handleLongRestStart}
                  onTouchEnd={handleLongRestEnd}
                  onTouchCancel={handleLongRestEnd}
                  onMouseDown={handleLongRestStart}
                  onMouseUp={handleLongRestEnd}
                  onMouseLeave={handleLongRestEnd}
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Hold for Long Rest"
                >
                  {/* Progress Overlay */}
                  <div 
                    className="absolute inset-0 bg-blue-500/30 transition-all"
                    style={{ width: `${longRestProgress}%` }}
                  />
                  <Moon className="w-5 h-5 text-blue-400 relative z-10" />
                  <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] relative z-10">
                    {longRestProgress > 0 ? 'Hold...' : 'Long Rest'}
                  </span>
                </button>
                
                {/* Level Up */}
                {canLevelUp ? (
                  <button
                    className={cn(
                      transparentButtonBase, 
                      "py-3 flex flex-col items-center gap-1 text-white",
                      "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)] animate-pulse"
                    )}
                    onClick={() => handleQuickAction('levelUp')}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Level Up</span>
                  </button>
                ) : (
                  <div
                    className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 opacity-40 cursor-not-allowed")}
                  >
                    <TrendingUp className="w-5 h-5 text-white/50" />
                    <span className="text-xs font-cinzel text-white/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">Level Up</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation Cards Footer */}
        <motion.footer 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.3 }}
          className="border-t border-white/10 p-4"
        >
          <PrimaryNavigationCards
            onQuickMenusClick={() => {
              triggerHaptic('light');
              setShowDrawersMenu(true);
            }}
            onCombatClick={() => {
              triggerHaptic('light');
              onNavigateToTab('combat');
            }}
            onContextualClick={handleContextualCardClick}
            achievements={achievements}
            hasChronicleUndo={hasChronicleUndo}
            hasNewShopItems={hasNewShopItems}
          />
        </motion.footer>
      </div>

      {/* Drawers Quick-Access Sheet */}
      <Sheet open={showDrawersMenu} onOpenChange={setShowDrawersMenu}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetTitle className="text-center font-cinzel mb-4">Quick-Access Drawers</SheetTitle>
          
          <div className="grid grid-cols-3 gap-3 pb-6">
            {drawerOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => handleDrawerOptionClick(option.action)}
                  disabled={!option.action}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg",
                    "border border-border/50 bg-card/50",
                    "hover:bg-card hover:border-border transition-all",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-muted/50"
                  )}>
                    <IconComponent className={cn("w-6 h-6", option.color)} />
                  </div>
                  <span className="text-sm font-medium font-cinzel">{option.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dice Roller Overlay */}
      {showDiceRoller && (
        <div className="fixed inset-0 z-[60] bg-background">
          <DiceRollerScreen onBack={() => setShowDiceRoller(false)} />
        </div>
      )}
    </BackgroundWrapper>
  );
}
