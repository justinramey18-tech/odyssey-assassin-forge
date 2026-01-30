import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, getLevelProgress, XP_PRESETS } from '@/lib/xpSystem';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  ArrowLeft, Heart, Shield, Zap, 
  BookOpen, Backpack, Trophy, Swords, 
  Scroll, Beaker, FileSearch, Star,
  Coffee, Moon, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import type { LucideIcon } from 'lucide-react';

import tposeBackground from '@/assets/generated/deadpool-assassin-tpose-dive.jpg';
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
}

interface NavigationCardData {
  id: NavigableTab;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

// Navigation card configuration
const navigationCards: NavigationCardData[] = [
  { id: 'skills', label: 'Skills', description: 'Proficiencies & checks', 
    icon: BookOpen, color: 'text-blue-400' },
  { id: 'abilities', label: 'Abilities', description: 'Unlock & upgrade', 
    icon: Zap, color: 'text-violet-400' },
  { id: 'gear', label: 'Gear', description: 'Equipment & inventory', 
    icon: Backpack, color: 'text-amber-400' },
  { id: 'feats', label: 'Feats', description: 'Achievements & progress', 
    icon: Trophy, color: 'text-yellow-400' },
  { id: 'combat', label: 'Combat', description: 'Battle tracker', 
    icon: Swords, color: 'text-red-400' },
  { id: 'scribe', label: 'Scribe', description: 'AI narrative tools', 
    icon: Scroll, color: 'text-orange-400' },
  { id: 'consumables', label: 'Items', description: 'Potions & scrolls', 
    icon: Beaker, color: 'text-green-400' },
  { id: 'chronicle', label: 'Chronicle', description: 'Session log sync', 
    icon: FileSearch, color: 'text-blue-300' },
  { id: 'stars', label: 'Stars', description: 'Constellation view', 
    icon: Star, color: 'text-purple-400' },
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
}: HomeScreenProps) {
  const isMobile = useIsMobile();
  const stats = useEquipmentStats(equipment);
  const multiplier = XP_PRESETS[xpPreset].multiplier;

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

  // Quick stats configuration
  const quickStats = useMemo(() => [
    {
      label: 'HP',
      value: `${character.level * 8 + 10}`,
      icon: Heart,
      color: 'text-red-400',
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
  ], [character.level, stats]);

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

  return (
    <BackgroundWrapper
      imagePath={tposeBackground}
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
          
          <ClockWidget />
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
                  <p className="text-xl font-cinzel font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {stat.value}
                  </p>
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
              const badge = getBadge(card.id);
              const IconComponent = card.icon;
              
              return (
                <motion.div key={card.id} variants={itemVariants}>
                  <button
                    className={cn(
                      transparentButtonBase,
                      "cursor-pointer min-h-[120px] p-4 w-full",
                      "flex flex-col items-center justify-center text-center gap-2"
                    )}
                    onClick={() => handleCardClick(card.id)}
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
    </BackgroundWrapper>
  );
}
