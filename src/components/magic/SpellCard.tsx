import { cn } from '@/lib/utils';
import { SpellDefinition } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellLevelLabel, getCastingTimeLabel, getComponentsLabel } from '@/lib/magic/spells';
import { scaleCantrip } from '@/lib/magic/calculations';
import { Star, Clock, Target, Eye } from 'lucide-react';
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
  
  // Get the icon component safely
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconLookup[spell.iconName] || LucideIcons.Sparkles;

  // Scale cantrip damage if applicable
  const displayDamage = spell.level === 0 
    ? scaleCantrip(spell.damageFormula, characterLevel)
    : spell.damageFormula;

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

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-3 rounded-xl transition-all text-left",
        "border-2 hover:scale-[1.02] active:scale-[0.98]",
        // School-colored border
        spell.school === 'abjuration' && "border-blue-500/40 hover:border-blue-400/60",
        spell.school === 'conjuration' && "border-teal-500/40 hover:border-teal-400/60",
        spell.school === 'divination' && "border-violet-500/40 hover:border-violet-400/60",
        spell.school === 'enchantment' && "border-pink-500/40 hover:border-pink-400/60",
        spell.school === 'evocation' && "border-orange-500/40 hover:border-orange-400/60",
        spell.school === 'illusion' && "border-slate-400/40 hover:border-slate-300/60",
        spell.school === 'necromancy' && "border-green-500/40 hover:border-green-400/60",
        spell.school === 'transmutation' && "border-amber-500/40 hover:border-amber-400/60",
        // Background
        "bg-gradient-to-br from-background/80 to-background/40",
        isPrepared && "ring-2 ring-indigo-500/60",
        isConcentrating && "ring-2 ring-amber-500 animate-pulse"
      )}
    >
      {/* Favorite star */}
      {isFavorite && (
        <Star className="absolute top-2 right-2 w-4 h-4 text-amber-400 fill-amber-400" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          "bg-gradient-to-br",
          schoolConfig.bgGradient
        )}>
          <IconComponent className={cn("w-5 h-5", schoolConfig.color)} />
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
            <span className="text-[10px] text-muted-foreground">
              {getSpellLevelLabel(spell.level)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{getCastingTimeLabel(spell.castingTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          <span>{spell.range}</span>
        </div>
        {spell.concentration && (
          <div className="flex items-center gap-1 text-amber-400">
            <Eye className="w-3 h-3" />
            <span>Conc.</span>
          </div>
        )}
      </div>

      {/* Description preview */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {spell.description}
      </p>

      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">
          {getComponentsLabel(spell.components)}
        </span>
        {displayDamage && (
          <span className="text-[10px] font-mono text-orange-400">
            {displayDamage} {spell.damageType}
            {spell.level === 0 && characterLevel >= 5 && (
              <span className="text-[8px] text-orange-300/60 ml-1">(scaled)</span>
            )}
          </span>
        )}
        {spell.ritual && (
          <span className="text-[10px] text-violet-400 font-medium">
            Ritual
          </span>
        )}
      </div>
    </button>
  );
}
