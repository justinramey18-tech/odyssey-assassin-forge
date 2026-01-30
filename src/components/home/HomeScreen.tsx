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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { Glass } from '@/components/ui/glass';
import type { LucideIcon } from 'lucide-react';

import tposeBackground from '@/assets/generated/deadpool-assassin-tpose-dive.jpg';

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
      overlayOpacity={45}
      tintColor="red"
      tintOpacity={10}
      fixed={true}
      backgroundPosition={isMobile ? 'center 25%' : 'center center'}
      className="fixed inset-0 z-50"
    >
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Install Banner */}
        <InstallBanner />

        {/* Header */}
        <Glass 
          as="header" 
          variant="header" 
          rounded="none"
          className="flex items-center gap-4 px-4 py-3 border-b border-glass"
        >
          <button 
            onClick={onReturnToBuilder}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12 border-2 border-primary shrink-0">
              <AvatarFallback className="text-lg font-bold bg-primary/20 text-white">
                {character.name.substring(0, 2).toUpperCase() || 'DP'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 
                  className="font-bold text-lg truncate text-white"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                >
                  {character.name || 'Mercenary'}
                </h1>
                <Badge variant="secondary" className="shrink-0 bg-white/20 text-white border-none">
                  Lv.{character.level}
                </Badge>
              </div>
              
              {/* XP Progress */}
              <div className="mt-1 space-y-0.5">
                <Progress value={xpProgress} className="h-1.5" />
                <div 
                  className="flex justify-between text-[10px] text-white/70"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
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
        </Glass>

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
                <Glass variant="default" className="p-3 flex flex-col items-center gap-1.5">
                  <div className="p-2 rounded-full bg-white/10">
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                  </div>
                  <p 
                    className="text-xl font-bold text-white drop-shadow-lg"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {stat.value}
                  </p>
                  <p 
                    className="text-[10px] text-white/70 uppercase tracking-wide"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {stat.label}
                  </p>
                </Glass>
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
                  <Glass
                    variant="interactive"
                    className={cn(
                      "cursor-pointer min-h-[120px] p-4",
                      "flex flex-col items-center justify-center text-center gap-2"
                    )}
                    onClick={() => handleCardClick(card.id)}
                    style={{ touchAction: 'manipulation' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Navigate to ${card.label}. ${card.description}${
                      badge ? `. ${badge} notifications.` : ''
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(card.id);
                      }
                    }}
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
                        "font-semibold text-white",
                        isMobile ? "text-sm" : "text-base"
                      )}
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                    >
                      {card.label}
                    </h3>
                    
                    {/* Description (Desktop only) */}
                    {!isMobile && (
                      <p 
                        className="text-xs text-white/70"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        {card.description}
                      </p>
                    )}
                  </Glass>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Quick Actions Footer */}
        <Glass 
          as="footer" 
          variant="header" 
          rounded="none"
          className="border-t border-glass p-4"
        >
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <Glass
              as="button"
              variant="interactive"
              className="h-auto py-3 flex flex-col items-center gap-1 text-white"
              onClick={() => handleQuickAction('shortRest')}
              style={{ touchAction: 'manipulation' }}
            >
              <Coffee className="w-5 h-5 text-amber-400" />
              <span className="text-xs">Short Rest</span>
            </Glass>
            
            <Glass
              as="button"
              variant="interactive"
              className="h-auto py-3 flex flex-col items-center gap-1 text-white"
              onClick={() => handleQuickAction('longRest')}
              style={{ touchAction: 'manipulation' }}
            >
              <Moon className="w-5 h-5 text-blue-400" />
              <span className="text-xs">Long Rest</span>
            </Glass>
            
            {canLevelUp ? (
              <Glass
                as="button"
                variant="interactive"
                className="h-auto py-3 flex flex-col items-center gap-1 text-white border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                onClick={() => handleQuickAction('levelUp')}
                style={{ touchAction: 'manipulation' }}
              >
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-xs">Level Up</span>
              </Glass>
            ) : (
              <Glass
                variant="default"
                className="h-auto py-3 flex flex-col items-center gap-1 opacity-40 cursor-not-allowed"
              >
                <TrendingUp className="w-5 h-5 text-white/50" />
                <span className="text-xs text-white/50">Level Up</span>
              </Glass>
            )}
          </div>
        </Glass>
      </div>
    </BackgroundWrapper>
  );
}
