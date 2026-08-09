# Send to DM fires the DM instantly

## What's wrong now

Tapping "Send to DM" in the round chat doesn't actually call the DM. Behind the scenes it still walks through the old ready-up routine: it writes the bundled text into the host's hidden "my prompt" slot, marks the host ready, and only then asks the DM to write. The DM call reads the ready list from a copy of the data that was taken a moment earlier, so the freshly-readied line usually isn't there yet, the app decides there is nothing to answer, and nothing happens until someone taps "Generate now" — which is why it feels like two steps and two prompts.

## The fix

"Send to DM" becomes the one and only trigger. The ticked lines are handed straight to the DM as a single prompt, with no hidden ready row and no second tap.

- **One prompt, one tap.** The bundle of ticked lines is the prompt. The old ready-up bookkeeping is skipped entirely in Chat Rounds and Live DM.
- **Whatever is ticked goes.** In-character lines and table talk can both be ticked; table talk is clearly labelled as out-of-character inside the prompt so the DM treats it as banter, not action.
- **Everyone who spoke is present.** Players whose lines are in the batch are never described as holding their action. Players who said nothing get their autopilot guide line if they have one set, and are otherwise simply left out.
- **Host and co-hosts only** can tap Send, as today.
- **Batch counter on the button.** The Send button shows how many lines and how many characters are in the batch, e.g. "Send to DM (5 lines, 3 heroes)".
- **Drag to reorder.** Ticked lines can be dragged into the order the host wants the DM to read them; that order is what gets sent.
- **Locked while the DM writes.** The button is disabled during generation. Ticks made in the meantime are kept and become the next batch.
- **After sending**, the sent lines grey out as "sent" and the drawer closes so the narration is readable.
- **No undo** — a sent batch stays sent.

## Technical section

- `use-party-dm.ts`: `generateResponse` gains an optional `directPrompt` input — `{ text, participants: {userId, characterName}[] }`. When present it bypasses the `currentPrompts` / `is_ready` read completely, uses the supplied text as the round's player block, and feeds `participants` into `buildAfkGuidesContext` as covered users so absent-player lines are only produced for genuinely silent members with a guide. Everything downstream (locks via `party_round_locks`, message insert, memory, extraction) is unchanged.
- `PartyDMScreen.tsx`: `fireChatRound` drops `submitPrompt` + `setReady` and the `pendingChatFireRef` echo-fallback effect, and calls `generateResponse({ directPrompt })` directly. Guard on `isGenerating` plus the existing DB lock. The fire-key dedupe stays.
- `use-round-chat.ts`: `buildRoundPrompt` respects an explicit ordering array and includes ticked OOC lines under a labelled table-talk block regardless of the Live DM setting; exposes `selectedOrder` / `reorderSelected` and the participant list (user id + character name) for the selected batch.
- `RoundChatDrawer.tsx`: drag handles on ticked lines for ordering, counter text on the Send button, disabled state while generating, sent lines rendered greyed.
- No database or edge-function changes.
