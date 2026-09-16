# Suggestions that read the live table, not just the story

## What changes

Right now "Suggest my next move" only looks at the DM's narration and the messages already handed to the DM. Anything a player has typed in the live chat but not yet sent to the DM is invisible to it — so you can't get suggestions that play off what someone else just said at the table.

After this, the suggestion helper also reads the most recent unsent, in-character lines in the live chat. If another player just shouted a threat or grabbed the door handle, your four suggestions can answer that directly.

## Details

- Only unsent in-character lines are included. Table talk (out-of-character banter) is ignored, so it can't steer your character's options.
- Lines are labelled by who said them, with your own lines marked as yours.
- Capped to the most recent handful of lines so the helper isn't flooded; the DM's narration stays the primary context and the live lines sit underneath it as "what's happening at the table right now, not yet narrated".
- The helper is told these are unresolved: the DM has not reacted to them yet, so suggestions should respond to them as things being attempted, never as things that already succeeded.
- When the chat is empty or nobody has an unsent in-character line, the behaviour is exactly as it is today.
- Party mode only — solo has no live chat, and nothing there changes.

## Technical section

- `PartyDMScreen.tsx` → `handleFetchStoryPills`: after building `recentNarrative`, build `liveTableLines` from `roundChat.pendingMessages` filtered to `in_character`, take the last 10, cap each at ~400 chars, strip the action-card/reply tokens the DM formatter already strips (reuse `parseReply(...).body`), label each `[<character_name>]` with the current user's own lines as `[You]`, join with newlines. Pass as a new optional `live_table_lines` string in the invoke body. Add `roundChat.pendingMessages` and `currentUserId` to the `useCallback` dependency array.
- `empyrean-masterwork-pills/index.ts`: destructure optional `live_table_lines`; when `isStoryMode` and it is a non-empty string, build a `liveTableBlock` ("## AT THE TABLE RIGHT NOW (unsent, unresolved)" + the lines + the instruction that these are attempts the DM has not yet resolved). Insert it into the story prompt array immediately after `narrativeBlock` and before `flavorBlock`, so the flavour instruction stays last. Absent → prompt byte-identical to today.
- No database changes. Non-story categories untouched.
