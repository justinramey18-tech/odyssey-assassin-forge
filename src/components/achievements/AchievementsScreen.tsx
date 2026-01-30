import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Trophy, Star, Download, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  Achievement, 
  achievementCategories,
  itemPrerequisites, 
  getUnclaimedMilestones, 
  MILESTONE_XP_REWARDS,
  MilestonePercent,
} from '@/lib/achievements';
import { AchievementCard } from './AchievementCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { usePan } from '@/hooks/use-pan';
import { cn } from '@/lib/utils';
import featsBackground from '@/assets/feats-background.jpg';

// Legendary set groupings for achievements
const SET_GROUPS = {
  'merc-mouth': {
    name: "Merc with a Mouth's Regalia",
    achievements: ['distract-enemies', 'survive-zero-hp', 'overkill-strikes', 'collect-items', 'successful-leaps'],
  },
  'chaotic-contracts': {
    name: 'Arsenal of Chaotic Contracts',
    achievements: ['post-kill-oneliners', 'faction-quests', 'shots-no-miss', 'food-in-combat', 'arrive-late'],
  },
  'regenerative': {
    name: 'Regalia of Regenerative Ridiculousness',
    achievements: ['fail-wisdom-save', 'zero-to-full', 'nonverbal-combat', 'quick-draw-attack', 'dash-action'],
  },
  'self-aware-arsenal': {
    name: "Self-Aware Slayer's Kit",
    achievements: ['predict-plot', 'survive-meant-lose', 'recognize-tropes', 'reverse-situations', 'hidden-paths'],
  },
  'violent-comedy': {
    name: 'Vestments of Violent Comedy',
    achievements: ['humor-defuse', 'minor-injuries', 'combat-flourishes', 'share-food-enemies', 'lucky-items'],
  },
  'unkillable': {
    name: "Unkillable Merc's Loadout",
    achievements: ['survive-lethal', 'come-back-death', 'counterattack-hit', 'reverse-time', 'avoid-area-effects'],
  },
  'absolute-absurdity': {
    name: 'Arsenal of Absolute Absurdity',
    achievements: ['break-fourth-wall', 'befriend-enemies', 'defeat-with-words', 'lucky-accidents', 'dramatic-entrances'],
  },
  'self-aware-slayer': {
    name: "Self-Aware Slayer's Kit",
    achievements: ['perceive-meta', 'survive-impossible', 'influence-story', 'deus-ex-machina', 'escape-last-second'],
  },
} as const;

const SET_ORDER = Object.keys(SET_GROUPS) as (keyof typeof SET_GROUPS)[];

interface AchievementsScreenProps {
  characterName: string;
  achievements: Achievement[];
  onAchievementsChange: (achievements: Achievement[]) => void;
  onBack: () => void;
  onAwardXP?: (amount: number, source: string) => void;
}

