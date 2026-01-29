import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { Badge } from '@/components/ui/badge';
import { Skull, Shield, Swords, Target } from 'lucide-react';
import { PrestigeBadge } from '@/components/prestige';
import { PrestigeData } from '@/lib/prestige';

interface CharacterHeaderProps {
  character: Character;
  currentXP: number;
  prestigeData?: PrestigeData;
}

export function CharacterHeader({ character, currentXP, prestigeData }: CharacterHeaderProps) {
  const totalPoints = getAbilityPointsForLevel(character.level);
  const spentPoints = getTotalPointsSpent(character.abilities);
  const isMaxLevel = character.level >= 20;
  const isPrestigeActive = isMaxLevel && prestigeData && prestigeData.prestigeLevel > 0;
  
  // Calculate total available points including prestige
  const prestigeAvailable = prestigeData?.availablePrestigePoints ?? 0;
  const totalAvailable = (totalPoints - spentPoints) + prestigeAvailable;
  
  // Calculate tree points
  const hunterPoints = character.abilities
    .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'hunter')
    .reduce((sum, ca) => sum + ca.currentTier, 0);
  const warriorPoints = character.abilities
    .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'warrior')
    .reduce((sum, ca) => sum + ca.currentTier, 0);
  const assassinPoints = character.abilities
    .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'assassin')
    .reduce((sum, ca) => sum + ca.currentTier, 0);

  return (
    <div className="bg-gradient-to-b from-card/80 to-card/40 border-b border-red-900/30 backdrop-blur-sm">
      <div className="container max-w-2xl mx-auto px-4 py-4">
        {/* Character Name & Level */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600/30 to-red-900/30 border-2 border-red-500/50 flex items-center justify-center">
              <Skull className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="font-cinzel font-bold text-lg text-foreground tracking-wide">
                {character.name || 'Unnamed Assassin'}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-primary/50 text-primary font-display">
                  Level {character.level}
                </Badge>
                {isPrestigeActive && (
                  <PrestigeBadge 
                    prestigeLevel={prestigeData!.prestigeLevel} 
                    isActive={true} 
                    size="sm"
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {currentXP.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>
          
          {/* Ability Points Summary */}
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {prestigeAvailable > 0 ? 'Total Points' : 'Ability Points'}
            </div>
            <div className="font-display font-bold text-primary">
              {spentPoints} / {totalPoints}{prestigeAvailable > 0 && ` (+${prestigeAvailable})`}
            </div>
          </div>
        </div>

        {/* Tree Distribution */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-900/20 border border-green-700/30">
            <Target className="w-4 h-4 text-green-400" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-green-400/80">Hunter</div>
              <div className="text-sm font-bold text-green-400">{hunterPoints} pts</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-900/20 border border-red-700/30">
            <Swords className="w-4 h-4 text-red-400" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-red-400/80">Warrior</div>
              <div className="text-sm font-bold text-red-400">{warriorPoints} pts</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-purple-900/20 border border-purple-700/30">
            <Shield className="w-4 h-4 text-purple-400" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-purple-400/80">Assassin</div>
              <div className="text-sm font-bold text-purple-400">{assassinPoints} pts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
