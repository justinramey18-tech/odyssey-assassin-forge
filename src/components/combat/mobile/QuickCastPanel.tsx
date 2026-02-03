import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpellDefinition } from '@/lib/magic/types';
import { getSchoolConfig } from '@/lib/magic/schools';
import { getSpellById } from '@/lib/magic/spells';
import { scaleCantrip } from '@/lib/magic/calculations';
import { SpellCastSheet } from '@/components/magic/SpellCastSheet';
import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import {
  Wand2,
  ChevronDown,
  ChevronUp,
  Star,
  Zap,
  Eye,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface QuickCastPanelProps {
  spellcasting: UseSpellcastingReturn;
  characterName: string;
  characterLevel: number;
  onCast: (result: { spellName: string; success: boolean }) => void;
}

export function QuickCastPanel({
  spellcasting,
  characterName,
  characterLevel,
  onCast,
}: QuickCastPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [castingSpell, setCastingSpell] = useState<SpellDefinition | null>(null);
  
  const { 
    state, 
    spellAttackBonus, 
    spellSaveDC, 
    totalSlotsRemaining,
    castSpell,
  } = spellcasting;
  
  // Get favorite spells (max 4)
  const favoriteSpells = useMemo(() => {
    return state.favoriteSpells
      .slice(0, 4)
      .map(id => getSpellById(id))
      .filter((spell): spell is SpellDefinition => spell !== null);
  }, [state.favoriteSpells]);
  
  // Get concentration spell
  const concentrationSpell = state.concentratingOn 
    ? getSpellById(state.concentratingOn) 
    : null;
  
  // If no path or no favorites, show minimal indicator
  if (!state.path || favoriteSpells.length === 0) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-muted-foreground">
              {!state.path ? 'No magic path selected' : 'Star favorite spells for quick access'}
            </span>
          </div>
          {state.path && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>+{spellAttackBonus}</span>
              <span>DC {spellSaveDC}</span>
            </div>
          )}
        </div>
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
      castingSpell.concentration,
      castingSpell.duration
    );
    
    onCast({ spellName: castingSpell.name, success: result.success });
    setCastingSpell(null);
  };
  
  return (
    <div className="px-4 py-2">
      {/* Quick Stats Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl mb-2"
      >
        <div className="flex items-center gap-3">
          <Wand2 className="w-4 h-4 text-indigo-400" />
          <div className="flex items-center gap-4 text-xs">
            <span className="text-indigo-300 font-mono">+{spellAttackBonus} Attack</span>
            <span className="text-purple-300 font-mono">DC {spellSaveDC}</span>
            <span className="text-violet-300 font-mono">{totalSlotsRemaining} Slots</span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {/* Concentration Alert */}
      {concentrationSpell && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg mb-2">
          <Eye className="w-3 h-3 text-amber-400 animate-pulse" />
          <span className="text-xs text-amber-200">
            Concentrating: <span className="font-medium">{concentrationSpell.name}</span>
          </span>
        </div>
      )}
      
      {/* Expanded Quick Cast Grid */}
      {isExpanded && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {favoriteSpells.map(spell => (
            <QuickSpellButton
              key={spell.id}
              spell={spell}
              characterLevel={characterLevel}
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
  );
}

function QuickSpellButton({
  spell,
  characterLevel,
  spellSlots,
  pactSlots,
  isConcentrating,
  onTap,
}: {
  spell: SpellDefinition;
  characterLevel: number;
  spellSlots: Record<number, { current: number; max: number }>;
  pactSlots?: { current: number; max: number; level: number };
  isConcentrating: boolean;
  onTap: () => void;
}) {
  const schoolConfig = getSchoolConfig(spell.school);
  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconLookup[spell.iconName] || LucideIcons.Sparkles;
  
  const isCantrip = spell.level === 0;
  const hasSlot = isCantrip || 
    (spellSlots[spell.level]?.current > 0) ||
    (pactSlots && pactSlots.current > 0 && pactSlots.level >= spell.level);
  
  const scaledDamage = isCantrip && spell.damageFormula 
    ? scaleCantrip(spell.damageFormula, characterLevel) 
    : spell.damageFormula;
  
  return (
    <button
      onClick={onTap}
      disabled={!hasSlot}
      className={cn(
        "flex items-center gap-2 p-2 rounded-xl border transition-all",
        "active:scale-[0.98]",
        hasSlot 
          ? "bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border-indigo-500/40 hover:border-indigo-400/60"
          : "bg-muted/20 border-muted/30 opacity-50",
        isConcentrating && "ring-2 ring-amber-500/50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        "bg-gradient-to-br",
        schoolConfig.bgGradient
      )}>
        <IconComponent className={cn("w-4 h-4", schoolConfig.color)} />
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="text-xs font-medium truncate">{spell.name}</div>
        <div className="flex items-center gap-1.5">
          {scaledDamage && (
            <span className="text-[10px] font-mono text-orange-400">{scaledDamage}</span>
          )}
          {spell.concentration && (
            <Eye className="w-2.5 h-2.5 text-amber-400" />
          )}
          {isConcentrating && (
            <span className="text-[8px] text-amber-400">ACTIVE</span>
          )}
        </div>
      </div>
      
      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
    </button>
  );
}
