import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleStage, type StageFighter } from '@/components/ai-dm/battle/BattleStage';
import { SpriteSheet } from '@/components/ai-dm/battle/SpriteSheet';
import { ANCALAGON_BACK } from '@/lib/battle-sprites';

const foe: StageFighter = { id: 'e1', name: 'Cadet', hp: 10, maxHp: 10, status: 'up' };
const me: StageFighter = { id: 'rider', name: 'Kylar', hp: 20, maxHp: 20, status: 'up', level: 1 };
const dragon: StageFighter = { id: 'dragon', name: 'Ancalagon', hp: 80, maxHp: 80, status: 'up', ally: true, portrait: 'onyx.png' };
const stage = (party: StageFighter[], flashes: Parameters<typeof BattleStage>[0]['flashes'] = []) =>
  <BattleStage enemies={[foe]} party={party} me={me} targetId="e1" onPickEnemy={() => {}} flashes={flashes} />;

describe('BattleStage with animated sprites', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('without a sprite nothing changes: the ally is a small portrait card and the player a large one', () => {
    const r = render(stage([dragon]));
    expect(r.container.querySelector('[data-sprite-anim]')).toBeNull();
    expect(r.container.querySelector('img[src="onyx.png"]')).toBeTruthy();
    expect(r.container.querySelector('.w-\\[108px\\]')).toBeTruthy();
    expect(r.container.querySelector('.left-\\[8\\%\\]')).toBeTruthy();
    expect(r.container.querySelector('.left-\\[1\\%\\]')).toBeTruthy();
  });

  it('an ally with a sprite is drawn from its sheet, large, and the player steps in front', () => {
    const r = render(stage([{ ...dragon, sprite: { sheet: ANCALAGON_BACK, play: null } }]));
    const sprite = r.container.querySelector('[data-sprite-anim]') as HTMLElement;
    expect(sprite.getAttribute('data-sprite-anim')).toBe('back_idle');
    expect(sprite.style.backgroundImage).toContain('url(');
    expect(screen.getByRole('img', { name: 'Ancalagon' })).toBeTruthy();
    expect(r.container.querySelector('img[src="onyx.png"]')).toBeNull();
    expect(r.container.querySelector('.w-\\[108px\\]')).toBeNull();
    expect(r.container.querySelector('.w-\\[84px\\]')).toBeTruthy();
    // The figure never takes taps meant for the boxes behind it.
    // Nothing from the figure's outer box inwards may take a tap (the box overlaps the enemy boxes on a phone).
    expect(sprite.closest('.absolute')?.className).toContain('pointer-events-none');
  });

  it('a hit shakes the figure and shows the number without restarting the sprite', () => {
    const withSprite = [{ ...dragon, sprite: { sheet: ANCALAGON_BACK, play: null } }];
    const r = render(stage(withSprite));
    const before = r.container.querySelector('[data-sprite-anim]');
    r.rerender(stage(withSprite, [{ id: 'dragon', kind: 'hit', amount: 7, key: 'k1' }]));
    expect(screen.getByText('-7')).toBeTruthy();
    expect(r.container.querySelector('[data-sprite-anim]')).toBe(before);
    expect(before?.parentElement?.className).toContain('battle-hit');
  });
});

describe('SpriteSheet', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const now = (r: ReturnType<typeof render>) => { const el = r.container.firstElementChild as HTMLElement; return `${el.getAttribute('data-sprite-anim')}:${el.getAttribute('data-sprite-frame')}`; };

  it('idles, plays a one-shot when asked, then goes back to idle', () => {
    const r = render(<SpriteSheet sprite={ANCALAGON_BACK} />);
    expect(now(r)).toBe('back_idle:0');
    act(() => { vi.advanceTimersByTime(340); });
    expect(now(r)).toBe('back_idle:1');
    r.rerender(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_fire_breath', key: 1 }} />);
    expect(now(r)).toBe('back_fire_breath:0');
    act(() => { vi.advanceTimersByTime(420); });
    expect(now(r)).toBe('back_fire_breath:2');
    act(() => { vi.advanceTimersByTime(700); });
    expect(now(r).startsWith('back_idle:')).toBe(true);
  });

  it('the same move again restarts only with a new key', () => {
    const r = render(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_claw', key: 1 }} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(now(r).startsWith('back_idle:')).toBe(true);
    r.rerender(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_claw', key: 1 }} />);
    expect(now(r).startsWith('back_idle:')).toBe(true);
    r.rerender(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_claw', key: 2 }} />);
    expect(now(r)).toBe('back_claw:0');
  });

  it('an unknown move is ignored, and reduced motion stays on the first idle frame', () => {
    const r = render(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_backflip', key: 1 }} />);
    expect(now(r)).toBe('back_idle:0');
    cleanup();
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    const calm = render(<SpriteSheet sprite={ANCALAGON_BACK} play={{ anim: 'back_bite', key: 3 }} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(now(calm)).toBe('back_idle:0');
    window.matchMedia = mm;
  });
});
