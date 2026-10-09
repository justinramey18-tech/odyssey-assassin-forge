// Real dice for the Human DM Assistant. AI models can't roll fairly (they pick
// convenient numbers), so every DM or NPC roll is made here, by the app, with
// the browser's cryptographic random numbers.

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
  /** Advantage / disadvantage: roll two d20s, keep the higher / lower. */
  mode: 'normal' | 'advantage' | 'disadvantage';
}

export interface DiceRoll {
  label: string;
  /** The expression as written, e.g. "1d20+5 adv". */
  expr: string;
  spec: DiceSpec;
  /** Every die rolled. */
  rolls: number[];
  /** The dice that count (differs from rolls only with advantage/disadvantage). */
  kept: number[];
  total: number;
  /** Natural 20 / natural 1 on a single d20. */
  crit: 'nat20' | 'nat1' | null;
}

const DICE_RE = /(\d{0,3})\s*d\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?/i;
const ADV_RE = /\b(adv|advantage)\b/i;
const DIS_RE = /\b(dis|disadv|disadvantage)\b/i;

/** Read the first dice expression in a text, e.g. "2d6+3" or "d20 adv". Null if there is none. */
export function parseDiceSpec(text: string): DiceSpec | null {
  const m = DICE_RE.exec(text || '');
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0;
  if (count < 1 || count > 50 || sides < 2 || sides > 1000) return null;
  let mode: DiceSpec['mode'] = 'normal';
  if (count === 1 && sides === 20) {
    if (DIS_RE.test(text)) mode = 'disadvantage';
    else if (ADV_RE.test(text)) mode = 'advantage';
  }
  return { count, sides, modifier, mode };
}

/** A fair whole number from 1 to sides, using crypto random numbers when available. */
export function randomDie(sides: number): number {
  const c = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c?.getRandomValues) {
    const limit = Math.floor(0x100000000 / sides) * sides; // reject the uneven tail
    const buf = new Uint32Array(1);
    for (;;) {
      c.getRandomValues(buf);
      if (buf[0] < limit) return (buf[0] % sides) + 1;
    }
  }
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(label: string, expr: string, spec: DiceSpec, die: (sides: number) => number = randomDie): DiceRoll {
  const n = spec.mode === 'normal' ? spec.count : 2;
  const rolls = Array.from({ length: n }, () => die(spec.sides));
  let kept = rolls;
  if (spec.mode === 'advantage') kept = [Math.max(...rolls)];
  if (spec.mode === 'disadvantage') kept = [Math.min(...rolls)];
  const total = kept.reduce((a, b) => a + b, 0) + spec.modifier;
  const single20 = spec.sides === 20 && kept.length === 1;
  const crit = single20 && kept[0] === 20 ? 'nat20' : single20 && kept[0] === 1 ? 'nat1' : null;
  return { label: label.trim() || 'Roll', expr: expr.trim(), spec, rolls, kept, total, crit };
}

/** "12 + 5 = 17", "[8, 15] keep 15 + 2 = 17". */
export function describeRoll(r: DiceRoll): string {
  const mod = r.spec.modifier ? ` ${r.spec.modifier > 0 ? '+' : '-'} ${Math.abs(r.spec.modifier)}` : '';
  const dice = r.spec.mode === 'normal'
    ? (r.rolls.length > 1 ? `[${r.rolls.join(', ')}]` : `${r.rolls[0]}`)
    : `[${r.rolls.join(', ')}] keep ${r.kept[0]}`;
  return `${dice}${mod} = ${r.total}`;
}

/** How a roll is told to the assistant. */
export function rollForAssistant(r: DiceRoll): string {
  const crit = r.crit === 'nat20' ? ' (natural 20)' : r.crit === 'nat1' ? ' (natural 1)' : '';
  return `${r.label}: ${r.expr} → ${describeRoll(r)}${crit}`;
}

/**
 * A host message like "roll 1d20+5 Grukk attack" or "/roll 2d6 fire damage" is
 * rolled by the app with no AI call. Returns null for anything else.
 */
export function parseHostRoll(text: string): { label: string; expr: string; spec: DiceSpec } | null {
  const m = /^\s*\/?roll\s+(.+)$/i.exec(text || '');
  if (!m) return null;
  const rest = m[1].trim();
  const dice = DICE_RE.exec(rest);
  if (!dice) return null;
  const spec = parseDiceSpec(rest);
  if (!spec) return null;
  const label = rest
    .replace(dice[0], ' ')
    .replace(ADV_RE, ' ')
    .replace(DIS_RE, ' ')
    .replace(/^\s*(for|:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const exprBits = [dice[0].replace(/\s+/g, '')];
  if (spec.mode === 'advantage') exprBits.push('adv');
  if (spec.mode === 'disadvantage') exprBits.push('dis');
  return { label: label || 'Roll', expr: exprBits.join(' '), spec };
}

/** One requested roll from the assistant, "Grukk's attack: 1d20+5". */
export function parseRollRequest(line: string): { label: string; expr: string; spec: DiceSpec } | null {
  const text = (line || '').replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
  if (!text) return null;
  const spec = parseDiceSpec(text);
  if (!spec) return null;
  const colon = text.lastIndexOf(':');
  const label = colon > 0 ? text.slice(0, colon).trim() : text.replace(DICE_RE, '').trim();
  const expr = colon > 0 ? text.slice(colon + 1).trim() : (DICE_RE.exec(text)?.[0] || '').trim();
  return { label: label || 'Roll', expr: expr || text, spec };
}