export function AchievementsScreen({ 
  characterName, 
  achievements, 
  onAchievementsChange, 
  onBack,
  onAwardXP,
}: AchievementsScreenProps) {
  const { toast } = useToast();
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // Ensure all achievements from achievementCategories exist in state
  const allAchievements = useMemo(() => {
    const existingIds = new Set(achievements.map(a => a.id));
    const merged = [...achievements];
    
    achievementCategories.forEach(cat => {
      if (!existingIds.has(cat.id)) {
        merged.push({ ...cat });
      }
    });
    
    return merged;
  }, [achievements]);

  // Group achievements by set
  const achievementsBySet = useMemo(() => {
    const grouped: Record<string, Achievement[]> = {};
    
    SET_ORDER.forEach(setKey => {
      const setConfig = SET_GROUPS[setKey];
      grouped[setKey] = setConfig.achievements
        .map(id => allAchievements.find(a => a.id === id))
        .filter((a): a is Achievement => a !== undefined);
    });
    
    return grouped;
  }, [allAchievements]);

  const currentSet = SET_ORDER[currentSetIndex];
  const currentSetAchievements = achievementsBySet[currentSet] || [];
  const currentAchievement = currentSetAchievements[currentAchievementIndex];

  // Pan navigation handlers
  const handlePanLeft = useCallback(() => {
    if (currentSetIndex < SET_ORDER.length - 1) {
      setSlideDirection('left');
      setCurrentSetIndex(prev => prev + 1);
      setCurrentAchievementIndex(0);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [currentSetIndex]);

  const handlePanRight = useCallback(() => {
    if (currentSetIndex > 0) {
      setSlideDirection('right');
      setCurrentSetIndex(prev => prev - 1);
      setCurrentAchievementIndex(0);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [currentSetIndex]);

  const handlePanUp = useCallback(() => {
    if (currentAchievementIndex < currentSetAchievements.length - 1) {
      setSlideDirection('up');
      setCurrentAchievementIndex(prev => prev + 1);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [currentAchievementIndex, currentSetAchievements.length]);

  const handlePanDown = useCallback(() => {
    if (currentAchievementIndex > 0) {
      setSlideDirection('down');
      setCurrentAchievementIndex(prev => prev - 1);
      setTimeout(() => setSlideDirection(null), 300);
    }
  }, [currentAchievementIndex]);

  const { handlers: panHandlers, panOffset, panDirection, panning } = usePan(
    {
      onPanLeft: handlePanLeft,
      onPanRight: handlePanRight,
      onPanUp: handlePanUp,
      onPanDown: handlePanDown,
    },
    { threshold: 60, velocityThreshold: 0.4 }
  );

  // Check and claim milestones after achievement changes
  const checkAndClaimMilestones = (updatedAchievements: Achievement[]) => {
    let totalXPAwarded = 0;
    const milestonesReached: { name: string; percent: MilestonePercent }[] = [];
    
    const finalAchievements = updatedAchievements.map(achievement => {
      const unclaimed = getUnclaimedMilestones(achievement);
      
      if (unclaimed.length > 0) {
        const xpForThis = unclaimed.reduce((sum, m) => sum + MILESTONE_XP_REWARDS[m], 0);
        totalXPAwarded += xpForThis;
        
        unclaimed.forEach(m => {
          milestonesReached.push({ name: achievement.name, percent: m });
        });
        
        return {
          ...achievement,
          claimedMilestones: [...(achievement.claimedMilestones || []), ...unclaimed],
        };
      }
      
      return achievement;
    });
    
    if (totalXPAwarded > 0 && onAwardXP) {
      const milestoneNames = milestonesReached
        .map(m => `${m.name} (${m.percent}%)`)
        .join(', ');
      onAwardXP(totalXPAwarded, `Feat Milestones: ${milestoneNames}`);
      
      toast({
        title: `⚡ +${totalXPAwarded} XP`,
        description: `Milestone${milestonesReached.length > 1 ? 's' : ''} reached!`,
        className: "border-primary bg-primary/10",
      });
    }
    
    return finalAchievements;
  };

  const handleIncrement = (id: string) => {
    const updated = allAchievements.map(a => 
      a.id === id && a.currentValue < a.maxValue
        ? { ...a, currentValue: a.currentValue + 1 }
        : a
    );
    
    const withMilestones = checkAndClaimMilestones(updated);
    onAchievementsChange(withMilestones);
  };

  const handleDecrement = (id: string) => {
    onAchievementsChange(
      allAchievements.map(a => 
        a.id === id && a.currentValue > 0
          ? { ...a, currentValue: a.currentValue - 1 }
          : a
      )
    );
  };

  // Calculate stats
  const totalProgress = allAchievements.reduce((sum, a) => sum + a.currentValue, 0);
  const totalMax = allAchievements.reduce((sum, a) => sum + a.maxValue, 0);
  const completedCount = allAchievements.filter(a => a.currentValue >= a.maxValue).length;
  
  // Count unlocked legendary items
  const unlockedLegendaryCount = Object.entries(itemPrerequisites).filter(([_, prereq]) => {
    const achievement = allAchievements.find(a => a.id === prereq.achievementId);
    return achievement && achievement.currentValue >= prereq.requiredValue;
  }).length;

  const handleExport = () => {
    const exportData = {
      characterName,
      achievements: allAchievements.map(a => ({
        id: a.id,
        currentValue: a.currentValue,
        claimedMilestones: a.claimedMilestones,
      })),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${characterName || 'character'}-achievements.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Achievements exported",
      description: "Your achievement progress has been saved.",
    });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.achievements && Array.isArray(data.achievements)) {
            onAchievementsChange(
              allAchievements.map(a => {
                const imported = data.achievements.find((i: { id: string }) => i.id === a.id);
                return imported ? { ...a, currentValue: imported.currentValue, claimedMilestones: imported.claimedMilestones } : a;
              })
            );
            toast({
              title: "Achievements imported",
              description: "Your achievement progress has been loaded.",
            });
          }
        } catch {
          toast({
            title: "Import failed",
            description: "Could not read the achievement file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Calculate set progress
  const getSetProgress = (setKey: string) => {
    const setAchievements = achievementsBySet[setKey] || [];
    const progress = setAchievements.reduce((sum, a) => sum + a.currentValue, 0);
    const max = setAchievements.reduce((sum, a) => sum + a.maxValue, 0);
    return { progress, max, percent: max > 0 ? Math.round((progress / max) * 100) : 0 };
  };

  const setProgress = getSetProgress(currentSet);

  return (
    <BackgroundWrapper 
      imagePath={featsBackground} 
      overlayOpacity={60} 
      tintColor="purple" 
      tintOpacity={15}
      className="fixed inset-0 z-50 flex flex-col"
    >
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-purple-900/50 bg-background/80 backdrop-blur-sm">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">Feats</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleImport}>
            <Upload className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport}>
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="relative z-10 px-4 py-4 border-b border-purple-900/30 bg-background/60 backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-lg font-bold">{completedCount}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase">Mastered</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
              <Star className="w-4 h-4" />
              <span className="text-lg font-bold">{unlockedLegendaryCount}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase">Legendaries</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground mb-1">
              {Math.round((totalProgress / totalMax) * 100)}%
            </div>
            <p className="text-[10px] text-muted-foreground uppercase">Overall</p>
          </div>
        </div>
      </div>

      {/* Set Navigation Header */}
      <div className="relative z-10 px-4 py-3 bg-background/40 backdrop-blur-sm border-b border-purple-900/20">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePanRight}
            disabled={currentSetIndex === 0}
            className={cn(
              "p-2 rounded-lg transition-all",
              currentSetIndex === 0 
                ? "opacity-30 cursor-not-allowed" 
                : "hover:bg-purple-500/20 active:scale-95"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex-1 text-center">
            <h2 className="font-display font-bold text-sm uppercase tracking-wider text-purple-300">
              {SET_GROUPS[currentSet].name}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Set {currentSetIndex + 1} of {SET_ORDER.length} · {setProgress.percent}% complete
            </p>
          </div>
          
          <button
            onClick={handlePanLeft}
            disabled={currentSetIndex >= SET_ORDER.length - 1}
            className={cn(
              "p-2 rounded-lg transition-all",
              currentSetIndex >= SET_ORDER.length - 1
                ? "opacity-30 cursor-not-allowed" 
                : "hover:bg-purple-500/20 active:scale-95"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {/* Set Progress Bar */}
        <div className="h-1 bg-purple-900/30 rounded-full overflow-hidden mt-2">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              setProgress.percent === 100 
                ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                : "bg-gradient-to-r from-purple-500 to-purple-400"
            )}
            style={{ width: `${setProgress.percent}%` }}
          />
        </div>
      </div>

      {/* 4-Direction Pan Area */}
      <div 
        {...panHandlers}
        className="flex-1 relative z-10 overflow-hidden flex flex-col"
      >
        {/* Up indicator */}
        <div className={cn(
          "flex justify-center py-2 transition-opacity",
          currentAchievementIndex > 0 ? "opacity-100" : "opacity-30"
        )}>
          <button
            onClick={handlePanDown}
            disabled={currentAchievementIndex === 0}
            className={cn(
              "p-1 rounded-lg transition-all",
              currentAchievementIndex > 0 && "hover:bg-purple-500/20 active:scale-95"
            )}
          >
            <ChevronUp className="w-5 h-5 text-purple-300" />
          </button>
        </div>

        {/* Current Achievement Card */}
        <div 
          className={cn(
            "flex-1 px-4 flex items-center justify-center transition-all duration-300",
            panning && "transition-none"
          )}
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {currentAchievement && (
            <div className={cn(
              "w-full max-w-md transition-all duration-300",
              slideDirection === 'left' && "animate-slide-left",
              slideDirection === 'right' && "animate-slide-right",
              slideDirection === 'up' && "animate-slide-up",
              slideDirection === 'down' && "animate-slide-down",
            )}>
              <AchievementCard
                achievement={currentAchievement}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                expanded
              />
              
              {/* Achievement position indicator */}
              <div className="flex justify-center gap-1.5 mt-4">
                {currentSetAchievements.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSlideDirection(idx > currentAchievementIndex ? 'up' : 'down');
                      setCurrentAchievementIndex(idx);
                      setTimeout(() => setSlideDirection(null), 300);
                    }}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentAchievementIndex 
                        ? "bg-purple-400 scale-125" 
                        : "bg-purple-900/50 hover:bg-purple-700/50"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Down indicator */}
        <div className={cn(
          "flex justify-center py-2 transition-opacity",
          currentAchievementIndex < currentSetAchievements.length - 1 ? "opacity-100" : "opacity-30"
        )}>
          <button
            onClick={handlePanUp}
            disabled={currentAchievementIndex >= currentSetAchievements.length - 1}
            className={cn(
              "p-1 rounded-lg transition-all",
              currentAchievementIndex < currentSetAchievements.length - 1 && "hover:bg-purple-500/20 active:scale-95"
            )}
          >
            <ChevronDown className="w-5 h-5 text-purple-300" />
          </button>
        </div>

        {/* Pan direction feedback overlay */}
        {panning && panDirection && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className={cn(
              "absolute bg-purple-500/10 rounded-full transition-opacity",
              panDirection === 'left' && "right-4 top-1/2 -translate-y-1/2 w-16 h-32",
              panDirection === 'right' && "left-4 top-1/2 -translate-y-1/2 w-16 h-32",
              panDirection === 'up' && "bottom-4 left-1/2 -translate-x-1/2 w-32 h-16",
              panDirection === 'down' && "top-4 left-1/2 -translate-x-1/2 w-32 h-16",
            )}>
              {panDirection === 'left' && <ChevronRight className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
              {panDirection === 'right' && <ChevronLeft className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
              {panDirection === 'up' && <ChevronDown className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
              {panDirection === 'down' && <ChevronUp className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </div>
          </div>
        )}
      </div>

      {/* Set dots navigation */}
      <div className="relative z-10 flex justify-center gap-2 py-3 bg-background/40 backdrop-blur-sm border-t border-purple-900/20">
        {SET_ORDER.map((setKey, idx) => {
          const progress = getSetProgress(setKey);
          return (
            <button
              key={setKey}
              onClick={() => {
                setSlideDirection(idx > currentSetIndex ? 'left' : 'right');
                setCurrentSetIndex(idx);
                setCurrentAchievementIndex(0);
                setTimeout(() => setSlideDirection(null), 300);
              }}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                idx === currentSetIndex 
                  ? "bg-purple-400 scale-125" 
                  : progress.percent === 100 
                    ? "bg-amber-500/60 hover:bg-amber-400/80"
                    : "bg-purple-900/50 hover:bg-purple-700/50"
              )}
              title={SET_GROUPS[setKey].name}
            />
          );
        })}
      </div>
    </BackgroundWrapper>
  );
}
