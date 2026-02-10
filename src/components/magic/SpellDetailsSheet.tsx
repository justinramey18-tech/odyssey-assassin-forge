import { cn } from '@/lib/utils';
import { SpellDefinition } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellLevelLabel, getCastingTimeLabel, getComponentsLabel } from '@/lib/magic/spells';
import { scaleCantrip, getCantripScaling } from '@/lib/magic/calculations';
import { getSpellLevelTheme } from '@/lib/magic/rangeUtils';
import { RangeIndicator } from './RangeIndicator';
import { SpellStatusIcons } from './SpellStatusIcons';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Star, Clock, Target, Eye, Mic, Hand, Package, 
  Zap, Swords, Shield, Copy, Check, TrendingUp,
  Crosshair, ShieldAlert
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SpellDetailsSheetProps {
  spell: SpellDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  isPrepared: boolean;
  isFavorite: boolean;
  isConcentrating: boolean;
  canCast: boolean;
  canPrepareMore?: boolean;
  characterLevel?: number;
  /** Whether this is a prepared caster (Wizard, Cleric) vs known caster (Warlock, Sorcerer) */
  isPreparedCaster?: boolean;
  onPrepare: () => void;
  onUnprepare: () => void;
  onToggleFavorite: () => void;
  onCast: () => void;
}

