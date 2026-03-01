import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Shield, Sparkles, Scale, Flame, Shuffle, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rollDie } from '@/lib/diceRoller';
import { rollWeightedDie, loadDiceOddsMode, saveDiceOddsMode, DICE_ODDS_CONFIGS, type DiceOddsMode } from '@/lib/diceOdds';
import { SKILLS, ABILITY_SCORES, type AbilityScore } from '@/lib/diceRollerConfig';
import type { CharacterContext } from '@/components/oracle/types';

type RollMode = 'normal' | 'advantage' | 'disadvantage';
type Tab = 'd20' | 'skills' | 'saves';

interface DMDiceRollerProps {
  characterContext: CharacterContext;
  onRollResult: (message: string) => void;
  disabled?: boolean;
}

interface RollDisplay {
  label: string;
  rolls: number[];
  kept: number;
  modifier: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  mode: RollMode;
  isQuickDie?: boolean;
  dieSides?: number;
  id: number; // for animation key
}

const ABILITY_MAP: Record<string, AbilityScore> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const MODE_ICONS: Record<DiceOddsMode, React.ReactNode> = {
  fair: <Scale className="w-3.5 h-3.5" />,
  heroic: <Sparkles className="w-3.5 h-3.5" />,
  dramatic: <Flame className="w-3.5 h-3.5" />,
  chaotic: <Shuffle className="w-3.5 h-3.5" />,
  cursed: <Skull className="w-3.5 h-3.5" />,
};

const MODE_COLORS: Record<DiceOddsMode, string> = {
  fair: 'text-white/60 border-white/10 hover:bg-white/10',
  heroic: 'text-amber-300 border-amber-500/30 hover:bg-amber-900/30',
  dramatic: 'text-purple-300 border-purple-500/30 hover:bg-purple-900/30',
  chaotic: 'text-cyan-300 border-cyan-500/30 hover:bg-cyan-900/30',
  cursed: 'text-red-300 border-red-500/30 hover:bg-red-900/30',
};

const MODE_COLORS_SELECTED: Record<DiceOddsMode, string> = {
  fair: 'text-white/80 bg-white/10 border-white/20',
  heroic: 'text-amber-300 bg-amber-900/40 border-amber-500/40',
  dramatic: 'text-purple-300 bg-purple-900/40 border-purple-500/40',
  chaotic: 'text-cyan-300 bg-cyan-900/40 border-cyan-500/40',
  cursed: 'text-red-300 bg-red-900/40 border-red-500/40',
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

const QUICK_DICE = [
  { label: 'd4', sides: 4 },
  { label: 'd6', sides: 6 },
  { label: 'd8', sides: 8 },
  { label: 'd10', sides: 10 },
  { label: 'd12', sides: 12 },
];

// Animated rolling number component
function RollingNumber({ target, sides, duration = 600 }: { target: number; sides: number; duration?: number }) {
  const [display, setDisplay] = useState(target);
  const [isRolling, setIsRolling] = useState(true);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    setIsRolling(true);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        // Show random numbers, slowing down toward the end
        const progress = elapsed / duration;
        const interval = 40 + progress * 120; // starts fast, slows down
        setDisplay(Math.floor(Math.random() * sides) + 1);
        frameRef.current = window.setTimeout(tick, interval);
      } else {
        setDisplay(target);
        setIsRolling(false);
      }
    };
    tick();
    return () => { if (frameRef.current) clearTimeout(frameRef.current); };
  }, [target, sides, duration]);

  return (
    <span className={cn(
      "tabular-nums transition-transform",
      isRolling && "animate-pulse"
    )}>
      {display}
    </span>
  );
}

