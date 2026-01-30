import { ArrowLeft, Trophy, Star, Download, Upload, Zap } from 'lucide-react';
import { 
  Achievement, 
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
import featsBackground from '@/assets/feats-background.jpg';

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

  // Check and claim milestones after achievement changes
  const checkAndClaimMilestones = (updatedAchievements: Achievement[]) => {
    let totalXPAwarded = 0;
    const milestonesReached: { name: string; percent: MilestonePercent }[] = [];
    
    const finalAchievements = updatedAchievements.map(achievement => {
      const unclaimed = getUnclaimedMilestones(achievement);
      
      if (unclaimed.length > 0) {
        // Calculate XP for this achievement's unclaimed milestones
        const xpForThis = unclaimed.reduce((sum, m) => sum + MILESTONE_XP_REWARDS[m], 0);
        totalXPAwarded += xpForThis;
        
        // Track which milestones were reached
        unclaimed.forEach(m => {
          milestonesReached.push({ name: achievement.name, percent: m });
        });
        
        // Mark milestones as claimed
        return {
          ...achievement,
          claimedMilestones: [...(achievement.claimedMilestones || []), ...unclaimed],
        };
      }
      
      return achievement;
    });
    
    // Award XP if any milestones were reached
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
    const updated = achievements.map(a => 
      a.id === id && a.currentValue < a.maxValue
        ? { ...a, currentValue: a.currentValue + 1 }
        : a
    );
    
    // Check for milestone rewards
    const withMilestones = checkAndClaimMilestones(updated);
    onAchievementsChange(withMilestones);
  };

  const handleDecrement = (id: string) => {
    onAchievementsChange(
      achievements.map(a => 
        a.id === id && a.currentValue > 0
          ? { ...a, currentValue: a.currentValue - 1 }
          : a
      )
    );
  };

  // Calculate stats
  const totalProgress = achievements.reduce((sum, a) => sum + a.currentValue, 0);
  const totalMax = achievements.reduce((sum, a) => sum + a.maxValue, 0);
  const completedCount = achievements.filter(a => a.currentValue >= a.maxValue).length;
  
  // Count unlocked legendary items
  const unlockedLegendaryCount = Object.entries(itemPrerequisites).filter(([_, prereq]) => {
    const achievement = achievements.find(a => a.id === prereq.achievementId);
    return achievement && achievement.currentValue >= prereq.requiredValue;
  }).length;

  const handleExport = () => {
    const exportData = {
      characterName,
      achievements: achievements.map(a => ({
        id: a.id,
        currentValue: a.currentValue,
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
              achievements.map(a => {
                const imported = data.achievements.find((i: { id: string }) => i.id === a.id);
                return imported ? { ...a, currentValue: imported.currentValue } : a;
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
        <h1 className="font-bold">Achievements</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleImport}>
            <Upload className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport}>
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Stats Summary - relative z for content visibility */}
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

      {/* Achievement List - Scrollable Accordion */}
      <ScrollArea className="flex-1 relative z-10">
        <div className="p-4 flex flex-col gap-2 pb-20 md:pb-4">
          {achievements.map(achievement => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
            />
          ))}
        </div>
      </ScrollArea>
    </BackgroundWrapper>
  );
}
