import { useMemo } from 'react';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent, getPointsSpentInTree, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { CharacterEquipment, EquipmentItem, legendarySetDefinitions } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { 
  User, Heart, Shield, Zap, Target, 
  Trophy, Package, Star, Sparkles, Moon, Sun,
  Swords, Crown, Scroll, Weight, Eye, Move, Gem
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// --- Character Stats Content ---
interface CharacterStatsProps {
  character: Character;
  equipment?: CharacterEquipment;
  prestigePoints?: number;
  // HP props
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
}

export function CharacterStatsContent({ 
  character, 
  equipment, 
  prestigePoints = 0,
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP = 0,
}: CharacterStatsProps) {
  const activeSlots = getActiveSlotsByLevel(character.level, prestigePoints);
  const xpForLevel = (level: number) => level * 1000;
  const currentXP = Math.floor(xpForLevel(character.level) * 0.65);
  const xpToNext = xpForLevel(character.level + 1) - xpForLevel(character.level);
  const xpProgress = Math.round((currentXP / xpToNext) * 100);

  // Use provided HP or calculate defaults
  const defaultMaxHP = 10 + character.level * 6;
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

  // Calculate equipment stats if equipment is provided
  const defaultEquipment: CharacterEquipment = { slots: {} as any, inventory: [] };
  const equipmentStats = useEquipmentStats(equipment || defaultEquipment);
  const hasEquipment = equipment && Object.values(equipment.slots).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Avatar and Name */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center border-2 border-red-500/50">
            <User className="w-8 h-8 text-red-200" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 py-0.5 rounded">
            LV.{character.level}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-cinzel font-bold">{character.name || 'Unnamed Assassin'}</h3>
          <p className="text-xs text-red-400 uppercase tracking-wider">Odyssey Assassin</p>
        </div>
      </div>

      {/* XP Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>XP Progress</span>
          <span>{currentXP.toLocaleString()} / {xpToNext.toLocaleString()}</span>
        </div>
        <Progress value={xpProgress} className="h-2 bg-muted/30" />
      </div>

      {/* Primary Combat Stats - now from equipment */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center p-3 rounded-lg bg-red-950/30 border border-red-900/30">
          <Heart className={`w-5 h-5 mx-auto mb-1 ${getHPColor()}`} />
          <div className={`text-lg font-bold ${getHPColor()}`}>
            {currentHP}
            <span className="text-sm font-normal text-muted-foreground">/{maxHP}</span>
          </div>
          {tempHP > 0 && (
            <div className="text-[10px] text-sky-400 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              +{tempHP} temp
            </div>
          )}
          <div className="text-[9px] text-muted-foreground uppercase mt-1">Hit Points</div>
          {/* HP mini progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted/30 mt-1 overflow-hidden">
            <div 
              className={`h-full transition-all ${
                hpPercentage > 50 ? 'bg-emerald-500' : 
                hpPercentage > 25 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${hpPercentage}%` }}
            />
          </div>
        </div>
        <div className="text-center p-3 rounded-lg bg-blue-950/30 border border-blue-900/30">
          <Shield className="w-5 h-5 mx-auto text-blue-400 mb-1" />
          <div className="text-lg font-bold">{hasEquipment ? equipmentStats.totalAC : 12 + Math.floor(character.level / 4)}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Armor Class</div>
          {hasEquipment && equipmentStats.acFromGear > 0 && (
            <div className="text-[8px] text-blue-400/70">+{equipmentStats.acFromGear} gear</div>
          )}
        </div>
        <div className="text-center p-3 rounded-lg bg-amber-950/30 border border-amber-900/30">
          <Swords className="w-5 h-5 mx-auto text-amber-400 mb-1" />
          <div className="text-lg font-bold">
            {hasEquipment ? (equipmentStats.totalAttackBonus >= 0 ? '+' : '') + equipmentStats.totalAttackBonus : '+' + (2 + Math.floor((character.level - 1) / 4))}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">Attack Bonus</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-purple-950/30 border border-purple-900/30">
          <Target className="w-5 h-5 mx-auto text-purple-400 mb-1" />
          <div className="text-lg font-bold font-mono">
            {hasEquipment && equipmentStats.damage ? equipmentStats.damage : '1d6'}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">Damage</div>
        </div>
      </div>

      {/* Equipment Attribute Bonuses */}
      {hasEquipment && (equipmentStats.strength !== 0 || equipmentStats.dexterity !== 0 || 
        equipmentStats.constitution !== 0 || equipmentStats.perception !== 0 ||
        equipmentStats.movement !== 0) && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Equipment Bonuses
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {equipmentStats.strength !== 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/30">
                <Swords className="w-3 h-3 text-red-400" />
                <span className="text-[10px] text-red-400 font-mono">
                  {equipmentStats.strength > 0 ? '+' : ''}{equipmentStats.strength} STR
                </span>
              </div>
            )}
            {equipmentStats.dexterity !== 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/30">
                <Move className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-green-400 font-mono">
                  {equipmentStats.dexterity > 0 ? '+' : ''}{equipmentStats.dexterity} DEX
                </span>
              </div>
            )}
            {equipmentStats.constitution !== 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/30">
                <Heart className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] text-orange-400 font-mono">
                  {equipmentStats.constitution > 0 ? '+' : ''}{equipmentStats.constitution} CON
                </span>
              </div>
            )}
            {equipmentStats.perception !== 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30">
                <Eye className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-purple-400 font-mono">
                  {equipmentStats.perception > 0 ? '+' : ''}{equipmentStats.perception} PER
                </span>
              </div>
            )}
            {equipmentStats.movement !== 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-cyan-400 font-mono">
                  {equipmentStats.movement > 0 ? '+' : ''}{equipmentStats.movement} SPD
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weight & Active Slots */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-muted/30">
          <div className="flex items-center gap-2">
            <Weight className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Weight</span>
          </div>
          <span className="font-mono text-sm">{hasEquipment ? equipmentStats.totalWeight : 0} lbs</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-muted/30">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Slots</span>
          </div>
          <span className="font-mono text-sm">{activeSlots}</span>
        </div>
      </div>

      {/* Active Set Bonuses */}
      {hasEquipment && equipmentStats.activeSetBonuses.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Gem className="w-3 h-3" />
            Active Set Bonuses
          </div>
          {equipmentStats.activeSetBonuses.map((set, idx) => (
            <div 
              key={idx}
              className="p-2 rounded-md border bg-amber-500/10 border-amber-500/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400">{set.setName}</span>
                <span className="text-[10px] text-amber-400/70">
                  {set.piecesActive}/{set.piecesTotal}
                </span>
              </div>
              <p className="text-[10px] text-amber-300/80 mt-1">{set.bonus}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Skills Overview Content ---
interface SkillsOverviewProps {
  character: Character;
  onNavigate: () => void;
}

export function SkillsOverviewContent({ character, onNavigate }: SkillsOverviewProps) {
  const totalPoints = getAbilityPointsForLevel(character.level);
  const spentPoints = getTotalPointsSpent(character.abilities);
  
  // Ability customization for homebrew support
  const abilityCustomization = useAbilityCustomization();
  
  const treePoints = {
    hunter: getPointsSpentInTree(character.abilities, allAbilities, 'hunter'),
    warrior: getPointsSpentInTree(character.abilities, allAbilities, 'warrior'),
    assassin: getPointsSpentInTree(character.abilities, allAbilities, 'assassin'),
  };

  const equippedAbilities = useMemo(() => {
    return character.equippedAbilities
      .filter(Boolean)
      .map(id => {
        // Check if homebrew
        if (id.startsWith('homebrew_')) {
          const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === id);
          return homebrew ? homebrewToAbility(homebrew) : null;
        }
        return allAbilities.find(a => a.id === id) ?? null;
      })
      .filter(Boolean);
  }, [character.equippedAbilities, abilityCustomization.state.homebrewAbilities]);

  return (
    <div className="space-y-4">
      {/* Points Summary */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-cinzel">Skill Points</span>
          <span className="text-lg font-bold text-red-400">{spentPoints}/{totalPoints}</span>
        </div>
        <Progress value={(spentPoints / totalPoints) * 100} className="h-2" />
      </div>

      {/* Tree Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-green-950/30 border border-green-900/30">
          <span className="text-xs font-medium text-green-400">Hunter</span>
          <span className="text-sm font-bold">{treePoints.hunter} pts</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-red-950/30 border border-red-900/30">
          <span className="text-xs font-medium text-red-400">Warrior</span>
          <span className="text-sm font-bold">{treePoints.warrior} pts</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-purple-950/30 border border-purple-900/30">
          <span className="text-xs font-medium text-purple-400">Assassin</span>
          <span className="text-sm font-bold">{treePoints.assassin} pts</span>
        </div>
      </div>

      {/* Equipped Abilities */}
      {equippedAbilities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Active Loadout</p>
          <div className="grid grid-cols-2 gap-2">
            {equippedAbilities.slice(0, 4).map((ability, i) => (
              <div 
                key={ability!.id}
                className="p-2 rounded bg-muted/20 border border-border/30 text-xs"
              >
                <span className="font-medium">{ability!.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onNavigate} className="w-full" variant="outline">
        <Swords className="w-4 h-4 mr-2" />
        Open Skills Tab
      </Button>
    </div>
  );
}

// --- Gear Overview Content ---
interface GearOverviewProps {
  equipment: CharacterEquipment;
  onNavigate: () => void;
}

export function GearOverviewContent({ equipment, onNavigate }: GearOverviewProps) {
  const equippedItems = Object.values(equipment.slots).filter(Boolean) as EquipmentItem[];
  const legendaryCount = equippedItems.filter(i => i.rarity === 'legendary').length;

  // Active set bonus
  const setCounts: Record<string, number> = {};
  equippedItems.forEach(item => {
    if (item.setId) {
      setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
    }
  });
  
  let activeSetBonus: { name: string; pieces: number; bonus: string } | null = null;
  for (const [setId, count] of Object.entries(setCounts)) {
    const setDef = legendarySetDefinitions.find(s => s.id === setId);
    if (setDef && count >= 2) {
      const bonus = setDef.bonuses
        .filter(b => count >= b.piecesRequired)
        .sort((a, b) => b.piecesRequired - a.piecesRequired)[0];
      if (bonus && (!activeSetBonus || count > activeSetBonus.pieces)) {
        activeSetBonus = { name: setDef.name, pieces: count, bonus: bonus.bonus };
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Equipment Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/30 text-center">
          <Package className="w-5 h-5 mx-auto text-amber-400 mb-1" />
          <div className="text-lg font-bold">{equippedItems.length}/8</div>
          <div className="text-[9px] text-muted-foreground uppercase">Slots Filled</div>
        </div>
        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/30 text-center">
          <Crown className="w-5 h-5 mx-auto text-amber-400 mb-1" />
          <div className="text-lg font-bold">{legendaryCount}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Legendary</div>
        </div>
      </div>

      {/* Active Set Bonus */}
      {activeSetBonus && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-amber-950/40 to-black/40 border border-amber-900/40">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-cinzel text-amber-400">{activeSetBonus.name}</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
              {activeSetBonus.pieces}/8
            </span>
          </div>
          <p className="text-xs text-foreground/80">{activeSetBonus.bonus}</p>
        </div>
      )}

      {/* Equipped Items List */}
      {equippedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Equipped</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {equippedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/10 text-xs">
                <span>{item.name}</span>
                <span className={`capitalize ${item.rarity === 'legendary' ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  {item.rarity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onNavigate} className="w-full" variant="outline">
        <Package className="w-4 h-4 mr-2" />
        Open Gear Tab
      </Button>
    </div>
  );
}

// --- Achievements Overview Content ---
interface AchievementsOverviewProps {
  achievements: Achievement[];
  onNavigate: () => void;
}

export function AchievementsOverviewContent({ achievements, onNavigate }: AchievementsOverviewProps) {
  const total = achievements.reduce((sum, a) => sum + a.maxValue, 0);
  const current = achievements.reduce((sum, a) => sum + a.currentValue, 0);
  const completed = achievements.filter(a => a.currentValue >= a.maxValue).length;
  const percentage = Math.round((current / total) * 100);

  // Get recent/closest to completion
  const nearComplete = [...achievements]
    .filter(a => a.currentValue < a.maxValue)
    .sort((a, b) => (b.currentValue / b.maxValue) - (a.currentValue / a.maxValue))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/30">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-cinzel">Overall Progress</span>
          <span className="text-lg font-bold text-purple-400">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
        <p className="text-[10px] text-muted-foreground mt-2">
          {completed}/{achievements.length} achievements completed
        </p>
      </div>

      {/* Near Completion */}
      {nearComplete.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Almost There</p>
          {nearComplete.map(a => (
            <div key={a.id} className="p-2 rounded bg-muted/20 border border-border/30">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium truncate">{a.name}</span>
                <span className="text-[10px] text-purple-400">
                  {a.currentValue}/{a.maxValue}
                </span>
              </div>
              <Progress value={(a.currentValue / a.maxValue) * 100} className="h-1" />
            </div>
          ))}
        </div>
      )}

      <Button onClick={onNavigate} className="w-full" variant="outline">
        <Trophy className="w-4 h-4 mr-2" />
        Open Feats Tab
      </Button>
    </div>
  );
}

// --- Constellation Overview Content ---
interface ConstellationOverviewProps {
  equipment: CharacterEquipment;
  onNavigate: () => void;
}

export function ConstellationOverviewContent({ equipment, onNavigate }: ConstellationOverviewProps) {
  const equippedItems = Object.values(equipment.slots).filter(Boolean) as EquipmentItem[];
  const legendaryCount = equippedItems.filter(i => i.rarity === 'legendary').length;
  const totalPieces = legendarySetDefinitions.reduce((sum, s) => sum + s.pieces.length, 0);

  return (
    <div className="space-y-4">
      {/* Stars Summary */}
      <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-900/30">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-cinzel">Stars Unlocked</span>
          <span className="text-lg font-bold text-cyan-400">{legendaryCount}/{totalPieces}</span>
        </div>
        <Progress value={(legendaryCount / totalPieces) * 100} className="h-2" />
      </div>

      {/* Constellation Sets */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase">8 Constellations</p>
        <div className="grid grid-cols-2 gap-2">
          {legendarySetDefinitions.slice(0, 4).map(set => {
            const equipped = equippedItems.filter(i => i.setId === set.id).length;
            return (
              <div 
                key={set.id}
                className="p-2 rounded bg-muted/20 border border-border/30 text-center"
              >
                <Star className={`w-4 h-4 mx-auto mb-1 ${equipped > 0 ? 'text-cyan-400' : 'text-muted-foreground/30'}`} />
                <p className="text-[9px] truncate">{set.name.split("'s")[0]}</p>
                <p className="text-[10px] text-cyan-400">{equipped}/8</p>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={onNavigate} className="w-full" variant="outline">
        <Sparkles className="w-4 h-4 mr-2" />
        Open Stars Tab
      </Button>
    </div>
  );
}

// --- Rest Actions Content ---
interface RestActionsProps {
  onShortRest: () => void;
  onLongRest: () => void;
}

export function RestActionsContent({ onShortRest, onLongRest }: RestActionsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Take a break to recover your strength and abilities.
      </p>

      <div className="space-y-3">
        <Button 
          variant="outline" 
          className="w-full h-auto py-4 flex-col gap-2 border-amber-900/40 hover:bg-amber-950/30"
          onClick={onShortRest}
        >
          <Sun className="w-6 h-6 text-amber-400" />
          <div>
            <p className="font-medium">Short Rest</p>
            <p className="text-[10px] text-muted-foreground">1 Hour - Restore some abilities</p>
          </div>
        </Button>

        <Button 
          variant="outline" 
          className="w-full h-auto py-4 flex-col gap-2 border-blue-900/40 hover:bg-blue-950/30"
          onClick={onLongRest}
        >
          <Moon className="w-6 h-6 text-blue-400" />
          <div>
            <p className="font-medium">Long Rest</p>
            <p className="text-[10px] text-muted-foreground">8 Hours - Full recovery</p>
          </div>
        </Button>
      </div>
    </div>
  );
}

// --- Daily Quote Content ---
interface DailyQuoteProps {
  quote: string;
}

export function DailyQuoteContent({ quote }: DailyQuoteProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-r from-red-950/40 to-black/40 border border-red-900/30">
        <Scroll className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-lg italic text-center text-foreground/90">"{quote}"</p>
        <p className="text-xs text-muted-foreground text-center mt-2">- Deadpool</p>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Wisdom refreshes daily. Check back tomorrow for more enlightenment.
      </p>
    </div>
  );
}
