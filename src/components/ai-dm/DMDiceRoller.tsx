import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ABILITY_ART, DIE_ART, SKILL_ART } from '@/lib/diceRollerArt';
import heroBannerArt from '@/assets/dice/hero-banner.webp.asset.json';
import oddsBannerArt from '@/assets/odds-banner.webp.asset.json';
import oddsFairArt from '@/assets/odds-fair.webp.asset.json';
import oddsHeroicArt from '@/assets/odds-heroic.webp.asset.json';
import oddsDramaticArt from '@/assets/odds-dramatic.webp.asset.json';
import oddsChaoticArt from '@/assets/odds-chaotic.webp.asset.json';
  import oddsCursedArt from '@/assets/odds-cursed.webp.asset.json';
  import modeNormalArt from '@/assets/dice-modes/mode-normal.webp.asset.json';
  import modeAdvantageArt from '@/assets/dice-modes/mode-advantage.webp.asset.json';
  import modeDisadvantageArt from '@/assets/dice-modes/mode-disadvantage.webp.asset.json';
  import rollInitiativeArt from '@/assets/dice-modes/roll-initiative.webp.asset.json';
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

const ABILITY_CHROME: Record<AbilityScore, { text: string; border: string; active: string }> = {
  str: { text: 'text-red-400', border: 'border-red-400/25', active: 'active:ring-red-400/30' },
  dex: { text: 'text-green-400', border: 'border-green-400/25', active: 'active:ring-green-400/30' },
  con: { text: 'text-amber-400', border: 'border-amber-400/25', active: 'active:ring-amber-400/30' },
  int: { text: 'text-blue-400', border: 'border-blue-400/25', active: 'active:ring-blue-400/30' },
  wis: { text: 'text-purple-400', border: 'border-purple-400/25', active: 'active:ring-purple-400/30' },
  cha: { text: 'text-pink-400', border: 'border-pink-400/25', active: 'active:ring-pink-400/30' },
};

// Medallion artwork per odds mode (dark iron discs — no scrim behind them)
const ODDS_ART: Record<DiceOddsMode, string> = {
  fair: oddsFairArt.url,
  heroic: oddsHeroicArt.url,
  dramatic: oddsDramaticArt.url,
  chaotic: oddsChaoticArt.url,
  cursed: oddsCursedArt.url,
};

