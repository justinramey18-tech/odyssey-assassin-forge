import { describe, it, expect, beforeEach } from 'vitest';
import { takeArenaSnapshot, restoreArenaSnapshot, hasArenaSnapshot } from '@/lib/arena/arenaSnapshot';

describe('arena snapshot', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('odyssey-active-cloud-save-id', 'c1');
  });

  it('restores health exactly after arena damage', () => {
    localStorage.setItem('odyssey-hp-state::c1', '{"current":30}');
    takeArenaSnapshot();
    localStorage.setItem('odyssey-hp-state::c1', '{"current":2}');
    expect(restoreArenaSnapshot()).toBe(true);
    expect(localStorage.getItem('odyssey-hp-state::c1')).toBe('{"current":30}');
    expect(hasArenaSnapshot()).toBe(false);
  });

  it('removes items that did not exist before entry', () => {
    takeArenaSnapshot();
    localStorage.setItem('odyssey-loot::c1', '[1]');
    restoreArenaSnapshot();
    expect(localStorage.getItem('odyssey-loot::c1')).toBeNull();
  });

  it('keeps the original snapshot if entered twice without exiting', () => {
    localStorage.setItem('odyssey-hp-state::c1', 'A');
    takeArenaSnapshot();
    localStorage.setItem('odyssey-hp-state::c1', 'B');
    takeArenaSnapshot();
    restoreArenaSnapshot();
    expect(localStorage.getItem('odyssey-hp-state::c1')).toBe('A');
  });

  it('does not touch another character', () => {
    localStorage.setItem('odyssey-hp-state::c2', 'other');
    takeArenaSnapshot();
    restoreArenaSnapshot();
    expect(localStorage.getItem('odyssey-hp-state::c2')).toBe('other');
  });
});
