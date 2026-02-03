import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpellDefinition, MagicPath, SpellSlotLevel, PactSlots } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellLevelLabel, getCastingTimeLabel, getComponentsLabel, getSpellById } from '@/lib/magic/spells';
import { SpellCastSheet } from '@/components/magic/SpellCastSheet';
import {
  Wand2,
  ChevronRight,
  Zap,
  Eye,
  Clock,
  Search,
  Filter,
  Sparkles,
  X,
  AlertTriangle,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';

interface MobileSpellListProps {
  spellcasting: UseSpellcastingReturn;
  characterName: string;
  onCast: (result: { spellName: string; success: boolean }) => void;
}

export function MobileSpellList({
  spellcasting,
  characterName,
  onCast,
}: MobileSpellListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [castingSpell, setCastingSpell] = useState<SpellDefinition | null>(null);
  
  const { state, spellAttackBonus, spellSaveDC, totalSlotsRemaining, castSpell, breakConcentration } = spellcasting;

  // Get prepared spells
  const preparedSpells = useMemo(() => {
    return state.preparedSpells
      .map(id => getSpellById(id))
      .filter((spell): spell is SpellDefinition => spell !== null);
  }, [state.preparedSpells]);

  // Filter spells
  const filteredSpells = useMemo(() => {
    return preparedSpells.filter(spell => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!spell.name.toLowerCase().includes(query) && 
            !spell.school.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filterLevel !== null && spell.level !== filterLevel) {
        return false;
      }
      return true;
    });
  }, [preparedSpells, searchQuery, filterLevel]);

  // Get concentration spell
  const concentrationSpell = state.concentratingOn 
    ? getSpellById(state.concentratingOn)
    : null;

  // No path selected
  if (!state.path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
          <Wand2 className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="text-muted-foreground">No magic path selected</p>
        <p className="text-[11px] text-indigo-400 italic mt-2">
          Visit the Arcana tab to unlock your magical potential
        </p>
      </div>
    );
  }

  // No prepared spells
  if (preparedSpells.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="text-muted-foreground">No spells prepared</p>
        <p className="text-[11px] text-indigo-400 italic mt-2">
          Prepare spells in the Arcana tab first
        </p>
      </div>
    );
  }

  const handleSpellTap = (spell: SpellDefinition) => {
    setCastingSpell(spell);
  };

  const handleCast = (castLevel: number, usePact: boolean) => {
    if (!castingSpell) return;
    
    const result = castSpell(
      castingSpell.id,
      castingSpell.name,
      castingSpell.level,
      castLevel,
      usePact,
      castingSpell.concentration
    );
    
    onCast({ spellName: castingSpell.name, success: result.success });
    setCastingSpell(null);
  };

  // Get unique spell levels for filter
  const spellLevels = useMemo(() => {
    const levels = new Set(preparedSpells.map(s => s.level));
    return Array.from(levels).sort((a, b) => a - b);
  }, [preparedSpells]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 pb-24 space-y-3">
      {/* Quick Stats Bar */}
      <div className="flex items-center gap-2 p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
        <div className="flex-1 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-indigo-400">+{spellAttackBonus}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Attack</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{spellSaveDC}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Save DC</div>
          </div>
          <div>
            <div className="text-lg font-bold text-violet-400">{totalSlotsRemaining}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Slots</div>
          </div>
        </div>
      </div>

      {/* Concentration Indicator */}
      {concentrationSpell && (
        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-sm text-amber-200">
              <span className="font-medium">{concentrationSpell.name}</span>
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
            onClick={breakConcentration}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Slot Status Strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5].map(level => {
          const slot = state.spellSlots[level];
          if (!slot || slot.max === 0) return null;
          return (
            <div 
              key={level}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap",
                slot.current > 0 
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-muted/20 text-muted-foreground border border-muted/20"
              )}
            >
              <Zap className="w-3 h-3" />
              <span>{level === 1 ? '1st' : level === 2 ? '2nd' : level === 3 ? '3rd' : `${level}th`}:</span>
              <span className="font-bold">{slot.current}/{slot.max}</span>
            </div>
          );
        })}
        {state.pactSlots && state.pactSlots.max > 0 && (
          <div 
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap",
              state.pactSlots.current > 0 
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-muted/20 text-muted-foreground border border-muted/20"
            )}
          >
            <Wand2 className="w-3 h-3" />
            <span>Pact:</span>
            <span className="font-bold">{state.pactSlots.current}/{state.pactSlots.max}</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search spells..."
          className="h-10 pl-10 bg-black/30 border-muted/30 rounded-xl text-sm"
        />
      </div>

      {/* Level Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="All"
          active={filterLevel === null}
          onClick={() => setFilterLevel(null)}
        />
        {spellLevels.map(level => (
          <FilterChip
            key={level}
            label={level === 0 ? 'Cantrip' : getSpellLevelLabel(level)}
            active={filterLevel === level}
            onClick={() => setFilterLevel(filterLevel === level ? null : level)}
          />
        ))}
      </div>

      {/* Spell List */}
      {filteredSpells.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No spells match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSpells.map(spell => (
            <MobileSpellCard
              key={spell.id}
              spell={spell}
              spellSlots={state.spellSlots}
              pactSlots={state.pactSlots}
              isConcentrating={state.concentratingOn === spell.id}
              onTap={() => handleSpellTap(spell)}
            />
          ))}
        </div>
      )}

      {/* Cast Sheet */}
      <SpellCastSheet
        spell={castingSpell}
        isOpen={!!castingSpell}
        onClose={() => setCastingSpell(null)}
        path={state.path!}
        spellSlots={state.spellSlots}
        pactSlots={state.pactSlots}
        concentratingOn={state.concentratingOn}
        spellAttackBonus={spellAttackBonus}
        spellSaveDC={spellSaveDC}
        characterName={characterName}
        onCast={handleCast}
      />
      </div>
    </div>
  );
}

