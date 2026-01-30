import { useMemo } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import type { LucideIcon } from 'lucide-react';

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
  bgColor: string;
}

// Navigation card configuration
const navigationCards: NavigationCardData[] = [
  { id: 'skills', label: 'Skills', description: 'Proficiencies & checks', 
    icon: BookOpen, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'abilities', label: 'Abilities', description: 'Unlock & upgrade', 
    icon: Zap, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  { id: 'gear', label: 'Gear', description: 'Equipment & inventory', 
    icon: Backpack, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'feats', label: 'Feats', description: 'Achievements & progress', 
    icon: Trophy, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  { id: 'combat', label: 'Combat', description: 'Battle tracker', 
    icon: Swords, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'scribe', label: 'Scribe', description: 'AI narrative tools', 
    icon: Scroll, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'consumables', label: 'Items', description: 'Potions & scrolls', 
    icon: Beaker, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'chronicle', label: 'Chronicle', description: 'Session log sync', 
    icon: FileSearch, color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
  { id: 'stars', label: 'Stars', description: 'Constellation view', 
    icon: Star, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
];

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
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
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'AC',
      value: stats.totalAC.toString(),
      icon: Shield,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Init',
      value: stats.dexterity >= 0 ? `+${stats.dexterity}` : stats.dexterity.toString(),
      icon: Zap,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Install Banner */}
      <InstallBanner />

      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md">
        <button 
          onClick={onReturnToBuilder}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="w-12 h-12 border-2 border-primary shrink-0">
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {character.name.substring(0, 2).toUpperCase() || 'DP'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg truncate">
                {character.name || 'Mercenary'}
              </h1>
              <Badge variant="secondary" className="shrink-0">
                Lv.{character.level}
              </Badge>
            </div>
            
            {/* XP Progress */}
            <div className="mt-1 space-y-0.5">
              <Progress value={xpProgress} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
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
        <div className="grid grid-cols-3 gap-3">
          {quickStats.map((stat) => (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className={cn("p-2 rounded-full", stat.bgColor)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation Grid */}
        <div className={cn(
          "grid gap-3",
          "grid-cols-2",
          "md:grid-cols-3",
          "lg:grid-cols-4"
        )}>
          {navigationCards.map((card) => {
            const badge = getBadge(card.id);
            const IconComponent = card.icon;
            
            return (
              <Card
                key={card.id}
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg active:scale-95",
                  "border-2 border-transparent hover:border-current/20",
                  "min-h-[120px]"
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
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 h-full">
                  {/* Icon with badge */}
                  <div className="relative">
                    <div className={cn(
                      "rounded-full flex items-center justify-center",
                      card.bgColor,
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
                  <h3 className={cn(
                    "font-semibold",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {card.label}
                  </h3>
                  
                  {/* Description (Desktop only) */}
                  {!isMobile && (
                    <p className="text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="border-t border-border bg-card/80 backdrop-blur-md p-4">
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => handleQuickAction('shortRest')}
            style={{ touchAction: 'manipulation' }}
          >
            <Coffee className="w-5 h-5 text-amber-500" />
            <span className="text-xs">Short Rest</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => handleQuickAction('longRest')}
            style={{ touchAction: 'manipulation' }}
          >
            <Moon className="w-5 h-5 text-blue-500" />
            <span className="text-xs">Long Rest</span>
          </Button>
          
          {canLevelUp && (
            <Button
              variant="default"
              className="h-auto py-3 flex flex-col items-center gap-1"
              onClick={() => handleQuickAction('levelUp')}
              style={{ touchAction: 'manipulation' }}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs">Level Up</span>
            </Button>
          )}
          
          {!canLevelUp && (
            <div className="h-auto py-3 flex flex-col items-center gap-1 opacity-50">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Level Up</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
