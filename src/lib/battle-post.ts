// Battle posts (CL-057, D-29): the DM post written for a Live NPC fight is the story's record
// of the fight, but the fight referee has already applied every HP change, potion and fight
// condition to the players' sheets (INV-L7). The post is marked when it is saved, so the party
// story auto-sync can skip those parts and keep only XP, gold, items, quests and world changes.
//
// The marker is an HTML comment at the end of the saved content. Screens never show it
// (enrichMessageWithWhispers strips every tag), and it is removed from the DM's history.

export const BATTLE_POST_MARKER = '<!--BATTLE_POST-->';

/** Add the marker to a battle post's content (once). */
export function markBattlePost(content: string): string {
  const text = String(content ?? '');
  if (text.includes(BATTLE_POST_MARKER)) return text;
  return `${text.trimEnd()}\n\n${BATTLE_POST_MARKER}`;
}

/** True when saved DM content carries the battle-post marker. */
export function isBattlePostContent(content: string | null | undefined): boolean {
  return typeof content === 'string' && content.includes(BATTLE_POST_MARKER);
}

/** The content without the marker (for the DM's history and anything else that re-reads it). */
export function stripBattlePostMarker(content: string): string {
  const text = String(content ?? '');
  if (!text.includes(BATTLE_POST_MARKER)) return text;
  return text.split(BATTLE_POST_MARKER).join('').trimEnd();
}

/** The parts of a story extraction the fight referee has already applied (INV-L7). */
export interface FightAppliedFields {
  hp_absolute?: number | null;
  hp_changes?: unknown[];
  items_consumed?: unknown[];
  conditions_added?: string[];
  conditions_removed?: string[];
  companion_hp_absolute?: number | null;
  companion_hp_changes?: unknown[];
  companion_conditions_added?: string[];
  companion_conditions_removed?: string[];
}

/**
 * A battle post's extraction without what the referee already applied: HP (set or changed),
 * potions and other items used, and conditions, for the character and their companion.
 * XP, gold, items gained, quests, world changes and rests are kept.
 */
export function withoutFightResults<T extends FightAppliedFields>(result: T): T {
  return {
    ...result,
    hp_absolute: null,
    hp_changes: [],
    items_consumed: [],
    conditions_added: [],
    conditions_removed: [],
    companion_hp_absolute: null,
    companion_hp_changes: [],
    companion_conditions_added: [],
    companion_conditions_removed: [],
  };
}
