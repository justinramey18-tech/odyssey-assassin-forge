# Active Quest screen

## Goal
Replace the Action Menu’s Quest Log destination with a parchment-style full-screen view of active quests, while keeping the full Story quest board available from the bottom.

## Build
1. Add the uploaded parchment artwork through the app’s asset storage and create `ActiveQuestScreen` above Live DM chat.
2. Keep the artwork fixed and top-aligned while only the quest content scrolls below its built-in title.
3. Show active quests only, ordered main before side, with dark-ink titles, tags, descriptions, display-only stages, progress, rewards, notes, dividers, and the requested empty state.
4. Add a bottom “Open full quest board” control that closes this screen and opens the existing character sheet on Story.
5. Route the Action Menu book tile to the new screen after the existing close delay, and keep its accessible name as “Quest log.”

## Verification
- Check the screen at 375px and 430px widths.
- Confirm the full built-in title remains visible, content begins below its flourish, and long quests scroll without moving the background.
- Confirm empty, one-quest, and multiple-quest ordering, plus the full quest board link.
