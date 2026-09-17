# Make the active chat mode pop: picture rings, letter outlines, and online dots

## What you'll see

In the Live DM Table:

1. **Your current mode stands out more.** Every speaker picture gets a bright colored ring when the message was sent in the mode you're currently typing in (green ring for in-character, blue ring for table talk). Messages in the *other* mode get no ring and their speaker picture fades back, so the split between the two modes is obvious at a glance.
2. **Active-mode words get an outline.** The letters themselves in active-mode messages get a thin light edge (like a sticker outline) on top of the existing dark halo, so they read as bold and lifted off the bubble. The faded mode's text stays exactly as it is today.
3. **Online dots in the chat.** Each speaker picture in the chat gets the same little dot the player cards on the home screen have: a green dot when the player is active, a faded grey dot when they're not. It uses the exact same source of truth, so it matches the cards.

## How it works (plain language)

- The chat already knows which mode you're typing in and which mode each message was sent in — the previous change used that to brighten one and fade the other. This builds on the same signal.
- The "active" dot on the player cards comes from a ready-made helper the app already uses elsewhere; the chat screen just needs to be handed the same player heartbeat info (a one-line addition where the party screen passes player names across) and can then show the identical dot.

## Files changed

- `src/components/ai-dm/RoundChatDrawer.tsx` — all three visual changes:
  - Message speaker pictures: bright ring (green for in-character, blue for table talk) when the message matches the current mode; dimmed otherwise.
  - Active-mode message text: thin light letter outline added to the existing dark shadow stack; other mode untouched.
  - Speaker pictures: presence dot at the bottom corner — green when active, faded grey when not — styled identically to the player cards. For your own picture, the small camera chip moves to the top corner so the two don't overlap.
- `src/components/ai-dm/PartyDMScreen.tsx` — one line: include each player's last-active timestamp when handing player info to the chat, so the dots can be computed.

## Not changing

- Sending, ticking, replying, editing, reactions, swipe gestures, the composer tiles, the header — all untouched.
- Nothing is written to the database differently; this is purely what each player's own screen shows, and what the DM receives is unchanged.