const ODDS_CHROME: Record<DiceOddsMode, { ring: string; glow: string; text: string }> = {
  fair: { ring: 'ring-amber-400', glow: 'shadow-[0_0_16px_rgba(251,191,36,0.4)]', text: 'text-amber-400' },
  heroic: { ring: 'ring-emerald-400', glow: 'shadow-[0_0_16px_rgba(52,211,153,0.4)]', text: 'text-emerald-400' },
  dramatic: { ring: 'ring-violet-400', glow: 'shadow-[0_0_16px_rgba(167,139,250,0.4)]', text: 'text-violet-400' },
  chaotic: { ring: 'ring-fuchsia-400', glow: 'shadow-[0_0_16px_rgba(232,121,249,0.4)]', text: 'text-fuchsia-400' },
  cursed: { ring: 'ring-red-500', glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]', text: 'text-red-500' },
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

      <div className="pb-8">
        {/* Illustrated d20 header */}
        <button
          onClick={() => handleRoll('d20', 0)}
          disabled={disabled}
          aria-label="Roll the dice (d20)"
          className="group relative block w-full max-h-[140px] min-h-[128px] overflow-hidden disabled:opacity-50 active:scale-[0.99] motion-safe:transition-transform motion-safe:duration-[120ms] motion-safe:ease-out motion-reduce:transition-none"
          style={{ touchAction: 'manipulation' }}
        >
          <img
            src={heroBannerArt.url}
            alt=""
            aria-hidden="true"
            loading="lazy"
            width="946"
            height="946"
            draggable={false}
            className="h-full max-h-[140px] min-h-[128px] w-full object-cover object-center group-active:brightness-125 motion-safe:transition-[filter] motion-safe:duration-[120ms] motion-reduce:transition-none"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-[14%] text-center font-cinzel text-sm font-bold uppercase tracking-[0.2em] text-amber-100 drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]">
            Roll the Dice
          </span>
        </button>

        <div className="px-3 py-3 space-y-4">
        {/* Roll mode toggle */}
        <div className="grid grid-cols-3 overflow-hidden rounded-full border border-amber-500/20 bg-black/25 p-1">
          {(['normal', 'advantage', 'disadvantage'] as RollMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setRollMode(mode)}
              disabled={disabled}
              className={cn(
                "min-h-11 rounded-full px-1 text-[10px] font-semibold motion-safe:transition-all motion-safe:duration-[120ms] motion-reduce:transition-none",
                rollMode === mode
                  ? "bg-amber-500/20 text-amber-200 shadow-inner ring-1 ring-amber-400/35"
                  : "text-white/45 hover:text-white/70",
                "active:scale-95"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              {mode === 'normal' ? 'Normal' : mode === 'advantage' ? 'Advantage' : 'Disadvantage'}
            </button>
          ))}
        </div>

        {/* D20 & Quick Rolls */}
        <div className="space-y-1.5">
          {/* Initiative — full-width picture banner, below the dice banner */}
          <button
            onClick={() => {
              const dexMod = getModifier(characterContext, 'dex');
              handleRoll('Initiative', dexMod);
            }}
            disabled={disabled}
            aria-label={isEmpyreanMode() ? 'Combat Reflexes (initiative roll)' : 'Roll initiative (d20)'}
            className="relative block w-full aspect-[5/2] rounded-lg overflow-hidden active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-[120ms] motion-safe:ease-out motion-reduce:transition-none"
            style={{ touchAction: 'manipulation' }}
          >
            <img
              src={PREFERS_REDUCED_MOTION ? '/dice/roll-initiative-bg.jpg' : '/dice/roll-initiative.gif'}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="500"
              height="200"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: 'center bottom' }}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith('/dice/roll-initiative-bg.jpg')) img.src = '/dice/roll-initiative-bg.jpg';
              }}
            />
            {/* Dark gradient so any overlay label reads over the image */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(8,6,4,0.85) 100%)' }}
            />
            {isEmpyreanMode() && (
              <span
                className="absolute inset-x-0 bottom-2 text-center font-cinzel font-black uppercase text-[24px] leading-none text-[#FFE4AA] pointer-events-none"
                style={{
                  WebkitTextStroke: '1px #3C1900',
                  textShadow: '0 0 12px rgba(255,150,40,0.8), 0 0 24px rgba(255,150,40,0.5)',
                }}
              >
                Combat Reflexes
              </span>
            )}
          </button>

          
          <div className="grid grid-cols-6 gap-1">
            {(Object.entries(ABILITY_SCORES) as [AbilityScore, typeof ABILITY_SCORES[AbilityScore]][]).map(([key, info]) => {
              const mod = getModifier(characterContext, key);
              const display = getAbilityScoreDisplay(key);
              const chrome = ABILITY_CHROME[key];
              return (
                <button
                  key={key}
                  onClick={() => handleRoll(`${display.name} Check`, mod)}
                  disabled={disabled}
                  className={cn(
                    "group flex min-h-[94px] min-w-0 flex-col items-center justify-center rounded-xl border bg-gradient-to-b from-white/[0.06] to-transparent px-0.5 py-1 active:scale-95 active:ring-2 motion-safe:transition-all motion-safe:duration-[120ms] motion-safe:ease-out motion-reduce:transition-none",
                    chrome.border,
                    chrome.active
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <img
                    src={ABILITY_ART[key]}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width="44"
                    height="44"
                    className="h-11 w-11 shrink-0 object-contain group-active:brightness-125 motion-safe:transition-[filter] motion-safe:duration-[120ms] motion-reduce:transition-none"
                  />
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", chrome.text)}>{display.abbr}</span>
                  <span className={cn("font-mono text-sm font-bold leading-none", chrome.text)}>{mod >= 0 ? `+${mod}` : mod}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {QUICK_DICE.map(d => (
              <button
                key={d.label}
                onClick={() => handleQuickDie(d.sides, d.label)}
                disabled={disabled}
                className="group flex min-h-[66px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] py-1 text-[10px] text-white/55 active:scale-95 motion-safe:transition-all motion-safe:duration-[120ms] motion-safe:ease-out motion-reduce:transition-none"
                style={{ touchAction: 'manipulation' }}
              >
                <img
                  src={DIE_ART[d.sides]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  width="40"
                  height="40"
                  className="h-10 w-10 object-contain group-active:brightness-125 motion-safe:transition-[filter] motion-safe:duration-[120ms] motion-reduce:transition-none"
                />
                <span className="font-mono uppercase tracking-wider">{d.label}</span>
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
          <div className="grid grid-cols-2 gap-1.5">
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
                  disabled={disabled}
                  className={cn(
                    "group relative flex min-h-[64px] min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left active:scale-95 motion-safe:transition-all motion-safe:duration-[120ms] motion-safe:ease-out motion-reduce:transition-none",
                    editMode && "ring-1 ring-white/10",
                    isExpert
                      ? "border-amber-500/30 bg-amber-900/15"
                      : isProf
                        ? "border-amber-500/30 bg-white/[0.04]"
                        : "border-white/5 bg-white/[0.03]",
                    rollHint?.skillId === skill.id && "ring-2 ring-amber-400/60 bg-amber-500/15"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className={cn(
                    "relative h-10 w-10 shrink-0 rounded-full",
                    isExpert && "ring-2 ring-amber-300/70 ring-offset-1 ring-offset-amber-900/40 after:absolute after:-inset-2 after:-z-10 after:rounded-full after:bg-amber-400/15 after:blur-md",
                    isProf && !isExpert && "ring-1 ring-amber-400/50"
                  )}>
                    <img
                      src={SKILL_ART[skill.id]}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      width="40"
                      height="40"
                      className={cn(
                        "h-10 w-10 object-contain group-active:brightness-125 motion-safe:transition-[filter,opacity] motion-safe:duration-[120ms] motion-reduce:transition-none",
                        isProf || isExpert ? "opacity-100" : "opacity-80"
                      )}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("break-words text-[10px] font-medium leading-tight", isExpert ? "text-amber-200/90" : "text-white/75")}>{skill.name}</span>
                    {desc && <span className="line-clamp-2 text-[10px] leading-[1.15] text-white/40">{desc}</span>}
                  </div>
                  <span className={cn("shrink-0 font-mono text-[11px] font-bold", abilityInfo.color)}>
                    {totalMod >= 0 ? `+${totalMod}` : totalMod}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full ring-1 ring-amber-400/50" />
              <span className="text-[8px] text-white/30">Proficient</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-amber-300/70 ring-offset-1 ring-offset-amber-900/40" />
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
          {/* Engraved plate header with live text overlay */}
          <div className="relative w-full">
            <img
              src={oddsBannerArt.url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="1014"
              height="166"
              draggable={false}
              className="w-full object-contain"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-cinzel text-sm font-bold uppercase tracking-[0.25em] text-amber-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              Dice Odds
            </span>
          </div>

          {/* Mode medallions */}
          <div className="mt-2 flex items-start justify-between">
            {(Object.keys(DICE_ODDS_CONFIGS) as DiceOddsMode[]).map(mode => {
              const config = DICE_ODDS_CONFIGS[mode];
              const isSelected = currentOddsMode === mode;
              const chrome = ODDS_CHROME[mode];
              return (
                <button
                  key={mode}
                  onClick={() => handleSelectOddsMode(mode)}
                  aria-pressed={isSelected}
                  aria-label={`${config.label} dice odds`}
                  className="flex w-16 flex-col items-center gap-1 rounded-lg py-1 active:scale-95 motion-safe:transition-transform motion-safe:duration-[120ms] motion-reduce:transition-none"
                  style={{ touchAction: 'manipulation' }}
                >
                  <img
                    src={ODDS_ART[mode]}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width="64"
                    height="64"
                    draggable={false}
                    className={cn(
                      "h-16 w-16 rounded-full object-contain motion-safe:transition-all motion-safe:duration-[150ms] motion-reduce:transition-none",
                      isSelected ? cn(chrome.ring, "ring-2", chrome.glow, "opacity-100") : "opacity-60"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wider text-center leading-tight motion-safe:transition-colors motion-safe:duration-[150ms] motion-reduce:transition-none",
                      isSelected ? chrome.text : "text-white/40"
                    )}
                  >
                    {config.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected mode description + quote */}
          <p className="text-[10px] text-white/60 text-center leading-snug mt-1 px-2">
            {currentOddsConfig.description}
          </p>
          <p className="text-[9px] text-white/40 text-center italic mt-0.5">
            {currentOddsConfig.deadpoolQuote}
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
