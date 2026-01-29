import { useMemo } from 'react';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent, getPointsSpentInTree, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { CharacterEquipment, EquipmentItem, legendarySetDefinitions } from '@/lib/inventory';
import { achievementCategories, Achievement } from '@/lib/achievements';
import { 
  User, Heart, Shield, Swords, Target, Zap, 
  Trophy, Package, Star, Sparkles, Moon, Sun,
  ArrowLeft, Scroll, Crown
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import homeBackground from '@/assets/home-background.jpg';

// Deadpool-style quotes
const deadpoolQuotes = [
  "Maximum effort!",
  "I'm touching myself tonight.",
  "You may be wondering why the red suit? So bad guys can't see me bleed.",
  "I know, right? Whose balls did I have to fondle to get my own movie?",
  "Time to make the chimichangas!",
  "I'm gonna do what's right. You know what that is?",
  "Fourth wall break inside a fourth wall break? That's like... 16 walls!",
  "Did I leave the stove on?",
  "Superhero landing! She's gonna do a superhero landing!",
  "Pump the hate brakes, Thanos.",
];

interface HomeScreenProps {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  onBack: () => void;
  onNavigateToTab: (tab: 'abilities' | 'inventory' | 'achievements' | 'constellation') => void;
  onShortRest: () => void;
  onLongRest: () => void;
}

export function HomeScreen({ 
  character, 
  equipment, 
  achievements,
  onBack,
  onNavigateToTab,
  onShortRest,
  onLongRest
}: HomeScreenProps) {
  const totalPoints = getAbilityPointsForLevel(character.level);
  const spentPoints = getTotalPointsSpent(character.abilities);
  const activeSlots = getActiveSlotsByLevel(character.level);

  // Daily quote (changes based on date)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return deadpoolQuotes[dayOfYear % deadpoolQuotes.length];
  }, []);

  // Calculate tree breakdown
  const treePoints = useMemo(() => ({
    hunter: getPointsSpentInTree(character.abilities, allAbilities, 'hunter'),
    warrior: getPointsSpentInTree(character.abilities, allAbilities, 'warrior'),
    assassin: getPointsSpentInTree(character.abilities, allAbilities, 'assassin'),
  }), [character.abilities]);

  // Calculate equipped abilities
  const equippedAbilities = useMemo(() => {
    return character.equippedAbilities
      .filter(Boolean)
      .map(id => allAbilities.find(a => a.id === id))
      .filter(Boolean);
  }, [character.equippedAbilities]);

  // Calculate equipment stats
  const equippedItems = useMemo(() => {
    return Object.values(equipment.slots).filter(Boolean) as EquipmentItem[];
  }, [equipment.slots]);

  const legendaryCount = equippedItems.filter(i => i.rarity === 'legendary').length;
  const totalLegendaryPieces = legendarySetDefinitions.reduce((sum, s) => sum + s.pieces.length, 0);

  // Active set bonus
  const activeSetBonus = useMemo(() => {
    const setCounts: Record<string, number> = {};
    equippedItems.forEach(item => {
      if (item.setId) {
        setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
      }
    });
    
    let bestSet: { name: string; pieces: number; bonus: string } | null = null;
    for (const [setId, count] of Object.entries(setCounts)) {
      const setDef = legendarySetDefinitions.find(s => s.id === setId);
      if (setDef && count >= 2) {
        const activeBonus = setDef.bonuses
          .filter(b => count >= b.piecesRequired)
          .sort((a, b) => b.piecesRequired - a.piecesRequired)[0];
        if (activeBonus && (!bestSet || count > bestSet.pieces)) {
          bestSet = { name: setDef.name, pieces: count, bonus: activeBonus.bonus };
        }
      }
    }
    return bestSet;
  }, [equippedItems]);

  // Achievement progress
  const achievementProgress = useMemo(() => {
    const total = achievements.reduce((sum, a) => sum + a.maxValue, 0);
    const current = achievements.reduce((sum, a) => sum + a.currentValue, 0);
    const completed = achievements.filter(a => a.currentValue >= a.maxValue).length;
    return { total, current, completed, percentage: Math.round((current / total) * 100) };
  }, [achievements]);

  // XP calculation (simplified - could be extended)
  const xpForLevel = (level: number) => level * 1000;
  const currentXP = Math.floor(xpForLevel(character.level) * 0.65); // Mock 65% progress
  const xpToNext = xpForLevel(character.level + 1) - xpForLevel(character.level);
  const xpProgress = Math.round((currentXP / xpToNext) * 100);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${homeBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-red-900/30 bg-background/50 backdrop-blur-md z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-cinzel font-bold text-lg uppercase tracking-wider text-red-400">
          Home Base
        </h1>
        <div className="w-9" /> {/* Spacer */}
      </header>

      <ScrollArea className="flex-1 relative z-10">
        <div className="p-4 space-y-4 pb-24">
          
          {/* Character Card */}
          <Card className="bg-black/60 border-red-900/40 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500/70" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500/70" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500/70" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500/70" />
            
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center border-2 border-red-500/50 shadow-lg shadow-red-900/30">
                    <User className="w-10 h-10 text-red-200" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                    LV.{character.level}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-cinzel font-bold text-foreground truncate">
                    {character.name || 'Unnamed Assassin'}
                  </h2>
                  <p className="text-xs text-red-400 uppercase tracking-wider mb-2">
                    Odyssey Assassin
                  </p>
                  
                  {/* XP Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>XP Progress</span>
                      <span>{currentXP.toLocaleString()} / {xpToNext.toLocaleString()}</span>
                    </div>
                    <Progress value={xpProgress} className="h-2 bg-muted/30" />
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className="text-center p-2 rounded-lg bg-red-950/30 border border-red-900/30">
                  <Heart className="w-4 h-4 mx-auto text-red-400 mb-1" />
                  <div className="text-sm font-bold">{10 + character.level * 6}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">HP</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-950/30 border border-blue-900/30">
                  <Shield className="w-4 h-4 mx-auto text-blue-400 mb-1" />
                  <div className="text-sm font-bold">{12 + Math.floor(character.level / 4)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">AC</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-950/30 border border-amber-900/30">
                  <Zap className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                  <div className="text-sm font-bold">+{2 + Math.floor((character.level - 1) / 4)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">Prof</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-purple-950/30 border border-purple-900/30">
                  <Target className="w-4 h-4 mx-auto text-purple-400 mb-1" />
                  <div className="text-sm font-bold">{activeSlots}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">Slots</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Quote */}
          <Card className="bg-gradient-to-r from-red-950/40 to-black/40 border-red-900/30 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-3">
              <Scroll className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-red-400 uppercase tracking-wider mb-0.5">Daily Wisdom</p>
                <p className="text-sm italic text-foreground/90">"{dailyQuote}"</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access - Equipped Loadout */}
          {equippedAbilities.length > 0 && (
            <Card className="bg-black/60 border-red-900/40 backdrop-blur-md">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-cinzel flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" />
                  Active Loadout
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {equippedAbilities.slice(0, 4).map((ability, i) => (
                    <button
                      key={ability!.id}
                      onClick={() => onNavigateToTab('abilities')}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold
                        ${ability!.tree === 'hunter' ? 'bg-green-900/50 text-green-400' : ''}
                        ${ability!.tree === 'warrior' ? 'bg-red-900/50 text-red-400' : ''}
                        ${ability!.tree === 'assassin' ? 'bg-purple-900/50 text-purple-400' : ''}
                      `}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{ability!.name}</p>
                        <p className="text-[9px] text-muted-foreground capitalize">{ability!.actionType.replace('_', ' ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {equippedAbilities.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No abilities equipped</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active Set Bonus */}
          {activeSetBonus && (
            <Card className="bg-gradient-to-r from-amber-950/40 to-black/40 border-amber-900/40 backdrop-blur-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Crown className="w-8 h-8 text-amber-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-cinzel text-amber-400 uppercase tracking-wider">{activeSetBonus.name}</p>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                        {activeSetBonus.pieces}/8
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80">{activeSetBonus.bonus}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Dashboards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ability Trees */}
            <Card 
              className="bg-black/60 border-red-900/40 backdrop-blur-md cursor-pointer hover:bg-black/70 transition-colors"
              onClick={() => onNavigateToTab('abilities')}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-cinzel uppercase">Skills</span>
                </div>
                <div className="text-2xl font-bold mb-1">{spentPoints}/{totalPoints}</div>
                <Progress value={(spentPoints / totalPoints) * 100} className="h-1.5 mb-2" />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] text-muted-foreground">Hunt: {treePoints.hunter}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] text-muted-foreground">War: {treePoints.warrior}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] text-muted-foreground">Assn: {treePoints.assassin}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card 
              className="bg-black/60 border-purple-900/40 backdrop-blur-md cursor-pointer hover:bg-black/70 transition-colors"
              onClick={() => onNavigateToTab('achievements')}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-cinzel uppercase">Feats</span>
                </div>
                <div className="text-2xl font-bold mb-1">{achievementProgress.percentage}%</div>
                <Progress value={achievementProgress.percentage} className="h-1.5 mb-2" />
                <p className="text-[10px] text-muted-foreground">
                  {achievementProgress.completed}/{achievements.length} mastered
                </p>
              </CardContent>
            </Card>

            {/* Legendary Gear */}
            <Card 
              className="bg-black/60 border-amber-900/40 backdrop-blur-md cursor-pointer hover:bg-black/70 transition-colors"
              onClick={() => onNavigateToTab('inventory')}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-cinzel uppercase">Gear</span>
                </div>
                <div className="text-2xl font-bold mb-1">{legendaryCount}</div>
                <Progress value={(legendaryCount / 8) * 100} className="h-1.5 mb-2" />
                <p className="text-[10px] text-muted-foreground">
                  {equippedItems.length}/8 slots filled
                </p>
              </CardContent>
            </Card>

            {/* Constellations */}
            <Card 
              className="bg-black/60 border-cyan-900/40 backdrop-blur-md cursor-pointer hover:bg-black/70 transition-colors"
              onClick={() => onNavigateToTab('constellation')}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-cinzel uppercase">Stars</span>
                </div>
                <div className="text-2xl font-bold mb-1">{legendaryCount}/{totalLegendaryPieces}</div>
                <Progress value={(legendaryCount / totalLegendaryPieces) * 100} className="h-1.5 mb-2" />
                <p className="text-[10px] text-muted-foreground">
                  8 constellations
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rest Actions */}
          <Card className="bg-black/60 border-border/30 backdrop-blur-md">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-cinzel flex items-center gap-2">
                <Moon className="w-4 h-4 text-blue-400" />
                Rest & Recovery
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1 border-blue-900/40 hover:bg-blue-950/30"
                  onClick={onShortRest}
                >
                  <Sun className="w-5 h-5 text-amber-400" />
                  <span className="text-xs">Short Rest</span>
                  <span className="text-[9px] text-muted-foreground">1 Hour</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1 border-blue-900/40 hover:bg-blue-950/30"
                  onClick={onLongRest}
                >
                  <Moon className="w-5 h-5 text-blue-400" />
                  <span className="text-xs">Long Rest</span>
                  <span className="text-[9px] text-muted-foreground">8 Hours</span>
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </div>
  );
}
