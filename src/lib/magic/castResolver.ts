// ============================================
// CAST RESOLVER
// ============================================
// The app is the referee. When a player casts, we resolve the mechanics HERE —
// roll the dice, scale for upcasting, work out the save DC — and hand the DM a
// factual receipt to narrate. The DM never invents the numbers.

export interface DiceFormula {
  count: number;
  die: number;
  flat: number;
}

/** Parse "3d6+2", "2d8", "1d10 - 1", "8" into a formula. Returns null if unusable. */
export function parseDiceFormula(raw: string | undefined | null): DiceFormula | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, '').toLowerCase();

  const dice = cleaned.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (dice) {
    const count = Number(dice[1]);
    const die = Number(dice[2]);
    const flat = dice[3] ? Number(dice[3]) : 0;
    if (!Number.isFinite(count) || !Number.isFinite(die) || count <= 0 || die <= 0) return null;
    return { count: Math.min(count, 50), die, flat: Number.isFinite(flat) ? flat : 0 };
  }

  const flatOnly = cleaned.match(/^([+-]?\d+)$/);
  if (flatOnly) {
    const flat = Number(flatOnly[1]);
    if (!Number.isFinite(flat)) return null;
    return { count: 0, die: 0, flat };
  }

  return null;
}

export function formatDiceFormula(f: DiceFormula): string {
  if (f.count <= 0) return `${f.flat}`;
  const base = `${f.count}d${f.die}`;
  if (f.flat === 0) return base;
  return `${base}${f.flat > 0 ? '+' : ''}${f.flat}`;
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export interface RolledDice {
  formula: string;
  rolls: number[];
  flat: number;
  total: number;
}

export function rollFormula(f: DiceFormula): RolledDice {
  const rolls: number[] = [];
  for (let i = 0; i < f.count; i++) rolls.push(rollDie(f.die));
  const total = rolls.reduce((s, r) => s + r, 0) + f.flat;
  return {
    formula: formatDiceFormula(f),
    rolls,
    flat: f.flat,
    total: Math.max(0, total),
  };
}

/**
 * Standard 5e upcasting: one extra damage/healing die per slot level above the
 * spell's base level. Cantrips never upcast this way (they scale by character
 * level elsewhere).
 */
export function scaleForUpcast(f: DiceFormula, baseLevel: number, castLevel: number, dicePerLevel = 1): DiceFormula {
  if (baseLevel <= 0) return f;
  const extraLevels = Math.max(0, castLevel - baseLevel);
  if (extraLevels === 0 || f.count <= 0) return f;
  return { ...f, count: f.count + extraLevels * dicePerLevel };
}

export interface AttackRoll {
  d20: number;
  bonus: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
}

export function rollSpellAttack(bonus: number): AttackRoll {
  const d20 = rollDie(20);
  const safeBonus = Number.isFinite(bonus) ? bonus : 0;
  return {
    d20,
    bonus: safeBonus,
    total: d20 + safeBonus,
    isCrit: d20 === 20,
    isFumble: d20 === 1,
  };
}

/** Crits double the dice, not the flat modifier. */
export function critDouble(f: DiceFormula): DiceFormula {
  if (f.count <= 0) return f;
  return { ...f, count: f.count * 2 };
}

// ============================================
// RESOLUTION
// ============================================

export interface CastSpellDefinition {
  name: string;
  level?: number;
  school?: string;
  description?: string;
  higherLevels?: string;
  attackType?: string;
  saveStat?: string;
  damageType?: string;
  damageFormula?: string;
  healingFormula?: string;
  concentration?: boolean;
  duration?: string;
  range?: string;
  isHomebrew?: boolean;
}

export interface ResolvedCast {
  spellName: string;
  baseLevel: number;
  castLevel: number;
  upcast: boolean;
  /** 'attack' | 'save' | 'auto' — how the effect lands. */
  resolution: 'attack' | 'save' | 'auto';
  attack?: AttackRoll;
  saveStat?: string;
  saveDC?: number;
  damage?: RolledDice;
  damageType?: string;
  healing?: RolledDice;
  concentration: boolean;
  /** Slot spend description, filled in by the caller. */
  slotNote?: string;
}

export interface ResolveOptions {
  spellAttackBonus: number;
  spellSaveDC: number;
  castLevel: number;
}

export function resolveCast(spell: CastSpellDefinition, opts: ResolveOptions): ResolvedCast {
  const baseLevel = Number.isFinite(spell.level) ? Number(spell.level) : 0;
  const castLevel = Number.isFinite(opts.castLevel) ? Number(opts.castLevel) : baseLevel;

  const rawAttackType = (spell.attackType || '').toLowerCase();
  const hasSave = !!spell.saveStat;
  const resolution: ResolvedCast['resolution'] =
    rawAttackType === 'melee' || rawAttackType === 'ranged'
      ? 'attack'
      : hasSave || rawAttackType === 'save'
        ? 'save'
        : 'auto';

  const result: ResolvedCast = {
    spellName: spell.name,
    baseLevel,
    castLevel,
    upcast: baseLevel > 0 && castLevel > baseLevel,
    resolution,
    concentration: !!spell.concentration,
  };

  if (resolution === 'attack') {
    result.attack = rollSpellAttack(opts.spellAttackBonus);
  } else if (resolution === 'save') {
    result.saveStat = spell.saveStat ? String(spell.saveStat).toUpperCase() : undefined;
    result.saveDC = Number.isFinite(opts.spellSaveDC) ? opts.spellSaveDC : undefined;
  }

  const dmg = parseDiceFormula(spell.damageFormula);
  if (dmg) {
    let scaled = scaleForUpcast(dmg, baseLevel, castLevel);
    if (result.attack?.isCrit) scaled = critDouble(scaled);
    // A fumbled attack deals nothing.
    if (!(result.attack && result.attack.isFumble)) {
      result.damage = rollFormula(scaled);
      result.damageType = spell.damageType;
    }
  }

  const heal = parseDiceFormula(spell.healingFormula);
  if (heal) {
    result.healing = rollFormula(scaleForUpcast(heal, baseLevel, castLevel));
  }

  return result;
}

// ============================================
// RECEIPT — what the DM is told
// ============================================

/**
 * A short factual receipt of a cast that ALREADY happened. The DM's job is to
 * narrate these facts, not to re-decide them.
 */
export function buildCastReceipt(r: ResolvedCast, spell: CastSpellDefinition): string {
  const parts: string[] = [];

  const levelLabel = r.baseLevel === 0
    ? 'a cantrip'
    : `a level ${r.baseLevel} spell${r.upcast ? `, cast at level ${r.castLevel}` : ''}`;

  parts.push(`I cast ${r.spellName} (${levelLabel}${spell.school ? `, ${spell.school} school` : ''}).`);

  if (spell.isHomebrew) {
    parts.push('This is a custom spell — follow its rules text exactly.');
  }
  if (spell.description) {
    parts.push(`Rules text: ${spell.description}`);
  }

  if (r.attack) {
    const outcome = r.attack.isCrit
      ? 'CRITICAL HIT'
      : r.attack.isFumble ? 'a natural 1 — the attack misses' : `total ${r.attack.total}`;
    parts.push(`Spell attack roll: d20 ${r.attack.d20} ${r.attack.bonus >= 0 ? '+' : ''}${r.attack.bonus} = ${outcome}.`);
  }

  if (r.saveStat && typeof r.saveDC === 'number') {
    parts.push(`The target must make a ${r.saveStat} saving throw against DC ${r.saveDC}.`);
  }

  if (r.damage) {
    parts.push(`Damage rolled: ${r.damage.total}${r.damageType ? ` ${r.damageType}` : ''} (${r.damage.formula}${r.damage.rolls.length ? ` → [${r.damage.rolls.join(', ')}]` : ''}).`);
  }

  if (r.healing) {
    parts.push(`Healing rolled: ${r.healing.total} (${r.healing.formula}${r.healing.rolls.length ? ` → [${r.healing.rolls.join(', ')}]` : ''}).`);
  }

  if (r.concentration) {
    parts.push('I am now concentrating on this spell.');
  }

  if (r.slotNote) parts.push(r.slotNote);

  parts.push('These numbers are already resolved by my character sheet — narrate the outcome using them exactly. Do not re-roll, change, or invent different values.');

  return parts.join(' ');
}

/** One-line summary for toasts and the cast log. */
export function summariseCast(r: ResolvedCast): string {
  const bits: string[] = [];
  if (r.attack) bits.push(r.attack.isCrit ? 'CRIT!' : `attack ${r.attack.total}`);
  if (r.saveDC && r.saveStat) bits.push(`${r.saveStat} save DC ${r.saveDC}`);
  if (r.damage) bits.push(`${r.damage.total}${r.damageType ? ` ${r.damageType}` : ''} damage`);
  if (r.healing) bits.push(`${r.healing.total} healing`);
  if (!bits.length) bits.push('no roll needed');
  return bits.join(' · ');
}
