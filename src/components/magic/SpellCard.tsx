import { cn } from '@/lib/utils';
import { SpellDefinition } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellLevelLabel, getCastingTimeLabel, getComponentsLabel } from '@/lib/magic/spells';
import { scaleCantrip, getCantripScaling } from '@/lib/magic/calculations';
import { getSpellLevelTheme } from '@/lib/magic/rangeUtils';
import { SpellStatusIcons } from './SpellStatusIcons';
import { RangeIndicatorCompact } from './RangeIndicator';
import { Star, Clock, Target, Eye, Mic, Hand, Package } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface SpellCardProps {
  spell: SpellDefinition;
  isPrepared?: boolean;
  isFavorite?: boolean;
  isConcentrating?: boolean;
  onClick?: () => void;
  compact?: boolean;
  characterLevel?: number;
}

export function SpellCard({
  spell,
  isPrepared = false,
  isFavorite = false,
  isConcentrating = false,
  onClick,
  compact = false,
  characterLevel = 1,
}: SpellCardProps) {
  const schoolConfig = getSchoolConfig(spell.school);
  const levelTheme = getSpellLevelTheme(spell.level);
  
  // Get the icon component safely
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconLookup[spell.iconName] || LucideIcons.Sparkles;

  // Scale cantrip damage if applicable
  const displayDamage = spell.level === 0 
    ? scaleCantrip(spell.damageFormula, characterLevel)
    : spell.damageFormula;
  
  const cantripScaling = spell.level === 0 && spell.damageFormula 
    ? getCantripScaling(1, 'd10', characterLevel) 
    : null;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-2 p-2 rounded-lg transition-all",
          "border border-transparent hover:border-white/20",
          "bg-gradient-to-r",
          schoolConfig.bgGradient,
          isPrepared && "ring-1 ring-indigo-500/50",
          isConcentrating && "ring-2 ring-amber-500 animate-pulse"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center",
          "bg-black/30"
        )}>
          <IconComponent className={cn("w-4 h-4", schoolConfig.color)} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium truncate">{spell.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {getSpellLevelLabel(spell.level)} • {spell.school}
          </div>
        </div>
        {isFavorite && (
          <Star className="w-3 h-3 text-amber-400 fill-amber-400 absolute top-1 right-1" />
        )}
      </button>
    );
  }

  const isUnpreparedLeveled = !isPrepared && spell.level > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-3 rounded-xl transition-all text-left",
        "border-2 hover:scale-[1.02] active:scale-[0.98]",
        // Level-based border coloring
        levelTheme.borderColor,
        // Background with subtle gradient
        "bg-gradient-to-br from-background/80 to-background/40",
        isPrepared && "ring-2 ring-indigo-500/60",
        isConcentrating && "ring-2 ring-amber-500 animate-pulse",
        isUnpreparedLeveled && "opacity-50 border-border/30"
      )}
    >
      {/* Favorite star */}
      {isFavorite && (
        <Star className="absolute top-2 right-2 w-4 h-4 text-amber-400 fill-amber-400" />
      )}
      
      {/* Prepared badge */}
      {isPrepared && spell.level > 0 && !isFavorite && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Prepared
        </span>
      )}

      {/* Unprepared badge */}
      {isUnpreparedLeveled && !isFavorite && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/60 text-muted-foreground border border-border/30">
          Not Prepared
        </span>
      )}

      {/* Homebrew badge */}
      {(spell as any).isHomebrew && (
        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-600/40 text-indigo-300 border border-indigo-500/30">
          Homebrew
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          "bg-gradient-to-br relative overflow-hidden",
          schoolConfig.bgGradient
        )}>
          <IconComponent className={cn("w-5 h-5", schoolConfig.color)} />
          {/* School watermark */}
          <div className={cn(
            "absolute inset-0 opacity-10",
            "bg-gradient-to-br from-white/20 to-transparent"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-cinzel text-sm font-medium leading-tight">
            {spell.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
              schoolConfig.bgGradient,
              schoolConfig.color
            )}>
              {spell.school}
            </span>
            <span className={cn("text-[10px]", levelTheme.textColor)}>
              {getSpellLevelLabel(spell.level)}
            </span>
          </div>
        </div>
      </div>

      {/* Status Icons Row */}
      <SpellStatusIcons 
        spell={spell} 
        characterLevel={characterLevel}
        size="sm"
        className="mb-2"
      />

      {/* Quick Info with Range Indicator */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{getCastingTimeLabel(spell.castingTime)}</span>
        </div>
        <RangeIndicatorCompact range={spell.range} />
      </div>

      {/* Description preview */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {spell.description}
      </p>

      {/* Bottom Bar with Components and Damage */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        {/* Component Icons */}
        <div className="flex items-center gap-1">
          {spell.components.verbal && (
            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center" title="Verbal">
              <Mic className="w-2.5 h-2.5 text-blue-400" />
            </div>
          )}
          {spell.components.somatic && (
            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center" title="Somatic">
              <Hand className="w-2.5 h-2.5 text-green-400" />
            </div>
          )}
          {spell.components.material && (
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center",
              spell.components.materialCost ? "bg-amber-500/20" : "bg-purple-500/20"
            )} title={spell.components.material}>
              <Package className={cn(
                "w-2.5 h-2.5",
                spell.components.materialCost ? "text-amber-400" : "text-purple-400"
              )} />
            </div>
          )}
        </div>
        
        {/* Damage/Healing Display */}
        <div className="flex items-center gap-2">
          {displayDamage && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
              <span className="text-[11px] font-mono text-orange-400 font-bold">
                {displayDamage}
              </span>
              <span className="text-[9px] text-orange-300/80">
                {spell.damageType}
              </span>
              {spell.level === 0 && characterLevel >= 5 && cantripScaling && (
                <span className="text-[8px] text-purple-400 ml-0.5">↑</span>
              )}
            </div>
          )}
          {spell.healingFormula && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full">
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {spell.healingFormula}
              </span>
            </div>
          )}
          {spell.ritual && !displayDamage && !spell.healingFormula && (
            <span className="text-[10px] text-violet-400 font-medium">
              Ritual
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
