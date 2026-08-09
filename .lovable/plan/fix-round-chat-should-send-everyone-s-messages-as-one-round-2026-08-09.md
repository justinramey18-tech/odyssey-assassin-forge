# Fix: Round Chat should send everyone's messages as one round

## What's happening now

In Chat Rounds and Live DM, the whole round is bundled into a single prompt and submitted under the host's name only. The DM then looks at who submitted something this round, sees only the host, and treats every other player as absent — which is why it says the other player "holds their action", even though their chat lines were typed and visible.

A second, smaller issue can drop lines entirely: the bundle only picks up messages tagged with the exact current round. If a player's message lands a moment before or after the round rolls over, it sits unsent and never reaches the DM.

## The fix

1. **Everyone who spoke counts as present.** When the round fires, the app now tells the DM which players contributed lines to that bundle. Those players are no longer treated as absent, so no more "holds their action" for someone who clearly acted. Players who genuinely said nothing still get their usual autopilot guide or "holds their action" line.

2. **Send the whole chunk.** The bundle sweeps up every unsent round-chat line, including any that were tagged to the round that just rolled over, so nothing gets stranded. Lines stay grouped per character, in order, exactly as they are today, and Live DM keeps its separate table-talk block and banter directive.

3. **Consistent across settings.** Whether the trigger is "any N messages", "N per player", "N different players", or the host tapping "Send to DM now", the same complete bundle goes out as one prompt.

## Technical section

- `use-party-dm.ts`: `generateResponse` gains an optional argument carrying the user ids covered by a chat-round bundle. Those ids are passed through to `buildAfkGuidesContext`, which excludes them from `absentMembers`, so no AFK/"Holds their action" line is generated for them.
- `use-round-chat.ts`: `pendingMessages` matches on `consumed === false` (plus the in-character/live filter) rather than requiring an exact `round_id` match, so rollover-straddling lines are included; `buildRoundPrompt` is unchanged in shape. A new `pendingUserIds` value is exported.
- `PartyDMScreen.tsx`: `fireChatRound` passes `roundChat.pendingUserIds` into `generateResponse`. No change to the trigger effects or the `party_round_locks` claim.
- No database or edge-function changes.
