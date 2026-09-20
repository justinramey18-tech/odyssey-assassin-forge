# Full-screen Quick Actions and spell artwork

## Goal
Make Quick Actions fully cover Live DM chat, reopen with every section and spell description expanded, and visually distinguish evocation spells with the supplied fire artwork.

## Build
1. Store the uploaded evocation artwork and expose it through a school-to-background lookup.
2. Make the drawer 100dvh with square corners, retained swipe handle, a pinned title/44px close control, pinned spell slots, and an independently scrolling action list.
3. Reset all visible sections to expanded whenever the drawer opens while preserving manual collapse during that visit.
4. Reset spell descriptions to expanded whenever the drawer opens; retain measured overflow and stopped-propagation “less/more” controls.
5. Add the evocation background and dark readability layer to standard, cantrip, and homebrew spell cards only, with brighter text and unchanged controls/casting behavior.

## Verification
- Check compilation and formatting.
- Test at 375px: full coverage, pinned controls/slots, scrolling list, reset behavior, evocation art, and unchanged plain cards.
