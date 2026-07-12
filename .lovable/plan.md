
## What's happening today

Your party session runs in rounds. When the AI finishes a response, the app immediately:

1. Starts a fresh round (new round ID, all prompts cleared).
2. In Couples/turn-based mode, flips the turn to the other player.

So when you deleted the AI response by mistake, the "AI response is gone" but the round has already moved on — the other player is now on the clock, and your resubmitted prompt has nowhere to land. There is currently no button to rewind that.

Separately, when a player writes dialogue in their prompt (e.g. `"I told him: 'Hand over the key or I'll break it off you.'"`), the AI paraphrases it in its narration instead of quoting the player's exact words. There is no instruction in the DM's rulebook that says "use player dialogue verbatim."

## What I'll change

### 1. Host-only "Take turn back" / "Redo my turn" control

In the party DM tools drawer (host only), add a new **Round Controls** section with two actions:

- **Take my turn back** — visible only in Couples/turn-based mode. Sets the current turn back to the host, so they can submit again. Confirmation dialog first so it isn't hit accidentally.
- **Redo last round** — visible in any party mode. Deletes the most recent AI response (if it's still there) *and* the most recent player prompt message that preceded it, clears any lingering prompt submissions for the current round, starts a fresh round, and (in turn-based mode) sets the turn back to whoever went last. This is the "I fat-fingered delete, give me a real do-over" button.

Both actions are gated to the host and show a "Host only" note. Non-hosts get nothing new. This is the temporary override you asked for — no schema changes, just orchestrating existing round/turn state that already exists in the session config.

I will also surface a small **"⟲ Redo last round"** shortcut directly on the DM's most recent message bubble for the host, so it's one tap away right where the mistake usually happens (right where the delete button lives now).

### 2. Preserve player dialogue verbatim

Update the DM's rulebook (the system prompt used for both the normal party DM and the Couples/turn-based party DM) to add an explicit rule:

> **Player-written dialogue is sacred.** When a player's prompt contains quoted speech (anything inside `"..."`, `'...'`, or `“...”`), reproduce those exact words verbatim inside the narration as that character's spoken line. Do not paraphrase, shorten, or rewrite it. Build the surrounding scene — tone, reaction, NPC response — around the player's exact words. Only paraphrase if the player clearly wrote a summary of intent instead of actual dialogue (e.g. "I try to talk him down" with no quotes).

I'll also add a shorter version of the same rule for the AFK/auto-pilot flow and the dialogue-mode flow so it applies everywhere the AI responds to a player.

## Out of scope

- No changes to how rounds are stored in the database.
- No changes to the AI model itself, just its instructions.
- No changes for non-host players — the turn override is a host-only tool by design.

## Files I expect to touch

- `src/hooks/use-party-dm.ts` — add a `redoLastRound` / `reclaimTurn` action.
- `src/components/ai-dm/PartyDMSettings.tsx` (tools drawer) — new Round Controls section.
- `src/components/ai-dm/PartyDMScreen.tsx` — wire props + optional "Redo last round" affordance on the last DM message.
- `supabase/functions/ai-dm/index.ts` — add the "verbatim dialogue" rule to the system prompt.
