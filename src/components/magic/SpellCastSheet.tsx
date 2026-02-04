import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SpellDefinition, MagicPath, SpellSlotLevel, PactSlots } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellLevelLabel, getCastingTimeLabel, getComponentsLabel } from '@/lib/magic/spells';
import { scaleCantrip } from '@/lib/magic/calculations';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wand2, Eye, Zap, AlertTriangle, ArrowUp, 
  Sparkles, Copy, Check, Clock, TrendingUp
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpellCastSheetProps {
  spell: SpellDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  path: MagicPath;
  spellSlots: Record<number, SpellSlotLevel>;
  pactSlots?: PactSlots;
  concentratingOn: string | null;
  spellAttackBonus: number;
  spellSaveDC: number;
  characterName: string;
  characterLevel?: number;
  onCast: (spellLevel: number, usePact: boolean) => void;
}

export function SpellCastSheet({
  spell,
  isOpen,
  onClose,
  path,
  spellSlots,
  pactSlots,
  concentratingOn,
  spellAttackBonus,
  spellSaveDC,
  characterName,
  characterLevel = 1,
  onCast,
}: SpellCastSheetProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [usePactSlot, setUsePactSlot] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Reset selection when spell changes - must use useEffect for side effects
  useEffect(() => {
    if (spell) {
      setSelectedLevel(spell.level);
      setUsePactSlot(path === 'hexblade' && !!pactSlots && pactSlots.current > 0);
    }
  }, [spell, path, pactSlots]);

  // All hooks must be called before early returns - compute derived values
  const schoolConfig = spell ? getSchoolConfig(spell.school) : null;
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = spell ? (iconLookup[spell.iconName] || LucideIcons.Sparkles) : LucideIcons.Sparkles;

  const isCantrip = spell?.level === 0;
  const isRitual = spell?.ritual;
  const requiresConcentration = spell?.concentration;
  const willBreakConcentration = requiresConcentration && concentratingOn !== null;

  // Available slot levels for upcasting
  const availableSlotLevels = useMemo(() => {
    if (!spell) return [];
    const levels: { level: number; available: number; max: number }[] = [];
    
    for (let lvl = spell.level; lvl <= 5; lvl++) {
      const slot = spellSlots[lvl];
      if (slot && slot.max > 0) {
        levels.push({ level: lvl, available: slot.current, max: slot.max });
      }
    }
    
    return levels;
  }, [spell, spellSlots]);

  // Early return AFTER all hooks
  if (!spell) return null;

  // Check if can cast at selected level
  const canCastAtLevel = (level: number): boolean => {
    if (usePactSlot && pactSlots) {
      return pactSlots.current > 0 && pactSlots.level >= level;
    }
    const slot = spellSlots[level];
    return slot ? slot.current > 0 : false;
  };

  const canCast = isCantrip || (selectedLevel !== null && canCastAtLevel(selectedLevel));

  // Calculate upcast damage if applicable
  const getUpcastDamage = (baseLevel: number, castLevel: number): string | null => {
    if (!spell.damageFormula || !spell.higherLevels || castLevel <= baseLevel) {
      return null;
    }
    
    // Parse base damage (e.g., "8d6" -> 8 dice, 6 sides)
    const match = spell.damageFormula.match(/(\d+)d(\d+)/);
    if (!match) return null;
    
    const baseDice = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const levelDiff = castLevel - baseLevel;
    
    // Most spells add 1 die per level
    const upcastDice = baseDice + levelDiff;
    return `${upcastDice}d${sides}`;
  };

  const handleCast = () => {
    if (isCantrip) {
      onCast(0, false);
      onClose();
      return;
    }
    
    if (selectedLevel === null) return;
    
    onCast(selectedLevel, usePactSlot);
    onClose();
  };

  const handleCopyPrompt = async () => {
    const castLevel = selectedLevel || spell.level;
    const isUpcast = castLevel > spell.level;
    const upcastDamage = getUpcastDamage(spell.level, castLevel);
    
    const rawPrompt = `## Spell Cast: ${spell.name}

**Caster:** ${characterName}
**Spell:** ${spell.name} (${getSpellLevelLabel(spell.level)} ${spell.school})
**Cast At:** ${isUpcast ? `${getSpellLevelLabel(castLevel)} (Upcast from ${getSpellLevelLabel(spell.level)})` : getSpellLevelLabel(spell.level)}
${spell.attackType === 'melee' || spell.attackType === 'ranged' ? `**Spell Attack:** +${spellAttackBonus}` : ''}
${spell.saveStat ? `**Save DC:** ${spellSaveDC} ${spell.saveStat}` : ''}
${spell.damageFormula ? `**Damage:** ${isUpcast && upcastDamage ? upcastDamage : spell.damageFormula} ${spell.damageType || ''}${isUpcast ? ' (upcast)' : ''}` : ''}
${requiresConcentration ? '**Concentration:** Required' : ''}

---

### Effect

${spell.description}

${isUpcast && spell.higherLevels ? `**Upcast Bonus:** ${spell.higherLevels}` : ''}

---

### Casting Components

- **Casting Time:** ${getCastingTimeLabel(spell.castingTime)}
- **Range:** ${spell.range}
- **Components:** ${getComponentsLabel(spell.components)}${spell.components.material ? ` (${spell.components.material})` : ''}
- **Duration:** ${spell.duration}

---

*Please narrate the casting and effects of this spell in the current combat/roleplay context.*`;

    const prompt = applyTimePrefix(rawPrompt);

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({
        title: 'Prompt Copied!',
        description: 'Spell cast details ready for AI DM.',
        className: 'border-indigo-500 bg-indigo-500/10',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Cast {spell.name}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pr-4">
          {/* Header */}
          <div className={cn(
            "p-4 -mx-6 -mt-2 mb-4 rounded-t-2xl",
            "bg-gradient-to-br",
            schoolConfig.bgGradient
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                "bg-black/30 backdrop-blur-sm"
              )}>
                <IconComponent className={cn("w-7 h-7", schoolConfig.color)} />
              </div>
              <div className="flex-1">
                <h2 className="font-cinzel text-xl font-bold">Cast {spell.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={cn("text-xs", schoolConfig.color)}>
                    {spell.school}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {getSpellLevelLabel(spell.level)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Concentration Warning */}
          {willBreakConcentration && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-amber-200">Concentration Warning</div>
                <div className="text-xs text-amber-300/80">
                  Casting this spell will end your current concentration.
                </div>
              </div>
            </div>
          )}

          {/* Cantrip - No slot needed */}
          {isCantrip && (
            <div className="mb-4 p-4 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">Cantrip - No Slot Required</span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-1">
                Cantrips can be cast at will without consuming spell slots.
              </p>
              {spell?.damageFormula && characterLevel >= 5 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-purple-300">
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    Scaled damage: {scaleCantrip(spell.damageFormula, characterLevel)} 
                    {characterLevel >= 17 ? ' (max)' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ritual Option */}
          {isRitual && !isCantrip && (
            <div className="mb-4 p-3 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-200">
                This spell can be cast as a ritual (10 minutes, no slot consumed)
              </span>
            </div>
          )}

          {/* Slot Selection for non-cantrips */}
          {!isCantrip && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                Select Spell Slot
              </h3>
              
              {/* Pact Slot Option (for Hexblade) */}
              {path === 'hexblade' && pactSlots && pactSlots.level >= spell.level && (
                <div className="mb-3">
                  <button
                    onClick={() => {
                      setUsePactSlot(true);
                      setSelectedLevel(pactSlots.level);
                    }}
                    disabled={pactSlots.current <= 0}
                    className={cn(
                      "w-full p-3 rounded-lg border-2 transition-all text-left",
                      usePactSlot
                        ? "border-violet-500 bg-violet-500/20"
                        : pactSlots.current > 0
                          ? "border-white/10 bg-muted/30 hover:border-violet-500/50"
                          : "border-white/5 bg-muted/10 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-violet-400" />
                        <span className="font-medium">Pact Slot</span>
                        <Badge variant="outline" className="text-violet-300 border-violet-500/50">
                          {getSpellLevelLabel(pactSlots.level)}
                        </Badge>
                      </div>
                      <span className={cn(
                        "text-sm font-mono",
                        pactSlots.current > 0 ? "text-violet-400" : "text-muted-foreground"
                      )}>
                        {pactSlots.current}/{pactSlots.max}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recovers on short rest • Casts at {getSpellLevelLabel(pactSlots.level)}
                    </p>
                  </button>
                </div>
              )}
              
              {/* Regular Slot Options */}
              <div className="grid grid-cols-2 gap-2">
                {availableSlotLevels.map(({ level, available, max }) => {
                  const isUpcast = level > spell.level;
                  const upcastDamage = getUpcastDamage(spell.level, level);
                  const isSelected = !usePactSlot && selectedLevel === level;
                  
                  return (
                    <button
                      key={level}
                      onClick={() => {
                        setUsePactSlot(false);
                        setSelectedLevel(level);
                      }}
                      disabled={available <= 0}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-left",
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20"
                          : available > 0
                            ? "border-white/10 bg-muted/30 hover:border-indigo-500/50"
                            : "border-white/5 bg-muted/10 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{getSpellLevelLabel(level)}</span>
                        <span className={cn(
                          "text-sm font-mono",
                          available > 0 ? "text-indigo-400" : "text-muted-foreground"
                        )}>
                          {available}/{max}
                        </span>
                      </div>
                      
                      {isUpcast && (
                        <div className="flex items-center gap-1 text-xs text-amber-400">
                          <ArrowUp className="w-3 h-3" />
                          <span>Upcast</span>
                          {upcastDamage && (
                            <span className="text-orange-400">({upcastDamage})</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spell Stats */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            {(spell.attackType === 'melee' || spell.attackType === 'ranged') && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-center">
                <div className="text-2xl font-bold text-red-400">+{spellAttackBonus}</div>
                <div className="text-xs text-muted-foreground uppercase">Spell Attack</div>
              </div>
            )}
            {spell.saveStat && (
              <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-center">
                <div className="text-2xl font-bold text-blue-400">{spellSaveDC}</div>
                <div className="text-xs text-muted-foreground uppercase">{spell.saveStat} Save DC</div>
              </div>
            )}
            {spell.damageFormula && (
              <div className="p-3 rounded-lg bg-orange-500/20 border border-orange-500/30 text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {selectedLevel && selectedLevel > spell.level 
                    ? getUpcastDamage(spell.level, selectedLevel) || spell.damageFormula
                    : spell.damageFormula
                  }
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  {spell.damageType || 'Damage'}
                </div>
              </div>
            )}
            {spell.healingFormula && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-center">
                <div className="text-2xl font-bold text-emerald-400">{spell.healingFormula}</div>
                <div className="text-xs text-muted-foreground uppercase">Healing</div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-4 p-3 rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {spell.description}
            </p>
          </div>

          {/* Upcast Effect */}
          {spell.higherLevels && selectedLevel && selectedLevel > spell.level && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUp className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-300">Upcast Effect</span>
              </div>
              <p className="text-xs text-muted-foreground">{spell.higherLevels}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pb-8">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyPrompt}
            >
              {copied ? (
                <><Check className="w-4 h-4 mr-2" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> Copy Prompt</>
              )}
            </Button>
            
            <Button
              className={cn(
                "flex-1",
                schoolConfig.bgGradient.replace('from-', 'bg-gradient-to-r from-')
              )}
              disabled={!canCast}
              onClick={handleCast}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {isCantrip ? 'Cast Cantrip' : `Cast at ${selectedLevel ? getSpellLevelLabel(selectedLevel) : '?'}`}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
