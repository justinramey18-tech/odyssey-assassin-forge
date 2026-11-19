import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SoloHallScene, hallRingCopy, hallRingLeftFor, hallRingSeamLeft, hallRingSeamShown, hallRingSpotAt, hallRingStoryLeft, hallRingTarget, hallRingWrap,
} from '@/components/empyrean/SoloHallScene';

const walls = { left: <span>left wall</span>, right: <span>right wall</span>, leftLabel: 'The College', rightLabel: 'Rider and Dragon' };

describe('solo hall scene', () => {
  afterEach(() => cleanup());

  it('draws the three images, the story, and a tap area only for the objects that are wired', () => {
    const onBag = vi.fn();
    const onDragon = vi.fn();
    const r = render(
      <SoloHallScene enabled {...walls} spots={{ bag: { onTap: onBag }, dragon: { onTap: onDragon, caption: 'Tairn', badge: 2 }, tools: { onTap: vi.fn(), alert: true } }}>
        <p>the story</p>
      </SoloHallScene>,
    );
    expect(r.container.querySelectorAll('img').length).toBe(3);
    expect(screen.getByText('the story')).toBeTruthy();
    expect(screen.queryByText('left wall')).toBeNull();
    expect(r.container.querySelectorAll('button').length).toBe(3);
    fireEvent.click(screen.getByLabelText('Bag'));
    fireEvent.click(screen.getByLabelText('Tairn, 2'));
    expect(onBag).toHaveBeenCalledTimes(1);
    expect(onDragon).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Tools')).toBeTruthy();
    expect(screen.queryByLabelText('Camp')).toBeNull();
  });

  it('keeps every tap area on its object: positions are percentages of the scene', () => {
    const r = render(<SoloHallScene enabled {...walls} spots={{ dragon: { onTap: vi.fn() } }}><p>s</p></SoloHallScene>);
    const dragon = screen.getByLabelText('Dragon') as HTMLButtonElement;
    expect(dragon.style.left.endsWith('%')).toBe(true);
    expect(dragon.style.top.endsWith('%')).toBe(true);
    expect(dragon.style.width.endsWith('%')).toBe(true);
    expect(dragon.style.height.endsWith('%')).toBe(true);
    const room = r.container.querySelector('[data-solo-hall]');
    expect(room?.className).not.toContain('snap');
  });

  it('opens on the story and looks back at it when a new message arrives', () => {
    const scrollTo = vi.fn();
    const proto = HTMLElement.prototype as unknown as { scrollTo: unknown };
    const before = proto.scrollTo;
    proto.scrollTo = scrollTo;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 2400 });
    try {
      const view = (key: number) => <SoloHallScene enabled {...walls} spots={{}} homeKey={key}><p>s</p></SoloHallScene>;
      const r = render(view(1));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'auto' });
      const calls = scrollTo.mock.calls.length;
      r.rerender(view(1));
      expect(scrollTo.mock.calls.length).toBe(calls);
      r.rerender(view(2));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
    } finally {
      proto.scrollTo = before;
      delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
      delete (HTMLElement.prototype as unknown as { scrollWidth?: number }).scrollWidth;
    }
  });

  it('switched off, it is the older round room with its two walls', () => {
    const r = render(<SoloHallScene enabled={false} {...walls} spots={{ bag: { onTap: vi.fn() } }}><p>the story</p></SoloHallScene>);
    expect(screen.getByText('left wall')).toBeTruthy();
    expect(screen.getByText('right wall')).toBeTruthy();
    expect(screen.getByText('the story')).toBeTruthy();
    expect(r.container.querySelector('[data-solo-room]')).toBeTruthy();
    expect(r.container.querySelector('[data-solo-hall]')).toBeNull();
    expect(screen.queryByLabelText('Bag')).toBeNull();
  });
});

// A phone-sized ring: a 400 px wide view, a 2,400 px painted hall, so one lap is 2,800 px.
const ring = { view: 400, scene: 2400, lap: 2800 };

