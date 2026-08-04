# Character Sheet inside the Solo AI DM

A full-screen, tabbed character sheet that lives in the solo DM, opened from a rich strip at the top of the chat. The AI DM keeps it in sync as the story unfolds.

## Why your 200 XP looked lost

Two separate things are going on, and only one is confirmed:

1. The DM's automatic character updates are an opt-in toggle (Tools > Auto-Sync), and it starts switched OFF. If it was off, nothing the DM narrated ever reached your sheet — the message you saw was just the DM talking.
2. Your screenshot shows "200 XP" recorded next to Level 5, while the bar reads 0 / 3,750. That is because your level was set ahead of your XP total, so the bar for level 5 starts at 3,250 XP and 200 falls below it. The number is stored; the bar just has nothing to fill.

First step of the build is to confirm which of these applied by checking the auto-sync toggle state, then fix both: turn auto-sync on by default for solo play, and make the XP bar honest when XP sits below the current level's floor (show "Level set manually — XP below this level's threshold" instead of a silent empty bar).

## The character sheet

**Entry point.** A rich strip pinned at the top of the solo DM chat: portrait, name, level, a live HP bar and a live XP bar. Tap it to open the sheet full screen. It updates the instant the DM changes anything.

**Layout.** Full screen, tabbed across the top, each tab independently scrollable:

- **Vitals** — HP and temp HP (adjustable), AC, active conditions, short/long rest buttons, gold.
- **Stats** — level, XP bar and progression mode, ability scores with modifiers, saves, skills, proficiency bonus.
- **Abilities** — equipped loadout, unlocked abilities with tiers, spells and cantrips, cooldown state. Same content as today's tools drawer. Button: "Open Abilities tab" to jump to the main app builder.
- **Items** — equipment, consumables, loot, with a "Use" action on consumables. Button: "Open Items tab" to jump to the main app inventory.
- **Story** — backstory, relationships, alignment, active quests, notes. Editable, and everything here is fed to the DM.

**Editing.** View plus light edits: HP, temp HP, XP, gold, conditions, rests, using a consumable, and story text. Deeper work (equipping abilities, buying, homebrew) sends you to the main tabs via the navigation buttons.

**Removing from the tools drawer.** While the solo DM is open, the Abilities and Consumables/Items sections of the quick tools drawer are hidden — they live in the sheet now. Everywhere else in the app the drawer is unchanged.

## AI DM sync

- Auto-sync defaults to ON for solo campaigns (still switchable off in Tools).
- After each DM reply, XP, HP, gold, conditions and rests apply straight to the sheet, and the existing summary banner reports what changed.
- **Items are held for review**: anything the DM says you found lands in a "Pending" strip at the top of the Items tab with Accept / Discard on each one. A badge on the header strip and the Items tab shows how many are waiting.
- **Level ups happen automatically** with a celebration: level increases, ability points are granted, and a level-up banner appears in the chat so the story acknowledges it.
- Whatever is on the sheet is what the DM sees on the next turn, so it can react to your current state.

## Technical notes

- New `SoloCharacterSheet` component under `src/components/ai-dm/`, modeled on the Empyrean `CharacterSheet` tab shell, plus a `CharacterSheetStrip` header rendered in `AIDMScreen`.
- Reuses existing hooks and data already assembled in `PromptDrawerProvider`'s `aiDMCharacterContext` (HP, gold, conditions, cooldowns, ability scores, loot, consumables, wild shape) rather than duplicating state, so scoped per-character storage rules are respected.
- Sheet reads/writes through the callbacks `Index.tsx` already exposes (`handleAddXP`, `handleHPChange`, `handleChronicleGold`, conditions, rests). Two new callbacks are added to the `autoSyncCallbacks` object: item acceptance and manual level-up.
- Auto-sync default flips in `use-dm-auto-sync.ts`: absent stored value means ON (an explicit stored `'false'` still wins).
- `items_acquired` from `ai-dm-extract` is currently discarded; it will be routed into the pending-items queue (kept in scoped storage, cleared on accept/discard).
- The XP-bar edge case is handled in `XPTracker`.
- Abilities/items suppression in `QuickActionsDrawer` is done with a prop passed only from the solo DM path, leaving other call sites untouched.
- New scoped storage keys are registered in all three registries (`scoped-keys.ts`, `resetApp.ts`, `use-auto-save.ts`).
