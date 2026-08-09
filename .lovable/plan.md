# Live DM — a third round style for party chat

Adds a "Live DM" option next to Ready-up and Chat Rounds. It works like Chat Rounds, but the table's out-of-character banter is sent to the DM too, and the DM is told to run the table like a live improv game master who riffs on the jokes before getting back to the scene.

## What the host sees

Party Settings → Round Style now offers three choices:

1. **Ready-up queue (classic)** — unchanged.
2. **Chat Rounds** — unchanged; only in-character lines reach the DM.
3. **Live DM** — everything in the round chat reaches the DM: in-character actions and table talk.

When Live DM is picked, two extra host controls appear underneath:

- **Banter level** — Light, Balanced, or Heavy. Controls how much the DM plays with the table talk. Light: a passing nod at most. Balanced: a quick quip or aside, then the scene. Heavy: leans into the bit, teases players by name, riffs before steering back.
- **Which messages count toward the round** — either "All messages count" (banter advances the counter too) or "Only in-character messages count" (banter rides along for flavour but doesn't trigger the DM). The existing trigger rule and 1–10 threshold keep working on top of this.

## What the players see

The round chat mini-window is identical: same feed, same in-character / table-talk toggle, same emoji reactions, same expand and collapse. The only visible difference in Live DM is the progress line, which reads e.g. "3 of 4 messages until the DM responds" and, when banter is excluded, notes that table talk doesn't count.

## What the DM receives

The bundle sent at the end of a round keeps in-character lines grouped per character as they are now, and appends the table talk in its own clearly marked section so the DM can tell the two apart:

```text
[Ramey]: I kick the door in.
[Sera]: Right behind you, blade out.

TABLE TALK (out of character):
Ramey: lol he's going to die again
Sera: 5 gold says the door is a mimic
```

A short instruction rides in front of it telling the DM it is running a live table in the vein of Anthony Burch — quick, warm, improv-minded — that table talk is real people at the table and not the characters, that it should react to the banter at the chosen intensity without letting the characters hear it, and that after the aside it must deliver a proper scene beat. Character actions still come only from the in-character lines; banter never becomes something a character did.

If a round contains only banter and no in-character lines, the DM is asked for a short table-side response rather than a full scene beat.

## Technical notes

- `src/hooks/use-round-chat.ts`: extend `RoundStyleMode` with `'live'`, add `banterLevel` ('light' | 'balanced' | 'heavy') and `countBanter` (boolean) to `RoundStyle` and `parseStyle` with safe defaults. Widen `pendingMessages` to include out-of-character rows when mode is `live`, and drive `progress` off in-character-only or all pending rows per `countBanter`. `buildRoundPrompt` gains the persona preamble (an `OOC:`-prefixed block, which the `ai-dm` function already treats as top authority) plus the `TABLE TALK` section; `consumePending` marks every included row consumed.
- `src/components/ai-dm/PartyDMSettings.tsx`: add the third Select option and the two Live-DM-only controls; label copy for non-hosts.
- `src/components/ai-dm/PartyDMScreen.tsx`: change `chatRoundsOn` to cover both `'chat'` and `'live'` so the existing gating, drawer render, and host trigger effect apply to Live DM unchanged.
- `src/components/ai-dm/RoundChatDrawer.tsx`: progress wording tweak for the banter-excluded case; no other changes.
- No database migration — the new fields live inside the existing `round_style` row in `party_shared_state`.
