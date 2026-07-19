## The bug in plain language

On the party DM screen, the textbox and the green Ready button are two separate steps today:

1. Type your action → tap the little **arrow / Send** button (this actually files your action into the round).
2. Then tap **Ready**.

If you type an action and then tap **Ready** *without* first tapping Send, the app throws away what you typed and files you as "Ready (No Action)". That's exactly what the screenshot shows — text is sitting in the box, but the button still says "Ready (No Action)" and Candace is checked in with no action.

The Ready button is hard-wired to the "no action" path. It never looks at the textbox.

## The fix

Make the green Ready button smart about the textbox:

- **When the textbox is empty** → button reads **"Ready (No Action)"** and behaves exactly as it does today (file the player as ready with nothing to do).
- **When there is typed text** → button reads **"Ready"** (drops the "No Action" tag), and tapping it:
  1. Files the typed text as that player's action (same code path as tapping the Send arrow), then
  2. Marks them ready.
  3. Clears the textbox draft so the next round starts clean.

That's it — one button, two behaviors driven by whether the textbox has content. Users no longer have to remember the two-tap Send-then-Ready dance.

### Where the change lives (technical note)

Single file: `src/components/ai-dm/PartyDMInput.tsx`.

- The component already tracks the draft text (`input`) and already has a `handleSubmit` that calls `onSubmit(text)` and clears the draft.
- Change the Ready `<Button>`'s label to depend on `input.trim()` (same condition the Send arrow already uses to enable itself).
- Change its `onClick` to: if `input.trim()` is non-empty, call `handleSubmit()` first, then `onReady()`; otherwise just `onReady()` (today's behavior).
- The AFK-guide variant (which shows "No Action" + "Autopilot" side-by-side) gets the same treatment on the "No Action" button so it flips to "Ready" when text is present.

No changes to `PartyDMScreen.tsx`, the `use-party-dm` hook, the database, or the ready/round-queue logic — those already handle "submit then ready" correctly (that's what the Autopilot path does at line 1593-1594).

### Verification

- Type text → button label flips to "Ready", Send arrow stays enabled.
- Tap Ready with text → row in Round Queue shows "Ready (with action)" and the typed prompt, textbox clears.
- Tap Ready with empty textbox → row shows "Ready (no action)" exactly like today.
- Send arrow still works on its own for players who prefer the two-tap flow.
