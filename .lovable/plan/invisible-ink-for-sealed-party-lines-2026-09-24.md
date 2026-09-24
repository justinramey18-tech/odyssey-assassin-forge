# Invisible ink for sealed party lines

## What changes
- Add the supplied ornate border, reveal plaque, and sparkle texture to the live-chat artwork.
- Keep sealed messages readable for their author, but veil them for other players until tapped.
- Reveal a veiled line only on the current player’s screen, then hide it again after 12 seconds.
- Preserve the ornate frame while revealed, and remove all veil framing when a line is unsealed or delivered.
- Leave action cards, dice rolls, sealing controls, delivery logic, and saved data unchanged.

## Verification
- Re-read the edited message rendering and invisible-ink styles.
- Confirm TypeScript compiles without opening or signing into the app.
