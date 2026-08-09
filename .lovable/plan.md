# Chat Rounds: a mini party-chat that drives the AI DM

Replaces the "Round Queue" drawer with a scrollable mini chat window. Players talk to each other in it, and once enough in-character messages have been sent, those messages are bundled and sent to the AI DM as a round — no Ready button needed.

## How it works

**A new mode, not a replacement.** In party settings the host picks the round style: the current Ready-up queue (unchanged) or the new **Chat Rounds**. Everything else about party mode stays the same.

**The drawer becomes a chat.** Where the round queue is today, there's a scrollable message feed with your own compact composer (same size as today's prompt box, same character limits — nothing shrinks).

**Two heights.** Collapsed it stays a slim strip showing the latest line and a progress counter. Tapping the notch expands it to roughly half the DM chat window so the conversation is readable, and tapping again drops it back so everyone can read the DM's narration.

**In-character vs. table talk.** Each message has a small toggle: in-character (counts toward the round, gets sent to the DM) or out-of-character (banter only, never sent). In-character is the default; OOC messages are visually dimmed and marked.

**Firing the round.** The host sets both:
- *Trigger rule*: any N messages total, N messages from each player, or one message from each of N different players.
- *Message count (N)*: adjustable, 1–10.

A live counter shows progress (e.g. "3 / 4 messages until the DM responds"). When the threshold is met, the in-character messages since the last DM beat are bundled — grouped by character name, in order — and sent as the round prompt. The counter resets. The host also gets a "Send to DM now" button to fire early, and can hold the round if needed.

**Reactions.** Long-press (or tap a small face icon) on any round-chat message to add an emoji reaction, using the same emoji set and behaviour as the existing DM message reactions. Reactions are live across all players and never affect the round count.

**Live sync.** Messages, reactions and the counter update in realtime for every player, so everyone sees the round filling up.

## Notes and edge cases

- While the DM is generating, the chat stays open and usable; anything sent during generation counts toward the *next* round.
- If a player sends several messages in a row, they're merged under one character heading so the DM doesn't see them as separate turns.
- Players who don't post still appear in the DM prompt as taking no action, matching how the current queue reports absent players.
- The existing round timer, autopilot and turn-based (Couples) modes are untouched and remain tied to the classic ready-up queue.

## Technical section

- **Data**: new table `party_round_chat` (party_id, user_id, character_name, content, in_character, round_id, created_at) with grants + RLS scoped to party members via `is_party_member`, plus `party_round_chat_reactions` (message_id, party_id, user_id, sender_name, emoji) mirroring `party_message_reactions`. Both added to the realtime publication; `REPLICA IDENTITY FULL` on the chat table.
- **Settings**: stored in `party_shared_state` under a new `round_style` state type — `{ mode: 'ready' | 'chat', triggerRule, messageCount }`, host-writable, read by all members. New hook `src/hooks/use-round-style.ts`.
- **New components**: `src/components/ai-dm/RoundChatDrawer.tsx` (feed + composer + counter + expand/collapse) and a small reaction bar reusing the existing emoji list from the DM message reactions implementation.
- **Wiring**: `PartyDMScreen.tsx` renders `RoundChatDrawer` in place of the existing queue drawer when `mode === 'chat'`; the existing queue block is kept behind the `ready` branch. Bundling and dispatch live in `src/hooks/use-party-dm.ts`, reusing the existing `generateResponse` path and its `party_round_locks` claim so only one client fires a round.
- **Trigger evaluation** runs off the realtime feed against the current `round_id`, and only on the host client, to avoid duplicate fires; the lock remains the safety net.
- No changes to the AI DM edge function — the bundled text uses the same prompt format the ready-up queue already produces.
