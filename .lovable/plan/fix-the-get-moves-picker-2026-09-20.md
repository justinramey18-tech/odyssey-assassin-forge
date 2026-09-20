# Fix the Get Moves picker

## What changes

- Make the full-screen picker genuinely opaque, with a solid dark panel and a strong dark backdrop so Live DM messages cannot show through.
- Build the Synergize player list from unsent in-character lines first. If none exist, use the most recently resolved round's in-character lines from other players and mark those entries “from last round.”
- If no other player has spoken at all, keep Synergize visible but disabled with “Nobody has said anything yet.” It will never switch itself to “Do my own thing.”
- Carry the same selected player context into generation whether the source is pending chat or the last resolved round.
- On the alignment screen and results, show a context strip with selected names and up to two small pictures. Solo mode shows “Your own move.”
- Keep every suggestion label exactly as returned and present it as a small tag.

## Verification

- Check at phone width over the full-screen Live DM Table.
- Confirm Synergize uses a current pending line when available.
- Confirm it falls back to the newest consumed round immediately after a DM response and shows “from last round.”
- Confirm Synergize is disabled when no other player has any in-character line.
- Confirm selected names/pictures persist through alignment, results, Back, and Regenerate.

## Technical details

- Extend the picker candidate data with an optional source marker used only for the “from last round” label.
- In the party screen, derive the latest consumed round by finding the newest consumed in-character message from another player, then include other-player in-character messages sharing that round ID.
- Use one effective candidate/line source: pending lines take priority as a group; the latest consumed round is used only when the pending other-player candidate list is empty.
- Update the suggestion request to send lines and target names from that same effective source, avoiding any silent solo fallback.
- No database or edge-function changes.
