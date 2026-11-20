import { describe, expect, it } from 'vitest';
import { ANCALAGON_BACK, dragonBattleSprite, dragonPlayFor, spriteFrameAt, spriteFrameStyle, SPRITE_HOLD_FRAMES } from '@/lib/battle-sprites';

describe('battle sprites: the black dragon\'s sheet', () => {
  it('every animation fits the grid and has frames', () => {
    for (const [name, a] of Object.entries(ANCALAGON_BACK.anims)) {
      expect(a.columns.length, name).toBeGreaterThan(0);
      expect(a.row, name).toBeLessThan(ANCALAGON_BACK.rows);
      for (const c of a.columns) expect(c, name).toBeLessThan(ANCALAGON_BACK.columns);
      expect(a.fps, name).toBeGreaterThan(0);
    }
    expect(ANCALAGON_BACK.anims[ANCALAGON_BACK.idle].loop).toBe(true);
    expect(Object.values(ANCALAGON_BACK.anims).filter(a => a.loop)).toHaveLength(1);
  });

  it('no two animations share a cell', () => {
    const cells = Object.values(ANCALAGON_BACK.anims).flatMap(a => a.columns.map(c => `${a.row}:${c}`));
    expect(new Set(cells).size).toBe(cells.length);
    expect(cells).toHaveLength(20);
  });

  it('only black dragons have a sheet so far', () => {
    expect(dragonBattleSprite('onyx')).toBe(ANCALAGON_BACK);
    for (const c of ['deep-red', 'deep-blue', 'dark-green', 'brown', 'silver', '', null, undefined]) expect(dragonBattleSprite(c)).toBeNull();
  });
});

describe('battle sprites: which move plays', () => {
  it('follows the referee\'s tag on the line being shown', () => {
    expect(dragonPlayFor({ n: 7, by: 'dragon', move: 'fire' }, 'dragon')).toEqual({ anim: 'back_fire_breath', key: 7 });
    expect(dragonPlayFor({ n: 8, by: 'dragon', move: 'bite' }, 'dragon')).toEqual({ anim: 'back_bite', key: 8 });
    expect(dragonPlayFor({ n: 9, by: 'dragon', move: 'claw' }, 'dragon')).toEqual({ anim: 'back_claw', key: 9 });
    expect(dragonPlayFor({ n: 10, by: 'dragon', move: 'guard' }, 'dragon')).toEqual({ anim: 'back_wing_guard', key: 10 });
  });

  it('flinches when the dragon is hit, and idles through everything else', () => {
    expect(dragonPlayFor({ n: 11, targetId: 'dragon', flash: 'hit' }, 'dragon')).toEqual({ anim: 'back_hurt', key: 11 });
    expect(dragonPlayFor({ n: 12, targetId: 'rider', flash: 'hit' }, 'dragon')).toBeNull();
    expect(dragonPlayFor({ n: 13, by: 'rider', move: 'attack', targetId: 'e1', flash: 'hit' }, 'dragon')).toBeNull();
    expect(dragonPlayFor({ n: 14, targetId: 'dragon', flash: 'heal' }, 'dragon')).toBeNull();
    expect(dragonPlayFor({ n: 15 }, 'dragon')).toBeNull();
    expect(dragonPlayFor(null, 'dragon')).toBeNull();
  });

  it('every animation it can ask for exists in the sheet', () => {
    for (const move of ['fire', 'bite', 'claw', 'guard'] as const) {
      const play = dragonPlayFor({ n: 1, by: 'dragon', move }, 'dragon');
      expect(ANCALAGON_BACK.anims[play!.anim]).toBeTruthy();
    }
    expect(ANCALAGON_BACK.anims.back_hurt).toBeTruthy();
  });
});

describe('battle sprites: playing a sheet', () => {
  const idle = ANCALAGON_BACK.anims.back_idle;
  const claw = ANCALAGON_BACK.anims.back_claw;

  it('a loop goes round forever at its speed', () => {
    expect(spriteFrameAt(idle, 0)).toEqual({ index: 0, done: false });
    expect(spriteFrameAt(idle, 249).index).toBe(0);
    expect(spriteFrameAt(idle, 250).index).toBe(1);
    expect(spriteFrameAt(idle, 1000)).toEqual({ index: 0, done: false });
    expect(spriteFrameAt(idle, 60_000).done).toBe(false);
  });

  it('a one-shot plays once, holds its last frame a beat, then is done', () => {
    const frame = 1000 / claw.fps;
    expect(spriteFrameAt(claw, 0)).toEqual({ index: 0, done: false });
    expect(spriteFrameAt(claw, frame * 3 + 1)).toEqual({ index: 3, done: false });
    expect(spriteFrameAt(claw, frame * 4 + 1)).toEqual({ index: 3, done: false });
    expect(spriteFrameAt(claw, frame * (4 + SPRITE_HOLD_FRAMES) + 1).done).toBe(true);
  });

  it('shows exactly one cell of the sheet', () => {
    expect(spriteFrameStyle(ANCALAGON_BACK, idle, 0)).toEqual({ backgroundSize: '400% 500%', backgroundPosition: '0% 0%' });
    expect(spriteFrameStyle(ANCALAGON_BACK, claw, 3)).toEqual({ backgroundSize: '400% 500%', backgroundPosition: '100% 25%' });
    const guard = ANCALAGON_BACK.anims.back_wing_guard;
    expect(spriteFrameStyle(ANCALAGON_BACK, guard, 0).backgroundPosition).toBe(`${(2 / 3) * 100}% 100%`);
    expect(spriteFrameStyle(ANCALAGON_BACK, guard, 9).backgroundPosition).toBe('100% 100%');
  });
});
