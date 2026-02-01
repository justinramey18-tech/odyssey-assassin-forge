import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, getLevelProgress, XP_PRESETS } from '@/lib/xpSystem';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { 
  ArrowLeft, Heart, Shield, Zap, 
  BookOpen, Backpack, Trophy, Swords, 
  Scroll, Beaker, FileSearch, Star,
  Coffee, Moon, TrendingUp, Settings,
  PanelLeft, Gem, Sparkles, Timer, MessageCircle, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import type { LucideIcon } from 'lucide-react';

import tposeBackground from '@/assets/generated/deadpool-assassin-tpose-dive.jpg';
import tposeBackgroundMobile from '@/assets/generated/deadpool-assassin-tpose-dive-mobile.jpg';
import assassinLogo from '@/assets/assassin-logo.png';

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
  | 'chronicle';

// Card types for navigation
type CardType = 'navigation' | 'drawers';

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
  // HP props
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
}

interface NavigationCardData {
  id: NavigableTab | 'drawers';
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  type: CardType;
}

// Navigation card configuration - ordered by user preference
const navigationCards: NavigationCardData[] = [
  { id: 'drawers', label: 'Drawers', description: 'Quick-access panels', 
    icon: PanelLeft, color: 'text-cyan-400', type: 'drawers' },
  { id: 'combat', label: 'Combat', description: 'Battle tracker', 
    icon: Swords, color: 'text-red-400', type: 'navigation' },
  { id: 'consumables', label: 'Items', description: 'Potions & scrolls', 
    icon: Beaker, color: 'text-green-400', type: 'navigation' },
  { id: 'abilities', label: 'Abilities', description: 'Unlock & upgrade', 
    icon: Zap, color: 'text-violet-400', type: 'navigation' },
  { id: 'gear', label: 'Gear', description: 'Equipment & inventory', 
    icon: Backpack, color: 'text-amber-400', type: 'navigation' },
  { id: 'stars', label: 'Stars', description: 'Constellation view', 
    icon: Star, color: 'text-purple-400', type: 'navigation' },
  { id: 'feats', label: 'Feats', description: 'Achievements & progress', 
    icon: Trophy, color: 'text-yellow-400', type: 'navigation' },
  { id: 'skills', label: 'Skills', description: 'Proficiencies & checks', 
    icon: BookOpen, color: 'text-blue-400', type: 'navigation' },
  { id: 'chronicle', label: 'Chronicle', description: 'Session log sync', 
    icon: FileSearch, color: 'text-blue-300', type: 'navigation' },
  { id: 'scribe', label: 'Scribe', description: 'AI narrative tools', 
    icon: Scroll, color: 'text-orange-400', type: 'navigation' },
];

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }
  },
};