export function DMDiceRoller({ characterContext, onRollResult, disabled = false }: DMDiceRollerProps) {
  const [tab, setTab] = useState<Tab>('d20');
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [showOddsPanel, setShowOddsPanel] = useState(false);
  const [currentOddsMode, setCurrentOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [lastRoll, setLastRoll] = useState<RollDisplay | null>(null);
  const rollIdRef = useRef(0);
  const dismissTimerRef = useRef<number>(0);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (lastRoll) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = window.setTimeout(() => setLastRoll(null), 5000);
    }
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, [lastRoll]);

  const handleRoll = useCallback((label: string, modifier: number) => {
    const roll = rollD20(rollMode);
    const message = formatRollMessage(label, roll, modifier, rollMode);
    rollIdRef.current += 1;
    setLastRoll({
      label,
      rolls: roll.rolls,
      kept: roll.kept,
      modifier,
      total: roll.kept + modifier,
      isCrit: roll.kept === 20,
      isFumble: roll.kept === 1,
      mode: rollMode,
      id: rollIdRef.current,
    });
    onRollResult(message);
  }, [rollMode, onRollResult]);

  const handleQuickDie = useCallback((sides: number, label: string) => {
    const result = rollDie(sides);
    const message = `🎲 **${label}**: [${result}] = **${result}**`;
    rollIdRef.current += 1;
    setLastRoll({
      label,
      rolls: [result],
      kept: result,
      modifier: 0,
      total: result,
      isCrit: false,
      isFumble: false,
      mode: 'normal',
      isQuickDie: true,
      dieSides: sides,
      id: rollIdRef.current,
    });
    onRollResult(message);
  }, [onRollResult]);

  const handleSelectOddsMode = useCallback((mode: DiceOddsMode) => {
    setCurrentOddsMode(mode);
    saveDiceOddsMode(mode);
    setShowOddsPanel(false);
  }, []);

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

  const currentOddsConfig = DICE_ODDS_CONFIGS[currentOddsMode];

  return (
    <div className="bg-black/20 relative">
      {/* Roll Result Display */}
      <AnimatePresence mode="wait">
        {lastRoll && (
          <motion.div
            key={lastRoll.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mx-3 mt-2 mb-1 px-3 py-2.5 rounded-lg border text-center relative",
                lastRoll.isCrit
                  ? "bg-amber-900/40 border-amber-400/50"
                  : lastRoll.isFumble
                  ? "bg-red-900/40 border-red-400/50"
                  : "bg-white/5 border-white/10"
              )}
              onClick={() => setLastRoll(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Label */}
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-1">
                {lastRoll.label}
                {lastRoll.mode !== 'normal' && (
                  <span className={cn(
                    "ml-1",
                    lastRoll.mode === 'advantage' ? 'text-emerald-400/60' : 'text-red-400/60'
                  )}>
                    ({lastRoll.mode})
                  </span>
                )}
              </div>

              {/* Dice values */}
              <div className="flex items-center justify-center gap-2">
                {/* Individual dice */}
                <div className="flex items-center gap-1">
                  {lastRoll.rolls.map((r, i) => {
                    const isDropped = lastRoll.rolls.length > 1 && r !== lastRoll.kept;
                    return (
                      <span
                        key={i}
                        className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold font-mono border",
                          isDropped
                            ? "bg-white/5 border-white/10 text-white/25 line-through"
                            : lastRoll.isCrit
                            ? "bg-amber-500/20 border-amber-400/40 text-amber-200"
                            : lastRoll.isFumble
                            ? "bg-red-500/20 border-red-400/40 text-red-200"
                            : "bg-white/10 border-white/15 text-white/80"
                        )}
                      >
                        <RollingNumber
                          target={r}
                          sides={lastRoll.isQuickDie ? (lastRoll.dieSides ?? 20) : 20}
                          duration={isDropped ? 400 : 600}
                        />
                      </span>
                    );
                  })}
                </div>

                {/* Modifier */}
                {lastRoll.modifier !== 0 && (
                  <span className="text-xs text-white/40 font-mono">
                    {lastRoll.modifier >= 0 ? `+${lastRoll.modifier}` : lastRoll.modifier}
                  </span>
                )}

                {/* Equals + Total */}
                <span className="text-white/30 text-xs">=</span>
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.65, type: 'spring', stiffness: 400, damping: 15 }}
                  className={cn(
                    "text-xl font-bold font-cinzel tabular-nums",
                    lastRoll.isCrit
                      ? "text-amber-300"
                      : lastRoll.isFumble
                      ? "text-red-300"
                      : "text-white"
                  )}
                >
                  {lastRoll.total}
                </motion.span>
              </div>

              {/* Crit / Fumble banner */}
              {(lastRoll.isCrit || lastRoll.isFumble) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mt-1",
                    lastRoll.isCrit ? "text-amber-400" : "text-red-400"
                  )}
                >
                  {lastRoll.isCrit ? '⭐ Natural 20!' : '💀 Natural 1!'}
                </motion.div>
              )}

              {/* Tap to dismiss hint */}
              <div className="text-[8px] text-white/20 mt-1">tap to dismiss</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 py-2 space-y-2">
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
            <div className="flex gap-1.5">
              <button
                onClick={() => handleRoll('d20', 0)}
                className="flex-1 py-2 rounded-lg bg-amber-900/20 border border-amber-500/20 hover:bg-amber-900/40 transition-colors text-sm font-cinzel text-amber-200"
                style={{ touchAction: 'manipulation' }}
              >
                🎲 Roll d20
              </button>
              <button
                onClick={() => {
                  const dexMod = getModifier(characterContext, 'dex');
                  handleRoll('Initiative', dexMod);
                }}
                className="px-3 py-2 rounded-lg bg-purple-900/20 border border-purple-500/20 hover:bg-purple-900/40 transition-colors text-sm font-cinzel text-purple-200"
                style={{ touchAction: 'manipulation' }}
              >
                ⚡ Initiative
              </button>
            </div>
            
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

        {/* Dice Odds Button */}
        <button
          onClick={() => setShowOddsPanel(prev => !prev)}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border text-[10px] font-semibold transition-all",
            MODE_COLORS_SELECTED[currentOddsMode]
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {MODE_ICONS[currentOddsMode]}
          <span>Dice Odds: {currentOddsConfig.label}</span>
        </button>
      </div>

      {/* Odds Panel (inline) */}
      <AnimatePresence>
      {showOddsPanel && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
        <div className="bg-black/95 border-t border-white/10 rounded-lg p-3 space-y-2 mt-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono text-center">
            Select Dice Odds
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(DICE_ODDS_CONFIGS) as DiceOddsMode[]).map(mode => {
              const config = DICE_ODDS_CONFIGS[mode];
              const isSelected = currentOddsMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleSelectOddsMode(mode)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border transition-all",
                    isSelected ? MODE_COLORS_SELECTED[mode] : MODE_COLORS[mode]
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  {MODE_ICONS[mode]}
                  <span className="text-[8px] font-mono uppercase leading-tight text-center">
                    {config.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-white/40 text-center italic">
            {currentOddsConfig.deadpoolQuote}
          </p>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
