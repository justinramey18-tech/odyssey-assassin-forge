import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Shield, Sparkles, Scale, Flame, Shuffle, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rollDie } from '@/lib/diceRoller';
import { rollWeightedDie, loadDiceOddsMode, saveDiceOddsMode, DICE_ODDS_CONFIGS, type DiceOddsMode } from '@/lib/diceOdds';
import { SKILLS, ABILITY_SCORES, type AbilityScore, getAbilityScoreDisplay, getSkillsForDisplay } from '@/lib/diceRollerConfig';
import { isEmpyreanMode } from '@/lib/empyreanLabels';
import type { CharacterContext } from '@/components/oracle/types';
import type { RollHint } from '@/lib/whisperRollHint';
import { playDiceRattle, playDiceThud } from '@/lib/diceSounds';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { getProficiencyBonus } from '@/lib/magic/calculations';
import { toast } from 'sonner';

type RollMode = 'normal' | 'advantage' | 'disadvantage';

interface DMDiceRollerProps {
  characterContext: CharacterContext;
  onRollResult: (message: string) => void;
  disabled?: boolean;
  /** Optional pre-selection hint parsed from a whisper. When provided, the roller opens with these fields pre-selected and (if a DC is given) displays it prominently. */
  rollHint?: RollHint | null;
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
  id: number;
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

// Skill descriptions for new players
const SKILL_DESCRIPTIONS: Record<string, string> = {
  acrobatics: 'Flips, balance, tumbling',
  animal_handling: 'Calm or control a beast',
  arcana: 'Recall magical lore',
  athletics: 'Climb, jump, swim',
  deception: 'Mislead with lies',
  history: 'Recall past events',
  insight: "Read someone's motives",
  intimidation: 'Threaten or coerce',
  investigation: 'Search for clues',
  medicine: 'Stabilize or diagnose',
  nature: 'Recall nature lore',
  perception: 'Spot hidden things',
  performance: 'Entertain an audience',
  persuasion: 'Influence with charm',
  religion: 'Recall divine lore',
  sleight_of_hand: 'Pick pockets, conceal',
  stealth: 'Move unseen or unheard',
  survival: 'Track, forage, navigate',
};

// Empyrean skill descriptions
const EMPYREAN_SKILL_DESCRIPTIONS: Record<string, string> = {
  acrobatics: 'Dogfighting on dragonback and avoiding dismount during aerial combat',
  animal_handling: 'Reading dragon moods, calming aggressive dragons, strengthening your bond',
  arcana: 'Understanding signet mechanics, avoiding burnout, and rune theory',
  athletics: 'Staying mounted during extreme maneuvers and sustained physical exertion',
  deception: 'Lying convincingly and hiding rebellion ties from Basgiath leadership',
  history: 'Knowledge of past battles, tactical precedents, and military doctrine',
  insight: 'Reading people, detecting lies, and sensing hidden motives or betrayal',
  intimidation: 'Projecting dominance, threatening enemies, forcing submission',
  investigation: 'Navigating military law in the Codex and finding legal loopholes',
  medicine: 'Stabilizing wounded riders and treating battlefield injuries under fire',
  nature: 'Dragon breeds, behaviors, bonding patterns, and territorial instincts',
  perception: 'Spotting ambushes, detecting threats before they strike, situational awareness',
  performance: 'Boosting squad morale before battle, public speaking, rallying the wing',
  persuasion: 'Leading squads, inspiring troops, issuing commands under pressure',
  religion: 'Recognizing Venin corruption, understanding dark wielder weaknesses and warding',
  sleight_of_hand: 'Creating magical runes and enchanted items — highly illegal at Basgiath',
  stealth: 'Infiltration and moving silently through enemy territory — rebellion specialty',
  survival: 'Navigation, shelter-building, and tactical resource management for War Games',
};

function getSkillDescription(skillId: string): string {
  if (isEmpyreanMode()) return EMPYREAN_SKILL_DESCRIPTIONS[skillId] ?? SKILL_DESCRIPTIONS[skillId] ?? '';
  return SKILL_DESCRIPTIONS[skillId] ?? '';
}

// Save descriptions for new players
const SAVE_DESCRIPTIONS: Record<AbilityScore, string> = {
  str: 'Resist being pushed or held',
  dex: 'Dodge blasts and traps',
  con: 'Endure poison or fatigue',
  int: 'See through illusions',
  wis: 'Resist charms and fear',
  cha: 'Defy banishment effects',
};

const EMPYREAN_SAVE_DESCRIPTIONS: Record<AbilityScore, string> = {
  str: 'Resist being thrown from your dragon or pinned by force',
  dex: 'Dodge dragon fire, crossbow bolts, and aerial hazards',
  con: 'Endure Venin corruption, poison, exhaustion, and signet burnout',
  int: 'Maintain focus through mental assault and signet interference',
  wis: 'Trust your instincts when illusions or fear try to deceive you',
  cha: 'Assert your will against telepathic intrusion and mental domination',
};

function getSaveDescription(key: AbilityScore): string {
  if (isEmpyreanMode()) return EMPYREAN_SAVE_DESCRIPTIONS[key] ?? SAVE_DESCRIPTIONS[key];
  return SAVE_DESCRIPTIONS[key];
}

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

// Reduced-motion users get the still JPG instead of the animated GIF
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const QUICK_DICE = [
  { label: 'd4', sides: 4 },
  { label: 'd6', sides: 6 },
  { label: 'd8', sides: 8 },
  { label: 'd10', sides: 10 },
  { label: 'd12', sides: 12 },
];

// Animated rolling number component
function RollingNumber({ target, sides, duration = 600, onLand }: { target: number; sides: number; duration?: number; onLand?: () => void }) {
  const [display, setDisplay] = useState(target);
  const [isRolling, setIsRolling] = useState(true);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    setIsRolling(true);
    playDiceRattle(duration);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        const progress = elapsed / duration;
        const interval = 40 + progress * 120;
        setDisplay(Math.floor(Math.random() * sides) + 1);
        frameRef.current = window.setTimeout(tick, interval);
      } else {
        setDisplay(target);
        setIsRolling(false);
        onLand?.();
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

// Long-press hook for toggling proficiency
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<number>(0);
  const onStart = useCallback(() => {
    timerRef.current = window.setTimeout(callback, ms);
  }, [callback, ms]);
  const onEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return { onTouchStart: onStart, onMouseDown: onStart, onTouchEnd: onEnd, onMouseUp: onEnd, onMouseLeave: onEnd };
}

export function DMDiceRoller({ characterContext, onRollResult, disabled = false, rollHint }: DMDiceRollerProps) {
  const [rollMode, setRollMode] = useState<RollMode>('normal');

  // Apply roll hint: pre-set the roll mode when a hint arrives.
  useEffect(() => {
    if (rollHint) {
      if (rollHint.rollMode === 'advantage' || rollHint.rollMode === 'disadvantage' || rollHint.rollMode === 'normal') {
        setRollMode(rollHint.rollMode);
      }
    }
  }, [rollHint]);

  const [currentOddsMode, setCurrentOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [lastRoll, setLastRoll] = useState<RollDisplay | null>(null);
  const [editMode, setEditMode] = useState(false);
  const rollIdRef = useRef(0);
  const dismissTimerRef = useRef<number>(0);

  // Load proficiency data from storage as state (so we can toggle)
  const [proficientSkills, setProficientSkills] = useState<Set<string>>(() => {
    try {
      const raw = getScopedItem('odyssey-proficient-skills');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const [proficientSaves, setProficientSaves] = useState<Set<string>>(() => {
    try {
      const raw = getScopedItem('odyssey-proficient-saves');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const [expertiseSkills, setExpertiseSkills] = useState<Set<string>>(() => {
    try {
      const raw = getScopedItem('odyssey-expertise-skills');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const profBonus = useMemo(() => getProficiencyBonus(characterContext.level || 1), [characterContext.level]);

  // Persist helpers
  const persistSkillProf = useCallback((next: Set<string>) => {
    setProficientSkills(next);
    setScopedItem('odyssey-proficient-skills', JSON.stringify([...next]));
  }, []);
  const persistExpertise = useCallback((next: Set<string>) => {
    setExpertiseSkills(next);
    setScopedItem('odyssey-expertise-skills', JSON.stringify([...next]));
  }, []);
  const persistSaveProf = useCallback((next: Set<string>) => {
    setProficientSaves(next);
    setScopedItem('odyssey-proficient-saves', JSON.stringify([...next]));
  }, []);

  // Cycle skill: none → proficient → expertise → none
  const cycleSkillProficiency = useCallback((skillId: string) => {
    const isProf = proficientSkills.has(skillId);
    const isExpert = expertiseSkills.has(skillId);

    if (!isProf && !isExpert) {
      // → proficient
      const next = new Set(proficientSkills); next.add(skillId);
      persistSkillProf(next);
      toast.success(`${skillId.replace('_', ' ')}: Proficient`, { duration: 1500 });
    } else if (isProf && !isExpert) {
      // → expertise
      const next = new Set(expertiseSkills); next.add(skillId);
      persistExpertise(next);
      toast.success(`${skillId.replace('_', ' ')}: Expertise`, { duration: 1500 });
    } else {
      // → none
      const nextProf = new Set(proficientSkills); nextProf.delete(skillId);
      const nextExp = new Set(expertiseSkills); nextExp.delete(skillId);
      persistSkillProf(nextProf);
      persistExpertise(nextExp);
      toast(`${skillId.replace('_', ' ')}: Removed`, { duration: 1500 });
    }
  }, [proficientSkills, expertiseSkills, persistSkillProf, persistExpertise]);

  // Toggle save proficiency
  const toggleSaveProficiency = useCallback((saveKey: string) => {
    const next = new Set(proficientSaves);
    if (next.has(saveKey)) {
      next.delete(saveKey);
      toast(`${saveKey.toUpperCase()} Save: Removed`, { duration: 1500 });
    } else {
      next.add(saveKey);
      toast.success(`${saveKey.toUpperCase()} Save: Proficient`, { duration: 1500 });
    }
    persistSaveProf(next);
  }, [proficientSaves, persistSaveProf]);

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
  }, []);

  // profBonus already defined above via getProficiencyBonus

  const currentOddsConfig = DICE_ODDS_CONFIGS[currentOddsMode];

  return (
    <div className="bg-black/20 relative">
      {/* DC banner (whisper-driven hint) */}
      {rollHint && rollHint.dc != null && (
        <div className="mx-3 mt-3 mb-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200 flex items-center justify-between">
          <span className="font-mono tracking-wide">
            DC {rollHint.dc}
            {rollHint.isSave ? ' · save' : ' · check'}
            {rollHint.skillId ? ` · ${rollHint.skillId.replace(/_/g, ' ')}` : (rollHint.ability ? ` · ${rollHint.ability.toUpperCase()}` : '')}
          </span>
          <span className="text-[9px] text-amber-300/60 uppercase tracking-wider">DM asked for this</span>
        </div>
      )}

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
                          onLand={!isDropped ? () => playDiceThud(lastRoll.isCrit, lastRoll.isFumble) : undefined}
                        />
                      </span>
                    );
                  })}
                </div>

                {lastRoll.modifier !== 0 && (
                  <span className="text-xs text-white/40 font-mono">
                    {lastRoll.modifier >= 0 ? `+${lastRoll.modifier}` : lastRoll.modifier}
                  </span>
                )}

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

              <div className="text-[8px] text-white/20 mt-1">tap to dismiss</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 py-2 space-y-3">
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

        {/* D20 & Quick Rolls */}
        <div className="space-y-1.5">
          {/* Roll the Dice banner */}
          <button
            onClick={() => handleRoll('d20', 0)}
            aria-label="Roll the dice (d20)"
            className="relative block w-full aspect-[5/2] rounded-lg overflow-hidden transition-transform duration-150 active:scale-[0.98]"
            style={{ touchAction: 'manipulation' }}
          >
            <img
              src={PREFERS_REDUCED_MOTION ? '/dice/roll-d20-bg.jpg' : '/dice/roll-d20.gif'}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: 'center 30%' }}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith('/dice/roll-d20-bg.jpg')) img.src = '/dice/roll-d20-bg.jpg';
              }}
            />
            {/* Dark gradient so the label reads over the image */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(8,6,4,0.9) 100%)' }}
            />
            <span
              className="absolute inset-x-0 bottom-2 text-center font-cinzel font-black uppercase text-[26px] leading-none text-[#FFE4AA] pointer-events-none"
              style={{
                WebkitTextStroke: '1px #3C1900',
                textShadow: '0 0 12px rgba(255,150,40,0.8), 0 0 24px rgba(255,150,40,0.5)',
              }}
            >
              Roll the Dice
            </span>
          </button>

          {/* Initiative — full width, below the banner */}
          <button
            onClick={() => {
              const dexMod = getModifier(characterContext, 'dex');
              handleRoll('Initiative', dexMod);
            }}
            className="w-full py-2 rounded-lg bg-purple-900/20 border border-purple-500/20 hover:bg-purple-900/40 transition-colors text-sm font-cinzel text-purple-200"
            style={{ touchAction: 'manipulation' }}
          >
            ⚡ {isEmpyreanMode() ? 'Combat Reflexes' : 'Initiative'}
          </button>

          
          <div className="grid grid-cols-6 gap-1">
            {(Object.entries(ABILITY_SCORES) as [AbilityScore, typeof ABILITY_SCORES[AbilityScore]][]).map(([key, info]) => {
              const mod = getModifier(characterContext, key);
              const display = getAbilityScoreDisplay(key);
              return (
                <button
                  key={key}
                  onClick={() => handleRoll(`${display.name} Check`, mod)}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <span className={cn("text-[10px] font-bold", info.color)}>{display.abbr}</span>
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

        {/* Section: Skill Checks */}
        <div>
          <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
              {isEmpyreanMode() ? '⚔ Rider Checks' : '⚔ Skill Checks'}
            </span>
            <button
              onClick={() => setEditMode(prev => !prev)}
              className={cn(
                "text-[9px] px-2 py-0.5 rounded-full border transition-colors",
                editMode
                  ? "bg-amber-900/40 border-amber-500/30 text-amber-300"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              {editMode ? '✓ Done' : '✏ Edit'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {getSkillsForDisplay().map(skill => {
              const baseMod = getModifier(characterContext, skill.ability);
              const isProf = proficientSkills.has(skill.id);
              const isExpert = expertiseSkills.has(skill.id);
              const totalMod = baseMod + (isExpert ? profBonus * 2 : isProf ? profBonus : 0);
              const abilityInfo = getAbilityScoreDisplay(skill.ability);
              const desc = getSkillDescription(skill.id);
              return (
                <button
                  key={skill.id}
                  onClick={() => editMode ? cycleSkillProficiency(skill.id) : handleRoll(`${skill.name}`, totalMod)}
                  className={cn(
                    "flex items-center justify-between px-2 py-2 rounded-md border transition-colors text-left",
                    editMode && "ring-1 ring-white/10",
                    isExpert
                      ? "bg-amber-900/15 border-amber-500/20 hover:bg-amber-900/25"
                      : isProf
                        ? "bg-emerald-900/15 border-emerald-500/20 hover:bg-emerald-900/25"
                        : "bg-white/5 hover:bg-white/10 border-white/5",
                    rollHint?.skillId === skill.id && "ring-2 ring-amber-400/60 bg-amber-500/15"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {editMode ? (
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0 border-2 transition-colors",
                        isExpert ? "bg-amber-400 border-amber-400" : isProf ? "bg-emerald-400 border-emerald-400" : "border-white/30 bg-transparent"
                      )} />
                    ) : (isProf || isExpert) ? (
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isExpert ? "bg-amber-400" : "bg-emerald-400"
                      )} />
                    ) : null}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={cn(
                        "text-[11px] truncate",
                        isExpert ? "text-amber-200/80" : isProf ? "text-emerald-200/80" : "text-white/70"
                      )}>{skill.name}</span>
{desc && <span className="text-[9px] text-white/35 line-clamp-2 leading-tight">{desc}</span>}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold shrink-0 ml-1", abilityInfo.color)}>
                    {totalMod >= 0 ? `+${totalMod}` : totalMod}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[8px] text-white/30">Proficient</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[8px] text-white/30">Expertise</span>
            </div>
            {editMode && (
              <span className="text-[8px] text-amber-300/50 ml-auto">Tap to cycle</span>
            )}
          </div>
        </div>

        {/* Section: Saving Throws */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 border-b border-white/5 pb-1 mb-2">
            {isEmpyreanMode() ? '🛡 Resistance Saves' : '🛡 Saving Throws'}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(ABILITY_SCORES) as [AbilityScore, typeof ABILITY_SCORES[AbilityScore]][]).map(([key, info]) => {
               const baseMod = getModifier(characterContext, key);
               const isProf = proficientSaves.has(key);
               const totalMod = baseMod + (isProf ? profBonus : 0);
               const desc = getSaveDescription(key);
               const display = getAbilityScoreDisplay(key);
               return (
                 <button
                   key={key}
                   onClick={() => editMode ? toggleSaveProficiency(key) : handleRoll(`${display.name} Save`, totalMod)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border transition-colors",
                    editMode && "ring-1 ring-white/10",
                    isProf
                      ? "bg-emerald-900/15 border-emerald-500/20 hover:bg-emerald-900/25"
                      : "bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10",
                    rollHint?.isSave && rollHint?.ability === key && !rollHint?.skillId && "ring-2 ring-amber-400/60 bg-amber-500/15"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {editMode ? (
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0 border-2 transition-colors",
                        isProf ? "bg-emerald-400 border-emerald-400" : "border-white/30 bg-transparent"
                      )} />
                    ) : isProf ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    ) : null}
                    <div className="flex flex-col min-w-0">
                      <span className={cn("text-xs font-semibold", info.color)}>{display.name}</span>
                      {desc && <span className="text-[9px] text-white/35 line-clamp-2 leading-tight">{desc}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-white/50 shrink-0 ml-1">{totalMod >= 0 ? `+${totalMod}` : totalMod}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section: Dice Odds */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 border-b border-white/5 pb-1 mb-2">
            🎰 Dice Odds
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
          <p className="text-[9px] text-white/40 text-center italic mt-1.5">
            {currentOddsConfig.deadpoolQuote}
          </p>
        </div>
      </div>
    </div>
  );
}
