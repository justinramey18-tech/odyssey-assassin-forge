import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, ChevronUp, ChevronDown, Equal, Swords, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rollDie } from '@/lib/diceRoller';
import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';
import { SKILLS, ABILITY_SCORES, type AbilityScore } from '@/lib/diceRollerConfig';
import type { CharacterContext } from '@/components/oracle/types';

type RollMode = 'normal' | 'advantage' | 'disadvantage';
type Tab = 'd20' | 'skills' | 'saves';

interface DMDiceRollerProps {
  characterContext: CharacterContext;
  onRollResult: (message: string) => void;
  disabled?: boolean;
}

const ABILITY_MAP: Record<string, AbilityScore> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

function getModifier(ctx: CharacterContext, ability: AbilityScore): number {
  if (!ctx.abilityScores) return 0;
  const fullName = Object.entries(ABILITY_MAP).find(([, v]) => v === ability)?.[0];
  if (!fullName) return 0;
  return (ctx.abilityScores as Record<string, { modifier: number }>)[fullName]?.modifier ?? 0;
}

function rollD20(mode: RollMode): { result: number; rolls: number[]; kept: number } {
  const oddsMode = loadDiceOddsMode();
  if (mode === 'normal') {
    const r = rollWeightedDie(20, oddsMode);
    return { result: r, rolls: [r], kept: r };
  }
  const r1 = rollWeightedDie(20, oddsMode);
  const r2 = rollWeightedDie(20, oddsMode);
  const kept = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
  return { result: kept, rolls: [r1, r2], kept };
}

function formatRollMessage(label: string, roll: ReturnType<typeof rollD20>, modifier: number, mode: RollMode): string {
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const total = roll.kept + modifier;
  const modeLabel = mode === 'advantage' ? ' (Advantage)' : mode === 'disadvantage' ? ' (Disadvantage)' : '';
  
  const isCrit = roll.kept === 20;
  const isFumble = roll.kept === 1;
  const critStr = isCrit ? ' ⭐ **Natural 20!**' : isFumble ? ' 💀 **Natural 1!**' : '';
  
  if (roll.rolls.length === 2) {
    const keptIdx = roll.rolls[0] === roll.kept ? 0 : 1;
    const droppedIdx = keptIdx === 0 ? 1 : 0;
    return `🎲 **${label}${modeLabel}**: [${roll.rolls[keptIdx]}, ~~${roll.rolls[droppedIdx]}~~] ${modStr} = **${total}**${critStr}`;
  }
  return `🎲 **${label}**: [${roll.rolls[0]}] ${modStr} = **${total}**${critStr}`;
}

// Quick d20 rolls
const QUICK_DICE = [
  { label: 'd4', sides: 4 },
  { label: 'd6', sides: 6 },
  { label: 'd8', sides: 8 },
  { label: 'd10', sides: 10 },
  { label: 'd12', sides: 12 },
];

