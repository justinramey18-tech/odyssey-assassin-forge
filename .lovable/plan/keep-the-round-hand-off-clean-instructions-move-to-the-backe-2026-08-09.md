# Keep the round hand-off clean: instructions move to the backend, chaos gets a dial

## What changes for players

Right now, when the host sends a batch of chat lines to the DM, the hand-off carries a block of hidden stage directions ("OOC: LIVE TABLE MODE…", formatting rules, banter guidance). Those instructions end up visible in the party chat transcript alongside the actual player lines.

After this change, the transcript shows only what people actually typed — character lines and table talk, grouped and labelled as they are today. All the behavioural rules live in the backend and are applied automatically for the mode you're in.

## The chaos dial

The Light / Balanced / Heavy banter picker in party settings is replaced by a 1-10 **Chaos Intensity** slider, same feel as the one in the combat prompt builder, with a short label under it describing the current level.

To answer the question directly: this is a comedy dial, not a costume swap. The DM stays your DM and keeps running your campaign, your GM Guides and your narration style — the slider decides how much Deadpool-flavoured energy it brings.

- **1-3 — Straight bat.** Barely acknowledges the banter, plays the scene clean.
- **4-7 — Live table host.** Quick quips and asides to the table, teasing by name, then straight back into the fiction.
- **8-10 — Full chaos.** Openly Deadpool-ish: fourth-wall winks, riffing on the players themselves, comedic exaggeration in the narration itself — while still delivering a real scene beat and never breaking your established world facts.

The dial affects both the table-side asides and the tone of the narration, and it applies in both Chat Rounds and Live DM whenever a hand-off happens.

## Notes and edge cases

- GM Guides, OOC directives and world-state canon still outrank the chaos dial; high chaos changes the delivery, never the facts or the rules.
- Table talk is still clearly marked as out-of-character, and characters still never "hear" it — that rule moves to the backend rather than disappearing.
- The `[TABLE] … [/TABLE]` aside format and the narrate/play-all buttons keep working exactly as they do now.
- Existing parties on Light / Balanced / Heavy are mapped to 2 / 5 / 8 on the new slider so nothing feels different until the host moves it.
- A hand-off with only table talk and no character lines still gets a short conversational reply instead of a forced scene beat.

## Technical section

- `src/hooks/use-round-chat.ts`: `RoundStyle.banterLevel` becomes `chaosLevel: number` (1-10, default 5) with migration from the old three values in `parseStyle`. `buildRoundPrompt` drops the `directive` / `note` blocks entirely and returns only the grouped in-character block plus the `TABLE TALK` block — no OOC instructions. `BANTER_INSTRUCTIONS` is deleted here.
- `src/components/ai-dm/PartyDMSettings.tsx`: the banter `Select` is swapped for a shadcn `Slider` (1-10) with a live label, writing `chaosLevel` through `onRoundStyleChange`. Applies to both `chat` and `live` modes.
- `src/hooks/use-party-dm.ts`: `generateResponse` accepts the round style's `mode` and `chaosLevel` alongside `directPrompt` and forwards them to `streamAIResponse`, which adds `liveTable: { mode, chaosLevel, hasTableTalk }` to the `ai-dm` request body.
- `supabase/functions/ai-dm/index.ts`: new optional `liveTable` field on `DMRequest`; `buildDMSystemPrompt` gains a section that emits the table-talk rules, the `[TABLE]` format rule and a chaos-tier persona block (tiers 1-3 / 4-7 / 8-10) — placed below GM Guides and canon so those still win.
- `src/components/ai-dm/PartyDMScreen.tsx`: passes `roundChat.style` through when firing a round. No database or table changes; `round_style` is stored as JSON in `party_shared_state`, so the new field needs no migration.
