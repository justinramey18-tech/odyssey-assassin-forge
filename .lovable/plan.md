

# Party DM Response Mode System

## Overview
Add a response mode selector to Party DM settings that lets the host choose from 10 preset modes controlling AI output length and content format. Include an advanced custom mode builder using length + content type combination.

## Architecture

The response mode will be stored in `DmSessionConfig.responseMode` (persisted in `party_shared_state` with `state_type: 'dm_session'`). No database migration needed — it's just a new field in the existing JSON `state_data` column.

The prompt modifier is injected into the `guides` string passed to `streamAIResponse` in `use-party-dm.ts`, same pattern as AFK guides and party member summaries.

## Files to Create

### `src/lib/dm-response-modes.ts`
Define types (`ResponseLength`, `ContentType`, `ResponseMode`), length specs (micro/snippet/standard/detailed/epic with word ranges), content specs (balanced/combat/dialogue/environment/lore/compressed), and 10 preset modes:

1. **Quick Action** ⚡ — micro + balanced (10-20 words)
2. **Combat Turn** ⚔️ — snippet + combat (30-50 words, bullet format)
3. **Standard Scene** 🎬 — standard + balanced (75-125 words)
4. **NPC Conversation** 💬 — detailed + dialogue (150-250 words)
5. **Boss Moment** 👑 — epic + environment (300-500 words)
6. **Fast Montage** ⏭️ — micro + compressed (10-20 words)
7. **Journey Summary** 🗺️ — snippet + compressed (30-50 words)
8. **Rich Exploration** 🔍 — detailed + environment (150-250 words)
9. **Lore Reveal** 📜 — standard + lore (75-125 words)
10. **Epic Climax** 🌟 — epic + balanced (300-500 words)

Export `getCustomModeModifier(length, content)` and `getResponseModeById(id)` helpers.

## Files to Edit

### `src/hooks/use-party-dm.ts`
- Add `responseMode?: string` to `DmSessionConfig` interface
- In `generateResponse` (normal mode, ~line 1221-1227): read `sessionConfig.responseMode`, look up the preset, and append its `promptModifier` to the `guides` string
- In split mode (~lines 1067-1075, 1112-1118): same injection into alpha/beta guides

### `src/components/ai-dm/PartyDMSettings.tsx`
- Add props: `responseMode?: string`, `onResponseModeChange?: (modeId: string | null) => void`
- Add new `SettingsSection` titled "Response Style" (creator-only) after Session Controls
- Render a 2-column grid of 10 preset mode cards (icon + name + word range), with selected state styling matching the existing DM Mode selector pattern
- Add "Advanced" toggle that reveals a custom builder with:
  - 5-option length slider (micro → epic)
  - 6 content type chip buttons
  - Live preview of combined mode name
- "None" option to disable (use default immersive style)

### `src/components/ai-dm/PartyDMScreen.tsx`
- Wire `responseMode` and `onResponseModeChange` props to `PartyDMSettings`
- `onResponseModeChange` calls `partyDm.updateSessionConfig({ responseMode: modeId })` (same pattern as `dmMode`)

## Technical Details

- Default: `undefined` (no mode = existing immersive style, no word limits)
- Custom combos stored as `"custom:detailed:combat"` string format in sessionConfig
- The prompt modifier is appended as a `## RESPONSE FORMAT` section in the guides string, positioned last so it takes priority
- All 10 presets + custom combos resolve to a single `promptModifier` string at generation time

