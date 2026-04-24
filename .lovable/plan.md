

## Why the Director can't change anything (and why the AI DM doesn't see it)

### The functional bug

When you tap **Confirm** on a Director suggestion, nothing actually saves. The card disappears, you get a friendly toast, and the AI DM never finds out anything happened.

In plain terms: the Director chat is correctly proposing changes, but the "apply this change" wire was never connected. The Confirm button is still running the placeholder behavior from earlier development — the one that says "yes, I'll pretend I did it" without writing to memory anchors, the campaign summary, the dragon personality, or anywhere else.

That's why the AI DM, when you asked OOC, knew nothing about your fart memory: the memory was never saved. It was acknowledged in the Director chat and immediately discarded.

### The "third-year cadet" expectation is separate

Even after the wire is fixed, "change me from a first-year to a third-year cadet" won't directly rewrite the year field on your character sheet. That field (`yearAtBasgiath`) is set during campaign setup and isn't one of the seven things the Director can edit.

What the Director *can* do for that request:
- Pin a **memory anchor** like "The rider has been promoted to third-year cadet, mid-campaign."
- Update the **campaign summary** to reflect the time skip and new rank.

Both of those will make the AI DM treat you as a third-year going forward — but the cosmetic year value on your character setup screen will still read "first-year" until you reconfigure the campaign manually. I'll mention this in the toast/confirmation copy so it's clear.

---

## The fix

### 1. Connect the Confirm button to real save actions
In the Empyrean DM screen, add the dispatcher that actually performs each of the 7 action types:
- **Install/disable/delete guide** → use the existing GM Guides system (already loaded in the screen).
- **Update campaign summary** → save to the Empyrean-specific summary key (NOT the default one — important so the right AI session reads it).
- **Pin memory anchor** → call the existing dragon bond memory function.
- **Update dragon personality** → update the dragon notes state and persist via the existing save helper.
- **OOC passthrough** → drop the note into the input bar prefixed with "(out of character: …)" for you to review and send.

Each of these uses functions that *already exist* in the codebase and are *already used* elsewhere — we're just calling them from a new place.

### 2. Wire it through to the Director chat
Pass the new dispatcher down through the Character Sheet to the Director chat component. Once it's connected, Confirm will:
- Actually save the change.
- Show a success toast naming what changed.
- Auto-dismiss the card.
- Re-throw on failure so the card stays visible if something breaks (so you can retry).

### 3. Use the right campaign summary storage
The Empyrean DM uses its own summary key (`empyrean-dm-campaign-summary`), separate from the regular Solo DM. The Director must save to that one or the Empyrean AI won't see updates. The dispatcher will pass the Empyrean key explicitly to the save function.

### 4. Mid-campaign year promotions
For requests like the third-year change, the Director already proposes either a guide or a memory anchor — that path is fine and will start working as soon as the wire is connected. No new action type needed.

---

## Files touched

- `src/components/empyrean/EmpyreanDMScreen.tsx` — add the dispatcher function and pass it to `<CharacterSheet>` as `onConfirmDirectorAction`.

That's it. No edge function changes, no new hooks, no schema work. One file.

---

## How you'll know it's working

After deploy:
1. Open Talk to the DM. Say *"Pin a memory that I farted in fear during my first dragon flight."*
2. Tap Confirm. Toast: **"Memory anchor pinned."**
3. Switch to the main DM. Ask OOC *"What memory anchors do you have?"* — the fart should appear.
4. Say *"Update the campaign summary to note I'm now a third-year cadet."* → Confirm → main DM treats you as third-year.

