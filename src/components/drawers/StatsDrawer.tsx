import { useState } from 'react';
import { isEmpyreanMode, getAbilityAbbr } from '@/lib/empyreanLabels';
import { Heart, Sparkles, Plus, Minus, Shield, Zap, Swords, Weight, Target, Eye, Save, Move, Gem, Info, ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  XP_REWARDS, 
  XPRewardType,
  getLevelProgress,
  getXPToNextLevel,
  XP_PRESETS,
  XPPreset,
} from '@/lib/xpSystem';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { AbilityScoresPanel } from '@/components/character/AbilityScoresPanel';
import { 
  AbilityName, 
  BaseAbilityScores,
  AbilityScoreBreakdown,
} from '@/lib/abilityScores/types';
import { getHPBreakdown, HP_CONFIG } from '@/lib/hpCalculation';
import { DnDClass, ClassLevelMap } from '@/lib/classes';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { ClassLevelBadge } from '@/components/character/ClassLevelBadge';
import { ClassFeaturesPanel } from '@/components/character/ClassFeaturesPanel';
import { HitDicePool } from '@/components/character/HitDicePool';

interface StatsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  level: number;
  currentXP: number;
  xpPreset: XPPreset;
  onAddXP: (amount: number, source: string) => void;
  // HP State (managed locally for now, could be lifted)
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, temp: number) => void;
  // HP calculation inputs
  constitutionModifier?: number;
  prestigeLevel?: number;
  // Equipment stats
  equipmentStats?: AggregatedStats;
  // Ability Scores
  baseScores?: BaseAbilityScores;
  getScoreBreakdown?: (ability: AbilityName) => AbilityScoreBreakdown;
  onIncrementScore?: (ability: AbilityName) => void;
  onDecrementScore?: (ability: AbilityName) => void;
  onRandomizeScores?: () => number[];
  onApplyScores?: (scores: BaseAbilityScores) => void;
  // Class system (Phase 8)
  primaryClass?: DnDClass;
  multiclassLevels?: ClassLevelMap;
  onHeal?: (amount: number) => void;
}

