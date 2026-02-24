

## Protagonist Cards v2 -- Streamlined Implementation

### What changed from the original plan

Based on your priorities (AI parser reliability > minimal toggle clicks > quick setup > field completeness), here are the key simplifications and improvements:

### Simplification 1: Progressive Disclosure for Fields

**Problem with original plan**: Showing 11+ fields in a form is overwhelming and slows setup.

**Improvement**: Split fields into two tiers:
- **Quick Setup tier** (visible on add): Name, Race/Class, Personality, Speech Style, POV dropdown -- these are enough to start using a protagonist immediately
- **Detail tier** (expandable after save): Backstory, Goals/Conflicts, Relationships, Appearance, Flaws, Skills, Character Arc -- shown as an "Expand Details" collapsible section on each saved card

This means a user can create a usable protagonist card in under 15 seconds, then fill in rich details later.

### Simplification 2: AI Parser as Primary Creation Path

**Problem**: Having "Parse from Text" as a secondary button on an already-complex form buries the highest-value feature.

**Improvement**: The "Add Protagonist" action presents two clear paths side by side:
- **"Paste Description"** (primary, highlighted) -- opens a single large textarea + Parse button. AI fills all fields. User reviews and saves.
- **"Manual Entry"** (secondary) -- traditional form for users who prefer control.

The parser uses `google/gemini-3-flash-preview` via the Lovable AI Gateway (fast, no API key needed, structured output via tool calling). This is more reliable than Gemini Pro for structured extraction tasks and significantly faster.

### Simplification 3: Inline Toggle Chips Instead of Buried Switches

**Problem**: Toggles inside collapsible cards require expanding each card to enable/disable.

**Improvement**: Each card row shows a small colored dot (green = enabled, gray = disabled) and clicking the card name toggles it. No need to expand. For NPCs (regular character cards), same pattern: a small toggle dot next to the name.

Visual states:
- Enabled: Normal card appearance with green dot
- Disabled: Dimmed card (opacity-50) with gray dot and strikethrough name

### Simplification 4: Unified Toggle Header

**Problem**: Separate toggle switches for "include protagonists" and "include NPCs" add decision fatigue.

**Improvement**: The section headers themselves are the toggles:
- "Protagonists (2/3)" with a master switch -- disables ALL protagonist injection
- "NPCs (4)" with a master switch -- disables ALL NPC injection
- Individual cards within each section have per-card toggle dots

### Simplification 5: Merge formatProtagonistsForPrompt into buildContextBlocks

**Problem**: Original plan creates separate prompt formatting in the library AND in both edge functions -- 3 places to maintain.

**Improvement**: The edge functions receive pre-structured protagonist data and build the prompt block in ONE place (`buildContextBlocks`). The library file only handles storage CRUD.

---

### Technical Implementation

#### New Files

**1. `src/lib/protagonist-cards.ts`**
- `ProtagonistCard` interface with all fields + `enabled: boolean` (default true)
- `POVStyle = 'first' | 'third' | 'rotating'`
- CRUD: `loadProtagonistCards`, `saveProtagonistCards`, `addProtagonistCard` (max 3), `removeProtagonistCard`, `updateProtagonistCard`
- Storage key: `dnd-protagonist-cards`

**2. `src/components/scribe/ProtagonistCardEditor.tsx`**
- Crown icon section header with master toggle and count "(2/3)"
- Each card: inline toggle dot + name + POV badge + expand/collapse for detail fields
- "Add Protagonist" with two-path modal (Paste Description / Manual Entry)
- Quick Setup fields on add: Name, Race/Class, Personality, Speech Style, POV
- Detail fields (expandable per-card after save): Backstory, Goals/Conflicts, Relationships, Appearance/Mannerisms, Flaws/Weaknesses, Skills/Abilities, Character Arc
- All detail fields are inline-editable textareas with debounced save
- Gold/amber border styling

**3. `supabase/functions/parse-protagonist/index.ts`**
- Uses Lovable AI Gateway with `google/gemini-3-flash-preview`
- Structured output via tool calling (not raw JSON parsing)
- Tool definition matches `ProtagonistCard` field schema
- Auth required (same pattern as other edge functions)
- Handles 429/402 rate limit errors
- Returns parsed fields as JSON

#### Modified Files

**4. `src/lib/character-cards.ts`**
- Add `enabled?: boolean` to `CharacterCard` interface (defaults to `true` for backward compat)
- Update `formatCardsForPrompt` to filter `card.enabled !== false`

**5. `src/components/scribe/CharacterCardEditor.tsx`**
- Add toggle dot next to each card name
- Dim disabled cards (opacity-50)
- Pass `onUpdate` with `{ enabled }` on toggle click

**6. `src/components/scribe/ScribeContextPanel.tsx`**
- Import and render `ProtagonistCardEditor` above Character Cards (inside Context Pipeline collapsible)
- Only render when `novelBuilderMode` is true
- Add protagonist state management (load/save/add/remove/update)
- Master toggle switches on both section headers

**7. `src/lib/scribe-context.ts`**
- Update `buildContextBody` to accept optional `protagonistCards` parameter
- Serialize only `enabled` protagonist cards into request body
- Serialize only `enabled` character cards into request body

**8. `supabase/functions/narrative-forge/index.ts` and `supabase/functions/scribe-ai/index.ts`**
- Add `ProtagonistCardInput` interface with all enriched fields
- Update `buildContextBlocks` to accept optional `protagonistCards`
- Generate weighted PROTAGONIST PROFILES block with POV/inner monologue directives
- Protagonist block injected BEFORE regular character cards for natural priority

Prompt block format:
```text
PROTAGONIST PROFILES (PRIMARY CHARACTERS -- prioritize in narration):

[Name] ([Race/Class]) -- POV: First Person
Personality: ...
Speech Style: ...
Backstory: ...
Goals & Conflicts: ...
Relationships: ...
Appearance & Mannerisms: ...
Flaws & Weaknesses: ...
Skills & Abilities: ...
Character Arc: ...

NARRATION DIRECTIVES:
- Write from the POV of protagonist(s) above
- Include inner monologue revealing thoughts and emotional reactions
- Protagonist details take priority over supporting cast
- When multiple protagonists use "Rotating" POV, shift perspective between scenes
```

**9. Callers: `ChroniclerHomeView.tsx`, `ScribeDrawer.tsx`, `NarrativeForgeScreen.tsx`**
- Import `loadProtagonistCards` and pass to `buildContextBody`

**10. `src/hooks/use-cloud-save.ts`**
- Add `'dnd-protagonist-cards'` to `SCOPED_KEYS`

#### Summary of Efficiency Gains

| Original Plan | Simplified |
|---|---|
| 11-field add form shown all at once | 5-field quick setup, details expandable after save |
| AI parser as secondary button | AI parser as primary creation path with two-path modal |
| Toggle switches inside expanded cards | Inline toggle dots visible without expanding |
| Separate prompt formatting in 3 places | Single `buildContextBlocks` in edge functions |
| Gemini 3 Pro for parsing | Gemini 3 Flash Preview (faster, cheaper, sufficient for extraction) |