export function DMDiceRoller({ characterContext, onRollResult, disabled = false }: DMDiceRollerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('d20');
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [lastRoll, setLastRoll] = useState<{ total: number; label: string } | null>(null);

  const handleRoll = useCallback((label: string, modifier: number) => {
    const roll = rollD20(rollMode);
    const message = formatRollMessage(label, roll, modifier, rollMode);
    setLastRoll({ total: roll.kept + modifier, label });
    onRollResult(message);
    // Brief flash then auto-close
    setTimeout(() => setLastRoll(null), 1500);
  }, [rollMode, onRollResult]);

  const handleQuickDie = useCallback((sides: number, label: string) => {
    const result = rollDie(sides);
    const message = `🎲 **${label}**: [${result}] = **${result}**`;
    onRollResult(message);
  }, [onRollResult]);

  const profBonus = useMemo(() => {
    const level = characterContext.level;
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
  }, [characterContext.level]);

  const tabs: { id: Tab; label: string; icon: typeof Dices }[] = [
    { id: 'd20', label: 'd20', icon: Dices },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'saves', label: 'Saves', icon: Shield },
  ];

  return (
    <div className="border-t border-amber-900/20 bg-black/20">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 transition-colors",
          "hover:bg-amber-900/10",
          disabled && "opacity-40 pointer-events-none"
        )}
        style={{ touchAction: 'manipulation' }}
      >
        <Dices className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] text-amber-300/70 font-semibold">Dice Roller</span>
        
        {/* Roll mode indicator */}
        <span className={cn(
          "text-[9px] px-1.5 py-0.5 rounded-full",
          rollMode === 'advantage' && "bg-emerald-900/30 text-emerald-400",
          rollMode === 'disadvantage' && "bg-red-900/30 text-red-400",
          rollMode === 'normal' && "bg-white/5 text-white/30",
        )}>
          {rollMode === 'advantage' ? 'ADV' : rollMode === 'disadvantage' ? 'DIS' : 'NRM'}
        </span>
        
        {lastRoll && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[11px] text-amber-300 font-bold ml-auto"
          >
            {lastRoll.label}: {lastRoll.total}
          </motion.span>
        )}
        
        <span className="ml-auto">
          {isOpen ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronUp className="w-3 h-3 text-white/30" />}
        </span>
      </button>

      {/* Expanded roller */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-2">
              {/* Roll mode toggle */}
              <div className="flex items-center gap-1">
                {(['normal', 'advantage', 'disadvantage'] as RollMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setRollMode(mode)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                      rollMode === mode
                        ? mode === 'advantage' ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/30"
                          : mode === 'disadvantage' ? "bg-red-900/40 text-red-300 border border-red-500/30"
                          : "bg-amber-900/30 text-amber-300 border border-amber-500/30"
                        : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {mode === 'normal' ? 'Normal' : mode === 'advantage' ? 'Advantage' : 'Disadvantage'}
                  </button>
                ))}
              </div>

              {/* Tab selector */}
              <div className="flex gap-1">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                      tab === t.id
                        ? "bg-amber-900/30 text-amber-300 border border-amber-500/20"
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <t.icon className="w-3 h-3" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {tab === 'd20' && (
                <div className="space-y-1.5">
                  {/* Main d20 button */}
                  <button
                    onClick={() => handleRoll('d20', 0)}
                    className="w-full py-2 rounded-lg bg-amber-900/20 border border-amber-500/20 hover:bg-amber-900/40 transition-colors text-sm font-cinzel text-amber-200"
                    style={{ touchAction: 'manipulation' }}
                  >
                    🎲 Roll d20
                  </button>
                  
                  {/* Ability check buttons */}
                  <div className="grid grid-cols-6 gap-1">
                    {(Object.entries(ABILITY_SCORES) as [AbilityScore, typeof ABILITY_SCORES[AbilityScore]][]).map(([key, info]) => {
                      const mod = getModifier(characterContext, key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleRoll(`${info.name} Check`, mod)}
                          className="flex flex-col items-center gap-0.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <span className={cn("text-[10px] font-bold", info.color)}>{info.abbr}</span>
                          <span className="text-[9px] text-white/40">{mod >= 0 ? `+${mod}` : mod}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick damage dice */}
                  <div className="flex gap-1">
                    {QUICK_DICE.map(d => (
                      <button
                        key={d.label}
                        onClick={() => handleQuickDie(d.sides, d.label)}
                        className="flex-1 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white/70 transition-colors border border-white/5"
                        style={{ touchAction: 'manipulation' }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'skills' && (
                <div className="grid grid-cols-2 gap-1 max-h-[180px] overflow-y-auto overscroll-contain scrollbar-none">
                  {SKILLS.map(skill => {
                    const mod = getModifier(characterContext, skill.ability);
                    const abilityInfo = ABILITY_SCORES[skill.ability];
                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleRoll(`${skill.name}`, mod)}
                        className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <span className="text-[11px] text-white/70 truncate">{skill.name}</span>
                        <span className={cn("text-[10px] font-semibold shrink-0 ml-1", abilityInfo.color)}>
                          {mod >= 0 ? `+${mod}` : mod}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {tab === 'saves' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(ABILITY_SCORES) as [AbilityScore, typeof ABILITY_SCORES[AbilityScore]][]).map(([key, info]) => {
                    const mod = getModifier(characterContext, key);
                    return (
                      <button
                        key={key}
                        onClick={() => handleRoll(`${info.name} Save`, mod)}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <span className={cn("text-xs font-semibold", info.color)}>{info.name}</span>
                        <span className="text-xs text-white/50">{mod >= 0 ? `+${mod}` : mod}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
