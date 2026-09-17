# Suggestions that can play off the rest of the table

## What changes

Right now "Suggest my next move" jumps straight to the alignment grid and only looks at the DM's narration. Anything a player has typed in the live chat but not yet sent to the DM is invisible to it — so you can't get suggestions that play off what someone else just said.

After this, tapping the button walks through two quick choices before the suggestions appear.

## The new flow

1. **Tap the button** → a screen with two big choices:
   - **Do my own thing** — works exactly like today. Only the story is read; the live chat is ignored.
   - **Synergize with others** — reads the story *and* the latest unsent, in-character lines in the live chat.
2. **Alignment grid** (the existing 3×3) — unchanged.
3. **Four suggestions.**

## How the four suggestions differ

- **Do my own thing:** unchanged — four moves in the chosen alignment, ordered mildest to boldest ("Barely", "Mild", "Bold", "Full send").
- **Synergize:** the four split into two pairs around one shared idea.
  - Options 1 and 2 **cut against** what the other players are doing — 1 is the mild version, 2 is the full-send version.
  - Options 3 and 4 **work with** them on the same idea — 3 mild, 4 full send.
  - Labels read "Against · Mild", "Against · Full send", "With · Mild", "With · Full send".
  - All four still stay inside the alignment you picked.

## Details on the live chat reading

- Only unsent **in-character** lines count. Table talk is ignored so banter can't steer your character.
- Lines are labelled by who said them, with your own marked as yours, capped to the most recent handful.
- The helper is told these are unresolved — the DM hasn't reacted yet — so suggestions treat them as attempts, never as things that already worked.
- If nobody has an unsent in-character line, Synergize falls back to normal story-only suggestions rather than inventing a partner.
- Party mode only. Solo has no live chat and nothing there changes.
- Back and Regenerate keep working, returning to the step before and re-running the same mode plus alignment.

## Technical section

- `StoryMasterworkActions.tsx`: add a `mode` step before the flavour grid. State `mode: 'solo' | 'sync' | null`; header title "How do you want to play it?" → then the existing "What kind of move?" → then the alignment name. Two cards (min-height 104px, `touchAction: 'manipulation'`) for the two choices. Back steps flavour → mode → closed; Regenerate re-runs with the stored `{mode, flavorId}`. `fetchStoryPills` signature becomes `(flavorId?: string, mode?: 'solo' | 'sync')`.
- `PartyDMScreen.tsx` → `handleFetchStoryPills(flavorId?, mode?)`: when `mode === 'sync'`, build `liveTableLines` from `roundChat.pendingMessages` filtered to `in_character`, last 10, each capped ~400 chars, body via `parseReply(...).body` + `stripActionCard`, labelled `[<character_name>]` (`[You]` for the current user). Pass `live_table_lines` and `synergy_mode: true` in the invoke body only in sync mode. Add `roundChat.pendingMessages` to the dependency array.
- `empyrean-masterwork-pills/index.ts`: destructure optional `live_table_lines` and `synergy_mode`. When story mode and `live_table_lines` is non-empty, add a `liveTableBlock` ("## AT THE TABLE RIGHT NOW (unsent, unresolved)") after `narrativeBlock`. When `synergy_mode` and live lines exist, replace the intensity-ordering half of `flavorBlock` with the against/with pairing rules and the four fixed labels; the alignment constraint text stays. Without these fields the prompt is byte-identical to today.
- No database changes. Non-story categories untouched.
