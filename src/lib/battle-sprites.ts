// Animated fighters for the battle screen: which sprite sheet a fighter uses, how its frames are
// laid out, and which animation plays for a line of the fight log. Pure data and rules, no React.
// The referee decides what happened (empyrean-rules/combat.ts tags each move); this only picks the picture.
import { ANCALAGON_BACK_SHEET } from '@/lib/battle-sprite-assets';
import type { FightLogLine } from '@/lib/empyrean-rules-client';

export interface SpriteAnim {
  /** Row in the sheet, from 0. */
  row: number;
  /** Columns of its frames, in order, from 0. */
  columns: number[];
  /** Frames a second. */
  fps: number;
  loop: boolean;
}

export interface BattleSprite {
  /** URL of the sheet. */
  sheet: string;
  /** Grid of the sheet. */
  columns: number;
  rows: number;
  /** One frame, in sheet pixels (only its shape matters on screen). */
  frame: { w: number; h: number };
  /** Where the figure stands inside a frame, as shares of the frame: used to place it and its pop-up numbers. */
  body: { left: number; right: number; top: number; bottom: number };
  /** The looping animation shown when nothing else plays. */
  idle: string;
  anims: Record<string, SpriteAnim>;
}

/** A one-shot to play now. A new key restarts it, even with the same name. */
export interface SpritePlay { anim: string; key: string | number }

/** The black dragon, seen from behind (the rider's side of the field). */
export const ANCALAGON_BACK: BattleSprite = {
  sheet: ANCALAGON_BACK_SHEET,
  columns: 4,
  rows: 5,
  frame: { w: 410, h: 512 },
  body: { left: 0.2, right: 0.8, top: 0.35, bottom: 0.98 },
  idle: 'back_idle',
  anims: {
    back_idle: { row: 0, columns: [0, 1, 2, 3], fps: 4, loop: true },
    back_claw: { row: 1, columns: [0, 1, 2, 3], fps: 6, loop: false },
    back_bite: { row: 2, columns: [0, 1, 2, 3], fps: 6, loop: false },
    back_fire_breath: { row: 3, columns: [0, 1, 2, 3], fps: 6, loop: false },
    back_hurt: { row: 4, columns: [0, 1], fps: 5, loop: false },
    back_wing_guard: { row: 4, columns: [2, 3], fps: 4, loop: false },
  },
};

/** The battle sprite for a rider's dragon by scale colour. Only the black dragon has one so far; the rest keep their portrait. */
export function dragonBattleSprite(colorId: string | null | undefined): BattleSprite | null {
  return colorId === 'onyx' ? ANCALAGON_BACK : null;
}

const DRAGON_MOVES: Record<string, string> = { fire: 'back_fire_breath', bite: 'back_bite', claw: 'back_claw', guard: 'back_wing_guard' };

/** The dragon's one-shot for the log line now on screen, or null to keep idling. */
export function dragonPlayFor(line: Pick<FightLogLine, 'n' | 'by' | 'move' | 'targetId' | 'flash'> | null | undefined, dragonId: string): SpritePlay | null {
  if (!line) return null;
  if (line.by === 'dragon' && line.move && DRAGON_MOVES[line.move]) return { anim: DRAGON_MOVES[line.move], key: line.n };
  if (line.targetId === dragonId && line.flash === 'hit') return { anim: 'back_hurt', key: line.n };
  return null;
}

// ── Playing a sheet (used by SpriteSheet.tsx) ──

/** How long a one-shot holds its last frame before the idle loop returns, in frames. */
export const SPRITE_HOLD_FRAMES = 1;

/** The frame of an animation after `elapsedMs`. `done` is true once a one-shot has finished (and held its last frame). */
export function spriteFrameAt(anim: SpriteAnim, elapsedMs: number): { index: number; done: boolean } {
  const n = anim.columns.length;
  const step = Math.floor(Math.max(0, elapsedMs) / (1000 / Math.max(1, anim.fps)));
  if (anim.loop) return { index: step % n, done: false };
  return { index: Math.min(step, n - 1), done: step >= n + SPRITE_HOLD_FRAMES };
}

/** CSS background-size and background-position that show one frame of a sheet in a box of the frame's shape. */
export function spriteFrameStyle(sprite: BattleSprite, anim: SpriteAnim, index: number): { backgroundSize: string; backgroundPosition: string } {
  const col = anim.columns[Math.max(0, Math.min(anim.columns.length - 1, index))] ?? 0;
  const x = sprite.columns > 1 ? (col / (sprite.columns - 1)) * 100 : 0;
  const y = sprite.rows > 1 ? (anim.row / (sprite.rows - 1)) * 100 : 0;
  return { backgroundSize: `${sprite.columns * 100}% ${sprite.rows * 100}%`, backgroundPosition: `${x}% ${y}%` };
}
