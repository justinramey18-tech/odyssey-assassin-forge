import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPendingDmItems,
  loadPendingDmItems,
  removePendingDmItem,
  PENDING_DM_ITEMS_EVENT,
} from '@/lib/pendingDmItems';

// Solo Empyrean: DM awards and quest item rewards wait for Accept / Discard.
describe('Empyrean loot review queue', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('odyssey-active-cloud-save-id', 'char-a');
  });

  it('queues quest item rewards in the shape quests.ts stores them', () => {
    const rewards = [
      { name: 'Riders\' flight leathers', quantity: 1, gold_value: 40, rarity: 'uncommon', category: 'armor' },
      { name: '  ', quantity: 1 },
    ];
    const items = rewards.filter(it => it && typeof it.name === 'string' && it.name.trim());
    const queued = addPendingDmItems(items);
    expect(queued).toHaveLength(1);
    expect(queued[0].name).toBe('Riders\' flight leathers');
    expect(queued[0].goldValue).toBe(40);
  });

  it('removes one item on accept or discard and tells listeners', () => {
    let fired = 0;
    const onChange = () => { fired += 1; };
    window.addEventListener(PENDING_DM_ITEMS_EVENT, onChange);
    const [a] = addPendingDmItems([{ name: 'Healing potion', quantity: 2 }, { name: 'Dagger' }]);
    removePendingDmItem(a.id);
    window.removeEventListener(PENDING_DM_ITEMS_EVENT, onChange);
    expect(loadPendingDmItems().map(i => i.name)).toEqual(['Dagger']);
    expect(fired).toBe(2);
  });

  it('keeps each character\'s loot separate', () => {
    addPendingDmItems([{ name: 'Signet focus' }]);
    localStorage.setItem('odyssey-active-cloud-save-id', 'char-b');
    expect(loadPendingDmItems()).toHaveLength(0);
    localStorage.setItem('odyssey-active-cloud-save-id', 'char-a');
    expect(loadPendingDmItems()).toHaveLength(1);
  });
});
