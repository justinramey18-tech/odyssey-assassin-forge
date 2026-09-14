# Prompt 11 of 11 — Make the Live DM Table readable

Restyle the round-chat message list in `src/components/ai-dm/RoundChatDrawer.tsx` so it reads like a real group chat: sans-serif body text, larger type, proper bubbles, hidden action buttons, and stacked consecutive messages.

## What changes

- Edit exactly one file: `src/components/ai-dm/RoundChatDrawer.tsx`.
- Add `actionsFor` state to reveal reaction/edit/delete buttons only when a bubble is tapped.
- Replace the entire `messages.map(...)` row block with a new bubble-based renderer:
  - Use `font-body` (Inter) and `text-[15px]` for all chat text.
  - Right-align the current user's messages in amber bubbles; left-align others in neutral bubbles; table talk in dashed sky-blue bubbles.
  - Show character name first, player name second in muted text; table talk reverses the order.
  - Stack consecutive messages from the same speaker, hiding the repeated avatar and name line.
  - Move the tick/sent indicator under the bubble; replace the permanent "You" and "Sent" badges.
  - Hide reaction/edit/delete buttons until the bubble is tapped.
  - Keep all existing handlers wired unchanged.
- Change the feed container's `space-y-1.5` to `space-y-0` so the new row spacing controls the rhythm.
- Add `font-body text-[15px]` to the composer textarea so typing matches the displayed messages.

## What does NOT change

- Prop names, handler names, or message data shape.
- Composer toggle buttons, Tick all / Clear ticks, or Send to DM.
- `src/index.css` or Tailwind config — the global Cinzel font remains; only the chat opts out.
- Full-screen logic from Prompt 10.

## Verification

1. TypeScript builds with no errors.
2. Chat messages render in a clean sans-serif at readable size, not small-caps serif.
3. Own messages sit right in amber bubbles; others sit left in grey; table talk is blue and dashed.
4. Each message header reads like "Thistlepig · ana" — character first, player after.
5. Two messages in a row from the same speaker share one avatar and one name line.
6. Smile / Pencil / Trash icons are hidden until a bubble is tapped.
7. Ticking a line still works, counts toward the total, and the bubble shows a green ring when ticked.
8. Reactions and the emoji picker still work.
9. All of the above holds in full-screen mode.