export function StatsDrawer({ 
  open, 
  onOpenChange,
  characterName,
  level,
  currentXP,
  xpPreset,
  onAddXP,
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP,
  onHPChange,
  equipmentStats,
  constitutionModifier = 0,
  prestigeLevel = 0,
  // Ability Scores
  baseScores,
  getScoreBreakdown,
  onIncrementScore,
  onDecrementScore,
  onRandomizeScores,
  onApplyScores,
  // Class system
  primaryClass = 'rogue',
  multiclassLevels = {},
  onHeal,
}: StatsDrawerProps) {
  const empyrean = isEmpyreanMode();
  // Local HP state (with default values based on level)
  const defaultMaxHP = 8 + (level - 1) * 5; // Simple formula: 8 + 5 per level
  const [localCurrentHP, setLocalCurrentHP] = useState(propCurrentHP ?? defaultMaxHP);
  const [localMaxHP] = useState(propMaxHP ?? defaultMaxHP);
  const [localTempHP, setLocalTempHP] = useState(propTempHP ?? 0);
  const [customXP, setCustomXP] = useState('');
  const [hpDelta, setHpDelta] = useState('');
  const [showHPBreakdown, setShowHPBreakdown] = useState(false);
  const [showClassSection, setShowClassSection] = useState(false);
  const [showClassFeatures, setShowClassFeatures] = useState(false);

  const currentHP = propCurrentHP ?? localCurrentHP;
  const maxHP = propMaxHP ?? localMaxHP;
  const tempHP = propTempHP ?? localTempHP;
  
  // Get HP breakdown for display
  const hpBreakdown = getHPBreakdown(level, constitutionModifier, prestigeLevel);

  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const xpProgress = getLevelProgress(level, currentXP, multiplier);
  const xpToNext = getXPToNextLevel(level, currentXP, multiplier);

  const updateHP = (newCurrent: number, newTemp: number) => {
    const clampedCurrent = Math.max(0, Math.min(newCurrent, maxHP));
    const clampedTemp = Math.max(0, newTemp);
    
    if (onHPChange) {
      onHPChange(clampedCurrent, clampedTemp);
    } else {
      setLocalCurrentHP(clampedCurrent);
      setLocalTempHP(clampedTemp);
    }
  };

  const handleDamage = () => {
    const amount = parseInt(hpDelta) || 1;
    let remainingDamage = amount;
    let newTemp = tempHP;
    let newCurrent = currentHP;

    // Temp HP absorbs damage first
    if (newTemp > 0) {
      if (remainingDamage >= newTemp) {
        remainingDamage -= newTemp;
        newTemp = 0;
      } else {
        newTemp -= remainingDamage;
        remainingDamage = 0;
      }
    }

    // Apply remaining to current HP
    newCurrent = Math.max(0, newCurrent - remainingDamage);
    updateHP(newCurrent, newTemp);
    setHpDelta('');
    
    toast.error(`${characterName} takes ${amount} damage!`);
  };

  const handleHeal = () => {
    const amount = parseInt(hpDelta) || 1;
    const newCurrent = Math.min(maxHP, currentHP + amount);
    updateHP(newCurrent, tempHP);
    setHpDelta('');
    
    toast.success(`${characterName} heals for ${amount} ${empyrean ? 'Vitality' : 'HP'}!`);
  };

  const handleAddTempHP = () => {
    const amount = parseInt(hpDelta) || 1;
    // Temp HP doesn't stack, take the higher value
    const newTemp = Math.max(tempHP, amount);
    updateHP(currentHP, newTemp);
    setHpDelta('');
    
    toast.success(`${characterName} gains ${amount} ${empyrean ? 'temporary Vitality' : 'temporary HP'}!`);
  };

  const handleQuickXP = (rewardType: XPRewardType) => {
    const reward = XP_REWARDS[rewardType];
    const amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
    onAddXP(amount, reward.label);
  };

  const handleCustomXP = () => {
    const amount = parseInt(customXP);
    if (amount > 0) {
      onAddXP(amount, 'Custom XP');
      setCustomXP('');
    }
  };

  const hpPercentage = (currentHP / maxHP) * 100;
  const hpColor = hpPercentage > 50 ? '#22c55e' : hpPercentage > 25 ? '#eab308' : '#ef4444';

  // Helper to render stat bonus
  const renderStatBonus = (value: number, label: string, icon: React.ReactNode, color: string) => {
    if (value === 0) return null;
    return (
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-md border"
        style={{ 
          backgroundColor: `${color}15`,
          borderColor: `${color}40`,
        }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="ml-auto font-mono text-sm font-bold" style={{ color }}>
          {value > 0 ? '+' : ''}{value}
        </span>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header with close button */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: '#ef444430' }}
      >
        <div className="flex items-center gap-3">
          <span 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
          >
            <Heart className="w-5 h-5" />
          </span>
          <h2 className="text-lg font-cinzel" style={{ color: '#ef4444' }}>{empyrean ? 'Rider Stats' : 'Stats'}</h2>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors"
          aria-label="Close stats"
        >
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Equipment Stats Section */}
          {equipmentStats && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Equipment Stats
              </h3>
              
              {/* Primary Combat Stats */}
              <div className="grid grid-cols-3 gap-2">
                {/* AC */}
                <div className="p-3 rounded-lg border bg-blue-500/10 border-blue-500/40 text-center">
                  <Shield className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                  <div className="text-2xl font-bold text-blue-400">{equipmentStats.totalAC}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{empyrean ? 'Defense' : 'AC'}</div>
                  {equipmentStats.acFromGear > 0 && (
                    <div className="text-[9px] text-blue-400/70">+{equipmentStats.acFromGear} gear</div>
                  )}
                </div>
                
                {/* Attack Bonus */}
                <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/40 text-center">
                  <Swords className="w-5 h-5 mx-auto text-red-400 mb-1" />
                  <div className="text-2xl font-bold text-red-400">
                    {equipmentStats.totalAttackBonus >= 0 ? '+' : ''}{equipmentStats.totalAttackBonus}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Attack</div>
                </div>
                
                {/* Damage */}
                <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/40 text-center">
                  <Target className="w-5 h-5 mx-auto text-amber-400 mb-1" />
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {equipmentStats.damage || '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Damage</div>
                </div>
              </div>

              {/* Weight */}
              <div className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/20 border-muted/40">
                <div className="flex items-center gap-2">
                  <Weight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Weight</span>
                </div>
                <span className="font-mono text-sm">{equipmentStats.totalWeight} lbs</span>
              </div>

              {/* Attribute Bonuses */}
              {(equipmentStats.strength !== 0 || equipmentStats.dexterity !== 0 || 
                equipmentStats.constitution !== 0 || equipmentStats.intelligence !== 0 ||
                equipmentStats.wisdom !== 0 || equipmentStats.charisma !== 0) && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Attribute Bonuses
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {renderStatBonus(equipmentStats.strength, getAbilityAbbr('str', 'STR'), <Swords className="w-3 h-3" />, '#ef4444')}
                    {renderStatBonus(equipmentStats.dexterity, getAbilityAbbr('dex', 'DEX'), <Move className="w-3 h-3" />, '#22c55e')}
                    {renderStatBonus(equipmentStats.constitution, getAbilityAbbr('con', 'CON'), <Heart className="w-3 h-3" />, '#f97316')}
                    {renderStatBonus(equipmentStats.intelligence, getAbilityAbbr('int', 'INT'), <Sparkles className="w-3 h-3" />, '#3b82f6')}
                    {renderStatBonus(equipmentStats.wisdom, getAbilityAbbr('wis', 'WIS'), <Eye className="w-3 h-3" />, '#a855f7')}
                    {renderStatBonus(equipmentStats.charisma, getAbilityAbbr('cha', 'CHA'), <Gem className="w-3 h-3" />, '#ec4899')}
                  </div>
                </div>
              )}

              {/* Other Bonuses */}
              {(equipmentStats.perception !== 0 || equipmentStats.saves !== 0 || equipmentStats.movement !== 0) && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Other Bonuses
                  </div>
                  <div className="space-y-1">
                    {renderStatBonus(equipmentStats.perception, empyrean ? 'Awareness' : 'Perception', <Eye className="w-3 h-3" />, '#a855f7')}
                    {renderStatBonus(equipmentStats.saves, 'Saving Throws', <Save className="w-3 h-3" />, '#22c55e')}
                    {renderStatBonus(equipmentStats.movement, 'Movement', <Move className="w-3 h-3" />, '#3b82f6')}
                  </div>
                </div>
              )}

              {/* Set Bonuses */}
              {equipmentStats.activeSetBonuses.length > 0 && (
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
                          {set.piecesActive}/{set.piecesTotal} pieces
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-300/80 mt-1">{set.bonus}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Class Section - Phase 8 */}
          {FEATURE_FLAGS.MULTICLASS_ENABLED && (
            <Collapsible open={showClassSection} onOpenChange={setShowClassSection}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-card/50 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{empyrean ? 'Role & Hit Dice' : 'Class & Hit Dice'}</span>
                  </div>
                  {showClassSection ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                {/* Class Badge */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Current Class
                  </div>
                  <ClassLevelBadge
                    primaryClass={primaryClass}
                    primaryLevel={level}
                    multiclassLevels={multiclassLevels}
                    size="md"
                    showTotalLevel
                  />
                </div>

                {/* Hit Dice Pool */}
                <HitDicePool
                  primaryClass={primaryClass}
                  primaryLevel={level}
                  multiclassLevels={multiclassLevels}
                  constitutionModifier={constitutionModifier}
                  currentHP={currentHP}
                  maxHP={maxHP}
                  onHeal={onHeal}
                />

                {/* Class Features (Collapsible) */}
                <Collapsible open={showClassFeatures} onOpenChange={setShowClassFeatures}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span>Class Features</span>
                      {showClassFeatures ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ClassFeaturesPanel
                      primaryClass={primaryClass}
                      primaryLevel={level}
                      multiclassLevels={multiclassLevels}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* HP Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Heart className="w-4 h-4" style={{ color: hpColor }} />
              Hit Points
            </h3>
            
            {/* HP Display */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: `${hpColor}10`,
                borderColor: `${hpColor}40`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold" style={{ color: hpColor }}>
                  {currentHP}
                  <span className="text-sm font-normal text-muted-foreground">/{maxHP}</span>
                </span>
                <div className="flex items-center gap-2">
                  {tempHP > 0 && (
                    <span className="flex items-center gap-1 text-sm text-cyan-400">
                      <Shield className="w-4 h-4" />
                      +{tempHP}
                    </span>
                  )}
                  <button
                    onClick={() => setShowHPBreakdown(!showHPBreakdown)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    title="Show HP breakdown"
                  >
                    {showHPBreakdown ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Info className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              <Progress 
                value={hpPercentage} 
                className="h-3"
                style={{ 
                  ['--progress-background' as string]: hpColor,
                }}
              />
              
              {/* HP Breakdown - collapsible */}
              {showHPBreakdown && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    HP Breakdown ({HP_CONFIG.HIT_DIE})
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between px-2 py-1 rounded bg-white/5">
                      <span className="text-muted-foreground">Base (Lvl 1)</span>
                      <span className="font-mono">{hpBreakdown.baseHP}</span>
                    </div>
                    {level > 1 && (
                      <div className="flex justify-between px-2 py-1 rounded bg-white/5">
                        <span className="text-muted-foreground">Levels 2-{level}</span>
                        <span className="font-mono">+{hpBreakdown.levelHP}</span>
                      </div>
                    )}
                    <div className={cn(
                      "flex justify-between px-2 py-1 rounded",
                      hpBreakdown.constitutionHP >= 0 ? "bg-orange-500/10" : "bg-rose-500/10"
                    )}>
                      <span className="text-orange-400">CON ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier})</span>
                      <span className={cn(
                        "font-mono",
                        hpBreakdown.constitutionHP >= 0 ? "text-orange-400" : "text-rose-400"
                      )}>
                        {hpBreakdown.constitutionHP >= 0 ? '+' : ''}{hpBreakdown.constitutionHP}
                      </span>
                    </div>
                    {prestigeLevel > 0 && (
                      <div className="flex justify-between px-2 py-1 rounded bg-amber-500/10">
                        <span className="text-amber-400">Prestige ({prestigeLevel})</span>
                        <span className="font-mono text-amber-400">+{hpBreakdown.prestigeHP}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between px-2 py-1.5 rounded bg-white/10 font-semibold text-sm mt-2">
                    <span>Total Max HP</span>
                    <span className="font-mono" style={{ color: hpColor }}>{hpBreakdown.totalHP}</span>
                  </div>
                </div>
              )}
            </div>

            {/* HP Controls */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={hpDelta}
                onChange={(e) => setHpDelta(e.target.value)}
                className="flex-1 h-9"
              />
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={handleDamage}
                className="gap-1"
              >
                <Minus className="w-3 h-3" />
                Damage
              </Button>
              <Button 
                size="sm" 
                variant="default"
                onClick={handleHeal}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-3 h-3" />
                Heal
              </Button>
            </div>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAddTempHP}
              className="w-full gap-1 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
            >
              <Shield className="w-3 h-3" />
              Add Temp HP
            </Button>
          </div>

          {/* XP Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Experience Points
            </h3>
            
            {/* XP Display */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: 'hsl(var(--amber-500) / 0.1)',
                borderColor: 'hsl(var(--amber-500) / 0.4)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-amber-400">
                  {currentXP.toLocaleString()} XP
                </span>
                <span className="text-xs text-muted-foreground">
                  Level {level} • {xpToNext.toLocaleString()} to next
                </span>
              </div>
              <Progress 
                value={xpProgress} 
                className="h-2"
              />
            </div>

            {/* Quick XP Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(XP_REWARDS).slice(0, 6).map(([key, reward]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickXP(key as XPRewardType)}
                  className="text-xs h-8"
                >
                  <Zap className="w-3 h-3 mr-1 text-amber-400" />
                  {reward.label}
                </Button>
              ))}
            </div>

            {/* Custom XP */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Custom XP amount"
                value={customXP}
                onChange={(e) => setCustomXP(e.target.value)}
                className="flex-1 h-9"
              />
              <Button 
                size="sm" 
                onClick={handleCustomXP}
                disabled={!customXP || parseInt(customXP) <= 0}
                className="gap-1 bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </div>

          {/* Ability Scores Section - At the bottom */}
          {baseScores && getScoreBreakdown && onIncrementScore && onDecrementScore && onRandomizeScores && onApplyScores && (
            <AbilityScoresPanel
              baseScores={baseScores}
              getScoreBreakdown={getScoreBreakdown}
              onIncrementScore={onIncrementScore}
              onDecrementScore={onDecrementScore}
              onRandomizeScores={onRandomizeScores}
              onApplyScores={onApplyScores}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
