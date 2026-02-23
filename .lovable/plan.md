

## Enhanced Scribe: Enhance Mode, Character Cards, Context Pipeline, and Smart Formatting

This plan adds four interconnected features that work together to produce AI output that reads like a seamless continuation of your existing novel, with strict consistency enforcement and voice matching.

---

### 1. Transform / Enhance Mode Toggle

A segmented control (Transform | Enhance) added to the Novel Builder, Scribe Drawer, and Narrative Forge Screen. 

- **Transform** (current behavior) -- Rewrites text into new prose from scratch
- **Enhance** -- Preserves your original text verbatim. Adds descriptive prose, sensory details, and atmosphere between and around existing content. All original dialogue stays word-for-word. New dialogue may be added only when logically consistent with the scene and characters.

### 2. Output Density Control (Word Count Multiplier)

A selector letting you target approximately 1.5x, 2x, or 3x the original word count. This tells the AI how much descriptive prose to layer on in Enhance mode (or how much to expand in Transform mode). Default is 1.5x.

### 3. Character Cards

A new localStorage-backed system for defining key characters with structured profiles. Each card includes:
- Name
- Race/Class (optional)
- Personality traits (brief)
- Speech style (e.g., "formal, archaic vocabulary" or "street slang, short sentences")

These cards are sent as a structured block in the system prompt so the AI can nail character-specific dialogue and maintain consistent voices when adding new dialogue.

**New file: `src/lib/character-cards.ts`** -- Storage helpers (load, save, add, remove, update) using scoped localStorage under key `dnd-character-cards`.

**New file: `src/components/scribe/CharacterCardEditor.tsx`** -- A small inline editor (collapsible) for managing character cards. Add/edit/delete cards with name, race/class, personality, and speech style fields.

### 4. Context Pipeline

A collapsible "Context" section in all three UIs with:

- **Campaign Summary toggle** -- Loads from existing `campaign-summary-storage`. Sent as a strict consistency enforcement block: the AI must maintain character names, relationships, locations, and world rules from it. Not background flavor -- active fact-checking.

- **Story Context selector** -- Pick any saved story. The last N words (controlled by slider) are sent as preceding narrative context for voice matching, plot continuity, character voice consistency, and emotional tone carry-over.

- **Context size slider** -- Adjustable from 1,000 to 10,000 words (default 5,000).

- **Auto-chain toggle** -- When enabled, saving/appending output to a story automatically selects that story as context for the next processing run. Creates a rolling writing pipeline.

### 5. Game Prompt Stripping

Auto-detection and removal of interactive choice blocks (A/B/C/D option lists) from input before processing. This is on by default in Enhance mode and togglable in Transform mode.

### 6. Formatting Preservation

Bold and italic markdown formatting is preserved in the output. The Enhance mode prompt explicitly instructs the AI to keep existing `**bold**` and `*italic*` formatting intact.

---

### Technical Details

#### New Files

**`src/lib/character-cards.ts`**
```typescript
interface CharacterCard {
  id: string;
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
}
// load, save, add, remove, update helpers
// localStorage key: 'dnd-character-cards' (scoped)
```

**`src/components/scribe/CharacterCardEditor.tsx`**
- Collapsible card list with add/edit/delete
- Inline form: name (required), race/class, personality, speech style
- Used inside the Context section of all three UIs

#### Modified Frontend Files

**`src/components/home/ChroniclerHomeView.tsx`**
- Add state: `processingMode` ('transform' | 'enhance'), `targetMultiplier` (1.5 | 2 | 3), `includeCampaignSummary` (boolean), `contextStoryId` (string | null), `contextWordCount` (number), `autoChainEnabled` (boolean), `stripGamePrompts` (boolean)
- Add Transform/Enhance toggle, multiplier selector, collapsible Context section with campaign summary toggle, story dropdown, word count slider, auto-chain toggle, character card editor, strip-game-prompts toggle
- Pass all new fields in request body to edge functions
- Auto-chain logic: after saving output to a story, set `contextStoryId` to that story's ID
- Helper: `getStoryTail(story, wordCount)` to extract last N words
- Helper: `stripChoiceBlocks(text)` regex to remove A/B/C/D choice prompts

**`src/components/drawers/ScribeDrawer.tsx`**
- Same state additions and UI controls (adapted for drawer layout)
- Same request body changes