describe('solo hall ring: the maths', () => {
  it('puts any view back in the middle copy without changing what is on screen', () => {
    expect(hallRingWrap(2800, 2800)).toBe(2800);
    expect(hallRingWrap(5599, 2800)).toBe(5599);
    expect(hallRingWrap(5600, 2800)).toBe(2800);
    expect(hallRingWrap(100, 2800)).toBe(2900);
    expect(hallRingWrap(7000, 2800)).toBe(4200);
    for (const x of [0, 1, 1399, 2799, 2800, 4321, 5600, 6999, 8000]) {
      const home = hallRingWrap(x, 2800);
      expect(home).toBeGreaterThanOrEqual(2800);
      expect(home).toBeLessThan(5600);
      expect((home - x) % 2800 === 0).toBe(true);
    }
  });

  it('keeps the story and the seam panel on the copy nearest the view, and swaps them only while they are off screen', () => {
    for (let x = 0; x <= 3 * ring.lap - ring.view; x += 7) {
      const center = x + ring.view / 2;
      const story = hallRingStoryLeft(hallRingCopy(center, ring.scene / 2, ring.lap), ring);
      const seam = hallRingSeamLeft(hallRingCopy(center, ring.scene + ring.view / 2, ring.lap), ring);
      // Wherever a copy of the story or the panel would be in view, the real one is there.
      for (let k = 0; k < 3; k++) {
        const s = hallRingStoryLeft(k, ring);
        if (s < x + ring.view && s + ring.view > x) expect(story).toBe(s);
        const p = hallRingSeamLeft(k, ring);
        if (p < x + ring.view && p + ring.view > x) expect(seam).toBe(p);
      }
    }
  });

  it('remembers what is in view through a resize', () => {
    const story = hallRingSpotAt(hallRingStoryLeft(1, ring), ring);
    expect(story).toEqual({ zone: 'scene', t: 0.5 });
    const shorter = { view: 400, scene: 1200, lap: 1600 };
    expect(hallRingLeftFor(story, shorter)).toBe(hallRingStoryLeft(1, shorter));
    const panel = hallRingSpotAt(hallRingSeamLeft(1, ring), ring);
    expect(panel.zone).toBe('seam');
    expect(hallRingLeftFor(panel, shorter)).toBe(hallRingSeamLeft(1, shorter));
    // The same spot is found from any copy.
    expect(hallRingSpotAt(hallRingStoryLeft(0, ring), ring)).toEqual(story);
    expect(hallRingSpotAt(hallRingStoryLeft(2, ring), ring)).toEqual(story);
  });

  it('turns to the story or the panel the short way round', () => {
    const atStory = hallRingStoryLeft(1, ring);
    expect(hallRingTarget('seam', atStory, ring)).toBe(hallRingSeamLeft(1, ring));
    expect(hallRingTarget('story', hallRingSeamLeft(1, ring), ring)).toBe(atStory);
    // Just past the panel, the next copy of the story is nearer than the one behind.
    expect(hallRingTarget('story', hallRingSeamLeft(1, ring) + 300, ring)).toBe(hallRingStoryLeft(2, ring));
    // From the left part of the hall, the panel behind is nearer.
    expect(hallRingTarget('seam', ring.lap + 100, ring)).toBe(hallRingSeamLeft(0, ring));
  });

  it('knows how much of the panel is in view', () => {
    expect(hallRingSeamShown(hallRingSeamLeft(1, ring), ring)).toBe(1);
    expect(hallRingSeamShown(hallRingSeamLeft(1, ring) - 200, ring)).toBe(0.5);
    expect(hallRingSeamShown(hallRingSeamLeft(1, ring) + 100, ring)).toBe(0.75);
    expect(hallRingSeamShown(hallRingStoryLeft(1, ring), ring)).toBe(0);
    expect(hallRingSeamShown(hallRingSeamLeft(0, ring), ring)).toBe(1);
  });
});

describe('solo hall ring: the scene', () => {
  afterEach(() => cleanup());

  it('without a seam panel the hall is drawn once, as before', () => {
    const r = render(<SoloHallScene enabled {...walls} spots={{ bag: { onTap: vi.fn() } }}><p>the story</p></SoloHallScene>);
    expect(r.container.querySelector('[data-hall-ring]')).toBeNull();
    expect(r.container.querySelectorAll('img').length).toBe(3);
    expect(r.container.querySelectorAll('button').length).toBe(1);
  });

  it('with a seam panel: three copies of the hall, one story, one panel, and only the middle copy is read out', () => {
    const onBag = vi.fn();
    const r = render(
      <SoloHallScene enabled {...walls} spots={{ bag: { onTap: onBag }, dragon: { onTap: vi.fn(), caption: 'Tairn' } }} seam={<p>dragon chat</p>}>
        <p>the story</p>
      </SoloHallScene>,
    );
    expect(r.container.querySelector('[data-hall-ring]')).toBeTruthy();
    expect(r.container.querySelectorAll('img').length).toBe(9);
    expect(screen.getAllByText('the story').length).toBe(1);
    expect(screen.getAllByText('dragon chat').length).toBe(1);
    expect(r.container.querySelector('[data-hall-seam]')?.textContent).toContain('dragon chat');
    const bags = r.container.querySelectorAll('button[aria-label="Bag"]');
    expect(bags.length).toBe(3);
    expect(Array.from(bags).filter(b => b.getAttribute('tabindex') === '-1').length).toBe(2);
    expect(Array.from(bags).filter(b => b.closest('[aria-hidden="true"]')).length).toBe(2);
    bags.forEach(b => fireEvent.click(b));
    expect(onBag).toHaveBeenCalledTimes(3);
    expect(r.container.querySelector('[data-solo-hall]')?.className).not.toContain('snap');
  });

  it('with enabled off, the older round room is drawn even if a seam panel is given', () => {
    render(<SoloHallScene enabled={false} {...walls} spots={{}} seam={<p>dragon chat</p>}><p>the story</p></SoloHallScene>);
    expect(screen.getByText('left wall')).toBeTruthy();
    expect(screen.queryByText('dragon chat')).toBeNull();
  });
});