export function SpellDetailsSheet({
  spell,
  isOpen,
  onClose,
  isPrepared,
  isFavorite,
  isConcentrating,
  canCast,
  canPrepareMore = true,
  characterLevel = 1,
  isPreparedCaster = true,
  onPrepare,
  onUnprepare,
  onToggleFavorite,
  onCast,
}: SpellDetailsSheetProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!spell) return null;

  const schoolConfig = getSchoolConfig(spell.school);
  const levelTheme = getSpellLevelTheme(spell.level);
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconLookup[spell.iconName] || LucideIcons.Sparkles;

  // Calculate scaled damage for cantrips
  const isCantrip = spell.level === 0;
  const scaledDamage = isCantrip ? scaleCantrip(spell.damageFormula, characterLevel) : spell.damageFormula;
  const cantripScaling = isCantrip && spell.damageFormula 
    ? getCantripScaling(1, 'd10', characterLevel) 
    : null;

  const handleCopyPrompt = async () => {
    const prompt = `**Spell: ${spell.name}**
Level: ${getSpellLevelLabel(spell.level)} ${spell.school}
Casting Time: ${getCastingTimeLabel(spell.castingTime)}
Range: ${spell.range}
Components: ${getComponentsLabel(spell.components)}
Duration: ${spell.duration}

${spell.description}${spell.higherLevels ? `\n\n**At Higher Levels:** ${spell.higherLevels}` : ''}`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Spell details copied to clipboard.',
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{spell.name}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pr-4">
          {/* Header */}
          <div className={cn(
            "p-4 -mx-6 -mt-2 mb-4 rounded-t-2xl",
            "bg-gradient-to-br",
            schoolConfig.bgGradient
          )}>
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                "bg-black/30 backdrop-blur-sm"
              )}>
                <IconComponent className={cn("w-7 h-7", schoolConfig.color)} />
              </div>
              <div className="flex-1">
                <h2 className="font-cinzel text-xl font-bold">{spell.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={cn("text-xs", schoolConfig.color)}>
                    {spell.school}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {getSpellLevelLabel(spell.level)}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFavorite}
                className="shrink-0"
              >
                <Star className={cn(
                  "w-5 h-5",
                  isFavorite ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                )} />
              </Button>
            </div>
          </div>

          {/* Concentration Warning */}
          {isConcentrating && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-200">Currently concentrating on this spell</span>
            </div>
          )}

          {/* Status Icons */}
          <SpellStatusIcons 
            spell={spell} 
            characterLevel={characterLevel}
            showLabels
            size="md"
            className="mb-4"
          />

          {/* Attack/Save Info Banner */}
          {(spell.attackType === 'melee' || spell.attackType === 'ranged') && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <Crosshair className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-sm font-medium text-red-300">
                  {spell.attackType === 'melee' ? 'Melee Spell Attack' : 'Ranged Spell Attack'}
                </div>
                <div className="text-xs text-muted-foreground">Roll d20 + Spell Attack vs target AC</div>
              </div>
            </div>
          )}
          
          {spell.attackType === 'save' && spell.saveStat && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-amber-300">
                  {spell.saveStat} Saving Throw
                </div>
                <div className="text-xs text-muted-foreground">Target makes {spell.saveStat} save vs your Spell DC</div>
              </div>
            </div>
          )}

          {/* Range & Area Display */}
          <div className="mb-4">
            <div className="text-xs text-muted-foreground uppercase font-medium mb-2">Range & Area</div>
            <RangeIndicator range={spell.range} size="md" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase">Casting Time</span>
              </div>
              <span className="font-medium text-sm">{getCastingTimeLabel(spell.castingTime)}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Shield className="w-4 h-4" />
                <span className="text-xs uppercase">Duration</span>
              </div>
              <span className="font-medium text-sm">{spell.duration}</span>
            </div>
          </div>

          {/* Components Detail */}
          <div className="mb-4 p-3 rounded-lg bg-muted/20 space-y-2">
            <div className="text-xs text-muted-foreground uppercase font-medium">Components Required</div>
            <div className="flex flex-wrap gap-2">
              {spell.components.verbal && (
                <Badge variant="outline" className="gap-1">
                  <Mic className="w-3 h-3" /> Verbal
                </Badge>
              )}
              {spell.components.somatic && (
                <Badge variant="outline" className="gap-1">
                  <Hand className="w-3 h-3" /> Somatic
                </Badge>
              )}
              {spell.components.material && (
                <Badge variant="outline" className="gap-1">
                  <Package className="w-3 h-3" /> Material
                </Badge>
              )}
            </div>
            {spell.components.material && (
              <p className="text-xs text-muted-foreground italic">
                {spell.components.material}
                {spell.components.materialConsumed && ' (consumed)'}
                {spell.components.materialCost && ` (${spell.components.materialCost} gp)`}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {spell.concentration && (
              <Badge className="bg-amber-600/30 text-amber-300 border-amber-500/50">
                <Eye className="w-3 h-3 mr-1" /> Concentration
              </Badge>
            )}
            {spell.ritual && (
              <Badge className="bg-violet-600/30 text-violet-300 border-violet-500/50">
                Ritual
              </Badge>
            )}
            {spell.attackType && (
              <Badge className="bg-red-600/30 text-red-300 border-red-500/50">
                <Swords className="w-3 h-3 mr-1" />
                {spell.attackType === 'melee' ? 'Melee Attack' : spell.attackType === 'ranged' ? 'Ranged Attack' : 'Save'}
              </Badge>
            )}
            {scaledDamage && (
              <Badge className="bg-orange-600/30 text-orange-300 border-orange-500/50">
                <Zap className="w-3 h-3 mr-1" />
                {scaledDamage} {spell.damageType}
                {isCantrip && characterLevel >= 5 && (
                  <TrendingUp className="w-3 h-3 ml-1" />
                )}
              </Badge>
            )}
          </div>

          {/* Cantrip Scaling Info */}
          {isCantrip && scaledDamage && cantripScaling && (
            <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Cantrip Scaling</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {characterLevel >= 17 
                  ? 'Maximum scaling reached (×4 dice)' 
                  : cantripScaling.nextScalingLevel 
                    ? `Scales at level ${cantripScaling.nextScalingLevel}` 
                    : 'Base damage'}
              </p>
            </div>
          )}

          {/* Description */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {spell.description}
            </p>
          </div>

          {/* Higher Levels */}
          {spell.higherLevels && (
            <div className="mb-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
              <h3 className="text-sm font-semibold text-indigo-300 mb-1">At Higher Levels</h3>
              <p className="text-sm text-muted-foreground">
                {spell.higherLevels}
              </p>
            </div>
          )}

          {/* Copy Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-4"
            onClick={handleCopyPrompt}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" /> Copy for AI DM
              </>
            )}
          </Button>

          {/* Actions */}
          <div className="flex gap-2 pb-8">
            {/* Prepare/Learn button — show for leveled spells, AND for cantrips on known casters */}
            {(spell.level > 0 || (!isPreparedCaster && spell.level === 0)) && (
              <Button
                variant={isPrepared ? "outline" : "default"}
                className="flex-1"
                onClick={isPrepared ? onUnprepare : onPrepare}
                disabled={!isPrepared && !canPrepareMore}
              >
                {isPrepared 
                  ? (isPreparedCaster ? 'Unprepare' : 'Forget') 
                  : (canPrepareMore 
                    ? (isPreparedCaster ? 'Prepare' : 'Learn') 
                    : 'At Limit')}
              </Button>
            )}
            <Button
              variant="default"
              className={cn(
                "flex-1",
                spell.school === 'evocation' && "bg-orange-600 hover:bg-orange-500",
                spell.school === 'necromancy' && "bg-green-700 hover:bg-green-600",
                spell.school === 'illusion' && "bg-slate-600 hover:bg-slate-500",
                spell.school === 'enchantment' && "bg-pink-600 hover:bg-pink-500",
                spell.school === 'abjuration' && "bg-blue-600 hover:bg-blue-500",
                spell.school === 'conjuration' && "bg-teal-600 hover:bg-teal-500",
                spell.school === 'divination' && "bg-violet-600 hover:bg-violet-500",
                spell.school === 'transmutation' && "bg-amber-600 hover:bg-amber-500",
              )}
              disabled={!canCast && spell.level > 0}
              onClick={onCast}
            >
              {spell.level === 0 ? 'Cast Cantrip' : 'Cast Spell'}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