function MobileSpellCard({
  spell,
  spellSlots,
  pactSlots,
  isConcentrating,
  onTap,
}: {
  spell: SpellDefinition;
  spellSlots: Record<number, SpellSlotLevel>;
  pactSlots?: PactSlots;
  isConcentrating: boolean;
  onTap: () => void;
}) {
  const schoolConfig = getSchoolConfig(spell.school);
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconLookup[spell.iconName] || LucideIcons.Sparkles;

  const isCantrip = spell.level === 0;
  const hasAvailableSlot = isCantrip || 
    (spellSlots[spell.level]?.current > 0) ||
    (pactSlots && pactSlots.current > 0 && pactSlots.level >= spell.level);

  const schoolBorderColors: Record<string, string> = {
    abjuration: 'border-l-blue-500',
    conjuration: 'border-l-teal-500',
    divination: 'border-l-violet-500',
    enchantment: 'border-l-pink-500',
    evocation: 'border-l-orange-500',
    illusion: 'border-l-slate-400',
    necromancy: 'border-l-green-500',
    transmutation: 'border-l-amber-500',
  };

  return (
    <button
      onClick={onTap}
      className={cn(
        "w-full flex items-center gap-3 p-4 bg-card border border-muted/30 border-l-4 rounded-xl",
        "active:scale-[0.99] transition-all",
        schoolBorderColors[spell.school] || 'border-l-indigo-500',
        !hasAvailableSlot && "opacity-50",
        isConcentrating && "ring-2 ring-amber-500/50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        "bg-gradient-to-br",
        schoolConfig.bgGradient
      )}>
        <IconComponent className={cn("w-5 h-5", schoolConfig.color)} />
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{spell.name}</span>
          {isConcentrating && (
            <Eye className="w-3 h-3 text-amber-400 animate-pulse flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={cn("text-[9px] h-5", schoolConfig.color)}>
            {spell.school}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {getSpellLevelLabel(spell.level)}
          </span>
          {spell.concentration && (
            <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              Conc.
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {spell.damageFormula && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-lg text-xs text-orange-300">
            <span className="font-mono">{spell.damageFormula}</span>
          </div>
        )}
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all active:scale-95",
        active
          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50"
          : "bg-muted/20 text-muted-foreground border border-muted/30"
      )}
    >
      {label}
    </button>
  );
}
