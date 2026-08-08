# Narration Style Controls

Right now the feel of the story is decided entirely by the GM Guides, the DM persona, and whatever tone the DM drifts into. There is no switch that says "play this gritty" or "play this like a horror film", and quest step narration inherits nothing.

This adds a narration style you choose, and makes every DM beat — including each quest objective step — honour it.

## What you get

- A **Narration Style** control with four presets: **Serious**, **Gritty**, **Comedic**, **Horror**, plus **Default** (behaves exactly like today).
- An intensity setting — Light / Standard / Heavy — so "gritty" can be a shade or a hammer.
- Solo: the control lives in the DM tools/settings and applies to your campaign only.
- Party: the host sets it for the table, everyone sees the current style, and it syncs live to all players.
- The style rides along with every DM request, including the automatic narration beats fired when a quest is accepted and when the next objective step is narrated, so quest prose matches the rest of the session.
- Style never overrules your GM Guides or an out-of-character directive. Order stays: your OOC directives first, GM Guides second, narration style third, DM persona last.

## Style definitions

Each preset is a short, concrete writing instruction, not a vibe word — for example Gritty asks for physical consequence, fatigue, dirt and cost; Horror asks for dread built through restraint, sound and wrongness; Comedic asks for timing and character-driven humour without breaking the world. Intensity scales how strongly those instructions are stated.

## Technical notes

- New `src/lib/narrationStyle.ts`: style ids, labels, intensity levels, and a `buildNarrationStyleBlock()` that renders the prompt text.
- Solo storage: scoped key `odyssey-narration-style` registered in `scoped-keys.ts`, `resetApp.ts` and `use-auto-save.ts`, with an `odyssey-character-loaded` listener.
- Party storage: `party_shared_state` row with `state_type: 'narration_style'`, host-writable, read live by all clients in `use-party-dm.ts`.
- UI: a `SettingsSection` in `PartyDMSettings.tsx` (host-only editing, read-only display for players) and the equivalent block on the solo tools/settings surface. Presets as selectable cards, intensity as a 3-option row, min 48px touch targets.
- Request plumbing: add `narrationStyle` / `narrationIntensity` to the DM request payload in `use-party-dm.ts` and the solo path, and to the shared `CharacterContext` shape in all three declaration sites.
- `supabase/functions/ai-dm/index.ts`: emit the style block in the style-priority section — after OOC directives and GM Guides, before the DM persona and the neutral default — and reference it in the NPC-voicing lean prompt so short NPC lines stay in tone. Null-guard so an absent style changes nothing.
- `src/lib/quests.ts`: `buildQuestKickoffPrompt` and the objective-step follow-up prompt append a one-line style reminder so quest beats do not fall back to neutral narration.