// Transparent card styles
const transparentCardBase = "border border-white/20 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200";
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
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP = 0,
}: HomeScreenProps) {
  const isMobile = useIsMobile();
  const stats = useEquipmentStats(equipment);
  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const [showDrawersMenu, setShowDrawersMenu] = useState(false);
  
  // Get drawer context - wrapped in try/catch since we might be outside provider
  let drawerContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    drawerContext = usePromptDrawers();
  } catch {
    // Not inside PromptDrawerProvider - drawers won't be available
  }

  // XP calculations
  const nextLevelXP = getXPForLevel(character.level + 1, multiplier);
  const currentLevelXP = getXPForLevel(character.level, multiplier);
  const xpProgress = character.level >= 20 ? 100 : getLevelProgress(character.level, currentXP, multiplier);
  const canLevelUp = character.level < 20 && currentXP >= nextLevelXP;

  // Badge calculation logic
  const getBadge = (tabId: string): string | number | undefined => {
    switch (tabId) {
      case 'abilities':
        const available = getAbilityPointsForLevel(character.level) - 
          getTotalPointsSpent(character.abilities);
        return available > 0 ? available : undefined;
      
      case 'feats':
        const unclaimed = achievements.filter(
          a => a.currentValue >= a.maxValue && !a.claimedMilestones?.includes(100)
        ).length;
        return unclaimed > 0 ? unclaimed : undefined;
      
      case 'chronicle':
        const hasUndo = localStorage.getItem('odyssey-chronicle-undo');
        return hasUndo ? '!' : undefined;
      
      default:
        return undefined;
    }
  };

  // Calculate HP values
  const defaultMaxHP = character.level * 8 + 10;
  const maxHP = propMaxHP ?? defaultMaxHP;
  const currentHP = propCurrentHP ?? maxHP;
  const tempHP = propTempHP;
  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  
  // HP color based on percentage
  const getHPColor = () => {
    if (hpPercentage > 50) return 'text-emerald-400';
    if (hpPercentage > 25) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Quick stats configuration
  const quickStats = useMemo(() => [
    {
      label: 'HP',
      value: `${currentHP}/${maxHP}`,
      subValue: tempHP > 0 ? `+${tempHP}` : undefined,
      icon: Heart,
      color: getHPColor(),
      hasBar: true,
      barPercent: hpPercentage,
    },
    {
      label: 'AC',
      value: stats.totalAC.toString(),
      icon: Shield,
      color: 'text-blue-400',
    },
    {
      label: 'Init',
      value: stats.dexterity >= 0 ? `+${stats.dexterity}` : stats.dexterity.toString(),
      icon: Zap,
      color: 'text-yellow-400',
    },
  ], [currentHP, maxHP, tempHP, hpPercentage, stats]);

  const handleCardClick = (cardId: NavigableTab) => {
    triggerHaptic('light');
    onNavigateToTab(cardId);
  };

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

  return (
    <BackgroundWrapper
      imagePath={isMobile ? tposeBackgroundMobile : tposeBackground}
      overlayOpacity={50}
      tintColor="red"
      tintOpacity={10}
      fixed={true}
      backgroundSize="contain"
      backgroundPosition="center center"
      className="fixed inset-0 z-50"
    >
      {/* Centered Assassin Logo Watermark */}
      <div 
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        aria-hidden="true"
      >
        <img 
          src={assassinLogo} 
          alt="" 
          className="w-[20vh] h-[20vh] opacity-35 object-contain"
        />
      </div>

      <div className="flex flex-col h-screen overflow-hidden relative z-10">
        {/* Install Banner */}
        <InstallBanner />

        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
          <button 
            onClick={onReturnToBuilder}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12 border-2 border-primary shrink-0">
              <AvatarFallback className="text-lg font-bold bg-primary/20 text-white font-cinzel">
                {character.name.substring(0, 2).toUpperCase() || 'DP'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-cinzel font-bold text-lg truncate text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {character.name || 'Mercenary'}
                </h1>
                <Badge variant="secondary" className="shrink-0 bg-white/20 text-white border-none font-cinzel">
                  Lv.{character.level}
                </Badge>
              </div>
              
              {/* XP Progress */}
              <div className="mt-1 space-y-0.5">
                <Progress value={xpProgress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                  <span>{currentXP.toLocaleString()} XP</span>
                  <span>
                    {character.level >= 20 
                      ? 'MAX' 
                      : `${nextLevelXP.toLocaleString()} XP`}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  onOpenSettings();
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5 text-white/80" />
              </button>
            )}
            <ClockWidget />
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Quick Stats Row */}
          <motion.div 
            className="grid grid-cols-3 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickStats.map((stat) => (
              <motion.div key={stat.label} variants={itemVariants}>
                <div className={cn(transparentCardBase, "p-3 flex flex-col items-center gap-1.5")}>
                  <div className="p-2 rounded-full bg-white/10">
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className={cn("text-lg font-cinzel font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]", stat.color)}>
                      {stat.value}
                    </p>
                    {'subValue' in stat && stat.subValue && (
                      <span className="text-xs text-sky-400 font-medium">{stat.subValue}</span>
                    )}
                  </div>
                  {'hasBar' in stat && stat.hasBar && (
                    <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div 
                        className={cn("h-full transition-all", 
                          stat.barPercent! > 50 ? 'bg-emerald-500' : 
                          stat.barPercent! > 25 ? 'bg-amber-500' : 'bg-rose-500'
                        )}
                        style={{ width: `${stat.barPercent}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-white/70 uppercase tracking-widest font-cinzel drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                    {stat.label}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Navigation Grid */}
          <motion.div 
            className={cn(
              "grid gap-3",
              "grid-cols-2",
              "md:grid-cols-3",
              "lg:grid-cols-4"
            )}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {navigationCards.map((card) => {
              const badge = card.type === 'navigation' ? getBadge(card.id) : undefined;
              const IconComponent = card.icon;
              
              // Handle Drawers card specially
              if (card.type === 'drawers') {
                if (!drawerContext) return null;
                
                return (
                  <motion.div key={card.id} variants={itemVariants}>
                    <button
                      className={cn(
                        transparentButtonBase,
                        "cursor-pointer min-h-[120px] p-4 w-full",
                        "flex flex-col items-center justify-center text-center gap-2",
                        "border-cyan-500/30 hover:border-cyan-400/50"
                      )}
                      onClick={() => {
                        triggerHaptic('light');
                        setShowDrawersMenu(true);
                      }}
                      style={{ touchAction: 'manipulation' }}
                      aria-label="Open quick-access drawers menu"
                    >
                      <div className="relative">
                        <div className={cn(
                          "rounded-full flex items-center justify-center bg-white/10",
                          isMobile ? "w-12 h-12" : "w-14 h-14"
                        )}>
                          <IconComponent className={cn(
                            card.color,
                            isMobile ? "w-6 h-6" : "w-7 h-7"
                          )} />
                        </div>
                      </div>
                      
                      <h3 
                        className={cn(
                          "font-cinzel font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
                          isMobile ? "text-sm" : "text-base"
                        )}
                      >
                        {card.label}
                      </h3>
                      
                      {!isMobile && (
                        <p className="text-xs text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                          {card.description}
                        </p>
                      )}
                    </button>
                  </motion.div>
                );
              }
              
              // Regular navigation cards
              return (
                <motion.div key={card.id} variants={itemVariants}>
                  <button
                    className={cn(
                      transparentButtonBase,
                      "cursor-pointer min-h-[120px] p-4 w-full",
                      "flex flex-col items-center justify-center text-center gap-2"
                    )}
                    onClick={() => handleCardClick(card.id as NavigableTab)}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={`Navigate to ${card.label}. ${card.description}${
                      badge ? `. ${badge} notifications.` : ''
                    }`}
                  >
                    {/* Icon with badge */}
                    <div className="relative">
                      <div className={cn(
                        "rounded-full flex items-center justify-center bg-white/10",
                        isMobile ? "w-12 h-12" : "w-14 h-14"
                      )}>
                        <IconComponent className={cn(
                          card.color,
                          isMobile ? "w-6 h-6" : "w-7 h-7"
                        )} />
                      </div>
                      
                      {/* Notification Badge */}
                      {badge !== undefined && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs animate-badge-pulse"
                        >
                          {badge}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Label */}
                    <h3 
                      className={cn(
                        "font-cinzel font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
                        isMobile ? "text-sm" : "text-base"
                      )}
                    >
                      {card.label}
                    </h3>
                    
                    {/* Description (Desktop only) */}
                    {!isMobile && (
                      <p className="text-xs text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                        {card.description}
                      </p>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Quick Actions Footer */}
        <footer className="border-t border-white/10 p-4">
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <button
              className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 text-white")}
              onClick={() => handleQuickAction('shortRest')}
              style={{ touchAction: 'manipulation' }}
            >
              <Coffee className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Short Rest</span>
            </button>
            
            <button
              className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 text-white")}
              onClick={() => handleQuickAction('longRest')}
              style={{ touchAction: 'manipulation' }}
            >
              <Moon className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Long Rest</span>
            </button>
            
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
                className={cn(transparentCardBase, "py-3 flex flex-col items-center gap-1 opacity-40 cursor-not-allowed")}
              >
                <TrendingUp className="w-5 h-5 text-white/50" />
                <span className="text-xs font-cinzel text-white/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">Level Up</span>
              </div>
            )}
          </div>
        </footer>
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
    </BackgroundWrapper>
  );
}
