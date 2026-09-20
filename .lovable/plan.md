# Roll request cards in the Live DM chat

When the DM calls for a dice roll, it stops hiding in the whisper tray. It becomes a card at the bottom of the Live DM chat with a button that actually rolls it — for one player, or for the whole party at once (initiative).

## What the player sees

- The newest DM message's roll requests appear as cards just above the chat box.
- Each card shows the character's name, what the roll is ("Charisma (Performance), DC 14"), and a button: "Roll", or "Roll with Advantage" / "Roll with Disadvantage".
- Only the named player can press it. Everyone else sees a greyed card reading "Waiting on Phoenix".
- The party host always gets a small "Roll for them" override on any card or row, for anyone who is away.
- Once rolled, the card stays visible but greys out and shows the result, so nobody rolls it twice.
- A player with nothing waiting on them sees no extra card.

## Party-wide rolls (initiative)

- A request addressed to everyone becomes one card with a row per living party member.
- Header shows progress: "Initiative — 3 of 5 rolled".
- Each result posts into the chat as it lands, so the DM can react to a natural 1 straight away.
- When the last row lands, the card collapses to a ranked summary and posts one line:
  `⚔️ Initiative: Phoenix 22 · Edgar 20 · The Pig 8 · Atlas 4 · Xeyle 2`
- Initiative rows use each character's own Dexterity bonus; ties break on the higher bonus.

## Results in chat

Results post automatically as that player's own in-character line, in the format already used:

```text
🎲 **Stealth**: [14] +3 = **17**
🎲 **Stealth** (adv): [14, 8] +3 = **17**
```

Rolls made by the host on someone's behalf note who rolled them.

## Whisper tray

Stays exactly as it is for private beats. Roll requests simply no longer appear there — the buttons for them move to the cards.

## Technical notes

- `src/lib/whisper-parser.ts`: add an optional `target` to `action` whispers — the text before the first colon when it matches a party member's `character_name`. `Everyone:` / `Party:` / `All:` or a comma-separated name list marks a party-wide roll; an unmatched prefix means untargeted (anyone may roll). Also parse a trailing `[adv]` / `[dis]` marker. TACTICS and WHISPER parsing untouched.
- `PartyDMScreen.tsx`: derive roll requests from the newest DM message only; drop the `isEmpyrean` gate on `handleWhisperAutoRoll` so auto-roll works in normal campaigns; stop passing action whispers to `WhisperTray`; pass request cards, permissions (named player / `isCreator` override) and a roll handler down to `RoundChatDrawer`.
- Rolling reuses `parseRollHint` → `resolveWhisperAutoRoll` → `performWhisperRoll` with the same character context `handleWhisperAutoRoll` builds today. Advantage/disadvantage rolls two d20s and keeps the higher/lower. When `canAutoRoll` is false the button opens the pre-filled dice roller as it does now.
- Results post through the existing `roundChat.sendMessage(content, true)` path, landing in `party_round_chat` with `in_character: true`.
- Shared state: `party_shared_state` gains a new `state_type` of `roll_requests` holding `{ requests: { [requestId]: { rows: { [userId]: { result, rolledBy, rolledAt } } } } }`. `requestId` is a stable hash of the message id plus the ACTION block text so every device agrees. That table is already on realtime; no schema change.
- `RoundChatDrawer.tsx`: render the cards above the composer — dark panel, amber border, Cinzel label, `gap-2` stacking, scrolling past three, correct at 360px, 48px touch targets.
- `use-party-dm.ts` (~line 2998): update the ACTION tag guidance — always name the character before a colon, one block addressed to `Everyone:` for a shared roll (never one per player), `[adv]` / `[dis]` after the name when warranted, one block per roll, never dice notation or DCs in the prose.

Out of scope: the dice roller itself, the roll math, private whisper rendering, the chat's existing message flow, and any schema change.
