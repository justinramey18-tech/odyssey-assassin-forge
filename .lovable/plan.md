# Tidy up the Party DM screen

Goal: reclaim space at the top of the party screen and put your character vitals where the other tools already live.

## What changes

1. **Character strip moves into the bottom drawer**
   - The name / HP bar / XP bar strip currently pinned under the party header is removed from the top of the screen.
   - It reappears at the top of the pull-up drawer, so opening any drawer tab (Dice, RP Prompts, Actions, Sheet, Settings, etc.) shows your vitals above the tab content.
   - Tapping the strip still opens the full character sheet, exactly as it does today, and keeps the "new items" badge.

2. **Remove the red "?" button** — the floating red question-mark shortcut that opens "Talk to the DM" is removed from the party screen. The Director/Talk-to-the-DM panel itself stays available where it already appears elsewhere.

3. **Remove the floating bookmark button** — the round jump-to-bookmark button in the lower-right of the chat area is removed. Per-message bookmark icons and the bookmark divider in the transcript stay as they are.

## Technical notes

- `src/components/ai-dm/PartyDMScreen.tsx`: move the `CharacterSheetStrip` block out of the header region and render it inside the expanded `DMBottomNav` panel; delete the jump-to-bookmark FAB (`handleJumpToBookmark` stays wired to nothing visible only if unused — otherwise it is removed with it).
- `src/components/ai-dm/DMBottomNav.tsx`: add an optional `headerContent` slot rendered at the top of the expanded panel, above the active tab's content.
- `src/components/ai-dm/StandalonePartyDMScreen.tsx`: remove the fixed red "?" button that sets `showDirectorScreen`.
- No changes to data, sync, or character-sheet logic.
