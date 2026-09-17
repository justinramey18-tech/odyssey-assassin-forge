# Suggestions that can play off the rest of the table

## What changes

Right now "Suggest my next move" jumps straight to the alignment grid and only looks at the DM's narration. Anything a player has typed in the live chat but not yet sent to the DM is invisible to it — so you can't get suggestions that play off what someone else just said.

After this, tapping the button walks through a few quick choices before the suggestions appear.

## The new flow

1. **Tap the button** → two big choices:
   - **Do my own thing** — works exactly like today. Only the story is read; the live chat is ignored.
   - **Synergize with others** — reads the story *and* the latest unsent, in-character lines in the live chat.
2. **Only if you chose Synergize: pick who.** A list of the players who currently have an unsent in-character line, each showing their picture, character name and a snippet of what they just said. Tap to select; tap again to deselect. You can pick **one or several** — picking several asks for a move that threads all of them together. A "Everyone who spoke" shortcut selects all. Continue is disabled until at least one is picked.
3. **Alignment grid** (the existing 3×3) — unchanged.
4. **Four suggestions.**

If nobody has an unsent in-character line, the picker is skipped and Synergize quietly behaves like "Do my own thing".

## How the four suggestions differ

- **Do my own thing:** unchanged — four moves in the chosen alignment, ordered mildest to boldest ("Barely", "Mild", "Bold", "Full send").
- **Synergize:** the four split into two pairs around one shared idea, all aimed at the player(s) you picked.
  - Options 1 and 2 **cut against** what they're doing — 1 mild, 2 full send.
  - Options 3 and 4 **work with** them on the same idea — 3 mild, 4 full send.
  - Labels read "Against · Mild", "Against · Full send", "With · Mild", "With · Full send".
  - With several players picked, each suggestion must involve all of them, not just one.
  - All four still stay inside the alignment you picked.

## Details on the live chat reading

- Only unsent **in-character** lines count. Table talk is ignored so banter can't steer your character.
- Lines are labelled by who said them, with your own marked as yours, capped to the most recent handful.
- The picked players' lines are marked as the ones to react to; other players' lines still go along as background so the scene reads correctly.
- The helper is told these are unresolved — the DM hasn't reacted yet — so suggestions treat them as attempts, never as things that already worked.
- Party mode only. Solo has no live chat and nothing there changes.
- Back steps one screen at a time; Regenerate re-runs the same mode, players and alignment.

## Technical section

- `StoryMasterworkActions.tsx`: step state `'mode' | 'targets' | 'flavor' | 'results'`. `mode: 'solo' | 'sync' | null`, `targetIds: string[]`. New props `liveTableCandidates?: { userId: string; name: string; preview: string; avatarUrl?: string }[]`. Target cards min-height 104px, `touchAction: 'manipulation'`, selected = amber ring. Skip the targets step when `liveTableCandidates` is empty (mode falls back to solo). Header titles: "How do you want to play it?" → "Who are you reacting to?" → "What kind of move?" → alignment name. `fetchStoryPills` signature becomes `(flavorId?: string, mode?: 'solo' | 'sync', targetIds?: string[])`.
- `PartyDMScreen.tsx`: derive `liveTableCandidates` from `roundChat.pendingMessages` filtered to `in_character` and excluding the current user — one entry per player (their latest line), preview from `parseReply(...).body` + `stripActionCard` truncated ~90 chars, avatar from `chatAvatars.avatars[userId].ic`. `handleFetchStoryPills(flavorId?, mode?, targetIds?)`: in sync mode build `live_table_lines` (last 10 in-character pending lines, each ~400 chars, labelled `[<character_name>]`, `[You]` for self) plus `synergy_targets` (character names of `targetIds`) and `synergy_mode: true`. Add `roundChat.pendingMessages` to the dependency array.
- `empyrean-masterwork-pills/index.ts`: destructure optional `live_table_lines`, `synergy_mode`, `synergy_targets`. Story mode + live lines → `liveTableBlock` ("## AT THE TABLE RIGHT NOW (unsent, unresolved)") inserted after `narrativeBlock`, naming the synergy targets as the lines to react to. `synergy_mode` + at least one target → the intensity-ordering half of `flavorBlock` is replaced with the against/with pairing rules, the four fixed labels, and the "must involve every named player" rule for multi-select; the alignment constraint text stays and the block stays last. Without these fields the prompt is byte-identical to today.
- No database changes. Non-story categories untouched.
