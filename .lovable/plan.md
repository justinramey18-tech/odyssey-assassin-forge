# Sent messages: remove the extra dim, add a giant green check mark

## What changes

All in `src/components/ai-dm/RoundChatDrawer.tsx` (message bubble only — no other files, no data changes).

1. **Remove the sent-message dim.** Delete the `m.consumed && "opacity-55"` entry from the bubble's class list. Messages already sent to the DM will no longer be dimmed for that reason alone — the in-character / table-talk toggle is now the only thing that controls fading.

2. **Add a giant green check mark to sent messages.** For every message already sent to the DM (`m.consumed`), render a large emerald check mark (the `Check` icon, already imported, roughly 64px) centered in the bubble:
   - **Text messages:** the check sits behind the words but in front of the background picture / color tint, so the text stays fully readable on top of it.
   - **Picture messages:** the check sits on top of the shared picture so it's still visible.
   - The check does not block taps (`pointer-events-none`).

3. **The check fades with the mode toggle.** Its brightness follows the same in-character / table-talk rule as everything else: full strength when the message's mode matches the toggle, faded when it doesn't — same opacity values used for the text and pictures today.

4. **Everything else stays exactly as it is:** the small "sent" chip that appears under a ticked row, the tick controls, edit/delete gating on sent messages, selection rings, avatar rings, presence dots, swipe-to-reply, reactions, read receipts, and the composer.

## Why

Sent messages were getting double-dimmed (once for being sent, once for the mode toggle), which made them hard to read. The big green check marks them clearly as "already handed to the DM" without washing them out.
