import { describe, it, expect } from 'vitest';
import {
  BATTLE_POST_MARKER,
  isBattlePostContent,
  markBattlePost,
  stripBattlePostMarker,
  withoutFightResults,
} from '@/lib/battle-post';
import { storyHistory } from '@/lib/story-scene';

describe('battle-post marker (CL-057)', () => {
  it('marks once, reads it back, and strips it cleanly', () => {
    const post = 'Steel rang in the hall. Anduril takes 14 damage across the fighting.\n';
    const marked = markBattlePost(post);
    expect(marked.endsWith(BATTLE_POST_MARKER)).toBe(true);
    expect(markBattlePost(marked)).toBe(marked);
    expect(isBattlePostContent(marked)).toBe(true);
    expect(isBattlePostContent(post)).toBe(false);
    expect(isBattlePostContent(null)).toBe(false);
    expect(stripBattlePostMarker(marked)).toBe(post.trimEnd());
    expect(stripBattlePostMarker(post)).toBe(post);
  });

  it('keeps the marker out of the DM history', () => {
    const rows = [
      { id: 'a', role: 'user', content: '⚔ Combat: Anduril hits', sender_name: 'Party' },
      { id: 'b', role: 'assistant', content: markBattlePost('The ogre falls.'), sender_name: 'DM' },
    ];
    const history = storyHistory(rows as any);
    expect(history.map(h => h.content)).toEqual(['⚔ Combat: Anduril hits', 'The ogre falls.']);
  });
});

describe('withoutFightResults', () => {
  const extraction = {
    hp_absolute: 31,
    hp_changes: [{ amount: 14, type: 'damage', source: 'ogre' }],
    xp_gained: 450,
    gold_changes: [{ amount: 30, action: 'gained' }],
    items_acquired: [{ name: 'Ogre tooth' }],
    items_consumed: [{ name: 'Potion of Healing', quantity: 1 }],
    conditions_added: ['poisoned'],
    conditions_removed: ['prone'],
    rest_occurred: null,
    companion_hp_absolute: 10,
    companion_hp_changes: [{ amount: 3, type: 'damage', source: 'ogre' }],
    companion_conditions_added: ['frightened'],
    companion_conditions_removed: [],
    quests_offered: [{ title: 'Ogre bounty' }],
    quest_progress: [{ key: 'clear_the_road', status: 'completed' }],
    world_state_changes: [{ title: 'The ogre is dead' }],
  };

  it('drops what the referee already applied and keeps XP, gold, loot, quests and world changes', () => {
    const r = withoutFightResults(extraction);
    expect(r.hp_absolute).toBeNull();
    expect(r.hp_changes).toEqual([]);
    expect(r.items_consumed).toEqual([]);
    expect(r.conditions_added).toEqual([]);
    expect(r.conditions_removed).toEqual([]);
    expect(r.companion_hp_absolute).toBeNull();
    expect(r.companion_hp_changes).toEqual([]);
    expect(r.companion_conditions_added).toEqual([]);
    expect(r.xp_gained).toBe(450);
    expect(r.gold_changes).toEqual(extraction.gold_changes);
    expect(r.items_acquired).toEqual(extraction.items_acquired);
    expect(r.quests_offered).toEqual(extraction.quests_offered);
    expect(r.quest_progress).toEqual(extraction.quest_progress);
    expect(r.world_state_changes).toEqual(extraction.world_state_changes);
    expect(extraction.hp_changes).toHaveLength(1); // the original is not changed
  });
});
