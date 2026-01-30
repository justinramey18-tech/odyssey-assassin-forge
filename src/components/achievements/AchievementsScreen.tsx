import { useState, useMemo } from 'react';
import { ArrowLeft, Trophy, Star, Download, Upload, Filter, X } from 'lucide-react';
import { 
  Achievement, 
  achievementCategories,
  itemPrerequisites, 
  getUnclaimedMilestones, 
  MILESTONE_XP_REWARDS,
  MilestonePercent,
} from '@/lib/achievements';
import { AchievementCard } from './AchievementCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
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
  const [filterSet, setFilterSet] = useState<string | null>(null);

  // Ensure all achievements from achievementCategories exist in state
  const allAchievements = useMemo(() => {
    const existingIds = new Set(achievements.map(a => a.id));
    const merged = [...achievements];
    
    // Add any missing achievements from categories
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

  // Filter sets to display
  const setsToDisplay = filterSet ? [filterSet] : SET_ORDER;

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

      {/* Set Filter Chips */}
      <div className="relative z-10 px-3 py-2 border-b border-purple-900/20 bg-background/40 backdrop-blur-sm overflow-x-auto">
        <div className="flex gap-2 pb-1 min-w-max">
          <button
            onClick={() => setFilterSet(null)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                !filterSet 
                  ? "bg-purple-500 text-white" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              All Sets
            </button>
            {SET_ORDER.map(setKey => {
              const setProgress = getSetProgress(setKey);
              return (
                <button
                  key={setKey}
                  onClick={() => setFilterSet(filterSet === setKey ? null : setKey)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5",
                    filterSet === setKey 
                      ? "bg-purple-500 text-white" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate max-w-[100px]">{SET_GROUPS[setKey].name.split(' ')[0]}</span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full",
                    setProgress.percent === 100 
                      ? "bg-amber-500/30 text-amber-300" 
                      : "bg-white/10"
                  )}>
                    {setProgress.percent}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      {/* Mobile-First Scrollable List */}
      <ScrollArea className="flex-1 relative z-10">
        <div className="px-3 py-4 space-y-6">
          {setsToDisplay.map(setKey => {
            const setConfig = SET_GROUPS[setKey as keyof typeof SET_GROUPS];
            const setAchievements = achievementsBySet[setKey] || [];
            const setProgress = getSetProgress(setKey);
            
            if (setAchievements.length === 0) return null;
            
            return (
              <div key={setKey} className="space-y-3">
                {/* Set Header */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="font-display font-bold text-sm uppercase tracking-wider text-purple-300">
                      {setConfig.name}
                    </h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {setProgress.percent}% complete · {setAchievements.filter(a => a.currentValue >= a.maxValue).length}/{setAchievements.length} mastered
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-purple-400">
                      {setProgress.progress}/{setProgress.max}
                    </div>
                  </div>
                </div>
                
                {/* Set Progress Bar */}
                <div className="h-1 bg-purple-900/30 rounded-full overflow-hidden mx-1">
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
                
                {/* Achievement Cards */}
                <div className="space-y-2">
                  {setAchievements.map(achievement => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </BackgroundWrapper>
  );
}
