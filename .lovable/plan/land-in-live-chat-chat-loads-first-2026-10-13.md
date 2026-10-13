# Land in Live Chat, Chat Loads First

## What you'll see

Opening the app while you're in a party takes you straight into the live party chat — and the chat itself is the first thing on screen. The last messages you saw appear instantly from the phone's memory while fresh messages load in behind them, so there's no blank spinner waiting for the server.

Everything else stays the same:

- Not in a party, signed out, or first-time player → Home (or the mode picker) as today.
- Back still returns to Home; the recovery screen still appears if the party is gone.
- The Enter Story cinematic still plays for a normal Play tap from Home.

## How it works (plain terms)

The direct-to-table landing already built is the entry point. This step makes the chat the priority inside it: the table opens on the chat view (not a panel or menu), the chat shows your saved conversation immediately, and everything else the table needs (member list, fight state, tools) finishes loading in the background without blocking the chat.

## Changes

1. **`src/components/ai-dm/StandalonePartyDMScreen.tsx` / `PartyDMScreen.tsx`**
   - Chat feed renders first: show the locally saved story lines instantly, then merge in fresh server messages when they arrive (using the stable-ID merging already in place).
   - Nothing else on the table may hold the chat hostage — heavy panels stay lazy-loaded as they are now.

2. **`src/pages/Index.tsx` / `src/components/home/HomeScreen.tsx`**
   - Confirm the on-open auto-open path mounts the table with the chat as the visible view, with no intermediate screen or extra tap.

3. **Loading polish**
   - Replace any full-screen "connecting" spinner that covers the chat with a slim "catching up…" indicator at the top of the chat itself, so players can read and scroll while it syncs.

## Verification

- Existing tests stay green; the stable-ID merge tests cover the instant-then-refresh chat behavior.
- No database, permission, or server changes. No sign-in flow testing; live two-phone timing unverified in this environment.
