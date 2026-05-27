# Fix: Solo signet pill does nothing when sending a prompt

## What's actually broken

When you tap "Use My Signet" and pick an intensity, the app correctly arms it in state and shows the "Signet armed" toast. But when you then type your prompt and hit send, the burnout meter never moves and the AI DM never sees that you channeled your signet.

## Root cause (in plain terms)

There are two send paths in the solo Empyrean screen:

1. A function called `handleSend` that knows about the armed signet — it adds the burnout, tags the message with `[SIGNET CHANNELED — intensity N/8]` so the AI narrates it, and clears the armed state.
2. The actual input box at the bottom of the screen, whose "send" button is wired to a *different* inline function that just forwards the raw text to the AI.

The input box was never hooked up to `handleSend`. So every prompt you send from the main input bypasses the entire signet logic. `handleSend` exists but is effectively dead code for normal sends — it's only used by a couple of internal helpers.

That's why:
- Burnout meter doesn't update (the line that adds intensity is never reached).
- The AI shows no awareness you channeled (the `[SIGNET CHANNELED]` tag is never appended).
- The "armed" state silently sticks around until something else clears it.

## The fix

Replace the inline `onSend` on the input box so it calls `handleSend()` instead of doing its own thing. `handleSend` already:
- Reads the typed text from the input ref.
- Applies threshing-authorized prefix when relevant.
- Applies the armed signet intensity (adds burnout, appends the channel tag, clears the armed state, marks the round as "signet used" so recovery is skipped).
- Handles single and multi-`@NPC` voicing.
- Clears the input after sending.

So routing the input's send button through `handleSend` restores all signet behavior with no other changes.

## One small consistency tweak

The inline handler currently uses a slightly different `@NPC` regex than `handleSend` (it only matches a single NPC mention; `handleSend` supports multiple). Using `handleSend` is strictly an improvement — multi-NPC voicing keeps working, threshing keeps working, normal sends keep working.

## Files touched

- `src/components/empyrean/EmpyreanDMScreen.tsx` — change the `EmpyreanDMInput`'s `onSend` prop (around line 2171) to invoke `handleSend()`.

No DB changes, no other components touched, no impact on party mode (party has its own separate fix already shipped).

## How to verify

1. Arm signet at intensity 4, type any action, send. Burnout should jump by exactly 4 and the DM's reply should clearly reference your signet's power.
2. Send a normal message with no signet armed. Nothing about burnout changes from your action; recovery (-1) still applies on the next round.
3. Send `@SomeNpc hello` — still routes to NPC voicing.
4. Threshing-authorized send still works.
