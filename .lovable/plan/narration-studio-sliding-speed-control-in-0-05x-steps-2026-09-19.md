# Narration Studio: sliding speed control in 0.05x steps

## What changes

In the Narration Studio (Edit narration), the speed control for each piece is currently a dropdown with a few fixed choices (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x). It becomes a slider that moves in small 0.05x steps, from 0.5x to 2x — the same smooth control the global narration speed already uses.

- Each piece keeps its own slider; it only changes that piece's playback speed.
- Setting it back to exactly 1x returns the piece to the global narration speed.
- Changing the speed of a piece that is currently playing still updates instantly (this already works and stays).
- Playback-only, as before: no re-voicing, no cost, and speeds stay on this device.

## Where

- `src/components/ai-dm/NarrationStudio.tsx` — replace the speed dropdown on each row with a compact slider (0.5 to 2.0, step 0.05) plus a small readout showing the current value, and a quick "1x" reset. The existing save and live-playback logic is untouched.

No other files, no database changes.
