import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloHallScene } from '@/components/empyrean/SoloHallScene';

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
