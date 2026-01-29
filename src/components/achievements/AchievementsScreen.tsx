import { useState } from 'react';
import { ArrowLeft, Trophy, Star, Download, Upload } from 'lucide-react';
import { Achievement, achievementCategories as defaultCategories, itemPrerequisites } from '@/lib/achievements';
import { AchievementCard } from './AchievementCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AchievementsScreenProps {
  characterName: string;
  onBack: () => void;
}

export function AchievementsScreen({ characterName, onBack }: AchievementsScreenProps) {
  const [achievements, setAchievements] = useState<Achievement[]>(
    () => defaultCategories.map(a => ({ ...a }))
  );
  const { toast } = useToast();

  const handleIncrement = (id: string) => {
    setAchievements(prev => 
      prev.map(a => 
        a.id === id && a.currentValue < a.maxValue
          ? { ...a, currentValue: a.currentValue + 1 }
          : a
      )
    );
  };

  const handleDecrement = (id: string) => {
    setAchievements(prev => 
      prev.map(a => 
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
            setAchievements(prev => 
              prev.map(a => {
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
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

      {/* Stats Summary */}
      <div className="px-4 py-4 border-b border-border/50 bg-card/30">
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

      {/* Achievement List */}
      <ScrollArea className="flex-1">
        <div className="p-4 grid gap-3 pb-20 md:pb-4">
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
    </div>
  );
}