**`src/components/scribe/NarrativeForgeScreen.tsx`**
- Same state additions and context controls in the processing options area
- Same request body changes

#### Modified Edge Functions

**`supabase/functions/scribe-ai/index.ts`**
- Extract `processingMode`, `campaignSummary`, `storyContext`, `characterCards`, `targetMultiplier` from request body
- When `processingMode === 'enhance'`, swap system prompt:

```text
You are a masterful narrative embellisher.
ENHANCE existing prose by adding descriptive detail, atmosphere, and sensory language AROUND the original text.

TARGET LENGTH: Aim for approximately {multiplier}x the original word count.

CRITICAL RULES:
- PRESERVE every original sentence, paragraph, and piece of dialogue VERBATIM
- Do NOT rewrite, rephrase, or reorganize existing text
- Do NOT continue the story beyond what is written
- Do NOT remove any content from the original
- ALL original dialogue must remain word-for-word unchanged
- You MAY add new dialogue that is logical within the scene context, consistent with established character voices
- ADD descriptive prose BETWEEN existing paragraphs: sensory details, atmosphere, emotional beats
- PRESERVE all **bold** and *italic* markdown formatting in the original
- Maintain the author's voice and tone
```

- When `campaignSummary` provided, prepend consistency enforcement block:
```text
CAMPAIGN REFERENCE (ENFORCE CONSISTENCY):
{summary}
You MUST maintain strict consistency with the above. Character names, relationships, locations, world rules must match. Do not contradict established facts.
```

- When `storyContext` provided, prepend continuity block:
```text
PRECEDING NARRATIVE (match voice, tone, plot continuity, character speech patterns):
{context}
```

- When `characterCards` provided, prepend character profiles:
```text
CHARACTER PROFILES (use for dialogue voice and consistency):
- {name} ({raceClass}): {personality}. Speech style: {speechStyle}
- ...
```

**`supabase/functions/narrative-forge/index.ts`**
- Add `processingMode`, `campaignSummary`, `storyContext`, `characterCards`, `targetMultiplier` to `RequestBody` interface
- In full mode, when `processingMode === 'enhance'`, swap system prompt to preservation-first rules (same structure as scribe-ai, adapted for Lovable gateway format)
- Inject campaign summary, story context, and character cards into system prompt
- Same context blocks as scribe-ai

#### Request Body Shape (both edge functions)

```typescript
body: {
  text: inputText,
  style: selectedStyle,
  intensity: toneIntensity,
  model: selectedModel,
  processingMode: 'transform' | 'enhance',
  targetMultiplier: 1.5 | 2 | 3,
  campaignSummary?: string,
  storyContext?: string,
  characterCards?: { name: string; raceClass?: string; personality: string; speechStyle: string }[],
  user_api_key?: string,
}
```

#### Auto-Chain Flow

1. User processes text with story context from "Chapter 5"
2. User clicks Save/Append to "Chapter 5"
3. If auto-chain is on, `contextStoryId` is automatically set to "Chapter 5"
4. Next processing run pulls the updated tail of "Chapter 5" as context
5. Seamless rolling pipeline -- each chunk feeds the next

#### Game Prompt Stripping (frontend helper)

```typescript
function stripChoiceBlocks(text: string): string {
  // Remove lines matching: **A.** or **A:** or A) followed by description
  // Also remove "How do you..." prompts preceding choices
  return text.replace(/\n\n\*?\*?(?:How (?:do|would|will) you.*?\??\*?\*?\s*\n)?(?:\s*\*?\*?[A-D][.):\s].*\n?)+/gi, '').trim();
}
```

### Files Summary

**Create:**
- `src/lib/character-cards.ts` -- Character card storage helpers
- `src/components/scribe/CharacterCardEditor.tsx` -- Character card management UI

**Modify:**
- `src/components/home/ChroniclerHomeView.tsx` -- Mode toggle, multiplier, context panel, auto-chain, game prompt stripping
- `src/components/drawers/ScribeDrawer.tsx` -- Same additions (drawer layout)
- `src/components/scribe/NarrativeForgeScreen.tsx` -- Same additions (full screen layout)
- `supabase/functions/scribe-ai/index.ts` -- Enhance mode prompt, context injection, character cards, multiplier
- `supabase/functions/narrative-forge/index.ts` -- Enhance mode prompt, context injection, character cards, multiplier

