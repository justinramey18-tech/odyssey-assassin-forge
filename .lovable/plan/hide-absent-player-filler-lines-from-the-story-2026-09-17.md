# Hide absent-player filler lines from the story

## What changes

Right now, every player who does not tick a line into a round still gets their own line posted into the story — either "X holds their action" or their autopilot stand-in text. With four players and one or two active, the story fills up with filler that nobody wants to read.

After this change, the story only shows the lines players actually sent. Absent players post nothing visible at all.

## What stays the same

- The DM still receives everything it does today: the "holds their action" notes, the autopilot guidance, and the AFK character guides. Nothing about how the DM writes the scene changes.
- The lines are still recorded, so the DM's memory of earlier rounds is unaffected and nothing is deleted.
- Applies to everyone at the table, with no setting to manage.
- Ticking, send order, Send to DM, the round timer, and autopilot itself are untouched.

## Technical section

- `PartyDMScreen.tsx`: the story feed at the `partyDm.messages.map(...)` render (around line 2852) filters out rows with `is_afk_marker === true`. Filtering happens at render only — `partyDm.messages` is unchanged, so the model history sent on the next round, summarisation, and memory extraction all still include those rows.
- No change to `use-party-dm.ts`: `buildAfkGuidesContext`, `afkEntries`, the per-member inserts with `is_afk_marker: true`, and the `afkPromptSection` in the combined prompt all stay exactly as they are.
- Index guards: the map's `idx` is used for adjacent-message logic, so the filter is applied to build the displayed array before mapping rather than skipping inside the callback, keeping indices consistent.
- No database, RLS, or edge-function changes.
