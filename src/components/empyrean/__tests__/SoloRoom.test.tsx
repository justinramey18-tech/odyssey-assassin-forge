import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloRoom, STORY_SPOT, WALL_SHARE } from '@/components/empyrean/SoloRoom';
import { SoloRiderWall, SoloWorldWall, type SoloRiderWallProps, type SoloWorldWallProps } from '@/components/empyrean/SoloRoomWalls';

const world = (over: Partial<SoloWorldWallProps> = {}): SoloWorldWallProps => ({
  camp: { clock: 'Day 1, 08:00', alert: false }, mapReady: true, offeredQuests: 0, pendingLoot: 0,
  onCamp: vi.fn(), onMap: vi.fn(), onPeople: vi.fn(), onQuests: vi.fn(), onLoot: vi.fn(), ...over,
});
const rider = (over: Partial<SoloRiderWallProps> = {}): SoloRiderWallProps => ({
  dragonName: 'Tairn', bonded: true,
  onDragon: vi.fn(), onBond: vi.fn(), onBag: vi.fn(), onSheet: vi.fn(), onTools: vi.fn(), ...over,
});

describe('solo round room', () => {
  afterEach(() => cleanup());

  it('the world wall opens each screen, and shows the clock, quest offers and loot', () => {
    const p = world({ offeredQuests: 2, pendingLoot: 1 });
    render(<SoloWorldWall {...p} />);
    fireEvent.click(screen.getByLabelText('Camp. Day 1 · 08:00'));
    fireEvent.click(screen.getByLabelText('Map'));
    fireEvent.click(screen.getByLabelText('People'));
    fireEvent.click(screen.getByLabelText('Quests. New offers waiting'));
    fireEvent.click(screen.getByLabelText('Loot. Waiting for review'));
    for (const fn of [p.onCamp, p.onMap, p.onPeople, p.onQuests, p.onLoot]) expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hides Camp and Map while the rules engine is off, the Map until it is ready, and Loot when there is none', () => {
    const off = render(<SoloWorldWall {...world({ camp: null })} />);
    expect(screen.queryByText('Camp')).toBeNull();
    expect(screen.queryByText('Map')).toBeNull();
    expect(screen.queryByText('Loot')).toBeNull();
    expect(screen.getByLabelText('People')).toBeTruthy();
    expect(screen.getByLabelText('Quests')).toBeTruthy();
    off.unmount();
    render(<SoloWorldWall {...world({ mapReady: false })} />);
    expect(screen.getByText('Camp')).toBeTruthy();
    expect(screen.queryByText('Map')).toBeNull();
  });

  it('the rider wall opens each screen and names the dragon, or says Unbonded', () => {
    const p = rider();
    const bonded = render(<SoloRiderWall {...p} />);
    fireEvent.click(screen.getByLabelText('Tairn. Speak mind to mind'));
    fireEvent.click(screen.getByLabelText('Bond'));
    fireEvent.click(screen.getByLabelText('Bag. Items and actions'));
    fireEvent.click(screen.getByLabelText('Sheet'));
    fireEvent.click(screen.getByLabelText('Tools. Saves, notes, world'));
    for (const fn of [p.onDragon, p.onBond, p.onBag, p.onSheet, p.onTools]) expect(fn).toHaveBeenCalledTimes(1);
    bonded.unmount();
    render(<SoloRiderWall {...rider({ bonded: false, dragonName: '' })} />);
    expect(screen.getByLabelText('Dragon. Unbonded')).toBeTruthy();
  });

  it('is one wide surface with the story between two walls: it opens on the story, has no tabs or snap points, and a new message looks back at the story', () => {
    const scrollTo = vi.fn();
    const proto = HTMLElement.prototype as unknown as { scrollTo: unknown };
    const before = proto.scrollTo;
    proto.scrollTo = scrollTo;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    try {
      const view = (key: number) => (
        <SoloRoom leftLabel="The College" rightLabel="Rider and Dragon" homeKey={key} left={<span>left wall</span>} right={<span>right wall</span>}>
          <p>the story</p>
        </SoloRoom>
      );
      const r = render(view(1));
      expect(screen.getByText('the story')).toBeTruthy();
      expect(screen.getByText('left wall')).toBeTruthy();
      expect(screen.getByText('right wall')).toBeTruthy();
      expect(STORY_SPOT).toBe(WALL_SHARE);
      expect(scrollTo).toHaveBeenLastCalledWith({ left: Math.round(400 * WALL_SHARE), behavior: 'auto' });
      const room = r.container.querySelector('[data-solo-room]');
      expect(room?.className).not.toContain('snap');
      expect(r.container.querySelectorAll('button').length).toBe(0);
      const calls = scrollTo.mock.calls.length;
      r.rerender(view(1));
      expect(scrollTo.mock.calls.length).toBe(calls);
      r.rerender(view(2));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: Math.round(400 * WALL_SHARE), behavior: 'smooth' });
    } finally {
      proto.scrollTo = before;
      delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
    }
  });
});
